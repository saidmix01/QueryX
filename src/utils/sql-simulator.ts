export function buildSelectCountForUpdate(sql: string): string | null {
  const m = sql.match(/^\s*UPDATE\s+([^\s]+)\s+SET[\s\S]*?(WHERE[\s\S]+)$/i);
  if (m) {
    const table = m[1];
    const where = m[2];
    return `SELECT COUNT(*) AS affected FROM ${table} ${where}`;
  }
  const mNoWhere = sql.match(/^\s*UPDATE\s+([^\s]+)\s+SET[\s\S]*$/i);
  if (mNoWhere) {
    const table = mNoWhere[1];
    return `SELECT COUNT(*) AS affected FROM ${table}`;
  }
  return null;
}

export function buildSelectCountForDelete(sql: string): string | null {
  const m = sql.match(/^\s*DELETE\s+FROM\s+([^\s]+)\s+(WHERE[\s\S]+)$/i);
  if (m) {
    const table = m[1];
    const where = m[2];
    return `SELECT COUNT(*) AS affected FROM ${table} ${where}`;
  }
  const mNoWhere = sql.match(/^\s*DELETE\s+FROM\s+([^\s]+)\s*;?$/i);
  if (mNoWhere) {
    const table = mNoWhere[1];
    return `SELECT COUNT(*) AS affected FROM ${table}`;
  }
  return null;
}

export async function simulateAffectedRows(connectionId: string, sql: string): Promise<number | null> {
  const { detectStatementType } = await import('./sql-parser');
  const { queryApi } = await import('../infrastructure/tauri-api');
  const type = detectStatementType(sql);
  let selectCount: string | null = null;
  if (type === 'UPDATE') {
    selectCount = buildSelectCountForUpdate(sql);
  } else if (type === 'DELETE') {
    selectCount = buildSelectCountForDelete(sql);
  }
  if (!selectCount) return null;
  const result = await queryApi.execute(connectionId, selectCount);
  if (result.rows && result.rows.length > 0) {
    const cell = result.rows[0][0] as any;
    const value = typeof cell === 'object' && 'value' in cell ? (cell.value as any) : cell;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  return result.row_count ?? null;
}

export function buildSelectAllForUpdate(sql: string): string | null {
  const m = sql.match(/^\s*UPDATE\s+([^\s]+)\s+SET[\s\S]*?(WHERE[\s\S]+)$/i);
  if (m) {
    const table = m[1];
    const where = m[2];
    return `SELECT * FROM ${table} ${where}`;
  }
  const mNoWhere = sql.match(/^\s*UPDATE\s+([^\s]+)\s+SET[\s\S]*$/i);
  if (mNoWhere) {
    const table = mNoWhere[1];
    return `SELECT * FROM ${table}`;
  }
  return null;
}

export function buildSelectAllForDelete(sql: string): string | null {
  const m = sql.match(/^\s*DELETE\s+FROM\s+([^\s]+)\s+(WHERE[\s\S]+)$/i);
  if (m) {
    const table = m[1];
    const where = m[2];
    return `SELECT * FROM ${table} ${where}`;
  }
  const mNoWhere = sql.match(/^\s*DELETE\s+FROM\s+([^\s]+)\s*;?$/i);
  if (mNoWhere) {
    const table = mNoWhere[1];
    return `SELECT * FROM ${table}`;
  }
  return null;
}
