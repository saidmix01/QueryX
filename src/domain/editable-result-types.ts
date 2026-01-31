/**
 * Tipos para edición de resultados y operaciones destructivas
 */

import type { CellValue } from './types';

export interface EditableCell {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  originalValue: CellValue;
  newValue: CellValue;
}

export interface DirtyRow {
  rowIndex: number;
  originalRow: CellValue[];
  editedCells: Map<number, CellValue>; // columnIndex -> newValue
  primaryKeyValues: Map<string, CellValue>; // columnName -> value
}

export type DestructiveOperationType = 'UPDATE' | 'DELETE' | 'ALTER';

export interface DestructiveOperation {
  type: DestructiveOperationType;
  sql: string;
  affectedRows: number;
  hasWhereClause: boolean;
  hasPrimaryKey: boolean;
  warnings: string[];
}

export interface UpdateOperation extends DestructiveOperation {
  type: 'UPDATE';
  tableName: string;
  updates: Map<string, CellValue>;
  whereClause: string;
}

export interface DeleteOperation extends DestructiveOperation {
  type: 'DELETE';
  tableName: string;
  whereClause: string;
}

export interface ConfirmationModalData {
  operation: DestructiveOperation;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Resultado de ejecución de múltiples statements
 */
export interface MultiStatementResult {
  statementIndex: number;
  sql: string;
  success: boolean;
  result?: any; // QueryResult o affected rows
  error?: string;
  executionTimeMs: number;
}

export interface MultiStatementExecution {
  results: MultiStatementResult[];
  totalExecutionTimeMs: number;
  successCount: number;
  errorCount: number;
}
