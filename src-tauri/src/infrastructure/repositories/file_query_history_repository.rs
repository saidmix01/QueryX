use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::{DomainError, QueryHistoryEntry, QueryHistoryRepository};

const MAX_HISTORY_ENTRIES: usize = 1000;

pub struct FileQueryHistoryRepository {
    file_path: PathBuf,
    entries: Arc<RwLock<Vec<QueryHistoryEntry>>>,
}

impl FileQueryHistoryRepository {
    pub async fn new(data_dir: PathBuf) -> Result<Self, DomainError> {
        let file_path = data_dir.join("query_history.json");

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let entries = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(Self {
            file_path,
            entries: Arc::new(RwLock::new(entries)),
        })
    }

    async fn save(&self) -> Result<(), DomainError> {
        let entries = self.entries.read().await;
        let content = serde_json::to_string_pretty(&*entries)?;
        fs::write(&self.file_path, content).await?;
        Ok(())
    }
}

#[async_trait]
impl QueryHistoryRepository for FileQueryHistoryRepository {
    async fn save(&self, entry: QueryHistoryEntry) -> Result<(), DomainError> {
        let mut entries = self.entries.write().await;
        entries.insert(0, entry);
        if entries.len() > MAX_HISTORY_ENTRIES {
            entries.truncate(MAX_HISTORY_ENTRIES);
        }
        drop(entries);
        self.save().await
    }


    async fn get_by_connection(&self, connection_id: Uuid, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let entries = self.entries.read().await;
        Ok(entries.iter()
            .filter(|e| e.connection_id == connection_id)
            .take(limit)
            .cloned()
            .collect())
    }

    async fn get_all(&self, limit: usize, offset: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let entries = self.entries.read().await;
        Ok(entries.iter().skip(offset).take(limit).cloned().collect())
    }

    async fn search(&self, query: &str, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let entries = self.entries.read().await;
        let query_lower = query.to_lowercase();
        Ok(entries.iter()
            .filter(|e| e.query.to_lowercase().contains(&query_lower))
            .take(limit)
            .cloned()
            .collect())
    }

    async fn get_frequent(&self, connection_id: Option<Uuid>, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let entries = self.entries.read().await;
        let filtered: Vec<_> = match connection_id {
            Some(id) => entries.iter().filter(|e| e.connection_id == id).cloned().collect(),
            None => entries.clone(),
        };
        
        use std::collections::HashMap;
        let mut freq: HashMap<String, (usize, QueryHistoryEntry)> = HashMap::new();
        for entry in filtered {
            let key = entry.query.clone();
            freq.entry(key).and_modify(|(count, _)| *count += 1).or_insert((1, entry));
        }
        
        let mut sorted: Vec<_> = freq.into_values().collect();
        sorted.sort_by(|a, b| b.0.cmp(&a.0));
        Ok(sorted.into_iter().take(limit).map(|(_, e)| e).collect())
    }

    async fn cleanup_older_than(&self, date: DateTime<Utc>) -> Result<u64, DomainError> {
        let mut entries = self.entries.write().await;
        let initial = entries.len();
        entries.retain(|e| e.executed_at >= date);
        let removed = initial - entries.len();
        drop(entries);
        self.save().await?;
        Ok(removed as u64)
    }

    async fn delete_by_connection(&self, connection_id: Uuid) -> Result<(), DomainError> {
        let mut entries = self.entries.write().await;
        entries.retain(|e| e.connection_id != connection_id);
        drop(entries);
        self.save().await
    }

    async fn delete(&self, id: Uuid) -> Result<(), DomainError> {
        let mut entries = self.entries.write().await;
        entries.retain(|e| e.id != id);
        drop(entries);
        self.save().await
    }

    async fn count(&self) -> Result<u64, DomainError> {
        let entries = self.entries.read().await;
        Ok(entries.len() as u64)
    }
}
