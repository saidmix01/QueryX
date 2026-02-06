use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{OnceCell, RwLock};
use uuid::Uuid;
use urlencoding::encode;

use crate::domain::{
    Connection, ConnectionRepository, ConnectionStatus, CreateConnectionDto, CredentialStore,
    DatabaseEngine, DomainError, SqlDriver, UpdateConnectionDto,
};
use crate::infrastructure::drivers::DriverFactory;
use crate::infrastructure::FileConnectionRepository;

#[derive(Clone)]
pub struct ActiveConnection {
    pub driver: Arc<dyn SqlDriver>,
    pub status: ConnectionStatus,
    pub current_database: Option<String>,
    pub current_schema: Option<String>,
}

/// Caso de uso para gestión de conexiones
pub struct ConnectionUseCase {
    data_dir: PathBuf,
    connection_repo: OnceCell<Arc<dyn ConnectionRepository>>,
    credential_store: Arc<dyn CredentialStore>,
    driver_factory: DriverFactory,
    active_connections: Arc<RwLock<HashMap<Uuid, ActiveConnection>>>,
}

impl ConnectionUseCase {
    pub fn new_lazy(
        data_dir: PathBuf,
        credential_store: Arc<dyn CredentialStore>,
    ) -> Self {
        Self {
            data_dir,
            connection_repo: OnceCell::new(),
            credential_store,
            driver_factory: DriverFactory::new(),
            active_connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn get_repo(&self) -> Result<&Arc<dyn ConnectionRepository>, DomainError> {
        self.connection_repo
            .get_or_try_init(|| async {
                let repo = FileConnectionRepository::new(self.data_dir.clone()).await?;
                Ok(Arc::new(repo) as Arc<dyn ConnectionRepository>)
            })
            .await
    }

    pub async fn get_all_connections(&self) -> Result<Vec<Connection>, DomainError> {
        let repo = self.get_repo().await?;
        repo.get_all().await
    }

    pub async fn get_connection(&self, id: Uuid) -> Result<Connection, DomainError> {
        let repo = self.get_repo().await?;
        repo.get_by_id(id)
            .await?
            .ok_or_else(|| DomainError::ConnectionNotFound { id: id.to_string() })
    }

    pub async fn create_connection(&self, dto: CreateConnectionDto) -> Result<Connection, DomainError> {
        if dto.name.trim().is_empty() {
            return Err(DomainError::validation("Connection name is required"));
        }

        if dto.engine != DatabaseEngine::SQLite && dto.host.is_none() {
            return Err(DomainError::validation("Host is required for this database type"));
        }
        
        // Validate port number for server-based databases
        if dto.engine != DatabaseEngine::SQLite {
            if let Some(port) = dto.port {
                if port == 0 || port > 65535 {
                    return Err(DomainError::validation("Port must be between 1 and 65535"));
                }
            }
        }
        
        // SQLite requires database or file_path
        if dto.engine == DatabaseEngine::SQLite && dto.database.is_none() && dto.file_path.is_none() {
            return Err(DomainError::validation("Database file path is required for SQLite"));
        }

        let password = dto.password.clone();
        let repo = self.get_repo().await?;
        let connection = repo.create(dto).await?;

        if let Some(pwd) = password {
            self.credential_store.store(connection.id, &pwd).await?;
        }

        Ok(connection)
    }

    pub async fn update_connection(&self, id: Uuid, dto: UpdateConnectionDto) -> Result<Connection, DomainError> {
        let password = dto.password.clone();
        let repo = self.get_repo().await?;
        let connection = repo.update(id, dto).await?;

        if let Some(pwd) = password {
            self.credential_store.update(id, &pwd).await?;
        }

        Ok(connection)
    }

    pub async fn delete_connection(&self, id: Uuid) -> Result<(), DomainError> {
        self.disconnect(id).await.ok();
        self.credential_store.delete(id).await.ok();
        let repo = self.get_repo().await?;
        repo.delete(id).await
    }

    pub async fn test_connection(&self, id: Uuid) -> Result<(), DomainError> {
        let connection = self.get_connection(id).await?;
        let password = self.credential_store.retrieve(id).await?.unwrap_or_default();
        let conn_string = self.build_connection_string(&connection, &password);

        let driver = self.driver_factory.create_new_driver(&connection.engine);
        driver.test_connection(&conn_string).await
    }

    pub async fn connect(&self, id: Uuid) -> Result<(), DomainError> {
        // Idempotencia y prevención de duplicados
        {
            let active = self.active_connections.read().await;
            if let Some(conn) = active.get(&id) {
                match conn.status {
                    ConnectionStatus::Connected => return Ok(()),
                    ConnectionStatus::Connecting => return Err(DomainError::connection("Connection already in progress")),
                    _ => {}
                }
            }
        }

        // Limpiar conexión previa si existe
        self.disconnect(id).await.ok();

        let connection = self.get_connection(id).await?;
        let password = self.credential_store.retrieve(id).await?.unwrap_or_default();
        let conn_string = self.build_connection_string(&connection, &password);
        
        tracing::info!("Connecting with string: {}", conn_string.replace(&password, "***"));
        tracing::info!("Connection details - port: {:?}, host: {:?}", connection.port, connection.host);

        let driver: Arc<dyn SqlDriver> = Arc::from(self.driver_factory.create_new_driver(&connection.engine));
        
        // Marcar como Connecting
        {
            let mut active = self.active_connections.write().await;
            active.insert(id, ActiveConnection {
                driver: driver.clone(),
                status: ConnectionStatus::Connecting,
                current_database: connection.get_default_database(),
                current_schema: None, // Por defecto no hay schema seleccionado explícitamente (o es public)
            });
        }

        match driver.connect(&conn_string).await {
            Ok(()) => {
                let mut active = self.active_connections.write().await;
                if let Some(conn) = active.get_mut(&id) {
                    conn.status = ConnectionStatus::Connected;
                    // Actualizar el contexto inicial si es posible
                    if connection.engine == DatabaseEngine::PostgreSQL {
                         conn.current_schema = Some("public".to_string());
                    }
                }
                
                let repo = self.get_repo().await?;
                repo.update_last_connected(id).await?;
                Ok(())
            }
            Err(e) => {
                let mut active = self.active_connections.write().await;
                if let Some(conn) = active.get_mut(&id) {
                    conn.status = ConnectionStatus::Error(e.to_string());
                }
                Err(e)
            }
        }
    }

    pub async fn disconnect(&self, id: Uuid) -> Result<(), DomainError> {
        let mut active = self.active_connections.write().await;
        if let Some(conn) = active.remove(&id) {
            conn.driver.disconnect().await?;
        }
        Ok(())
    }

    pub async fn get_connection_status(&self, id: Uuid) -> ConnectionStatus {
        let active = self.active_connections.read().await;
        active.get(&id)
            .map(|c| c.status.clone())
            .unwrap_or(ConnectionStatus::Disconnected)
    }

    pub async fn get_active_driver(&self, id: Uuid) -> Result<Arc<dyn SqlDriver>, DomainError> {
        let active = self.active_connections.read().await;
        active.get(&id)
            .filter(|c| c.status == ConnectionStatus::Connected)
            .map(|c| c.driver.clone())
            .ok_or_else(|| DomainError::connection("Connection not active"))
    }
    
    /// Retorna el contexto activo (database, schema) de una conexión
    pub async fn get_active_context(&self, id: Uuid) -> Option<(Option<String>, Option<String>)> {
        let active = self.active_connections.read().await;
        active.get(&id)
            .map(|c| (c.current_database.clone(), c.current_schema.clone()))
    }

    /// Cambia la base de datos activa
    /// Para PostgreSQL/MySQL esto implica reconectar o ejecutar USE (dependiendo de la implementación)
    /// Aquí optamos por reconectar para garantizar aislamiento completo
    pub async fn change_database(&self, id: Uuid, database_name: String) -> Result<(), DomainError> {
        let mut connection = self.get_connection(id).await?;
        
        // Verificamos si realmente necesitamos cambiar
        {
            let active = self.active_connections.read().await;
            if let Some(conn) = active.get(&id) {
                if conn.current_database.as_ref() == Some(&database_name) {
                    return Ok(());
                }
            } else {
                 return Err(DomainError::connection("Connection not active"));
            }
        }

        // Modificamos temporalmente la configuración para conectar a la nueva DB
        connection.database = Some(database_name.clone());
        let password = self.credential_store.retrieve(id).await?.unwrap_or_default();
        let conn_string = self.build_connection_string(&connection, &password);
        
        // Creamos nuevo driver y conectamos
        let new_driver: Arc<dyn SqlDriver> = Arc::from(self.driver_factory.create_new_driver(&connection.engine));
        
        // Desconectamos el anterior
        self.disconnect(id).await?;
        
        // Registramos el nuevo (Connecting)
        {
            let mut active = self.active_connections.write().await;
             active.insert(id, ActiveConnection {
                driver: new_driver.clone(),
                status: ConnectionStatus::Connecting,
                current_database: Some(database_name.clone()),
                current_schema: None, // Reset schema al cambiar DB
            });
        }
        
        match new_driver.connect(&conn_string).await {
             Ok(()) => {
                let mut active = self.active_connections.write().await;
                if let Some(conn) = active.get_mut(&id) {
                    conn.status = ConnectionStatus::Connected;
                    // Reset schema to default if needed
                    if connection.engine == DatabaseEngine::PostgreSQL {
                         conn.current_schema = Some("public".to_string());
                    }
                }
                Ok(())
            }
            Err(e) => {
                let mut active = self.active_connections.write().await;
                if let Some(conn) = active.get_mut(&id) {
                    conn.status = ConnectionStatus::Error(e.to_string());
                }
                Err(e)
            }
        }
    }

    /// Cambia el esquema activo (solo PostgreSQL)
    pub async fn change_schema(&self, id: Uuid, schema_name: String) -> Result<(), DomainError> {
        let driver = self.get_active_driver(id).await?;
        
        // Esto solo aplica realmente para PostgreSQL
        if driver.driver_id() == "postgresql" {
            let query = format!("SET search_path TO \"{}\"", schema_name);
            driver.execute_statement(&query).await?;
            
            // Actualizar estado
            let mut active = self.active_connections.write().await;
            if let Some(conn) = active.get_mut(&id) {
                conn.current_schema = Some(schema_name);
            }
        }
        
        Ok(())
    }

    fn build_connection_string(&self, conn: &Connection, password: &str) -> String {
        // URL encode the password to handle special characters like ?, @, #, etc.
        let encoded_password = encode(password);
        
        match conn.engine {
            DatabaseEngine::PostgreSQL => {
                let port = conn.port.filter(|&p| p > 0).unwrap_or(5432);
                let database = conn.database.as_deref().unwrap_or("postgres");
                let encoded_user = encode(conn.username.as_deref().unwrap_or("postgres"));
                format!(
                    "postgres://{}:{}@{}:{}/{}",
                    encoded_user,
                    encoded_password,
                    conn.host.as_deref().unwrap_or("localhost"),
                    port,
                    database
                )
            }
            DatabaseEngine::MySQL => {
                // Ensure port is valid, default to 3306 if 0 or None
                let port = conn.port.filter(|&p| p > 0).unwrap_or(3306);
                let encoded_user = encode(conn.username.as_deref().unwrap_or("root"));
                tracing::info!("MySQL connection - using port: {}", port);
                let base = format!(
                    "mysql://{}:{}@{}:{}",
                    encoded_user,
                    encoded_password,
                    conn.host.as_deref().unwrap_or("localhost"),
                    port
                );
                // MySQL puede conectar sin database específica
                if let Some(db) = &conn.database {
                    format!("{}/{}", base, db)
                } else {
                    base
                }
            }
            DatabaseEngine::SQLite => {
                let path = conn.file_path.as_ref()
                    .or(conn.database.as_ref())
                    .map(|s| s.as_str())
                    .unwrap_or("database.db");
                format!("sqlite:{}", path)
            }
        }
    }
}
