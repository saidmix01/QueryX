use crate::domain::entities::{CreateSavedQueryDto, QueryFolder, SavedQuery, UpdateSavedQueryDto};
use crate::domain::error::DomainError;
use crate::domain::ports::SavedQueryRepository;
use crate::infrastructure::repositories::FileSavedQueryRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct SavedQueryUseCase {
    repository: Arc<FileSavedQueryRepository>,
}

impl SavedQueryUseCase {
    pub fn new(repository: Arc<FileSavedQueryRepository>) -> Self {
        Self { repository }
    }

    pub async fn get_by_connection(&self, connection_id: Uuid) -> Result<Vec<SavedQuery>, DomainError> {
        self.repository.get_by_connection(connection_id).await
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<SavedQuery, DomainError> {
        self.repository.get_by_id(id).await
    }

    pub async fn create(&self, dto: CreateSavedQueryDto) -> Result<SavedQuery, DomainError> {
        // Validaciones
        if dto.name.trim().is_empty() {
            return Err(DomainError::validation("Query name cannot be empty"));
        }
        if dto.sql.trim().is_empty() {
            return Err(DomainError::validation("SQL cannot be empty"));
        }

        self.repository.create(dto).await
    }

    pub async fn update(&self, id: Uuid, dto: UpdateSavedQueryDto) -> Result<SavedQuery, DomainError> {
        // Validaciones
        if let Some(ref name) = dto.name {
            if name.trim().is_empty() {
                return Err(DomainError::validation("Query name cannot be empty"));
            }
        }
        if let Some(ref sql) = dto.sql {
            if sql.trim().is_empty() {
                return Err(DomainError::validation("SQL cannot be empty"));
            }
        }

        self.repository.update(id, dto).await
    }

    pub async fn delete(&self, id: Uuid) -> Result<(), DomainError> {
        self.repository.delete(id).await
    }

    pub async fn find_by_tags(&self, connection_id: Uuid, tags: Vec<String>) -> Result<Vec<SavedQuery>, DomainError> {
        self.repository.find_by_tags(connection_id, tags).await
    }

    pub async fn get_folders(&self, connection_id: Uuid) -> Result<Vec<QueryFolder>, DomainError> {
        self.repository.get_folders(connection_id).await
    }

    pub async fn create_folder(
        &self,
        connection_id: Uuid,
        name: String,
        parent_id: Option<Uuid>,
    ) -> Result<QueryFolder, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::validation("Folder name cannot be empty"));
        }

        self.repository.create_folder(connection_id, name, parent_id).await
    }

    pub async fn delete_folder(&self, id: Uuid) -> Result<(), DomainError> {
        self.repository.delete_folder(id).await
    }
}
