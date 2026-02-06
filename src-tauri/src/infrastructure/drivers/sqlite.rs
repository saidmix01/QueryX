use async_trait::async_trait;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Row, Column, TypeInfo};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::domain::{
    CellValue, ColumnInfo, ColumnSchema, CompletionContext, CompletionItem, CompletionKind,
    ConstraintInfo, ConstraintType, DatabaseInfo, DomainError, FunctionInfo, IndexInfo, 
    PaginationInfo, PrimaryKeyInfo, QueryResult, SchemaInfo, SequenceInfo, SqlDriver, 
    TableInfo, TriggerEvent, TriggerInfo, TriggerTiming, ViewInfo,
};

pub struct SqliteDriver {
    pool: Arc<RwLock<Option<SqlitePool>>>,
}

impl SqliteDriver {
    pub fn new() -> Self {
        Self {
            pool: Arc::new(RwLock::new(None)),
        }
    }

    async fn get_pool(&self) -> Result<SqlitePool, DomainError> {
        let guard = self.pool.read().await;
        guard.clone().ok_or_else(|| DomainError::connection("Not connected"))
    }

    fn map_sqlite_value(row: &sqlx::sqlite::SqliteRow, idx: usize) -> CellValue {
        let col = row.column(idx);
        let type_name = col.type_info().name();

        match type_name {
            "INTEGER" => row.try_get::<i64, _>(idx)
                .map(CellValue::Int)
                .unwrap_or(CellValue::Null),
            "REAL" => row.try_get::<f64, _>(idx)
                .map(CellValue::Float)
                .unwrap_or(CellValue::Null),
            "BLOB" => row.try_get::<Vec<u8>, _>(idx)
                .map(CellValue::Bytes)
                .unwrap_or(CellValue::Null),
            _ => row.try_get::<String, _>(idx)
                .map(CellValue::String)
                .unwrap_or(CellValue::Null),
        }
    }
}

impl Default for SqliteDriver {
    fn default() -> Self {
        Self::new()
    }
}


#[async_trait]
impl SqlDriver for SqliteDriver {
    fn driver_id(&self) -> &'static str { "sqlite" }
    fn display_name(&self) -> &'static str { "SQLite" }

    async fn connect(&self, connection_string: &str) -> Result<(), DomainError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
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
        guard.as_ref().map(|p| !p.is_closed()).unwrap_or(false)
    }

    async fn test_connection(&self, connection_string: &str) -> Result<(), DomainError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(connection_string)
            .await
            .map_err(|e| DomainError::connection(e.to_string()))?;
        sqlx::query("SELECT 1").fetch_one(&pool).await
            .map_err(|e| DomainError::connection(e.to_string()))?;
        pool.close().await;
        Ok(())
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, DomainError> {
        let pool = self.get_pool().await?;
        let start = Instant::now();
        let rows = sqlx::query(query).fetch_all(&pool).await
            .map_err(|e| DomainError::query(e.to_string()))?;
        let execution_time = start.elapsed().as_millis() as u64;

        let columns: Vec<ColumnInfo> = if !rows.is_empty() {
            rows[0].columns().iter().map(|col| ColumnInfo {
                name: col.name().to_string(),
                data_type: col.type_info().name().to_string(),
                nullable: true,
                is_primary_key: false,
            }).collect()
        } else { vec![] };

        let data: Vec<Vec<CellValue>> = rows.iter().map(|row| {
            (0..row.columns().len()).map(|idx| Self::map_sqlite_value(row, idx)).collect()
        }).collect();

        Ok(QueryResult::new(query.to_string(), columns, data).with_execution_time(execution_time))
    }


    async fn execute_query_paginated(&self, query: &str, page: u32, page_size: u32) -> Result<QueryResult, DomainError> {
        let offset = (page - 1) * page_size;
        let paginated = format!("{} LIMIT {} OFFSET {}", query.trim_end_matches(';'), page_size, offset);
        let count_query = format!("SELECT COUNT(*) FROM ({}) as sq", query.trim_end_matches(';'));
        let pool = self.get_pool().await?;
        let total: i64 = sqlx::query_scalar(&count_query).fetch_one(&pool).await.unwrap_or(0);
        let mut result = self.execute_query(&paginated).await?;
        result = result.with_pagination(PaginationInfo::new(page, page_size).with_total(total as u64));
        Ok(result)
    }

    async fn insert_row(
        &self,
        _schema: Option<&str>,
        table: &str,
        values: std::collections::HashMap<String, serde_json::Value>,
    ) -> Result<QueryResult, DomainError> {
        let pool = self.get_pool().await?;
        
        // 1. Obtener columnas
        let columns_info = self.get_columns(table, None).await?;
        let col_map: std::collections::HashMap<String, ColumnSchema> = columns_info
            .iter()
            .map(|c| (c.name.clone(), c.clone()))
            .collect();

        // 2. Preparar valores
        let mut valid_entries = Vec::new();
        for (key, val) in values {
            if let Some(info) = col_map.get(&key) {
                let is_empty = val.is_null() || (val.is_string() && val.as_str().unwrap().is_empty());
                // SQLite no tiene AUTO_INCREMENT en columnas no-PK tan estricto, pero ROWID sí.
                // Si es PK INTEGER, es auto-increment por defecto.
                if is_empty && (info.default_value.is_some() || info.is_primary_key) {
                    continue;
                }
                valid_entries.push((key, val, info.clone()));
            }
        }

        let sql = if valid_entries.is_empty() {
             format!("INSERT INTO {} DEFAULT VALUES", table)
        } else {
             let cols_sql = valid_entries.iter().map(|(k,_,_)| format!("\"{}\"", k)).collect::<Vec<_>>().join(", ");
             let vals_sql = (0..valid_entries.len()).map(|_| "?").collect::<Vec<_>>().join(", ");
             format!("INSERT INTO {} ({}) VALUES ({})", table, cols_sql, vals_sql)
        };

        // 3. Ejecutar
        // SQLite soporta RETURNING * en versiones recientes (3.35+). 
        // Intentaremos usar RETURNING * si es posible.
        let sql_returning = format!("{} RETURNING *", sql);
        
        let mut query_builder = sqlx::query(&sql_returning);
        for (_, val, _) in &valid_entries {
             if val.is_null() {
                 query_builder = query_builder.bind(Option::<String>::None);
             } else if let Some(b) = val.as_bool() {
                 query_builder = query_builder.bind(b);
             } else if let Some(i) = val.as_i64() {
                 query_builder = query_builder.bind(i);
             } else if let Some(f) = val.as_f64() {
                 query_builder = query_builder.bind(f);
             } else {
                 let s = val.as_str().map(|s| s.to_string()).unwrap_or_else(|| val.to_string());
                 query_builder = query_builder.bind(s);
             }
        }

        // Intentar ejecutar con RETURNING
        let result = query_builder.fetch_one(&pool).await;

        match result {
            Ok(row) => {
                let columns: Vec<ColumnInfo> = row.columns().iter().map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: col.type_info().name().to_string(),
                    nullable: true,
                    is_primary_key: false,
                }).collect();

                let data: Vec<Vec<CellValue>> = vec![
                    (0..row.columns().len())
                        .map(|idx| Self::map_sqlite_value(&row, idx))
                        .collect()
                ];
                Ok(QueryResult::new(sql_returning, columns, data))
            },
            Err(_) => {
                // Fallback si RETURNING falla (versión vieja de SQLite)
                // Ejecutar INSERT normal y luego SELECT
                let mut query_builder = sqlx::query(&sql);
                for (_, val, _) in &valid_entries {
                     if val.is_null() {
                         query_builder = query_builder.bind(Option::<String>::None);
                     } else if let Some(b) = val.as_bool() {
                         query_builder = query_builder.bind(b);
                     } else if let Some(i) = val.as_i64() {
                         query_builder = query_builder.bind(i);
                     } else if let Some(f) = val.as_f64() {
                         query_builder = query_builder.bind(f);
                     } else {
                         let s = val.as_str().map(|s| s.to_string()).unwrap_or_else(|| val.to_string());
                         query_builder = query_builder.bind(s);
                     }
                }
                
                let exec_result = query_builder.execute(&pool).await
                    .map_err(|e| DomainError::query(e.to_string()))?;
                
                let last_id = exec_result.last_insert_rowid();
                
                // Fetch inserted row using ROWID
                let fetch_sql = format!("SELECT * FROM {} WHERE rowid = ?", table);
                let row = sqlx::query(&fetch_sql)
                    .bind(last_id)
                    .fetch_one(&pool)
                    .await
                    .map_err(|e| DomainError::query(e.to_string()))?;

                let columns: Vec<ColumnInfo> = row.columns().iter().map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: col.type_info().name().to_string(),
                    nullable: true,
                    is_primary_key: false,
                }).collect();

                let data: Vec<Vec<CellValue>> = vec![
                    (0..row.columns().len())
                        .map(|idx| Self::map_sqlite_value(&row, idx))
                        .collect()
                ];
                
                Ok(QueryResult::new(sql, columns, data))
            }
        }
    }

    async fn execute_statement(&self, statement: &str) -> Result<u64, DomainError> {
        let pool = self.get_pool().await?;
        let result = sqlx::query(statement).execute(&pool).await
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
        Ok(vec!["main".to_string()])
    }

    async fn get_database_info(&self, database: &str) -> Result<DatabaseInfo, DomainError> {
        Ok(DatabaseInfo {
            name: database.to_string(),
            schemas: self.list_schemas(database).await?,
            size_bytes: None,
            encoding: Some("UTF-8".to_string()),
        })
    }

    async fn list_schemas(&self, _database: &str) -> Result<Vec<SchemaInfo>, DomainError> {
        Ok(vec![SchemaInfo { 
            name: "main".to_string(), 
            tables: vec![], 
            views: vec![], 
            functions: vec![],
            sequences: vec![],
            is_system: false,
        }])
    }

    async fn list_tables(&self, _schema: Option<&str>) -> Result<Vec<TableInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .fetch_all(&pool).await.map_err(|e| DomainError::query(e.to_string()))?;
        Ok(rows.iter().map(|r| TableInfo {
            name: r.get::<String, _>("name"),
            schema: Some("main".to_string()),
            columns: vec![], primary_key: None, foreign_keys: vec![], indexes: vec![],
            constraints: vec![], triggers: vec![],
            row_count: None, size_bytes: None, comment: None,
        }).collect())
    }


    async fn get_table_info(&self, table: &str, _schema: Option<&str>) -> Result<TableInfo, DomainError> {
        let columns = self.get_columns(table, None).await?;
        let indexes = self.list_indexes(table, None).await?;
        let constraints = self.list_constraints(table, None).await?;
        let triggers = self.list_triggers(table, None).await?;
        
        let pk_cols: Vec<String> = columns.iter().filter(|c| c.is_primary_key).map(|c| c.name.clone()).collect();
        let primary_key = if !pk_cols.is_empty() { Some(PrimaryKeyInfo { name: None, columns: pk_cols }) } else { None };

        Ok(TableInfo {
            name: table.to_string(), schema: Some("main".to_string()), columns, primary_key,
            foreign_keys: vec![], indexes, constraints, triggers,
            row_count: None, size_bytes: None, comment: None,
        })
    }

    async fn get_columns(&self, table: &str, _schema: Option<&str>) -> Result<Vec<ColumnSchema>, DomainError> {
        let pool = self.get_pool().await?;
        let rows = sqlx::query(&format!("PRAGMA table_info('{}')", table))
            .fetch_all(&pool).await.map_err(|e| DomainError::query(e.to_string()))?;
        Ok(rows.iter().map(|r| ColumnSchema {
            name: r.get("name"), data_type: r.get("type"), native_type: r.get("type"),
            nullable: r.get::<i32, _>("notnull") == 0,
            default_value: r.try_get("dflt_value").ok(),
            is_primary_key: r.get::<i32, _>("pk") == 1,
            is_unique: false, is_auto_increment: false,
            max_length: None, numeric_precision: None, numeric_scale: None, comment: None,
            ordinal_position: r.get::<i32, _>("cid") as u32,
        }).collect())
    }

    async fn list_views(&self, _schema: Option<&str>) -> Result<Vec<ViewInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let rows = sqlx::query("SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name")
            .fetch_all(&pool).await.map_err(|e| DomainError::query(e.to_string()))?;
        Ok(rows.iter().map(|r| ViewInfo {
            name: r.get("name"), schema: Some("main".to_string()), columns: vec![],
            definition: r.try_get("sql").ok(), is_materialized: false,
        }).collect())
    }

    async fn list_indexes(&self, table: &str, _schema: Option<&str>) -> Result<Vec<IndexInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let idx_rows = sqlx::query(&format!("PRAGMA index_list('{}')", table))
            .fetch_all(&pool).await.map_err(|e| DomainError::query(e.to_string()))?;
        
        let mut indexes = Vec::new();
        for row in idx_rows {
            let name: String = row.get("name");
            let is_unique: i32 = row.get("unique");
            
            // Get columns for this index
            let col_rows = sqlx::query(&format!("PRAGMA index_info('{}')", name))
                .fetch_all(&pool).await.unwrap_or_default();
            let columns: Vec<String> = col_rows.iter().map(|r| r.get("name")).collect();
            
            indexes.push(IndexInfo {
                name,
                columns,
                is_unique: is_unique == 1,
                is_primary: false,
                index_type: "btree".to_string(),
            });
        }
        Ok(indexes)
    }

    async fn list_constraints(&self, table: &str, _schema: Option<&str>) -> Result<Vec<ConstraintInfo>, DomainError> {
        let columns = self.get_columns(table, None).await?;
        let mut constraints = Vec::new();
        
        // Primary key constraint
        let pk_cols: Vec<String> = columns.iter().filter(|c| c.is_primary_key).map(|c| c.name.clone()).collect();
        if !pk_cols.is_empty() {
            constraints.push(ConstraintInfo {
                name: format!("{}_pkey", table),
                constraint_type: ConstraintType::PrimaryKey,
                columns: pk_cols,
                definition: None,
            });
        }
        
        Ok(constraints)
    }

    async fn list_triggers(&self, table: &str, _schema: Option<&str>) -> Result<Vec<TriggerInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let rows = sqlx::query(
            "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name = ? ORDER BY name"
        )
        .bind(table)
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows.iter().map(|r| {
            let sql: String = r.try_get("sql").unwrap_or_default();
            let timing = if sql.to_uppercase().contains("BEFORE") {
                TriggerTiming::Before
            } else if sql.to_uppercase().contains("INSTEAD OF") {
                TriggerTiming::InsteadOf
            } else {
                TriggerTiming::After
            };
            
            let mut events = Vec::new();
            let sql_upper = sql.to_uppercase();
            if sql_upper.contains("INSERT") { events.push(TriggerEvent::Insert); }
            if sql_upper.contains("UPDATE") { events.push(TriggerEvent::Update); }
            if sql_upper.contains("DELETE") { events.push(TriggerEvent::Delete); }

            TriggerInfo {
                name: r.get("name"),
                table_name: table.to_string(),
                schema: Some("main".to_string()),
                timing,
                events,
                definition: Some(sql),
                enabled: true,
            }
        }).collect())
    }

    async fn list_functions(&self, _schema: Option<&str>) -> Result<Vec<FunctionInfo>, DomainError> {
        // SQLite no tiene funciones definidas por usuario en el catálogo
        Ok(vec![])
    }

    async fn list_sequences(&self, _schema: Option<&str>) -> Result<Vec<SequenceInfo>, DomainError> {
        // SQLite no tiene secuencias
        Ok(vec![])
    }

    async fn cancel_query(&self) -> Result<(), DomainError> { Ok(()) }

    async fn get_completions(&self, prefix: &str, _ctx: CompletionContext) -> Result<Vec<CompletionItem>, DomainError> {
        let keywords = ["SELECT", "FROM", "WHERE", "JOIN", "AND", "OR", "ORDER", "BY", "LIMIT"];
        Ok(keywords.iter().filter(|k| k.to_lowercase().starts_with(&prefix.to_lowercase()))
            .map(|k| CompletionItem {
                label: k.to_string(), kind: CompletionKind::Keyword,
                detail: Some("SQL Keyword".to_string()), insert_text: k.to_string(), documentation: None,
            }).collect())
    }

    async fn server_version(&self) -> Result<String, DomainError> {
        let pool = self.get_pool().await?;
        let row = sqlx::query("SELECT sqlite_version()").fetch_one(&pool).await
            .map_err(|e| DomainError::query(e.to_string()))?;
        Ok(row.get::<String, _>(0))
    }
}
