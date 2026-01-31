use crate::domain::entities::{SaveWorkspaceDto, WorkspaceState};
use crate::domain::error::DomainError;
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
pub trait WorkspaceRepository: Send + Sync {
    /// Guardar el estado del workspace para una conexión
    async fn save(&self, dto: SaveWorkspaceDto) -> Result<WorkspaceState, DomainError>;

    /// Obtener el estado del workspace de una conexión
    async fn get(&self, connection_id: Uuid) -> Result<Option<WorkspaceState>, DomainError>;

    /// Eliminar el workspace de una conexión
    async fn delete(&self, connection_id: Uuid) -> Result<(), DomainError>;

    /// Obtener todos los workspaces guardados
    async fn get_all(&self) -> Result<Vec<WorkspaceState>, DomainError>;
}
