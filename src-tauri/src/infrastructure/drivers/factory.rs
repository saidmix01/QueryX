use std::collections::HashMap;
use std::sync::Arc;

use crate::domain::{DatabaseEngine, DomainError, SqlDriver, SqlDriverFactory};
use super::{MySqlDriver, PostgresDriver, SqliteDriver};

/// Factory para crear instancias de drivers SQL
pub struct DriverFactory {
    drivers: HashMap<String, Arc<dyn SqlDriver>>,
}

impl DriverFactory {
    pub fn new() -> Self {
        let mut drivers: HashMap<String, Arc<dyn SqlDriver>> = HashMap::new();
        
        drivers.insert("postgresql".to_string(), Arc::new(PostgresDriver::new()));
        drivers.insert("mysql".to_string(), Arc::new(MySqlDriver::new()));
        drivers.insert("sqlite".to_string(), Arc::new(SqliteDriver::new()));
        
        Self { drivers }
    }

    pub fn get_driver(&self, engine: &DatabaseEngine) -> Result<Arc<dyn SqlDriver>, DomainError> {
        let key = match engine {
            DatabaseEngine::PostgreSQL => "postgresql",
            DatabaseEngine::MySQL => "mysql",
            DatabaseEngine::SQLite => "sqlite",
        };

        self.drivers
            .get(key)
            .cloned()
            .ok_or_else(|| DomainError::DriverNotFound {
                engine: key.to_string(),
            })
    }

    pub fn create_new_driver(&self, engine: &DatabaseEngine) -> Box<dyn SqlDriver> {
        match engine {
            DatabaseEngine::PostgreSQL => Box::new(PostgresDriver::new()),
            DatabaseEngine::MySQL => Box::new(MySqlDriver::new()),
            DatabaseEngine::SQLite => Box::new(SqliteDriver::new()),
        }
    }
}

impl Default for DriverFactory {
    fn default() -> Self {
        Self::new()
    }
}

impl SqlDriverFactory for DriverFactory {
    fn create_driver(&self, engine: &str) -> Result<Box<dyn SqlDriver>, DomainError> {
        match engine.to_lowercase().as_str() {
            "postgresql" | "postgres" => Ok(Box::new(PostgresDriver::new())),
            "mysql" | "mariadb" => Ok(Box::new(MySqlDriver::new())),
            "sqlite" | "sqlite3" => Ok(Box::new(SqliteDriver::new())),
            _ => Err(DomainError::DriverNotFound {
                engine: engine.to_string(),
            }),
        }
    }

    fn supported_engines(&self) -> Vec<&'static str> {
        vec!["postgresql", "mysql", "sqlite"]
    }
}
