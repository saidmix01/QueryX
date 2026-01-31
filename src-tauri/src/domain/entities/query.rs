use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Resultado de una query SQL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub id: Uuid,
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<CellValue>>,
    pub row_count: usize,
    pub affected_rows: Option<u64>,
    pub execution_time_ms: u64,
    pub query: String,
    pub executed_at: DateTime<Utc>,
    pub pagination: Option<PaginationInfo>,
}

impl QueryResult {
    pub fn new(query: String, columns: Vec<ColumnInfo>, rows: Vec<Vec<CellValue>>) -> Self {
        let row_count = rows.len();
        Self {
            id: Uuid::new_v4(),
            columns,
            rows,
            row_count,
            affected_rows: None,
            execution_time_ms: 0,
            query,
            executed_at: Utc::now(),
            pagination: None,
        }
    }

    pub fn with_execution_time(mut self, ms: u64) -> Self {
        self.execution_time_ms = ms;
        self
    }

    pub fn with_affected_rows(mut self, count: u64) -> Self {
        self.affected_rows = Some(count);
        self
    }

    pub fn with_pagination(mut self, pagination: PaginationInfo) -> Self {
        self.pagination = Some(pagination);
        self
    }
}

/// Información de una columna
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
}

/// Valor de una celda normalizado
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum CellValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
    Bytes(Vec<u8>),
    Date(String),
    Time(String),
    DateTime(String),
    Json(serde_json::Value),
    Uuid(String),
    Array(Vec<CellValue>),
}

impl CellValue {
    pub fn type_name(&self) -> &'static str {
        match self {
            CellValue::Null => "null",
            CellValue::Bool(_) => "bool",
            CellValue::Int(_) => "int",
            CellValue::Float(_) => "float",
            CellValue::String(_) => "string",
            CellValue::Bytes(_) => "bytes",
            CellValue::Date(_) => "date",
            CellValue::Time(_) => "time",
            CellValue::DateTime(_) => "datetime",
            CellValue::Json(_) => "json",
            CellValue::Uuid(_) => "uuid",
            CellValue::Array(_) => "array",
        }
    }
}

/// Información de paginación
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub page_size: u32,
    pub total_rows: Option<u64>,
    pub total_pages: Option<u32>,
    pub has_next: bool,
    pub has_previous: bool,
}

impl PaginationInfo {
    pub fn new(page: u32, page_size: u32) -> Self {
        Self {
            page,
            page_size,
            total_rows: None,
            total_pages: None,
            has_next: false,
            has_previous: page > 1,
        }
    }

    pub fn with_total(mut self, total_rows: u64) -> Self {
        self.total_rows = Some(total_rows);
        self.total_pages = Some((total_rows as f64 / self.page_size as f64).ceil() as u32);
        self.has_next = self.page < self.total_pages.unwrap_or(1);
        self
    }
}

/// Entrada en el historial de queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryEntry {
    pub id: Uuid,
    pub connection_id: Uuid,
    pub query: String,
    pub executed_at: DateTime<Utc>,
    pub execution_time_ms: u64,
    pub row_count: Option<usize>,
    pub success: bool,
    pub error_message: Option<String>,
}

impl QueryHistoryEntry {
    pub fn success(connection_id: Uuid, query: String, execution_time_ms: u64, row_count: usize) -> Self {
        Self {
            id: Uuid::new_v4(),
            connection_id,
            query,
            executed_at: Utc::now(),
            execution_time_ms,
            row_count: Some(row_count),
            success: true,
            error_message: None,
        }
    }

    pub fn failure(connection_id: Uuid, query: String, error: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            connection_id,
            query,
            executed_at: Utc::now(),
            execution_time_ms: 0,
            row_count: None,
            success: false,
            error_message: Some(error),
        }
    }
}

/// DTO para ejecutar queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteQueryDto {
    pub connection_id: Uuid,
    pub query: String,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}
