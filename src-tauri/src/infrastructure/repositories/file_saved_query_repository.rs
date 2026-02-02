use crate::domain::entities::{CreateSavedQueryDto, QueryFolder, SavedQuery, UpdateSavedQueryDto};
use crate::domain::error::DomainError;
use crate::domain::ports::SavedQueryRepository;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct SavedQueryStorage {
    queries: Vec<SavedQuery>,
    folders: Vec<QueryFolder>,
}

impl Default for SavedQueryStorage {
    fn default() -> Self {
        Self {
            queries: Vec::new(),
            folders: Vec::new(),
        }
    }
}

pub struct FileSavedQueryRepository {
    storage_path: PathBuf,
    cache: RwLock<SavedQueryStorage>,
}

impl FileSavedQueryRepository {
    pub fn new(storage_path: PathBuf) -> Self {
        Self {
            storage_path,
            cache: RwLock::new(SavedQueryStorage::default()),
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
                DomainError::internal(format!("Failed to read saved queries: {}", e))
            })?;
            let parsed = serde_json::from_str::<SavedQueryStorage>(&content);
            let storage = match parsed {
                Ok(s) => s,
                Err(_) => {
                    let bak_path = self.storage_path.with_extension("bak");
                    if bak_path.exists() {
                        let bak_content = fs::read_to_string(&bak_path).await.map_err(|e| {
                            DomainError::internal(format!("Failed to read saved queries backup: {}", e))
                        })?;
                        serde_json::from_str::<SavedQueryStorage>(&bak_content).map_err(|e| {
                            DomainError::internal(format!("Failed to parse saved queries backup: {}", e))
                        })?
                    } else {
                        SavedQueryStorage::default()
                    }
                }
            };
            *self.cache.write().await = storage;
        }

        Ok(())
    }

    async fn save_to_disk(&self) -> Result<(), DomainError> {
        let cache = self.cache.read().await;
        let content = serde_json::to_string_pretty(&*cache).map_err(|e| {
            DomainError::internal(format!("Failed to serialize saved queries: {}", e))
        })?;

        let tmp_path = self.storage_path.with_extension("tmp");
        fs::write(&tmp_path, content).await.map_err(|e| {
            DomainError::internal(format!("Failed to write temp saved queries: {}", e))
        })?;
        if self.storage_path.exists() {
            let bak_path = self.storage_path.with_extension("bak");
            let _ = fs::rename(&self.storage_path, &bak_path).await;
        }
        fs::rename(&tmp_path, &self.storage_path).await.map_err(|e| {
            DomainError::internal(format!("Failed to commit saved queries: {}", e))
        })?;

        Ok(())
    }
}

#[async_trait]
impl SavedQueryRepository for FileSavedQueryRepository {
    async fn get_by_connection(&self, connection_id: Uuid) -> Result<Vec<SavedQuery>, DomainError> {
        let cache = self.cache.read().await;
        Ok(cache
            .queries
            .iter()
            .filter(|q| q.connection_id == connection_id)
            .cloned()
            .collect())
    }

    async fn get_by_id(&self, id: Uuid) -> Result<SavedQuery, DomainError> {
        let cache = self.cache.read().await;
        cache
            .queries
            .iter()
            .find(|q| q.id == id)
            .cloned()
            .ok_or_else(|| DomainError::not_found(format!("Saved query {}", id)))
    }

    async fn create(&self, dto: CreateSavedQueryDto) -> Result<SavedQuery, DomainError> {
        let mut query = SavedQuery::new(dto.connection_id, dto.name, dto.sql);

        if let Some(desc) = dto.description {
            query = query.with_description(desc);
        }
        if let Some(tags) = dto.tags {
            query = query.with_tags(tags);
        }
        if let Some(folder_id) = dto.folder_id {
            query = query.with_folder(folder_id);
        }

        let mut cache = self.cache.write().await;
        cache.queries.push(query.clone());
        drop(cache);

        self.save_to_disk().await?;
        Ok(query)
    }

    async fn update(&self, id: Uuid, dto: UpdateSavedQueryDto) -> Result<SavedQuery, DomainError> {
        let mut cache = self.cache.write().await;

        let query = cache
            .queries
            .iter_mut()
            .find(|q| q.id == id)
            .ok_or_else(|| DomainError::not_found(format!("Saved query {}", id)))?;

        if let Some(name) = dto.name {
            query.name = name;
        }
        if let Some(sql) = dto.sql {
            query.sql = sql;
        }
        if let Some(description) = dto.description {
            query.description = Some(description);
        }
        if let Some(tags) = dto.tags {
            query.tags = tags;
        }
        if let Some(folder_id) = dto.folder_id {
            query.folder_id = Some(folder_id);
        }

        query.updated_at = chrono::Utc::now();
        let updated = query.clone();
        drop(cache);

        self.save_to_disk().await?;
        Ok(updated)
    }

    async fn delete(&self, id: Uuid) -> Result<(), DomainError> {
        let mut cache = self.cache.write().await;
        cache.queries.retain(|q| q.id != id);
        drop(cache);

        self.save_to_disk().await?;
        Ok(())
    }

    async fn find_by_tags(
        &self,
        connection_id: Uuid,
        tags: Vec<String>,
    ) -> Result<Vec<SavedQuery>, DomainError> {
        let cache = self.cache.read().await;
        Ok(cache
            .queries
            .iter()
            .filter(|q| {
                q.connection_id == connection_id
                    && tags.iter().any(|tag| q.tags.contains(tag))
            })
            .cloned()
            .collect())
    }

    async fn get_folders(&self, connection_id: Uuid) -> Result<Vec<QueryFolder>, DomainError> {
        let cache = self.cache.read().await;
        Ok(cache
            .folders
            .iter()
            .filter(|f| f.connection_id == connection_id)
            .cloned()
            .collect())
    }

    async fn create_folder(
        &self,
        connection_id: Uuid,
        name: String,
        parent_id: Option<Uuid>,
    ) -> Result<QueryFolder, DomainError> {
        let mut folder = QueryFolder::new(connection_id, name);
        if let Some(parent) = parent_id {
            folder = folder.with_parent(parent);
        }

        let mut cache = self.cache.write().await;
        cache.folders.push(folder.clone());
        drop(cache);

        self.save_to_disk().await?;
        Ok(folder)
    }

    async fn delete_folder(&self, id: Uuid) -> Result<(), DomainError> {
        let mut cache = self.cache.write().await;
        cache.folders.retain(|f| f.id != id);
        // También eliminar queries de esta carpeta
        for query in cache.queries.iter_mut() {
            if query.folder_id == Some(id) {
                query.folder_id = None;
            }
        }
        drop(cache);

        self.save_to_disk().await?;
        Ok(())
    }
}
