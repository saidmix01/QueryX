import type { CellValue, QueryResult, DatabaseEngine } from '../domain/types';

function cellToRaw(cell: CellValue): any {
  switch (cell.type) {
    case 'Null':
      return null;
    case 'Bool':
    case 'Int':
    case 'Float':
    case 'Uuid':
    case 'Date':
    case 'Time':
    case 'DateTime':
      // @ts-ignore
      return cell.value ?? null;
    case 'String':
      return cell.value;
    case 'Json':
      return cell.value;
    case 'Bytes':
      return (cell.value || []).map((b) => String(b)).join(',');
    case 'Array':
      return JSON.stringify(cell.value.map((v) => cellToRaw(v)));
    default:
      return null;
  }
}

function escapeCsv(value: any, delimiter: string): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const needsQuotes =
    str.includes(delimiter) ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.includes('"');
  if (!needsQuotes) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export function toCsv(result: QueryResult, delimiter = ','): string {
  const header = result.columns.map((c) => escapeCsv(c.name, delimiter)).join(delimiter);
  const lines = result.rows.map((row) =>
    row.map((cell) => escapeCsv(cellToRaw(cell), delimiter)).join(delimiter)
  );
  return [header, ...lines].join('\n');
}

function quoteIdentifier(name: string, engine: DatabaseEngine): string {
  if (engine === 'mysql') return `\`${name}\``;
  return `"${name}"`;
}

function sqlLiteral(value: any, engine: DatabaseEngine): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${str.replace(/'/g, "''")}'`;
}

export function toInsertSql(
  result: QueryResult,
  engine: DatabaseEngine,
  tableName?: { schema?: string | null; table?: string | null }
): string {
  const schema = tableName?.schema || null;
  const table = tableName?.table || null;
  const full =
    table
      ? schema
        ? `${quoteIdentifier(schema, engine)}.${quoteIdentifier(table, engine)}`
        : `${quoteIdentifier(table, engine)}`
      : `/* set table name */`;
  const cols = result.columns.map((c) => quoteIdentifier(c.name, engine)).join(', ');
  const statements = result.rows.map((row) => {
    const values = row.map((cell) => sqlLiteral(cellToRaw(cell), engine)).join(', ');
    return `INSERT INTO ${full} (${cols}) VALUES (${values});`;
  });
  return statements.join('\n');
}

export function normalizeRowsForExcel(result: QueryResult): { columns: string[]; rows: any[][] } {
  const columns = result.columns.map((c) => c.name);
  const rows = result.rows.map((row) => row.map((cell) => {
    const raw = cellToRaw(cell);
    if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
    return raw;
  }));
  return { columns, rows };
}
