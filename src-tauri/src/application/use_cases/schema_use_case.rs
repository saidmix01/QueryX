use std::sync::Arc;
use uuid::Uuid;

use crate::domain::{
    ColumnSchema, ConstraintInfo, DatabaseInfo, DomainError, FunctionInfo, IndexInfo,
    SchemaInfo, SequenceInfo, TableInfo, TriggerInfo, ViewInfo,
};
use super::ConnectionUseCase;

/// Caso de uso para exploración de schema
pub struct SchemaUseCase {
    connection_use_case: Arc<ConnectionUseCase>,
}

impl SchemaUseCase {
    pub fn new(connection_use_case: Arc<ConnectionUseCase>) -> Self {
        Self { connection_use_case }
    }

    pub async fn list_databases(&self, connection_id: Uuid) -> Result<Vec<String>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_databases().await
    }

    pub async fn get_database_info(&self, connection_id: Uuid, database: &str) -> Result<DatabaseInfo, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.get_database_info(database).await
    }

    pub async fn list_schemas(&self, connection_id: Uuid, database: &str) -> Result<Vec<SchemaInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_schemas(database).await
    }

    pub async fn list_tables(&self, connection_id: Uuid, schema: Option<&str>) -> Result<Vec<TableInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_tables(schema).await
    }

    pub async fn get_table_info(&self, connection_id: Uuid, table: &str, schema: Option<&str>) -> Result<TableInfo, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.get_table_info(table, schema).await
    }

    pub async fn get_columns(&self, connection_id: Uuid, table: &str, schema: Option<&str>) -> Result<Vec<ColumnSchema>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.get_columns(table, schema).await
    }

    pub async fn list_indexes(&self, connection_id: Uuid, table: &str, schema: Option<&str>) -> Result<Vec<IndexInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_indexes(table, schema).await
    }

    pub async fn list_constraints(&self, connection_id: Uuid, table: &str, schema: Option<&str>) -> Result<Vec<ConstraintInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_constraints(table, schema).await
    }

    pub async fn list_triggers(&self, connection_id: Uuid, table: &str, schema: Option<&str>) -> Result<Vec<TriggerInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_triggers(table, schema).await
    }

    pub async fn list_views(&self, connection_id: Uuid, schema: Option<&str>) -> Result<Vec<ViewInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_views(schema).await
    }

    pub async fn list_functions(&self, connection_id: Uuid, schema: Option<&str>) -> Result<Vec<FunctionInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_functions(schema).await
    }

    pub async fn list_sequences(&self, connection_id: Uuid, schema: Option<&str>) -> Result<Vec<SequenceInfo>, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.list_sequences(schema).await
    }

    pub async fn get_server_version(&self, connection_id: Uuid) -> Result<String, DomainError> {
        let driver = self.connection_use_case.get_active_driver(connection_id).await?;
        driver.server_version().await
    }
}
