use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Consulta SQL guardada por el usuario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedQuery {
    pub id: Uuid,
    pub connection_id: Uuid,
    pub name: String,
    pub sql: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub folder_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SavedQuery {
    pub fn new(connection_id: Uuid, name: String, sql: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            connection_id,
            name,
            sql,
            description: None,
            tags: Vec::new(),
            folder_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    pub fn with_folder(mut self, folder_id: Uuid) -> Self {
        self.folder_id = Some(folder_id);
        self
    }
}

/// Carpeta para organizar consultas guardadas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryFolder {
    pub id: Uuid,
    pub connection_id: Uuid,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl QueryFolder {
    pub fn new(connection_id: Uuid, name: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            connection_id,
            name,
            parent_id: None,
            created_at: Utc::now(),
        }
    }

    pub fn with_parent(mut self, parent_id: Uuid) -> Self {
        self.parent_id = Some(parent_id);
        self
    }
}

/// DTO para crear una consulta guardada
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSavedQueryDto {
    pub connection_id: Uuid,
    pub name: String,
    pub sql: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_id: Option<Uuid>,
}

/// DTO para actualizar una consulta guardada
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSavedQueryDto {
    pub name: Option<String>,
    pub sql: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder_id: Option<Uuid>,
}
