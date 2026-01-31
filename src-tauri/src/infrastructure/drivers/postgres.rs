use async_trait::async_trait;
use sqlx::{postgres::PgPoolOptions, PgPool, Row, Column, TypeInfo};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::domain::{
    CellValue, ColumnInfo, ColumnSchema, CompletionContext, CompletionItem, CompletionKind,
    ConstraintInfo, ConstraintType, DatabaseInfo, DomainError, ForeignKeyAction, ForeignKeyInfo, 
    FunctionInfo, IndexInfo, PaginationInfo, PrimaryKeyInfo, 
    QueryResult, SchemaInfo, SequenceInfo, SqlDriver, TableInfo, TriggerEvent, TriggerInfo, 
    TriggerTiming, ViewInfo,
};

pub struct PostgresDriver {
    pool: Arc<RwLock<Option<PgPool>>>,
}

impl PostgresDriver {
    pub fn new() -> Self {
        Self {
            pool: Arc::new(RwLock::new(None)),
        }
    }

    async fn get_pool(&self) -> Result<PgPool, DomainError> {
        let guard = self.pool.read().await;
        guard.clone().ok_or_else(|| DomainError::connection("Not connected"))
    }

    fn map_pg_value(row: &sqlx::postgres::PgRow, idx: usize) -> CellValue {
        let col = row.column(idx);
        let type_name = col.type_info().name();

        // Intentamos obtener el valor según el tipo
        match type_name {
            "BOOL" => row.try_get::<bool, _>(idx)
                .map(CellValue::Bool)
                .unwrap_or(CellValue::Null),
            "INT2" | "INT4" => row.try_get::<i32, _>(idx)
                .map(|v| CellValue::Int(v as i64))
                .unwrap_or(CellValue::Null),
            "INT8" => row.try_get::<i64, _>(idx)
                .map(CellValue::Int)
                .unwrap_or(CellValue::Null),
            "FLOAT4" => row.try_get::<f32, _>(idx)
                .map(|v| CellValue::Float(v as f64))
                .unwrap_or(CellValue::Null),
            "FLOAT8" | "NUMERIC" => row.try_get::<f64, _>(idx)
                .map(CellValue::Float)
                .unwrap_or(CellValue::Null),
            "UUID" => row.try_get::<uuid::Uuid, _>(idx)
                .map(|v| CellValue::Uuid(v.to_string()))
                .unwrap_or(CellValue::Null),
            "JSON" | "JSONB" => row.try_get::<serde_json::Value, _>(idx)
                .map(CellValue::Json)
                .unwrap_or(CellValue::Null),
            "BYTEA" => row.try_get::<Vec<u8>, _>(idx)
                .map(CellValue::Bytes)
                .unwrap_or(CellValue::Null),
            "DATE" => row.try_get::<chrono::NaiveDate, _>(idx)
                .map(|v| CellValue::Date(v.to_string()))
                .unwrap_or(CellValue::Null),
            "TIME" => row.try_get::<chrono::NaiveTime, _>(idx)
                .map(|v| CellValue::Time(v.to_string()))
                .unwrap_or(CellValue::Null),
            "TIMESTAMP" | "TIMESTAMPTZ" => row.try_get::<chrono::DateTime<chrono::Utc>, _>(idx)
                .map(|v| CellValue::DateTime(v.to_rfc3339()))
                .unwrap_or(CellValue::Null),
            _ => row.try_get::<String, _>(idx)
                .map(CellValue::String)
                .unwrap_or(CellValue::Null),
        }
    }
}

impl Default for PostgresDriver {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SqlDriver for PostgresDriver {
    fn driver_id(&self) -> &'static str {
        "postgresql"
    }

    fn display_name(&self) -> &'static str {
        "PostgreSQL"
    }

    async fn connect(&self, connection_string: &str) -> Result<(), DomainError> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(connection_string)
            .await
            .map_err(|e| DomainError::connection(e.to_string()))?;

        let mut guard = self.pool.write().await;
        *guard = Some(pool);
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), DomainError> {
        let mut guard = self.pool.write().await;
        if let Some(pool) = guard.take() {
            pool.close().await;
        }
        Ok(())
    }

    async fn is_connected(&self) -> bool {
        let guard = self.pool.read().await;
        if let Some(pool) = guard.as_ref() {
            !pool.is_closed()
        } else {
            false
        }
    }

    async fn test_connection(&self, connection_string: &str) -> Result<(), DomainError> {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(connection_string)
            .await
            .map_err(|e| DomainError::connection(e.to_string()))?;

        sqlx::query("SELECT 1")
            .fetch_one(&pool)
            .await
            .map_err(|e| DomainError::connection(e.to_string()))?;

        pool.close().await;
        Ok(())
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, DomainError> {
        let pool = self.get_pool().await?;
        let start = Instant::now();

        let rows = sqlx::query(query)
            .fetch_all(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        let execution_time = start.elapsed().as_millis() as u64;

        let columns: Vec<ColumnInfo> = if !rows.is_empty() {
            rows[0]
                .columns()
                .iter()
                .map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: col.type_info().name().to_string(),
                    nullable: true,
                    is_primary_key: false,
                })
                .collect()
        } else {
            vec![]
        };

        let data: Vec<Vec<CellValue>> = rows
            .iter()
            .map(|row| {
                (0..row.columns().len())
                    .map(|idx| Self::map_pg_value(row, idx))
                    .collect()
            })
            .collect();

        Ok(QueryResult::new(query.to_string(), columns, data).with_execution_time(execution_time))
    }

    async fn execute_query_paginated(
        &self,
        query: &str,
        page: u32,
        page_size: u32,
    ) -> Result<QueryResult, DomainError> {
        let offset = (page - 1) * page_size;
        let paginated_query = format!("{} LIMIT {} OFFSET {}", query.trim_end_matches(';'), page_size, offset);

        // Obtener count total
        let count_query = format!("SELECT COUNT(*) as total FROM ({}) as subquery", query.trim_end_matches(';'));
        let pool = self.get_pool().await?;

        let total_rows: i64 = sqlx::query_scalar(&count_query)
            .fetch_one(&pool)
            .await
            .unwrap_or(0);

        let mut result = self.execute_query(&paginated_query).await?;
        let pagination = PaginationInfo::new(page, page_size).with_total(total_rows as u64);
        result = result.with_pagination(pagination);

        Ok(result)
    }

    async fn execute_statement(&self, statement: &str) -> Result<u64, DomainError> {
        let pool = self.get_pool().await?;

        let result = sqlx::query(statement)
            .execute(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(result.rows_affected())
    }

    async fn execute_multi_statement(&self, statements: Vec<String>) -> Result<Vec<crate::domain::StatementResult>, DomainError> {
        let pool = self.get_pool().await?;
        let mut results = Vec::new();

        for (idx, statement) in statements.iter().enumerate() {
            let start = Instant::now();
            let sql = statement.trim();
            
            if sql.is_empty() {
                continue;
            }

            // Detectar si es SELECT o statement de modificación
            let is_select = sql.to_uppercase().trim_start().starts_with("SELECT") ||
                           sql.to_uppercase().trim_start().starts_with("WITH");

            let result = if is_select {
                match self.execute_query(sql).await {
                    Ok(query_result) => crate::domain::StatementResult {
                        statement_index: idx,
                        sql: sql.to_string(),
                        success: true,
                        affected_rows: None,
                        result: Some(query_result),
                        error: None,
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    },
                    Err(e) => crate::domain::StatementResult {
                        statement_index: idx,
                        sql: sql.to_string(),
                        success: false,
                        affected_rows: None,
                        result: None,
                        error: Some(e.to_string()),
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    },
                }
            } else {
                match sqlx::query(sql).execute(&pool).await {
                    Ok(exec_result) => crate::domain::StatementResult {
                        statement_index: idx,
                        sql: sql.to_string(),
                        success: true,
                        affected_rows: Some(exec_result.rows_affected()),
                        result: None,
                        error: None,
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    },
                    Err(e) => crate::domain::StatementResult {
                        statement_index: idx,
                        sql: sql.to_string(),
                        success: false,
                        affected_rows: None,
                        result: None,
                        error: Some(e.to_string()),
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    },
                }
            };

            results.push(result);
        }

        Ok(results)
    }

    async fn execute_in_transaction(&self, statement: &str) -> Result<crate::domain::TransactionResult, DomainError> {
        let pool = self.get_pool().await?;
        let start = Instant::now();
        
        let mut tx = pool.begin()
            .await
            .map_err(|e| DomainError::query(format!("Failed to begin transaction: {}", e)))?;

        let result = sqlx::query(statement)
            .execute(&mut *tx)
            .await;

        match result {
            Ok(exec_result) => {
                tx.commit()
                    .await
                    .map_err(|e| DomainError::query(format!("Failed to commit transaction: {}", e)))?;
                
                Ok(crate::domain::TransactionResult {
                    affected_rows: exec_result.rows_affected(),
                    execution_time_ms: start.elapsed().as_millis() as u64,
                    committed: true,
                })
            }
            Err(e) => {
                tx.rollback()
                    .await
                    .map_err(|e| DomainError::query(format!("Failed to rollback transaction: {}", e)))?;
                
                Err(DomainError::query(e.to_string()))
            }
        }
    }

    async fn list_databases(&self) -> Result<Vec<String>, DomainError> {
        let pool = self.get_pool().await?;

        let rows = sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
            .fetch_all(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows.iter().map(|r| r.get::<String, _>("datname")).collect())
    }

    async fn get_database_info(&self, database: &str) -> Result<DatabaseInfo, DomainError> {
        let schemas = self.list_schemas(database).await?;

        Ok(DatabaseInfo {
            name: database.to_string(),
            schemas,
            size_bytes: None,
            encoding: Some("UTF8".to_string()),
        })
    }

    async fn list_schemas(&self, _database: &str) -> Result<Vec<SchemaInfo>, DomainError> {
        let pool = self.get_pool().await?;

        let rows = sqlx::query(
            "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name"
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        let system_schemas = ["pg_catalog", "information_schema", "pg_toast", "pg_temp_1", "pg_toast_temp_1"];
        
        let mut schemas = Vec::new();
        for row in rows {
            let schema_name: String = row.get("schema_name");
            let is_system = system_schemas.contains(&schema_name.as_str()) || schema_name.starts_with("pg_");

            schemas.push(SchemaInfo {
                name: schema_name,
                tables: vec![],
                views: vec![],
                functions: vec![],
                sequences: vec![],
                is_system,
            });
        }

        Ok(schemas)
    }

    async fn list_tables(&self, schema: Option<&str>) -> Result<Vec<TableInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT table_name FROM information_schema.tables 
             WHERE table_schema = $1 AND table_type = 'BASE TABLE'
             ORDER BY table_name"
        )
        .bind(schema_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        let mut tables = Vec::new();
        for row in rows {
            let table_name: String = row.get("table_name");
            tables.push(TableInfo {
                name: table_name,
                schema: Some(schema_name.to_string()),
                columns: vec![],
                primary_key: None,
                foreign_keys: vec![],
                indexes: vec![],
                constraints: vec![],
                triggers: vec![],
                row_count: None,
                size_bytes: None,
                comment: None,
            });
        }

        Ok(tables)
    }

    async fn get_table_info(&self, table: &str, schema: Option<&str>) -> Result<TableInfo, DomainError> {
        let schema_name = schema.unwrap_or("public");
        let columns = self.get_columns(table, Some(schema_name)).await?;
        let indexes = self.list_indexes(table, Some(schema_name)).await?;
        let constraints = self.list_constraints(table, Some(schema_name)).await?;
        let triggers = self.list_triggers(table, Some(schema_name)).await?;
        let pool = self.get_pool().await?;

        // Primary key
        let pk_rows = sqlx::query(
            "SELECT kcu.column_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu 
               ON tc.constraint_name = kcu.constraint_name
             WHERE tc.table_schema = $1 AND tc.table_name = $2 
               AND tc.constraint_type = 'PRIMARY KEY'"
        )
        .bind(schema_name)
        .bind(table)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        let primary_key = if !pk_rows.is_empty() {
            Some(PrimaryKeyInfo {
                name: None,
                columns: pk_rows.iter().map(|r| r.get::<String, _>("column_name")).collect(),
            })
        } else {
            None
        };

        // Foreign keys
        let fk_rows = sqlx::query(
            "SELECT 
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.key_column_usage AS kcu
               ON tc.constraint_name = kcu.constraint_name
             JOIN information_schema.constraint_column_usage AS ccu
               ON ccu.constraint_name = tc.constraint_name
             WHERE tc.constraint_type = 'FOREIGN KEY' 
               AND tc.table_schema = $1 AND tc.table_name = $2"
        )
        .bind(schema_name)
        .bind(table)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|r| ForeignKeyInfo {
                name: r.get("constraint_name"),
                columns: vec![r.get("column_name")],
                referenced_table: r.get("foreign_table_name"),
                referenced_schema: Some(schema_name.to_string()),
                referenced_columns: vec![r.get("foreign_column_name")],
                on_update: ForeignKeyAction::NoAction,
                on_delete: ForeignKeyAction::NoAction,
            })
            .collect();

        // Row count estimate
        let count_row = sqlx::query(
            "SELECT reltuples::bigint AS estimate FROM pg_class 
             WHERE relname = $1"
        )
        .bind(table)
        .fetch_optional(&pool)
        .await
        .ok()
        .flatten();

        let row_count = count_row.map(|r| r.get::<i64, _>("estimate") as u64);

        Ok(TableInfo {
            name: table.to_string(),
            schema: Some(schema_name.to_string()),
            columns,
            primary_key,
            foreign_keys,
            indexes,
            constraints,
            triggers,
            row_count,
            size_bytes: None,
            comment: None,
        })
    }

    async fn get_columns(&self, table: &str, schema: Option<&str>) -> Result<Vec<ColumnSchema>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT 
                column_name, data_type, udt_name, is_nullable, column_default,
                character_maximum_length, numeric_precision, numeric_scale,
                ordinal_position
             FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2
             ORDER BY ordinal_position"
        )
        .bind(schema_name)
        .bind(table)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| ColumnSchema {
                name: r.get("column_name"),
                data_type: r.get("data_type"),
                native_type: r.get("udt_name"),
                nullable: r.get::<String, _>("is_nullable") == "YES",
                default_value: r.try_get("column_default").ok(),
                is_primary_key: false,
                is_unique: false,
                is_auto_increment: r.try_get::<String, _>("column_default")
                    .map(|d| d.contains("nextval"))
                    .unwrap_or(false),
                max_length: r.try_get::<i32, _>("character_maximum_length").ok().map(|v| v as u32),
                numeric_precision: r.try_get::<i32, _>("numeric_precision").ok().map(|v| v as u32),
                numeric_scale: r.try_get::<i32, _>("numeric_scale").ok().map(|v| v as u32),
                comment: None,
                ordinal_position: r.get::<i32, _>("ordinal_position") as u32,
            })
            .collect())
    }

    async fn list_views(&self, schema: Option<&str>) -> Result<Vec<ViewInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT table_name, view_definition FROM information_schema.views 
             WHERE table_schema = $1 ORDER BY table_name"
        )
        .bind(schema_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| ViewInfo {
                name: r.get("table_name"),
                schema: Some(schema_name.to_string()),
                columns: vec![],
                definition: r.try_get("view_definition").ok(),
                is_materialized: false,
            })
            .collect())
    }

    async fn list_indexes(&self, table: &str, schema: Option<&str>) -> Result<Vec<IndexInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT 
                i.relname as index_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                am.amname as index_type,
                array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
             FROM pg_class t
             JOIN pg_index ix ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_am am ON i.relam = am.oid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
             WHERE t.relname = $1 AND n.nspname = $2
             GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
             ORDER BY i.relname"
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| IndexInfo {
                name: r.get("index_name"),
                columns: r.get::<Vec<String>, _>("columns"),
                is_unique: r.get("is_unique"),
                is_primary: r.get("is_primary"),
                index_type: r.get("index_type"),
            })
            .collect())
    }

    async fn list_constraints(&self, table: &str, schema: Option<&str>) -> Result<Vec<ConstraintInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT 
                tc.constraint_name,
                tc.constraint_type,
                array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns,
                cc.check_clause as definition
             FROM information_schema.table_constraints tc
             LEFT JOIN information_schema.key_column_usage kcu 
               ON tc.constraint_name = kcu.constraint_name 
               AND tc.table_schema = kcu.table_schema
             LEFT JOIN information_schema.check_constraints cc
               ON tc.constraint_name = cc.constraint_name
             WHERE tc.table_schema = $1 AND tc.table_name = $2
             GROUP BY tc.constraint_name, tc.constraint_type, cc.check_clause
             ORDER BY tc.constraint_name"
        )
        .bind(schema_name)
        .bind(table)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| {
                let constraint_type_str: String = r.get("constraint_type");
                let constraint_type = match constraint_type_str.as_str() {
                    "PRIMARY KEY" => ConstraintType::PrimaryKey,
                    "FOREIGN KEY" => ConstraintType::ForeignKey,
                    "UNIQUE" => ConstraintType::Unique,
                    "CHECK" => ConstraintType::Check,
                    "EXCLUSION" => ConstraintType::Exclusion,
                    _ => ConstraintType::Check,
                };
                ConstraintInfo {
                    name: r.get("constraint_name"),
                    constraint_type,
                    columns: r.try_get::<Vec<String>, _>("columns").unwrap_or_default(),
                    definition: r.try_get("definition").ok(),
                }
            })
            .collect())
    }

    async fn list_triggers(&self, table: &str, schema: Option<&str>) -> Result<Vec<TriggerInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT 
                t.tgname as trigger_name,
                CASE 
                    WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
                    WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
                    ELSE 'AFTER'
                END as timing,
                t.tgtype,
                t.tgenabled != 'D' as enabled,
                pg_get_triggerdef(t.oid) as definition
             FROM pg_trigger t
             JOIN pg_class c ON t.tgrelid = c.oid
             JOIN pg_namespace n ON c.relnamespace = n.oid
             WHERE c.relname = $1 AND n.nspname = $2 AND NOT t.tgisinternal
             ORDER BY t.tgname"
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| {
                let timing_str: String = r.get("timing");
                let timing = match timing_str.as_str() {
                    "BEFORE" => TriggerTiming::Before,
                    "INSTEAD OF" => TriggerTiming::InsteadOf,
                    _ => TriggerTiming::After,
                };
                let tgtype: i16 = r.get("tgtype");
                let mut events = Vec::new();
                if tgtype & 4 == 4 { events.push(TriggerEvent::Insert); }
                if tgtype & 8 == 8 { events.push(TriggerEvent::Delete); }
                if tgtype & 16 == 16 { events.push(TriggerEvent::Update); }
                if tgtype & 32 == 32 { events.push(TriggerEvent::Truncate); }

                TriggerInfo {
                    name: r.get("trigger_name"),
                    table_name: table.to_string(),
                    schema: Some(schema_name.to_string()),
                    timing,
                    events,
                    definition: r.try_get("definition").ok(),
                    enabled: r.get("enabled"),
                }
            })
            .collect())
    }

    async fn list_functions(&self, schema: Option<&str>) -> Result<Vec<FunctionInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT 
                p.proname as function_name,
                pg_get_function_result(p.oid) as return_type,
                l.lanname as language,
                pg_get_functiondef(p.oid) as definition
             FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             JOIN pg_language l ON p.prolang = l.oid
             WHERE n.nspname = $1 AND p.prokind = 'f'
             ORDER BY p.proname"
        )
        .bind(schema_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| FunctionInfo {
                name: r.get("function_name"),
                schema: Some(schema_name.to_string()),
                return_type: r.try_get("return_type").ok(),
                parameters: vec![],
                language: r.get("language"),
                definition: r.try_get("definition").ok(),
            })
            .collect())
    }

    async fn list_sequences(&self, schema: Option<&str>) -> Result<Vec<SequenceInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let schema_name = schema.unwrap_or("public");

        let rows = sqlx::query(
            "SELECT 
                s.relname as sequence_name,
                seq.seqtypid::regtype::text as data_type,
                seq.seqstart as start_value,
                seq.seqincrement as increment,
                seq.seqmin as min_value,
                seq.seqmax as max_value
             FROM pg_class s
             JOIN pg_sequence seq ON s.oid = seq.seqrelid
             JOIN pg_namespace n ON s.relnamespace = n.oid
             WHERE n.nspname = $1 AND s.relkind = 'S'
             ORDER BY s.relname"
        )
        .bind(schema_name)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| SequenceInfo {
                name: r.get("sequence_name"),
                schema: Some(schema_name.to_string()),
                data_type: r.get("data_type"),
                start_value: r.get("start_value"),
                increment: r.get("increment"),
                min_value: r.try_get("min_value").ok(),
                max_value: r.try_get("max_value").ok(),
                current_value: None,
            })
            .collect())
    }

    async fn cancel_query(&self) -> Result<(), DomainError> {
        // PostgreSQL soporta pg_cancel_backend, pero requiere el PID
        // Por ahora retornamos Ok
        Ok(())
    }

    async fn get_completions(&self, prefix: &str, context: CompletionContext) -> Result<Vec<CompletionItem>, DomainError> {
        let mut completions = Vec::new();
        let pool = self.get_pool().await?;
        let prefix_lower = prefix.to_lowercase();

        // SQL Keywords
        let keywords = ["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
            "ON", "AND", "OR", "NOT", "IN", "LIKE", "ORDER", "BY", "GROUP", "HAVING",
            "LIMIT", "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
            "CREATE", "TABLE", "INDEX", "VIEW", "DROP", "ALTER", "ADD", "COLUMN"];

        for kw in keywords {
            if kw.to_lowercase().starts_with(&prefix_lower) {
                completions.push(CompletionItem {
                    label: kw.to_string(),
                    kind: CompletionKind::Keyword,
                    detail: Some("SQL Keyword".to_string()),
                    insert_text: kw.to_string(),
                    documentation: None,
                });
            }
        }

        // Tables
        let schema = context.current_schema.as_deref().unwrap_or("public");
        let tables = sqlx::query(
            "SELECT table_name FROM information_schema.tables 
             WHERE table_schema = $1 AND LOWER(table_name) LIKE $2
             LIMIT 20"
        )
        .bind(schema)
        .bind(format!("{}%", prefix_lower))
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        for row in tables {
            let name: String = row.get("table_name");
            completions.push(CompletionItem {
                label: name.clone(),
                kind: CompletionKind::Table,
                detail: Some(format!("Table in {}", schema)),
                insert_text: name,
                documentation: None,
            });
        }

        Ok(completions)
    }

    async fn server_version(&self) -> Result<String, DomainError> {
        let pool = self.get_pool().await?;

        let row = sqlx::query("SELECT version()")
            .fetch_one(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(row.get::<String, _>(0))
    }
}
