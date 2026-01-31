import type { DatabaseEngine } from '../domain/types';
import type { CatalogTable, SchemaCatalog } from './schema-catalog';

/**
 * Sugerencia de autocompletado
 */
export interface CompletionSuggestion {
  label: string;
  insertText: string;
  kind: 'schema' | 'table' | 'view' | 'column' | 'keyword';
  detail?: string;
  documentation?: string;
  sortOrder: number;
}

/**
 * Estrategia de dialecto SQL para adaptar sugerencias según el motor
 */
export interface SqlDialectStrategy {
  /** Formatea el nombre completo de una tabla */
  formatTableName(table: CatalogTable): string;
  /** Formatea el nombre de un schema/database */
  formatSchemaName(name: string): string;
  /** Obtiene el separador de schema.tabla */
  getSeparator(): string;
  /** Obtiene keywords específicas del dialecto */
  getKeywords(): string[];
  /** Indica si soporta schemas */
  supportsSchemas(): boolean;
}

/**
 * Estrategia para PostgreSQL
 */
class PostgresDialectStrategy implements SqlDialectStrategy {
  formatTableName(table: CatalogTable): string {
    if (table.schema && table.schema !== 'public') {
      return `${table.schema}.${table.name}`;
    }
    return table.name;
  }

  formatSchemaName(name: string): string {
    return name;
  }

  getSeparator(): string {
    return '.';
  }

  supportsSchemas(): boolean {
    return true;
  }

  getKeywords(): string[] {
    return [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN', 'ON', 'AND', 'OR',
      'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'AS',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
      'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE',
      'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'NOT NULL',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'INDEX',
      'RETURNING', 'WITH', 'RECURSIVE', 'UNION', 'INTERSECT', 'EXCEPT',
      'COALESCE', 'NULLIF', 'CAST', 'EXTRACT', 'DATE_TRUNC',
      'ARRAY', 'JSONB', 'JSON', 'LATERAL', 'FILTER', 'OVER', 'PARTITION BY'
    ];
  }
}

/**
 * Estrategia para MySQL
 */
class MySqlDialectStrategy implements SqlDialectStrategy {
  formatTableName(table: CatalogTable): string {
    if (table.database) {
      return `${table.database}.${table.name}`;
    }
    return table.name;
  }

  formatSchemaName(name: string): string {
    return name;
  }

  getSeparator(): string {
    return '.';
  }

  supportsSchemas(): boolean {
    return true; // MySQL usa databases como schemas
  }

  getKeywords(): string[] {
    return [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN', 'ON', 'AND', 'OR',
      'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'AS',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
      'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE',
      'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'NOT NULL',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'INDEX',
      'AUTO_INCREMENT', 'ENGINE', 'CHARSET', 'COLLATE',
      'IF EXISTS', 'IF NOT EXISTS', 'REPLACE INTO', 'ON DUPLICATE KEY',
      'COALESCE', 'IFNULL', 'NULLIF', 'CAST', 'CONVERT',
      'DATE_FORMAT', 'STR_TO_DATE', 'NOW', 'CURDATE', 'CURTIME',
      'JSON', 'JSON_EXTRACT', 'JSON_OBJECT', 'JSON_ARRAY'
    ];
  }
}

/**
 * Estrategia para SQLite
 */
class SqliteDialectStrategy implements SqlDialectStrategy {
  formatTableName(table: CatalogTable): string {
    return table.name;
  }

  formatSchemaName(name: string): string {
    return name;
  }

  getSeparator(): string {
    return '.';
  }

  supportsSchemas(): boolean {
    return false;
  }

  getKeywords(): string[] {
    return [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'CROSS JOIN',
      'INNER JOIN', 'NATURAL JOIN', 'ON', 'AND', 'OR',
      'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'AS',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
      'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
      'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'NOT NULL',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE',
      'AUTOINCREMENT', 'WITHOUT ROWID', 'STRICT',
      'IF EXISTS', 'IF NOT EXISTS', 'REPLACE INTO', 'INSERT OR REPLACE',
      'COALESCE', 'IFNULL', 'NULLIF', 'TYPEOF', 'CAST',
      'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME',
      'JSON', 'JSON_EXTRACT', 'JSON_OBJECT', 'JSON_ARRAY',
      'GLOB', 'LIKE', 'BETWEEN', 'IN', 'EXISTS'
    ];
  }
}

/**
 * Factory para obtener la estrategia de dialecto según el motor
 */
export function getDialectStrategy(engine: DatabaseEngine): SqlDialectStrategy {
  switch (engine) {
    case 'postgresql':
      return new PostgresDialectStrategy();
    case 'mysql':
      return new MySqlDialectStrategy();
    case 'sqlite':
      return new SqliteDialectStrategy();
    default:
      return new PostgresDialectStrategy();
  }
}

/**
 * Genera sugerencias de tablas usando la estrategia de dialecto
 */
export function generateTableSuggestions(
  catalog: SchemaCatalog,
  strategy: SqlDialectStrategy,
  prefix?: string
): CompletionSuggestion[] {
  const tables = prefix
    ? catalog.searchTables(prefix)
    : catalog.getTables();

  return tables.map((table, index) => ({
    label: strategy.formatTableName(table),
    insertText: strategy.formatTableName(table),
    kind: table.type === 'view' ? 'view' : 'table',
    detail: table.type === 'view' ? 'View' : 'Table',
    documentation: table.schema ? `Schema: ${table.schema}` : undefined,
    sortOrder: index,
  }));
}

/**
 * Genera sugerencias de schemas
 */
export function generateSchemaSuggestions(
  catalog: SchemaCatalog,
  strategy: SqlDialectStrategy
): CompletionSuggestion[] {
  if (!strategy.supportsSchemas()) {
    return [];
  }

  return catalog.getSchemas().map((schema, index) => ({
    label: strategy.formatSchemaName(schema),
    insertText: strategy.formatSchemaName(schema),
    kind: 'schema',
    detail: 'Schema',
    sortOrder: index,
  }));
}

/**
 * Genera sugerencias de columnas
 */
export function generateColumnSuggestions(
  catalog: SchemaCatalog,
  tableName: string,
  prefix?: string
): CompletionSuggestion[] {
  const columns = prefix
    ? catalog.searchColumns(tableName, prefix)
    : catalog.getColumns(tableName);

  return columns.map((col, index) => ({
    label: col.name,
    insertText: col.name,
    kind: 'column',
    detail: col.dataType,
    documentation: [
      col.isPrimaryKey ? '🔑 Primary Key' : '',
      col.nullable ? 'Nullable' : 'NOT NULL',
      col.comment || '',
    ].filter(Boolean).join(' | '),
    sortOrder: col.isPrimaryKey ? -1 : index,
  }));
}
