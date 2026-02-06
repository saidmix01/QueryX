use tauri::State;
use uuid::Uuid;
use std::sync::Arc;

use crate::application::QueryUseCase;
use crate::domain::{DomainError, ExecuteQueryDto, QueryHistoryEntry, QueryResult, StatementResult, TransactionResult};

pub type QueryState = Arc<QueryUseCase>;

#[tauri::command]
pub async fn execute_query(
    state: State<'_, QueryState>,
    connection_id: String,
    query: String,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<QueryResult, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    
    let dto = ExecuteQueryDto {
        connection_id: uuid,
        query,
        page,
        page_size,
    };
    
    state.execute_query(dto).await
}

#[tauri::command]
pub async fn insert_row(
    state: State<'_, QueryState>,
    connection_id: String,
    schema: Option<String>,
    table: String,
    values: std::collections::HashMap<String, serde_json::Value>,
) -> Result<QueryResult, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.insert_row(uuid, schema, table, values).await
}

#[tauri::command]
pub async fn execute_multi_statement(
    state: State<'_, QueryState>,
    connection_id: String,
    statements: Vec<String>,
) -> Result<Vec<StatementResult>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.execute_multi_statement(uuid, statements).await
}

#[tauri::command]
pub async fn execute_in_transaction(
    state: State<'_, QueryState>,
    connection_id: String,
    statement: String,
) -> Result<TransactionResult, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.execute_in_transaction(uuid, &statement).await
}

#[tauri::command]
pub async fn execute_statement(
    state: State<'_, QueryState>,
    connection_id: String,
    statement: String,
) -> Result<u64, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.execute_statement(uuid, &statement).await
}

#[tauri::command]
pub async fn get_query_history(
    state: State<'_, QueryState>,
    connection_id: String,
    limit: Option<usize>,
) -> Result<Vec<QueryHistoryEntry>, DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.get_history(uuid, limit.unwrap_or(50)).await
}

#[tauri::command]
pub async fn search_query_history(
    state: State<'_, QueryState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<QueryHistoryEntry>, DomainError> {
    state.search_history(&query, limit.unwrap_or(50)).await
}

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, QueryState>,
    connection_id: String,
) -> Result<(), DomainError> {
    let uuid = Uuid::parse_str(&connection_id).map_err(|_| DomainError::validation("Invalid UUID"))?;
    state.cancel_query(uuid).await
}
