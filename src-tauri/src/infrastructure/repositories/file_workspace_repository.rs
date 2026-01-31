use crate::domain::entities::{SaveWorkspaceDto, WorkspaceState};
use crate::domain::error::DomainError;
use crate::domain::ports::WorkspaceRepository;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Default)]
struct WorkspaceStorage {
    workspaces: HashMap<Uuid, WorkspaceState>,
}

pub struct FileWorkspaceRepository {
    storage_path: PathBuf,
    cache: RwLock<WorkspaceStorage>,
}

impl FileWorkspaceRepository {
    pub fn new(storage_path: PathBuf) -> Self {
        Self {
            storage_path,
            cache: RwLock::new(WorkspaceStorage::default()),
        }
    }

    pub async fn initialize(&self) -> Result<(), DomainError> {
        if let Some(parent) = self.storage_path.parent() {
            fs::create_dir_all(parent).await.map_err(|e| {
                DomainError::internal(format!("Failed to create storage directory: {}", e))
            })?;
        }

        if self.storage_path.exists() {
            let content = fs::read_to_string(&self.storage_path).await.map_err(|e| {
                DomainError::internal(format!("Failed to read workspaces: {}", e))
            })?;

            let storage: WorkspaceStorage = serde_json::from_str(&content).map_err(|e| {
                DomainError::internal(format!("Failed to parse workspaces: {}", e))
            })?;

            *self.cache.write().await = storage;
        }

        Ok(())
    }

    async fn save_to_disk(&self) -> Result<(), DomainError> {
        let cache = self.cache.read().await;
        let content = serde_json::to_string_pretty(&*cache).map_err(|e| {
            DomainError::internal(format!("Failed to serialize workspaces: {}", e))
        })?;

        fs::write(&self.storage_path, content).await.map_err(|e| {
            DomainError::internal(format!("Failed to write workspaces: {}", e))
        })?;

        Ok(())
    }
}

#[async_trait]
impl WorkspaceRepository for FileWorkspaceRepository {
    async fn save(&self, dto: SaveWorkspaceDto) -> Result<WorkspaceState, DomainError> {
        let workspace = WorkspaceState::new(dto.connection_id)
            .with_tabs(dto.tabs);

        let workspace = if let Some(active_id) = dto.active_tab_id {
            workspace.with_active_tab(active_id)
        } else {
            workspace
        };

        let mut cache = self.cache.write().await;
        cache.workspaces.insert(dto.connection_id, workspace.clone());
        drop(cache);

        self.save_to_disk().await?;
        Ok(workspace)
    }

    async fn get(&self, connection_id: Uuid) -> Result<Option<WorkspaceState>, DomainError> {
        let cache = self.cache.read().await;
        Ok(cache.workspaces.get(&connection_id).cloned())
    }

    async fn delete(&self, connection_id: Uuid) -> Result<(), DomainError> {
        let mut cache = self.cache.write().await;
        cache.workspaces.remove(&connection_id);
        drop(cache);

        self.save_to_disk().await?;
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<WorkspaceState>, DomainError> {
        let cache = self.cache.read().await;
        Ok(cache.workspaces.values().cloned().collect())
    }
}
