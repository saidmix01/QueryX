use async_trait::async_trait;
use sqlx::{mysql::MySqlPoolOptions, MySqlPool, Row, Column, TypeInfo};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use crate::domain::{
    CellValue, ColumnInfo, ColumnSchema, CompletionContext, CompletionItem, CompletionKind,
    ConstraintInfo, ConstraintType, DatabaseInfo, DomainError, ForeignKeyAction, ForeignKeyInfo, 
    FunctionInfo, IndexInfo, PaginationInfo, PrimaryKeyInfo, QueryResult, SchemaInfo, 
    SequenceInfo, SqlDriver, TableInfo, TriggerEvent, TriggerInfo, TriggerTiming, ViewInfo,
};

pub struct MySqlDriver {
    pool: Arc<RwLock<Option<MySqlPool>>>,
}

impl MySqlDriver {
    pub fn new() -> Self {
        Self {
            pool: Arc::new(RwLock::new(None)),
        }
    }

    async fn get_pool(&self) -> Result<MySqlPool, DomainError> {
        let guard = self.pool.read().await;
        guard.clone().ok_or_else(|| DomainError::connection("Not connected"))
    }

    fn map_mysql_value(row: &sqlx::mysql::MySqlRow, idx: usize) -> CellValue {
        let col = row.column(idx);
        let type_name = col.type_info().name();

        match type_name {
            "BOOLEAN" | "TINYINT(1)" => row.try_get::<bool, _>(idx)
                .map(CellValue::Bool)
                .unwrap_or(CellValue::Null),
            "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" => row.try_get::<i32, _>(idx)
                .map(|v| CellValue::Int(v as i64))
                .unwrap_or(CellValue::Null),
            "BIGINT" => row.try_get::<i64, _>(idx)
                .map(CellValue::Int)
                .unwrap_or(CellValue::Null),
            "FLOAT" => row.try_get::<f32, _>(idx)
                .map(|v| CellValue::Float(v as f64))
                .unwrap_or(CellValue::Null),
            "DOUBLE" | "DECIMAL" => row.try_get::<f64, _>(idx)
                .map(CellValue::Float)
                .unwrap_or(CellValue::Null),
            "DATE" => row.try_get::<chrono::NaiveDate, _>(idx)
                .map(|v| CellValue::Date(v.to_string()))
                .unwrap_or(CellValue::Null),
            "TIME" => row.try_get::<chrono::NaiveTime, _>(idx)
                .map(|v| CellValue::Time(v.to_string()))
                .unwrap_or(CellValue::Null),
            "DATETIME" | "TIMESTAMP" => row.try_get::<chrono::NaiveDateTime, _>(idx)
                .map(|v| CellValue::DateTime(v.to_string()))
                .unwrap_or(CellValue::Null),
            "BLOB" | "BINARY" | "VARBINARY" => row.try_get::<Vec<u8>, _>(idx)
                .map(CellValue::Bytes)
                .unwrap_or(CellValue::Null),
            "JSON" => row.try_get::<serde_json::Value, _>(idx)
                .map(CellValue::Json)
                .unwrap_or(CellValue::Null),
            _ => row.try_get::<String, _>(idx)
                .map(CellValue::String)
                .unwrap_or(CellValue::Null),
        }
    }
}

impl Default for MySqlDriver {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SqlDriver for MySqlDriver {
    fn driver_id(&self) -> &'static str {
        "mysql"
    }

    fn display_name(&self) -> &'static str {
        "MySQL"
    }

    async fn connect(&self, connection_string: &str) -> Result<(), DomainError> {
        let pool = MySqlPoolOptions::new()
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
        let pool = MySqlPoolOptions::new()
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
                    .map(|idx| Self::map_mysql_value(row, idx))
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

    async fn insert_row(
        &self,
        schema: Option<&str>,
        table: &str,
        values: std::collections::HashMap<String, serde_json::Value>,
    ) -> Result<QueryResult, DomainError> {
        let pool = self.get_pool().await?;
        // MySQL no usa schemas como PG, el schema es la base de datos
        let _db = schema.unwrap_or("DATABASE()"); // o el contexto actual
        
        // 1. Obtener columnas para validar tipos y defaults
        let columns_info = self.get_columns(table, schema).await?;
        let col_map: std::collections::HashMap<String, ColumnSchema> = columns_info
            .iter()
            .map(|c| (c.name.clone(), c.clone()))
            .collect();

        // 2. Filtrar y preparar valores
        let mut valid_entries = Vec::new();
        for (key, val) in values {
            if let Some(info) = col_map.get(&key) {
                // Si es null/vacío y tiene default o es auto-increment, lo omitimos
                let is_empty = val.is_null() || (val.is_string() && val.as_str().unwrap().is_empty());
                
                if is_empty && (info.default_value.is_some() || info.is_auto_increment) {
                    continue;
                }
                valid_entries.push((key, val, info.clone()));
            }
        }

        if valid_entries.is_empty() {
             // INSERT VALUES () no es estándar en MySQL, se usa INSERT INTO table () VALUES () o DEFAULT VALUES si soporta
             // MySQL: INSERT INTO table VALUES () o INSERT INTO table () VALUES ()
             let sql = format!("INSERT INTO {} () VALUES ()", table);
             
             let result = sqlx::query(&sql)
                .execute(&pool)
                .await
                .map_err(|e| DomainError::query(e.to_string()))?;
                
             let last_id = result.last_insert_id();
             
             // Intentar recuperar la fila insertada si hay PK
             if last_id > 0 {
                 let pk_col = columns_info.iter().find(|c| c.is_primary_key || c.is_auto_increment);
                 if let Some(pk) = pk_col {
                     let fetch_sql = format!("SELECT * FROM {} WHERE {} = ?", table, pk.name);
                     let rows = sqlx::query(&fetch_sql)
                         .bind(last_id)
                         .fetch_all(&pool)
                         .await
                         .map_err(|e| DomainError::query(e.to_string()))?;
                         
                     if let Some(row) = rows.first() {
                         let columns: Vec<ColumnInfo> = row.columns().iter().map(|col| ColumnInfo {
                            name: col.name().to_string(),
                            data_type: col.type_info().name().to_string(),
                            nullable: true, 
                            is_primary_key: false,
                        }).collect();
            
                        let data: Vec<Vec<CellValue>> = vec![
                            (0..row.columns().len())
                                .map(|idx| Self::map_mysql_value(row, idx))
                                .collect()
                        ];
                        return Ok(QueryResult::new(sql, columns, data));
                     }
                 }
             }
             
             // Si no pudimos recuperar, devolvemos resultado vacío con métricas
             return Ok(QueryResult::new(sql, vec![], vec![]).with_affected_rows(result.rows_affected()));
        }

        // 3. Construir query dinámica
        let cols_sql = valid_entries.iter().map(|(k,_,_)| format!("`{}`", k)).collect::<Vec<_>>().join(", ");
        let vals_sql = (0..valid_entries.len()).map(|_| "?").collect::<Vec<_>>().join(", ");
        let sql = format!("INSERT INTO {} ({}) VALUES ({})", table, cols_sql, vals_sql);

        // 4. Ejecutar
        let mut query_builder = sqlx::query(&sql);
        
        for (_, val, info) in &valid_entries {
            let type_name = info.data_type.to_lowercase();
            
            if type_name.contains("bool") || type_name.contains("tinyint(1)") {
                 query_builder = query_builder.bind(val.as_bool());
            } else if type_name.contains("int") {
                 if let Some(i) = val.as_i64() {
                     query_builder = query_builder.bind(i);
                 } else {
                     query_builder = query_builder.bind(Option::<i64>::None);
                 }
            } else if type_name.contains("float") || type_name.contains("double") || type_name.contains("decimal") {
                 query_builder = query_builder.bind(val.as_f64());
            } else {
                 if val.is_null() {
                     query_builder = query_builder.bind(Option::<String>::None);
                 } else if let Some(s) = val.as_str() {
                     query_builder = query_builder.bind(s);
                 } else {
                     query_builder = query_builder.bind(val.to_string());
                 }
            }
        }

        let result = query_builder
            .execute(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        // 5. Intentar recuperar la fila
        let last_id = result.last_insert_id();
        if last_id > 0 {
             let pk_col = columns_info.iter().find(|c| c.is_primary_key || c.is_auto_increment);
             if let Some(pk) = pk_col {
                 let fetch_sql = format!("SELECT * FROM {} WHERE {} = ?", table, pk.name);
                 let rows = sqlx::query(&fetch_sql)
                     .bind(last_id)
                     .fetch_all(&pool)
                     .await
                     .map_err(|e| DomainError::query(e.to_string()))?;
                     
                 if let Some(row) = rows.first() {
                     let columns: Vec<ColumnInfo> = row.columns().iter().map(|col| ColumnInfo {
                        name: col.name().to_string(),
                        data_type: col.type_info().name().to_string(),
                        nullable: true, 
                        is_primary_key: false,
                    }).collect();
        
                    let data: Vec<Vec<CellValue>> = vec![
                        (0..row.columns().len())
                            .map(|idx| Self::map_mysql_value(row, idx))
                            .collect()
                    ];
                    return Ok(QueryResult::new(sql, columns, data));
                 }
             }
        }

        Ok(QueryResult::new(sql, vec![], vec![]).with_affected_rows(result.rows_affected()))
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

        let rows = sqlx::query("SHOW DATABASES")
            .fetch_all(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn get_database_info(&self, database: &str) -> Result<DatabaseInfo, DomainError> {
        let schemas = self.list_schemas(database).await?;

        Ok(DatabaseInfo {
            name: database.to_string(),
            schemas,
            size_bytes: None,
            encoding: Some("utf8mb4".to_string()),
        })
    }

    async fn list_schemas(&self, database: &str) -> Result<Vec<SchemaInfo>, DomainError> {
        // MySQL trata databases como schemas
        let system_dbs = ["information_schema", "mysql", "performance_schema", "sys"];
        let is_system = system_dbs.contains(&database);

        Ok(vec![SchemaInfo {
            name: database.to_string(),
            tables: vec![],
            views: vec![],
            functions: vec![],
            sequences: vec![],
            is_system,
        }])
    }

    async fn list_tables(&self, schema: Option<&str>) -> Result<Vec<TableInfo>, DomainError> {
        let pool = self.get_pool().await?;

        let query = if let Some(db) = schema {
            format!(
                "SELECT TABLE_NAME FROM information_schema.TABLES 
                 WHERE TABLE_SCHEMA = '{}' AND TABLE_TYPE = 'BASE TABLE'
                 ORDER BY TABLE_NAME",
                db
            )
        } else {
            "SHOW TABLES".to_string()
        };

        let rows = sqlx::query(&query)
            .fetch_all(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| TableInfo {
                name: r.get::<String, _>(0),
                schema: schema.map(String::from),
                columns: vec![],
                primary_key: None,
                foreign_keys: vec![],
                indexes: vec![],
                constraints: vec![],
                triggers: vec![],
                row_count: None,
                size_bytes: None,
                comment: None,
            })
            .collect())
    }

    async fn get_table_info(&self, table: &str, schema: Option<&str>) -> Result<TableInfo, DomainError> {
        let columns = self.get_columns(table, schema).await?;
        let indexes = self.list_indexes(table, schema).await?;
        let constraints = self.list_constraints(table, schema).await?;
        let triggers = self.list_triggers(table, schema).await?;
        let pool = self.get_pool().await?;
        let db = schema.unwrap_or("DATABASE()");

        // Primary key
        let pk_rows = sqlx::query(&format!(
            "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_SCHEMA = {} AND TABLE_NAME = '{}' AND CONSTRAINT_NAME = 'PRIMARY'",
            if schema.is_some() { format!("'{}'", db) } else { "DATABASE()".to_string() },
            table
        ))
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        let primary_key = if !pk_rows.is_empty() {
            Some(PrimaryKeyInfo {
                name: Some("PRIMARY".to_string()),
                columns: pk_rows.iter().map(|r| r.get::<String, _>(0)).collect(),
            })
        } else {
            None
        };

        // Foreign keys
        let fk_rows = sqlx::query(&format!(
            "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = {} AND TABLE_NAME = '{}' AND REFERENCED_TABLE_NAME IS NOT NULL",
            if schema.is_some() { format!("'{}'", db) } else { "DATABASE()".to_string() },
            table
        ))
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|r| ForeignKeyInfo {
                name: r.get("CONSTRAINT_NAME"),
                columns: vec![r.get("COLUMN_NAME")],
                referenced_table: r.get("REFERENCED_TABLE_NAME"),
                referenced_schema: schema.map(String::from),
                referenced_columns: vec![r.get("REFERENCED_COLUMN_NAME")],
                on_update: ForeignKeyAction::NoAction,
                on_delete: ForeignKeyAction::NoAction,
            })
            .collect();

        Ok(TableInfo {
            name: table.to_string(),
            schema: schema.map(String::from),
            columns,
            primary_key,
            foreign_keys,
            indexes,
            constraints,
            triggers,
            row_count: None,
            size_bytes: None,
            comment: None,
        })
    }

    async fn get_columns(&self, table: &str, schema: Option<&str>) -> Result<Vec<ColumnSchema>, DomainError> {
        let pool = self.get_pool().await?;

        let query = format!(
            "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
                    CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE,
                    ORDINAL_POSITION, COLUMN_KEY, EXTRA, COLUMN_COMMENT
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = {} AND TABLE_NAME = '{}'
             ORDER BY ORDINAL_POSITION",
            if let Some(s) = schema { format!("'{}'", s) } else { "DATABASE()".to_string() },
            table
        );

        let rows = sqlx::query(&query)
            .fetch_all(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| {
                let extra: String = r.try_get("EXTRA").unwrap_or_default();
                let column_key: String = r.try_get("COLUMN_KEY").unwrap_or_default();

                ColumnSchema {
                    name: r.get("COLUMN_NAME"),
                    data_type: r.get("DATA_TYPE"),
                    native_type: r.get("COLUMN_TYPE"),
                    nullable: r.get::<String, _>("IS_NULLABLE") == "YES",
                    default_value: r.try_get("COLUMN_DEFAULT").ok(),
                    is_primary_key: column_key == "PRI",
                    is_unique: column_key == "UNI",
                    is_auto_increment: extra.contains("auto_increment"),
                    max_length: r.try_get("CHARACTER_MAXIMUM_LENGTH").ok(),
                    numeric_precision: r.try_get("NUMERIC_PRECISION").ok(),
                    numeric_scale: r.try_get("NUMERIC_SCALE").ok(),
                    comment: r.try_get("COLUMN_COMMENT").ok(),
                    ordinal_position: r.get::<u32, _>("ORDINAL_POSITION"),
                }
            })
            .collect())
    }

    async fn list_views(&self, schema: Option<&str>) -> Result<Vec<ViewInfo>, DomainError> {
        let pool = self.get_pool().await?;

        let query = format!(
            "SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS 
             WHERE TABLE_SCHEMA = {} ORDER BY TABLE_NAME",
            if let Some(s) = schema { format!("'{}'", s) } else { "DATABASE()".to_string() }
        );

        let rows = sqlx::query(&query)
            .fetch_all(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| ViewInfo {
                name: r.get("TABLE_NAME"),
                schema: schema.map(String::from),
                columns: vec![],
                definition: r.try_get("VIEW_DEFINITION").ok(),
                is_materialized: false,
            })
            .collect())
    }

    async fn list_indexes(&self, table: &str, schema: Option<&str>) -> Result<Vec<IndexInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let db_clause = if let Some(s) = schema { format!("'{}'", s) } else { "DATABASE()".to_string() };

        let rows = sqlx::query(&format!(
            "SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = {} AND TABLE_NAME = '{}'
             ORDER BY INDEX_NAME, SEQ_IN_INDEX",
            db_clause, table
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        use std::collections::HashMap;
        let mut index_map: HashMap<String, IndexInfo> = HashMap::new();
        
        for row in rows {
            let name: String = row.get("INDEX_NAME");
            let column: String = row.get("COLUMN_NAME");
            let non_unique: i32 = row.get("NON_UNIQUE");
            let index_type: String = row.get("INDEX_TYPE");
            
            index_map.entry(name.clone())
                .and_modify(|idx| idx.columns.push(column.clone()))
                .or_insert(IndexInfo {
                    name: name.clone(),
                    columns: vec![column],
                    is_unique: non_unique == 0,
                    is_primary: name == "PRIMARY",
                    index_type,
                });
        }

        Ok(index_map.into_values().collect())
    }

    async fn list_constraints(&self, table: &str, schema: Option<&str>) -> Result<Vec<ConstraintInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let db_clause = if let Some(s) = schema { format!("'{}'", s) } else { "DATABASE()".to_string() };

        let rows = sqlx::query(&format!(
            "SELECT tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE, kcu.COLUMN_NAME
             FROM information_schema.TABLE_CONSTRAINTS tc
             LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
               ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
             WHERE tc.TABLE_SCHEMA = {} AND tc.TABLE_NAME = '{}'
             ORDER BY tc.CONSTRAINT_NAME",
            db_clause, table
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        use std::collections::HashMap;
        let mut constraint_map: HashMap<String, ConstraintInfo> = HashMap::new();

        for row in rows {
            let name: String = row.get("CONSTRAINT_NAME");
            let type_str: String = row.get("CONSTRAINT_TYPE");
            let column: Option<String> = row.try_get("COLUMN_NAME").ok();

            let constraint_type = match type_str.as_str() {
                "PRIMARY KEY" => ConstraintType::PrimaryKey,
                "FOREIGN KEY" => ConstraintType::ForeignKey,
                "UNIQUE" => ConstraintType::Unique,
                "CHECK" => ConstraintType::Check,
                _ => ConstraintType::Check,
            };

            constraint_map.entry(name.clone())
                .and_modify(|c| {
                    if let Some(col) = &column {
                        c.columns.push(col.clone());
                    }
                })
                .or_insert(ConstraintInfo {
                    name,
                    constraint_type,
                    columns: column.map(|c| vec![c]).unwrap_or_default(),
                    definition: None,
                });
        }

        Ok(constraint_map.into_values().collect())
    }

    async fn list_triggers(&self, table: &str, schema: Option<&str>) -> Result<Vec<TriggerInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let db_clause = if let Some(s) = schema { format!("'{}'", s) } else { "DATABASE()".to_string() };

        let rows = sqlx::query(&format!(
            "SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, ACTION_STATEMENT
             FROM information_schema.TRIGGERS
             WHERE EVENT_OBJECT_SCHEMA = {} AND EVENT_OBJECT_TABLE = '{}'
             ORDER BY TRIGGER_NAME",
            db_clause, table
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| {
                let timing_str: String = r.get("ACTION_TIMING");
                let event_str: String = r.get("EVENT_MANIPULATION");
                
                let timing = match timing_str.as_str() {
                    "BEFORE" => TriggerTiming::Before,
                    "AFTER" => TriggerTiming::After,
                    _ => TriggerTiming::After,
                };
                
                let event = match event_str.as_str() {
                    "INSERT" => TriggerEvent::Insert,
                    "UPDATE" => TriggerEvent::Update,
                    "DELETE" => TriggerEvent::Delete,
                    _ => TriggerEvent::Insert,
                };

                TriggerInfo {
                    name: r.get("TRIGGER_NAME"),
                    table_name: table.to_string(),
                    schema: schema.map(String::from),
                    timing,
                    events: vec![event],
                    definition: r.try_get("ACTION_STATEMENT").ok(),
                    enabled: true,
                }
            })
            .collect())
    }

    async fn list_functions(&self, schema: Option<&str>) -> Result<Vec<FunctionInfo>, DomainError> {
        let pool = self.get_pool().await?;
        let db_clause = if let Some(s) = schema { format!("'{}'", s) } else { "DATABASE()".to_string() };

        let rows = sqlx::query(&format!(
            "SELECT ROUTINE_NAME, DATA_TYPE, ROUTINE_DEFINITION
             FROM information_schema.ROUTINES
             WHERE ROUTINE_SCHEMA = {} AND ROUTINE_TYPE = 'FUNCTION'
             ORDER BY ROUTINE_NAME",
            db_clause
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| FunctionInfo {
                name: r.get("ROUTINE_NAME"),
                schema: schema.map(String::from),
                return_type: r.try_get("DATA_TYPE").ok(),
                parameters: vec![],
                language: "SQL".to_string(),
                definition: r.try_get("ROUTINE_DEFINITION").ok(),
            })
            .collect())
    }

    async fn list_sequences(&self, _schema: Option<&str>) -> Result<Vec<SequenceInfo>, DomainError> {
        // MySQL no tiene secuencias nativas (usa AUTO_INCREMENT)
        Ok(vec![])
    }

    async fn cancel_query(&self) -> Result<(), DomainError> {
        Ok(())
    }

    async fn get_completions(&self, prefix: &str, _context: CompletionContext) -> Result<Vec<CompletionItem>, DomainError> {
        let mut completions = Vec::new();
        let prefix_lower = prefix.to_lowercase();

        let keywords = ["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER",
            "ON", "AND", "OR", "NOT", "IN", "LIKE", "ORDER", "BY", "GROUP", "HAVING",
            "LIMIT", "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE"];

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

        Ok(completions)
    }

    async fn server_version(&self) -> Result<String, DomainError> {
        let pool = self.get_pool().await?;

        let row = sqlx::query("SELECT VERSION()")
            .fetch_one(&pool)
            .await
            .map_err(|e| DomainError::query(e.to_string()))?;

        Ok(row.get::<String, _>(0))
    }
}
