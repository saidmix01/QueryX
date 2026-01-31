use crate::domain::entities::{CreateSavedQueryDto, QueryFolder, SavedQuery, UpdateSavedQueryDto};
use crate::domain::error::DomainError;
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
pub trait SavedQueryRepository: Send + Sync {
    /// Obtener todas las consultas guardadas de una conexión
    async fn get_by_connection(&self, connection_id: Uuid) -> Result<Vec<SavedQuery>, DomainError>;

    /// Obtener una consulta guardada por ID
    async fn get_by_id(&self, id: Uuid) -> Result<SavedQuery, DomainError>;

    /// Crear una nueva consulta guardada
    async fn create(&self, dto: CreateSavedQueryDto) -> Result<SavedQuery, DomainError>;

    /// Actualizar una consulta guardada
    async fn update(&self, id: Uuid, dto: UpdateSavedQueryDto) -> Result<SavedQuery, DomainError>;

    /// Eliminar una consulta guardada
    async fn delete(&self, id: Uuid) -> Result<(), DomainError>;

    /// Buscar consultas por tags
    async fn find_by_tags(&self, connection_id: Uuid, tags: Vec<String>) -> Result<Vec<SavedQuery>, DomainError>;

    /// Obtener todas las carpetas de una conexión
    async fn get_folders(&self, connection_id: Uuid) -> Result<Vec<QueryFolder>, DomainError>;

    /// Crear una carpeta
    async fn create_folder(&self, connection_id: Uuid, name: String, parent_id: Option<Uuid>) -> Result<QueryFolder, DomainError>;

    /// Eliminar una carpeta
    async fn delete_folder(&self, id: Uuid) -> Result<(), DomainError>;
}
