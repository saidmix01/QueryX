use crate::domain::entities::{SaveWorkspaceDto, WorkspaceState};
use crate::domain::error::DomainError;
use crate::domain::ports::WorkspaceRepository;
use crate::infrastructure::repositories::FileWorkspaceRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct WorkspaceUseCase {
    repository: Arc<FileWorkspaceRepository>,
}

impl WorkspaceUseCase {
    pub fn new(repository: Arc<FileWorkspaceRepository>) -> Self {
        Self { repository }
    }

    pub async fn save(&self, dto: SaveWorkspaceDto) -> Result<WorkspaceState, DomainError> {
        self.repository.save(dto).await
    }

    pub async fn get(&self, connection_id: Uuid) -> Result<Option<WorkspaceState>, DomainError> {
        self.repository.get(connection_id).await
    }

    pub async fn delete(&self, connection_id: Uuid) -> Result<(), DomainError> {
        self.repository.delete(connection_id).await
    }

    pub async fn get_all(&self) -> Result<Vec<WorkspaceState>, DomainError> {
        self.repository.get_all().await
    }
}
