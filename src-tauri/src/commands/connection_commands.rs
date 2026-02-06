use tauri::State;
use uuid::Uuid;

use crate::application::ConnectionUseCase;
use crate::domain::{Connection, ConnectionStatus, CreateConnectionDto, DomainError, UpdateConnectionDto};
use std::sync::Arc;

pub type ConnectionState = Arc<ConnectionUseCase>;

#[tauri::command]
pub async fn get_connections(
    state: State<'_, ConnectionState>,
) -> Result<Vec<Connection>, DomainError> {
    state.get_all_connections().await
}

#[tauri::command]
pub async fn get_connection(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<Connection, DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.get_connection(uuid).await
}

#[tauri::command]
pub async fn create_connection(
    state: State<'_, ConnectionState>,
    dto: CreateConnectionDto,
) -> Result<Connection, DomainError> {
    state.create_connection(dto).await
}

#[tauri::command]
pub async fn update_connection(
    state: State<'_, ConnectionState>,
    id: String,
    dto: UpdateConnectionDto,
) -> Result<Connection, DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.update_connection(uuid, dto).await
}

#[tauri::command]
pub async fn delete_connection(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.delete_connection(uuid).await
}


#[tauri::command]
pub async fn test_connection(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.test_connection(uuid).await
}

#[tauri::command]
pub async fn connect(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.connect(uuid).await
}

#[tauri::command]
pub async fn disconnect(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.disconnect(uuid).await
}

#[tauri::command]
pub async fn get_connection_status(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<ConnectionStatus, DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    Ok(state.get_connection_status(uuid).await)
}

#[tauri::command]
pub async fn change_database(
    state: State<'_, ConnectionState>,
    id: String,
    database: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.change_database(uuid, database).await
}

#[tauri::command]
pub async fn change_schema(
    state: State<'_, ConnectionState>,
    id: String,
    schema: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.change_schema(uuid, schema).await
}

#[tauri::command]
pub async fn get_active_context(
    state: State<'_, ConnectionState>,
    id: String,
) -> Result<(Option<String>, Option<String>), DomainError> {
    let uuid = Uuid::parse_str(&id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    Ok(state.get_active_context(uuid).await.unwrap_or((None, None)))
}
