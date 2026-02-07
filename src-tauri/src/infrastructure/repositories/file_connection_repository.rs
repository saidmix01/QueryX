use async_trait::async_trait;
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::{
    Connection, ConnectionRepository, CreateConnectionDto, DomainError,
    UpdateConnectionDto,
};

/// Implementación de ConnectionRepository usando archivos JSON
pub struct FileConnectionRepository {
    file_path: PathBuf,
    connections: Arc<RwLock<Vec<Connection>>>,
}

impl FileConnectionRepository {
    pub async fn new(data_dir: PathBuf) -> Result<Self, DomainError> {
        let file_path = data_dir.join("connections.json");

        // Crear directorio si no existe
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let connections = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            match serde_json::from_str::<Vec<Connection>>(&content) {
                Ok(c) => c,
                Err(_) => {
                    let bak_path = file_path.with_extension("bak");
                    if bak_path.exists() {
                        let bak_content = fs::read_to_string(&bak_path).await?;
                        serde_json::from_str::<Vec<Connection>>(&bak_content).unwrap_or_default()
                    } else {
                        Vec::new()
                    }
                }
            }
        } else {
            Vec::new()
        };

        Ok(Self {
            file_path,
            connections: Arc::new(RwLock::new(connections)),
        })
    }

    async fn save(&self) -> Result<(), DomainError> {
        let connections = self.connections.read().await;
        let content = serde_json::to_string_pretty(&*connections)?;
        let tmp_path = self.file_path.with_extension("tmp");
        fs::write(&tmp_path, content).await?;
        if self.file_path.exists() {
            let bak_path = self.file_path.with_extension("bak");
            let _ = fs::rename(&self.file_path, &bak_path).await;
        }
        fs::rename(&tmp_path, &self.file_path).await?;
        Ok(())
    }
}

#[async_trait]
impl ConnectionRepository for FileConnectionRepository {
    async fn get_all(&self) -> Result<Vec<Connection>, DomainError> {
        let connections = self.connections.read().await;
        Ok(connections.clone())
    }

    async fn get_by_id(&self, id: Uuid) -> Result<Option<Connection>, DomainError> {
        let connections = self.connections.read().await;
        Ok(connections.iter().find(|c| c.id == id).cloned())
    }

    async fn find_by_name(&self, name: &str) -> Result<Vec<Connection>, DomainError> {
        let connections = self.connections.read().await;
        let name_lower = name.to_lowercase();
        Ok(connections
            .iter()
            .filter(|c| c.name.to_lowercase().contains(&name_lower))
            .cloned()
            .collect())
    }

    async fn create(&self, dto: CreateConnectionDto) -> Result<Connection, DomainError> {
        let now = Utc::now();
        
        // Asignar puerto por defecto según el motor si no viene
        let port = dto.port.or_else(|| match dto.engine {
            crate::domain::DatabaseEngine::PostgreSQL => Some(5432),
            crate::domain::DatabaseEngine::MySQL => Some(3306),
            crate::domain::DatabaseEngine::SQLite => None,
        });
        
        let connection = Connection {
            id: Uuid::new_v4(),
            name: dto.name,
            engine: dto.engine,
            host: dto.host,
            port,
            database: dto.database,
            username: dto.username,
            file_path: dto.file_path,
            ssl: dto.ssl.unwrap_or_default(),
            ssh_tunnel: None,
            color: dto.color,
            read_only: dto.read_only.unwrap_or(false),
            created_at: now,
            updated_at: now,
            last_connected_at: None,
        };

        {
            let mut connections = self.connections.write().await;
            connections.push(connection.clone());
        }

        self.save().await?;
        Ok(connection)
    }


    async fn update(&self, id: Uuid, dto: UpdateConnectionDto) -> Result<Connection, DomainError> {
        let mut connections = self.connections.write().await;
        let conn = connections
            .iter_mut()
            .find(|c| c.id == id)
            .ok_or_else(|| DomainError::ConnectionNotFound { id: id.to_string() })?;

        if let Some(name) = dto.name { conn.name = name; }
        if let Some(host) = dto.host { conn.host = Some(host); }
        if let Some(port) = dto.port { conn.port = Some(port); }
        if let Some(database) = dto.database { conn.database = Some(database); }
        if let Some(username) = dto.username { conn.username = Some(username); }
        if let Some(ssl) = dto.ssl { conn.ssl = ssl; }
        if let Some(color) = dto.color { conn.color = Some(color); }
        if let Some(ro) = dto.read_only { conn.read_only = ro; }
        conn.updated_at = Utc::now();

        let updated = conn.clone();
        drop(connections);
        self.save().await?;
        Ok(updated)
    }

    async fn delete(&self, id: Uuid) -> Result<(), DomainError> {
        let mut connections = self.connections.write().await;
        let initial_len = connections.len();
        connections.retain(|c| c.id != id);
        
        if connections.len() == initial_len {
            return Err(DomainError::ConnectionNotFound { id: id.to_string() });
        }
        drop(connections);
        self.save().await
    }

    async fn update_last_connected(&self, id: Uuid) -> Result<(), DomainError> {
        let mut connections = self.connections.write().await;
        if let Some(conn) = connections.iter_mut().find(|c| c.id == id) {
            conn.last_connected_at = Some(Utc::now());
        }
        drop(connections);
        self.save().await
    }

    async fn duplicate(&self, id: Uuid, new_name: String) -> Result<Connection, DomainError> {
        let connections = self.connections.read().await;
        let original = connections.iter().find(|c| c.id == id)
            .ok_or_else(|| DomainError::ConnectionNotFound { id: id.to_string() })?
            .clone();
        drop(connections);

        let dto = CreateConnectionDto {
            name: new_name,
            engine: original.engine,
            host: original.host,
            port: original.port,
            database: original.database,
            username: original.username,
            password: None,
            file_path: original.file_path,
            ssl: Some(original.ssl),
            color: original.color,
            read_only: Some(original.read_only),
        };
        self.create(dto).await
    }

    async fn export(&self, ids: Vec<Uuid>) -> Result<String, DomainError> {
        let connections = self.connections.read().await;
        let to_export: Vec<_> = connections.iter()
            .filter(|c| ids.contains(&c.id))
            .cloned()
            .collect();
        serde_json::to_string_pretty(&to_export).map_err(DomainError::from)
    }

    async fn import(&self, json: &str) -> Result<Vec<Connection>, DomainError> {
        let imported: Vec<Connection> = serde_json::from_str(json)?;
        let mut connections = self.connections.write().await;
        let mut result = Vec::new();
        
        for mut conn in imported {
            conn.id = Uuid::new_v4();
            conn.created_at = Utc::now();
            conn.updated_at = Utc::now();
            connections.push(conn.clone());
            result.push(conn);
        }
        drop(connections);
        self.save().await?;
        Ok(result)
    }
}
