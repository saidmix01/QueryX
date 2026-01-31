use tauri::State;
use uuid::Uuid;
use std::sync::Arc;

use crate::application::SchemaUseCase;
use crate::domain::{
    ColumnSchema, ConstraintInfo, DatabaseInfo, DomainError, FunctionInfo, IndexInfo,
    SchemaInfo, SequenceInfo, TableInfo, TriggerInfo, ViewInfo,
};

pub type SchemaState = Arc<SchemaUseCase>;

#[tauri::command]
pub async fn list_databases(
    state: State<'_, SchemaState>,
    connection_id: String,
) -> Result<Vec<String>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_databases(uuid).await
}

#[tauri::command]
pub async fn get_database_info(
    state: State<'_, SchemaState>,
    connection_id: String,
    database: String,
) -> Result<DatabaseInfo, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.get_database_info(uuid, &database).await
}

#[tauri::command]
pub async fn list_schemas(
    state: State<'_, SchemaState>,
    connection_id: String,
    database: String,
) -> Result<Vec<SchemaInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_schemas(uuid, &database).await
}

#[tauri::command]
pub async fn list_tables(
    state: State<'_, SchemaState>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<TableInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_tables(uuid, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_table_info(
    state: State<'_, SchemaState>,
    connection_id: String,
    table: String,
    schema: Option<String>,
) -> Result<TableInfo, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.get_table_info(uuid, &table, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_columns(
    state: State<'_, SchemaState>,
    connection_id: String,
    table: String,
    schema: Option<String>,
) -> Result<Vec<ColumnSchema>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.get_columns(uuid, &table, schema.as_deref()).await
}

#[tauri::command]
pub async fn list_indexes(
    state: State<'_, SchemaState>,
    connection_id: String,
    table: String,
    schema: Option<String>,
) -> Result<Vec<IndexInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_indexes(uuid, &table, schema.as_deref()).await
}

#[tauri::command]
pub async fn list_constraints(
    state: State<'_, SchemaState>,
    connection_id: String,
    table: String,
    schema: Option<String>,
) -> Result<Vec<ConstraintInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_constraints(uuid, &table, schema.as_deref()).await
}

#[tauri::command]
pub async fn list_triggers(
    state: State<'_, SchemaState>,
    connection_id: String,
    table: String,
    schema: Option<String>,
) -> Result<Vec<TriggerInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_triggers(uuid, &table, schema.as_deref()).await
}

#[tauri::command]
pub async fn list_views(
    state: State<'_, SchemaState>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<ViewInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_views(uuid, schema.as_deref()).await
}

#[tauri::command]
pub async fn list_functions(
    state: State<'_, SchemaState>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<FunctionInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_functions(uuid, schema.as_deref()).await
}

#[tauri::command]
pub async fn list_sequences(
    state: State<'_, SchemaState>,
    connection_id: String,
    schema: Option<String>,
) -> Result<Vec<SequenceInfo>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.list_sequences(uuid, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_server_version(
    state: State<'_, SchemaState>,
    connection_id: String,
) -> Result<String, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.get_server_version(uuid).await
}
