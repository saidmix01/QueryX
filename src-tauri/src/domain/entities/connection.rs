use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Tipos de motores SQL soportados
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseEngine {
    PostgreSQL,
    MySQL,
    SQLite,
}

impl DatabaseEngine {
    pub fn default_port(&self) -> Option<u16> {
        match self {
            DatabaseEngine::PostgreSQL => Some(5432),
            DatabaseEngine::MySQL => Some(3306),
            DatabaseEngine::SQLite => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            DatabaseEngine::PostgreSQL => "PostgreSQL",
            DatabaseEngine::MySQL => "MySQL",
            DatabaseEngine::SQLite => "SQLite",
        }
    }
}

/// Configuración SSL para conexiones
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SslConfig {
    pub enabled: bool,
    pub ca_cert_path: Option<String>,
    pub client_cert_path: Option<String>,
    pub client_key_path: Option<String>,
    pub verify_server_cert: bool,
}

/// Configuración SSH tunnel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshTunnelConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: SshAuthMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SshAuthMethod {
    Password,
    PrivateKey { key_path: String },
}

/// Entidad principal de conexión a base de datos
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub id: Uuid,
    pub name: String,
    pub engine: DatabaseEngine,
    pub host: Option<String>,
    pub port: Option<u16>,
    /// Database name - Optional for server connections (will show all databases)
    /// Required for SQLite (file path)
    pub database: Option<String>,
    pub username: Option<String>,
    /// Path al archivo para SQLite
    pub file_path: Option<String>,
    pub ssl: SslConfig,
    pub ssh_tunnel: Option<SshTunnelConfig>,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_connected_at: Option<DateTime<Utc>>,
}

impl Connection {
    pub fn new(name: String, engine: DatabaseEngine, database: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            engine: engine.clone(),
            host: None,
            port: engine.default_port(),
            database,
            username: None,
            file_path: None,
            ssl: SslConfig::default(),
            ssh_tunnel: None,
            color: None,
            created_at: now,
            updated_at: now,
            last_connected_at: None,
        }
    }

    pub fn with_host(mut self, host: impl Into<String>) -> Self {
        self.host = Some(host.into());
        self
    }

    pub fn with_port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }

    pub fn with_username(mut self, username: impl Into<String>) -> Self {
        self.username = Some(username.into());
        self
    }

    pub fn with_file_path(mut self, path: impl Into<String>) -> Self {
        self.file_path = Some(path.into());
        self
    }

    /// Genera el connection string (sin password)
    pub fn connection_string_template(&self) -> String {
        match self.engine {
            DatabaseEngine::PostgreSQL => {
                let db = self.database.as_deref().unwrap_or("postgres");
                format!(
                    "postgres://{}@{}:{}/{}",
                    self.username.as_deref().unwrap_or("postgres"),
                    self.host.as_deref().unwrap_or("localhost"),
                    self.port.unwrap_or(5432),
                    db
                )
            }
            DatabaseEngine::MySQL => {
                // MySQL puede conectar sin database específica
                let base = format!(
                    "mysql://{}@{}:{}",
                    self.username.as_deref().unwrap_or("root"),
                    self.host.as_deref().unwrap_or("localhost"),
                    self.port.unwrap_or(3306)
                );
                if let Some(db) = &self.database {
                    format!("{}/{}", base, db)
                } else {
                    base
                }
            }
            DatabaseEngine::SQLite => {
                let path = self.file_path.as_ref()
                    .or(self.database.as_ref())
                    .map(|s| s.as_str())
                    .unwrap_or("database.db");
                format!("sqlite://{}", path)
            }
        }
    }
    
    /// Returns the default database to connect to when no database is specified
    pub fn get_default_database(&self) -> Option<String> {
        match self.engine {
            DatabaseEngine::PostgreSQL => Some("postgres".to_string()),
            DatabaseEngine::MySQL => None, // MySQL can connect without a database
            DatabaseEngine::SQLite => self.database.clone().or_else(|| self.file_path.clone()),
        }
    }
}

/// DTO para crear conexiones desde el frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConnectionDto {
    pub name: String,
    pub engine: DatabaseEngine,
    pub host: Option<String>,
    pub port: Option<u16>,
    /// Database name - Optional for server connections, required for SQLite
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub file_path: Option<String>,
    pub ssl: Option<SslConfig>,
    pub color: Option<String>,
}

/// DTO para actualizar conexiones
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConnectionDto {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub ssl: Option<SslConfig>,
    pub color: Option<String>,
}

/// Estado de una conexión activa
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}
