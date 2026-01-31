use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::{Connection, CreateConnectionDto, UpdateConnectionDto};
use crate::domain::error::DomainError;

/// Repository Pattern para gestión de conexiones guardadas
#[async_trait]
pub trait ConnectionRepository: Send + Sync {
    /// Obtiene todas las conexiones guardadas
    async fn get_all(&self) -> Result<Vec<Connection>, DomainError>;

    /// Obtiene una conexión por ID
    async fn get_by_id(&self, id: Uuid) -> Result<Option<Connection>, DomainError>;

    /// Busca conexiones por nombre
    async fn find_by_name(&self, name: &str) -> Result<Vec<Connection>, DomainError>;

    /// Crea una nueva conexión
    async fn create(&self, dto: CreateConnectionDto) -> Result<Connection, DomainError>;

    /// Actualiza una conexión existente
    async fn update(&self, id: Uuid, dto: UpdateConnectionDto) -> Result<Connection, DomainError>;

    /// Elimina una conexión
    async fn delete(&self, id: Uuid) -> Result<(), DomainError>;

    /// Actualiza la fecha de última conexión
    async fn update_last_connected(&self, id: Uuid) -> Result<(), DomainError>;

    /// Duplica una conexión
    async fn duplicate(&self, id: Uuid, new_name: String) -> Result<Connection, DomainError>;

    /// Exporta conexiones a JSON (sin passwords)
    async fn export(&self, ids: Vec<Uuid>) -> Result<String, DomainError>;

    /// Importa conexiones desde JSON
    async fn import(&self, json: &str) -> Result<Vec<Connection>, DomainError>;
}

/// Especificación para filtrar conexiones
#[derive(Debug, Clone, Default)]
pub struct ConnectionSpecification {
    pub engine: Option<String>,
    pub name_contains: Option<String>,
    pub host_contains: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

impl ConnectionSpecification {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_engine(mut self, engine: impl Into<String>) -> Self {
        self.engine = Some(engine.into());
        self
    }

    pub fn with_name_contains(mut self, name: impl Into<String>) -> Self {
        self.name_contains = Some(name.into());
        self
    }

    pub fn with_pagination(mut self, limit: usize, offset: usize) -> Self {
        self.limit = Some(limit);
        self.offset = Some(offset);
        self
    }
}
