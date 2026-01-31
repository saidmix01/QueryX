import type { DatabaseEngine } from '../domain/types';

/**
 * Analizador de queries SQL para determinar si son editables
 */

export interface QueryAnalysis {
  isEditable: boolean;
  tableName: string | null;
  schemaName: string | null;
  primaryKeyColumns: string[];
  reason?: string; // Por qué no es editable
}

/**
 * Analiza una query SELECT para determinar si es editable
 * Una query es editable si:
 * - Es un SELECT simple de una sola tabla
 * - No tiene JOINs
 * - No tiene GROUP BY
 * - No tiene DISTINCT
 * - No tiene funciones de agregación
 * - No tiene UNION
 */
export function analyzeQueryEditability(sql: string): QueryAnalysis {
  const normalized = sql.trim().toUpperCase();
  
  // Debe ser un SELECT
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return {
      isEditable: false,
      tableName: null,
      schemaName: null,
      primaryKeyColumns: [],
      reason: 'Only SELECT queries can be edited',
    };
  }

  // No debe tener JOINs
  if (
    normalized.includes(' JOIN ') ||
    normalized.includes(' INNER JOIN ') ||
    normalized.includes(' LEFT JOIN ') ||
    normalized.includes(' RIGHT JOIN ') ||
    normalized.includes(' FULL JOIN ') ||
    normalized.includes(' CROSS JOIN ')
  ) {
    return {
      isEditable: false,
      tableName: null,
      schemaName: null,
      primaryKeyColumns: [],
      reason: 'Queries with JOINs cannot be edited',
    };
  }

  // No debe tener GROUP BY
  if (normalized.includes(' GROUP BY ')) {
    return {
      isEditable: false,
      tableName: null,
      schemaName: null,
      primaryKeyColumns: [],
      reason: 'Queries with GROUP BY cannot be edited',
    };
  }

  // No debe tener DISTINCT
  if (normalized.includes('SELECT DISTINCT')) {
    return {
      isEditable: false,
      tableName: null,
      schemaName: null,
      primaryKeyColumns: [],
      reason: 'Queries with DISTINCT cannot be edited',
    };
  }

  // No debe tener UNION
  if (normalized.includes(' UNION ')) {
    return {
      isEditable: false,
      tableName: null,
      schemaName: null,
      primaryKeyColumns: [],
      reason: 'Queries with UNION cannot be edited',
    };
  }

  // No debe tener funciones de agregación comunes
  const aggregateFunctions = ['COUNT(', 'SUM(', 'AVG(', 'MIN(', 'MAX('];
  for (const func of aggregateFunctions) {
    if (normalized.includes(func)) {
      return {
        isEditable: false,
        tableName: null,
        schemaName: null,
        primaryKeyColumns: [],
        reason: 'Queries with aggregate functions cannot be edited',
      };
    }
  }

  // Extraer el nombre de la tabla
  const tableInfo = extractTableName(sql);
  
  if (!tableInfo.tableName) {
    return {
      isEditable: false,
      tableName: null,
      schemaName: null,
      primaryKeyColumns: [],
      reason: 'Could not determine table name',
    };
  }

  return {
    isEditable: true,
    tableName: tableInfo.tableName,
    schemaName: tableInfo.schemaName,
    primaryKeyColumns: [], // Se llenará con información del schema
  };
}

/**
 * Extrae el nombre de la tabla de una query SELECT
 */
function extractTableName(sql: string): { tableName: string | null; schemaName: string | null } {
  // Patrón para capturar: FROM [schema.]table
  const fromPattern = /FROM\s+(?:([a-zA-Z_][a-zA-Z0-9_]*|"[^"]+"|`[^`]+`)\.)?([a-zA-Z_][a-zA-Z0-9_]*|"[^"]+"|`[^`]+`)(?:\s+(?:AS\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?(?:\s|$|,)/i;
  
  const match = sql.match(fromPattern);
  
  if (!match) {
    return { tableName: null, schemaName: null };
  }

  const schemaName = match[1] ? cleanIdentifier(match[1]) : null;
  const tableName = cleanIdentifier(match[2]);

  return { tableName, schemaName };
}

/**
 * Limpia identificadores SQL (remueve comillas, backticks, etc.)
 */
function cleanIdentifier(identifier: string): string {
  return identifier.replace(/^["'`]|["'`]$/g, '');
}

/**
 * Genera un UPDATE statement para una fila editada
 */
export function generateUpdateStatement(
  tableName: string,
  schemaName: string | null,
  updates: Map<string, any>,
  primaryKeys: Map<string, any>,
  engine: DatabaseEngine
): string {
  const fullTableName = schemaName 
    ? quoteIdentifier(schemaName, engine) + '.' + quoteIdentifier(tableName, engine)
    : quoteIdentifier(tableName, engine);

  // SET clause
  const setClauses: string[] = [];
  for (const [column, value] of updates.entries()) {
    setClauses.push(`${quoteIdentifier(column, engine)} = ${formatValue(value)}`);
  }

  // WHERE clause con primary keys
  const whereClauses: string[] = [];
  for (const [column, value] of primaryKeys.entries()) {
    whereClauses.push(`${quoteIdentifier(column, engine)} = ${formatValue(value)}`);
  }

  if (whereClauses.length === 0) {
    throw new Error('Cannot generate UPDATE without primary key values');
  }

  return `UPDATE ${fullTableName}\nSET ${setClauses.join(', ')}\nWHERE ${whereClauses.join(' AND ')};`;
}

/**
 * Genera un DELETE statement para una fila
 */
export function generateDeleteStatement(
  tableName: string,
  schemaName: string | null,
  primaryKeys: Map<string, any>,
  engine: DatabaseEngine
): string {
  const fullTableName = schemaName 
    ? quoteIdentifier(schemaName, engine) + '.' + quoteIdentifier(tableName, engine)
    : quoteIdentifier(tableName, engine);

  // WHERE clause con primary keys
  const whereClauses: string[] = [];
  for (const [column, value] of primaryKeys.entries()) {
    whereClauses.push(`${quoteIdentifier(column, engine)} = ${formatValue(value)}`);
  }

  if (whereClauses.length === 0) {
    throw new Error('Cannot generate DELETE without primary key values');
  }

  return `DELETE FROM ${fullTableName}\nWHERE ${whereClauses.join(' AND ')};`;
}

/**
 * Quote identifier según el motor SQL
 */
function quoteIdentifier(name: string, engine: DatabaseEngine): string {
  switch (engine) {
    case 'mysql':
      return `\`${name}\``;
    case 'postgresql':
    case 'sqlite':
    case 'sqlserver':
      return `"${name}"`;
    default:
      return `"${name}"`;
  }
}

/**
 * Formatea un valor para SQL
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  // Para objetos complejos, intentar JSON
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}
