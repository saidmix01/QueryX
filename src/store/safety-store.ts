import { create } from 'zustand';
import type { DatabaseEngine } from '../domain/types';
import { queryApi } from '../infrastructure/tauri-api';

export interface SnapshotEntry {
  id: string;
  connectionId: string;
  type: 'UPDATE' | 'DELETE';
  tableName: string;
  executedSql: string;
  timestamp: number;
  columns: string[];
  rows: any[][];
  primaryKeyColumns: string[];
}

interface SafetyState {
  history: SnapshotEntry[];
  recordSnapshot: (entry: SnapshotEntry) => void;
  undoLast: (connectionId: string, engine: DatabaseEngine) => Promise<boolean>;
  undoById: (id: string, engine: DatabaseEngine) => Promise<boolean>;
}

function sqlLiteral(value: any, _engine: DatabaseEngine): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${str.replace(/'/g, "''")}'`;
}

function quoteIdentifier(name: string, engine: DatabaseEngine): string {
  if (!name) return '""';
  const n = name.replace(/^["`]/, '').replace(/["`]$/, '');
  if (engine === 'mysql') return `\`${n}\``;
  return `"${n}"`;
}

function quoteFullTableName(tableName: string, engine: DatabaseEngine): string {
  if (!tableName) return '""';
  if (tableName.includes('.')) {
    const parts = tableName.split('.');
    const schema = parts[0].replace(/^["`]/, '').replace(/["`]$/, '');
    const table = parts[1].replace(/^["`]/, '').replace(/["`]$/, '');
    return `${quoteIdentifier(schema, engine)}.${quoteIdentifier(table, engine)}`;
  }
  const t = tableName.replace(/^["`]/, '').replace(/["`]$/, '');
  return quoteIdentifier(t, engine);
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  history: [],
  recordSnapshot: (entry) => {
    set((s) => ({ history: [entry, ...s.history].slice(0, 50) }));
  },
  undoLast: async (connectionId, engine) => {
    const entry = get().history.find((h) => h.connectionId === connectionId);
    if (!entry) return false;
    return get().undoById(entry.id, engine);
  },
  undoById: async (id, engine) => {
    const entry = get().history.find((h) => h.id === id);
    if (!entry) return false;
    const stmts: string[] = [];
    if (entry.type === 'DELETE') {
      const cols = entry.columns;
      const colsSql = cols.map((c) => quoteIdentifier(c, engine)).join(', ');
      const fullName = quoteFullTableName(entry.tableName, engine);
      const insertPrefix = engine === 'postgresql' ? `INSERT INTO ${fullName} OVERRIDING SYSTEM VALUE` : `INSERT INTO ${fullName}`;
      entry.rows.forEach((row) => {
        const values = row.map((v) => sqlLiteral(v, engine)).join(', ');
        stmts.push(`${insertPrefix} (${colsSql}) VALUES (${values});`);
      });
    } else if (entry.type === 'UPDATE') {
      const pkCols = entry.primaryKeyColumns;
      if (pkCols.length === 0) return false;
      const fullName = quoteFullTableName(entry.tableName, engine);
      entry.rows.forEach((row) => {
        const nonPkCols = entry.columns.filter((c) => !pkCols.includes(c));
        const setParts = nonPkCols
          .map((c) => {
            const idxGlobal = entry.columns.indexOf(c);
            const val = row[idxGlobal];
            return `${quoteIdentifier(c, engine)} = ${sqlLiteral(val, engine)}`;
          })
          .join(', ');
        const whereParts = pkCols
          .map((c) => {
            const idxGlobal = entry.columns.indexOf(c);
            const val = row[idxGlobal];
            return `${quoteIdentifier(c, engine)} = ${sqlLiteral(val, engine)}`;
          })
          .join(' AND ');
        stmts.push(`UPDATE ${fullName} SET ${setParts} WHERE ${whereParts};`);
      });
    }
    if (stmts.length === 0) return false;
    try {
      await queryApi.executeMultiStatement(entry.connectionId, stmts);
      return true;
    } catch {
      return false;
    }
  },
}));
