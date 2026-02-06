use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::OnceCell;
use uuid::Uuid;

use crate::domain::{
    DomainError, ExecuteQueryDto, QueryHistoryEntry, QueryHistoryRepository, QueryResult,
};
use crate::infrastructure::FileQueryHistoryRepository;
use super::ConnectionUseCase;

/// Caso de uso para ejecución de queries
pub struct QueryUseCase {
    connection_use_case: Arc<ConnectionUseCase>,
    data_dir: PathBuf,
    history_repo: OnceCell<Arc<dyn QueryHistoryRepository>>,
}

impl QueryUseCase {
    pub fn new_lazy(
        connection_use_case: Arc<ConnectionUseCase>,
        data_dir: PathBuf,
    ) -> Self {
        Self {
            connection_use_case,
            data_dir,
            history_repo: OnceCell::new(),
        }
    }

    async fn get_history_repo(&self) -> Result<&Arc<dyn QueryHistoryRepository>, DomainError> {
        self.history_repo
            .get_or_try_init(|| async {
                let repo = FileQueryHistoryRepository::new(self.data_dir.clone()).await?;
                Ok(Arc::new(repo) as Arc<dyn QueryHistoryRepository>)
            })
            .await
    }

    pub async fn execute_query(&self, dto: ExecuteQueryDto) -> Result<QueryResult, DomainError> {
        let driver = self.connection_use_case.get_active_driver(dto.connection_id).await?;

        let result = if let (Some(page), Some(page_size)) = (dto.page, dto.page_size) {
            driver.execute_query_paginated(&dto.query, page, page_size).await
        } else {
            driver.execute_query(&dto.query).await
        };

        // Guardar en historial
        let history_repo = self.get_history_repo().await?;
        match &result {
            Ok(r) => {
                let entry = QueryHistoryEntry::success(
                    dto.connection_id,
                    dto.query.clone(),
                    r.execution_time_ms,
                    r.row_count,
                );
                history_repo.save(entry).await.ok();
            }
            Err(e) => {
                let entry = QueryHistoryEntry::failure(
                    dto.connection_id,
                    dto.query.clone(),
                    e.to_string(),
                );
                history_repo.save(entry).await.ok();
            }
        }

        result
    }

    pub async fn execute_statement(&self, connection_id: Uuid, statement: &str) -> Result<u64, DomainError> {
        let conn = self.connection_use_case.get_connection(connection_id).await?;
        if conn.read_only && Self::is_destructive(statement) {
            return Err(DomainError::validation("Conexión en modo solo lectura: operación bloqueada"));
        }
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        let result = driver.execute_statement(statement).await;

        let history_repo = self.get_history_repo().await?;
        match &result {
            Ok(affected) => {
                let entry = QueryHistoryEntry::success(connection_id, statement.to_string(), 0, *affected as usize);
                history_repo.save(entry).await.ok();
            }
            Err(e) => {
                let entry = QueryHistoryEntry::failure(connection_id, statement.to_string(), e.to_string());
                history_repo.save(entry).await.ok();
            }
        }

        result
    }

    pub async fn insert_row(
        &self, 
        connection_id: Uuid, 
        schema: Option<String>, 
        table: String, 
        values: std::collections::HashMap<String, serde_json::Value>
    ) -> Result<QueryResult, DomainError> {
        let conn = self.connection_use_case.get_connection(connection_id).await?;
        if conn.read_only {
            return Err(DomainError::validation("Conexión en modo solo lectura: operación bloqueada"));
        }
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        
        let result = driver.insert_row(schema.as_deref(), &table, values).await;
        
        let history_repo = self.get_history_repo().await?;
        match &result {
            Ok(r) => {
                let entry = QueryHistoryEntry::success(
                    connection_id,
                    r.query.clone(),
                    r.execution_time_ms,
                    r.row_count,
                );
                history_repo.save(entry).await.ok();
            }
            Err(e) => {
                let entry = QueryHistoryEntry::failure(
                    connection_id,
                    format!("INSERT INTO {}.{}", schema.as_deref().unwrap_or("public"), table),
                    e.to_string(),
                );
                history_repo.save(entry).await.ok();
            }
        }
        
        result
    }

    pub async fn execute_multi_statement(&self, connection_id: Uuid, statements: Vec<String>) -> Result<Vec<crate::domain::StatementResult>, DomainError> {
        let conn = self.connection_use_case.get_connection(connection_id).await?;
        if conn.read_only {
            for s in &statements {
                if Self::is_destructive(s) {
                    return Err(DomainError::validation("Conexión en modo solo lectura: operación bloqueada"));
                }
            }
        }
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.execute_multi_statement(statements).await
    }

    pub async fn execute_in_transaction(&self, connection_id: Uuid, statement: &str) -> Result<crate::domain::TransactionResult, DomainError> {
        let conn = self.connection_use_case.get_connection(connection_id).await?;
        if conn.read_only && Self::is_destructive(statement) {
            return Err(DomainError::validation("Conexión en modo solo lectura: operación bloqueada"));
        }
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.execute_in_transaction(statement).await
    }


fn is_destructive(sql: &str) -> bool {
    let normalized = sql.trim().to_uppercase();
    normalized.starts_with("UPDATE")
        || normalized.starts_with("DELETE")
        || normalized.starts_with("DROP")
        || normalized.starts_with("TRUNCATE")
        || normalized.starts_with("ALTER")
}

    pub async fn get_history(&self, connection_id: Uuid, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let repo = self.get_history_repo().await?;
        repo.get_by_connection(connection_id, limit).await
    }

    pub async fn search_history(&self, query: &str, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let repo = self.get_history_repo().await?;
        repo.search(query, limit).await
    }

    pub async fn get_frequent_queries(&self, connection_id: Option<Uuid>, limit: usize) -> Result<Vec<QueryHistoryEntry>, DomainError> {
        let repo = self.get_history_repo().await?;
        repo.get_frequent(connection_id, limit).await
    }

    pub async fn cancel_query(&self, connection_id: Uuid) -> Result<(), DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.cancel_query().await
    }
}
