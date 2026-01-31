use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

/// Estado completo del workspace para una conexión
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceState {
    pub connection_id: Uuid,
    pub active_tab_id: Option<String>,
    pub tabs: Vec<WorkspaceTab>,
    pub last_updated: DateTime<Utc>,
}

impl WorkspaceState {
    pub fn new(connection_id: Uuid) -> Self {
        Self {
            connection_id,
            active_tab_id: None,
            tabs: Vec::new(),
            last_updated: Utc::now(),
        }
    }

    pub fn with_tabs(mut self, tabs: Vec<WorkspaceTab>) -> Self {
        self.tabs = tabs;
        self.last_updated = Utc::now();
        self
    }

    pub fn with_active_tab(mut self, tab_id: String) -> Self {
        self.active_tab_id = Some(tab_id);
        self.last_updated = Utc::now();
        self
    }
}

/// Pestaña individual del workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceTab {
    pub id: String,
    pub tab_type: TabType,
    pub title: String,
    pub payload: TabPayload,
}

impl WorkspaceTab {
    pub fn sql_editor(id: String, title: String, sql: String) -> Self {
        Self {
            id,
            tab_type: TabType::SqlEditor,
            title,
            payload: TabPayload::SqlEditor { sql },
        }
    }

    pub fn table_view(id: String, title: String, table: TableRef) -> Self {
        Self {
            id,
            tab_type: TabType::TableView,
            title,
            payload: TabPayload::TableView { table },
        }
    }

    pub fn query_builder(id: String, title: String, query_model: JsonValue) -> Self {
        Self {
            id,
            tab_type: TabType::QueryBuilder,
            title,
            payload: TabPayload::QueryBuilder { query_model },
        }
    }
}

/// Tipo de pestaña
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TabType {
    SqlEditor,
    TableView,
    QueryBuilder,
}

/// Payload específico de cada tipo de pestaña
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TabPayload {
    SqlEditor {
        sql: String,
    },
    TableView {
        table: TableRef,
    },
    QueryBuilder {
        query_model: JsonValue,
    },
}

/// Referencia a una tabla
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableRef {
    pub schema: Option<String>,
    pub name: String,
}

impl TableRef {
    pub fn new(name: String) -> Self {
        Self {
            schema: None,
            name,
        }
    }

    pub fn with_schema(mut self, schema: String) -> Self {
        self.schema = Some(schema);
        self
    }
}

/// DTO para guardar el workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveWorkspaceDto {
    pub connection_id: Uuid,
    pub active_tab_id: Option<String>,
    pub tabs: Vec<WorkspaceTab>,
}
