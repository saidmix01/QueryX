use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::{
    ColumnSchema, ConstraintInfo, DatabaseInfo, QueryResult, SchemaInfo, 
    SequenceInfo, TableInfo, TriggerInfo, ViewInfo, FunctionInfo, IndexInfo,
};
use crate::domain::error::DomainError;

/// Port principal para drivers SQL
/// Cada motor de base de datos debe implementar este trait
#[async_trait]
pub trait SqlDriver: Send + Sync {
    /// Identificador único del driver
    fn driver_id(&self) -> &'static str;

    /// Nombre legible del driver
    fn display_name(&self) -> &'static str;

    /// Conecta a la base de datos
    async fn connect(&self, connection_string: &str) -> Result<(), DomainError>;

    /// Desconecta de la base de datos
    async fn disconnect(&self) -> Result<(), DomainError>;

    /// Verifica si la conexión está activa
    async fn is_connected(&self) -> bool;

    /// Prueba la conexión sin mantenerla abierta
    async fn test_connection(&self, connection_string: &str) -> Result<(), DomainError>;

    /// Ejecuta una query SELECT y retorna resultados
    async fn execute_query(&self, query: &str) -> Result<QueryResult, DomainError>;

    /// Ejecuta una query con paginación
    async fn execute_query_paginated(
        &self,
        query: &str,
        page: u32,
        page_size: u32,
    ) -> Result<QueryResult, DomainError>;

    /// Inserta una fila en la tabla
    async fn insert_row(
        &self,
        schema: Option<&str>,
        table: &str,
        values: std::collections::HashMap<String, serde_json::Value>,
    ) -> Result<QueryResult, DomainError>;

    /// Ejecuta una query de modificación (INSERT, UPDATE, DELETE)
    async fn execute_statement(&self, statement: &str) -> Result<u64, DomainError>;

    /// Ejecuta múltiples statements en una transacción
    async fn execute_multi_statement(&self, statements: Vec<String>) -> Result<Vec<StatementResult>, DomainError>;

    /// Ejecuta un statement dentro de una transacción y retorna filas afectadas
    async fn execute_in_transaction(&self, statement: &str) -> Result<TransactionResult, DomainError>;

    /// Obtiene la lista de bases de datos
    async fn list_databases(&self) -> Result<Vec<String>, DomainError>;

    /// Obtiene información detallada de una base de datos
    async fn get_database_info(&self, database: &str) -> Result<DatabaseInfo, DomainError>;

    /// Obtiene los schemas de una base de datos
    async fn list_schemas(&self, database: &str) -> Result<Vec<SchemaInfo>, DomainError>;

    /// Obtiene las tablas de un schema
    async fn list_tables(&self, schema: Option<&str>) -> Result<Vec<TableInfo>, DomainError>;

    /// Obtiene información detallada de una tabla
    async fn get_table_info(&self, table: &str, schema: Option<&str>) -> Result<TableInfo, DomainError>;

    /// Obtiene las columnas de una tabla
    async fn get_columns(&self, table: &str, schema: Option<&str>) -> Result<Vec<ColumnSchema>, DomainError>;

    /// Obtiene los índices de una tabla
    async fn list_indexes(&self, table: &str, schema: Option<&str>) -> Result<Vec<IndexInfo>, DomainError>;

    /// Obtiene los constraints de una tabla
    async fn list_constraints(&self, table: &str, schema: Option<&str>) -> Result<Vec<ConstraintInfo>, DomainError>;

    /// Obtiene los triggers de una tabla
    async fn list_triggers(&self, table: &str, schema: Option<&str>) -> Result<Vec<TriggerInfo>, DomainError>;

    /// Obtiene las vistas
    async fn list_views(&self, schema: Option<&str>) -> Result<Vec<ViewInfo>, DomainError>;

    /// Obtiene las funciones
    async fn list_functions(&self, schema: Option<&str>) -> Result<Vec<FunctionInfo>, DomainError>;

    /// Obtiene las secuencias
    async fn list_sequences(&self, schema: Option<&str>) -> Result<Vec<SequenceInfo>, DomainError>;

    /// Cancela la query en ejecución
    async fn cancel_query(&self) -> Result<(), DomainError>;

    /// Obtiene sugerencias de autocompletado
    async fn get_completions(&self, prefix: &str, context: CompletionContext) -> Result<Vec<CompletionItem>, DomainError>;

    /// Obtiene la versión del servidor
    async fn server_version(&self) -> Result<String, DomainError>;
}

/// Contexto para autocompletado
#[derive(Debug, Clone)]
pub struct CompletionContext {
    pub current_database: Option<String>,
    pub current_schema: Option<String>,
    pub cursor_position: usize,
    pub query_text: String,
}

/// Item de autocompletado
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: CompletionKind,
    pub detail: Option<String>,
    pub insert_text: String,
    pub documentation: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum CompletionKind {
    Keyword,
    Table,
    Column,
    Schema,
    Database,
    Function,
    Snippet,
}

/// Factory para crear drivers SQL
pub trait SqlDriverFactory: Send + Sync {
    fn create_driver(&self, engine: &str) -> Result<Box<dyn SqlDriver>, DomainError>;
    fn supported_engines(&self) -> Vec<&'static str>;
}

/// Pool de conexiones para un driver
#[async_trait]
pub trait ConnectionPool: Send + Sync {
    async fn acquire(&self) -> Result<PooledConnection, DomainError>;
    async fn release(&self, conn: PooledConnection) -> Result<(), DomainError>;
    fn pool_size(&self) -> usize;
    fn available_connections(&self) -> usize;
}

/// Conexión del pool
pub struct PooledConnection {
    pub id: Uuid,
    pub driver_id: String,
}

/// Resultado de ejecución de un statement individual
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StatementResult {
    pub statement_index: usize,
    pub sql: String,
    pub success: bool,
    pub affected_rows: Option<u64>,
    pub result: Option<QueryResult>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Resultado de una transacción
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TransactionResult {
    pub affected_rows: u64,
    pub execution_time_ms: u64,
    pub committed: bool,
}
