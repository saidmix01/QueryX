import { create } from 'zustand';
import type { QueryHistoryEntry, QueryResult } from '../domain/types';
import { queryApi } from '../infrastructure/tauri-api';
import { useResultPanelsStore } from './result-panels-store';
import { useNotificationStore } from './notification-store';
import { useConnectionStore } from './connection-store';
import { useUIStore } from './ui-store';
import { useSafetyStore } from './safety-store';

import { DatabaseEngine } from '../domain/types';
import { TableDefinition, UserDefinition, RoleDefinition } from '../domain/admin-types';

function isCancellation(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === 'string') {
    const s = e.toLowerCase();
    return s.includes('cancel') || s.includes('canceled') || s.includes('cancelled');
  }
  if (typeof e === 'object') {
    const anyE = e as any;
    const type = String(anyE?.type || '').toLowerCase();
    const msg = String(anyE?.msg || anyE?.message || '').toLowerCase();
    return type.includes('cancel') || msg.includes('cancel');
  }
  return false;
}

export interface AdminTabState {
  type: 'table' | 'user' | 'role';
  mode: 'create' | 'edit';
  engine: DatabaseEngine;
  initialDefinition?: TableDefinition | UserDefinition | RoleDefinition; // For table/user/role edit
  schema?: string;
  table?: string;
}

export interface QueryTab {
  id: string;
  type?: 'query' | 'admin';
  adminState?: AdminTabState;
  title: string;
  connectionId: string;
  query: string;
  result: QueryResult | null;
  multiResults: any[] | null; // Para resultados de múltiples statements
  isExecuting: boolean;
  error: string | null;
}

interface AddTabOptions {
  title?: string;
  query?: string;
  connectionId?: string;
  type?: 'query' | 'admin';
  adminState?: AdminTabState;
}

interface QueryState {
  tabs: QueryTab[];
  activeTabId: string | null;
  history: QueryHistoryEntry[];

  // Actions
  createTab: (connectionId: string) => string;
  addTab: (options: AddTabOptions) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateQuery: (tabId: string, query: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  executeQuery: (tabId: string, specificQuery?: string, page?: number, pageSize?: number) => Promise<void>;
  executeMultiStatement: (tabId: string) => Promise<void>;
  cancelQuery: (tabId: string) => Promise<void>;
  loadHistory: (connectionId: string) => Promise<void>;
}

let tabCounter = 0;

export const useQueryStore = create<QueryState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  history: [],

  createTab: (connectionId) => {
    const id = `tab-${++tabCounter}`;
    const newTab: QueryTab = {
      id,
      type: 'query',
      title: `Query ${tabCounter}`,
      connectionId,
      query: '',
      result: null,
      multiResults: null,
      isExecuting: false,
      error: null,
    };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
    return id;
  },

  addTab: (options) => {
    const id = `tab-${++tabCounter}`;
    const newTab: QueryTab = {
      id,
      type: options.type || 'query',
      adminState: options.adminState,
      title: options.title || `Query ${tabCounter}`,
      connectionId: options.connectionId || '',
      query: options.query || '',
      result: null,
      multiResults: null,
      isExecuting: false,
      error: null,
    };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (tabId) => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  updateQuery: (tabId, query) => {
    // Actualización directa sin debounce - el editor de Monaco ya maneja esto eficientemente
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, query } : t
      ),
    }));
  },

  updateTabTitle: (tabId, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, title } : t
      ),
    }));
  },

  executeQuery: async (tabId, specificQuery, page, pageSize) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    if (tab.isExecuting) return;

    const queryToExecute = specificQuery || tab.query;

    const { detectStatementType, isDestructiveStatement } = await import('../utils/sql-parser');
    const type = detectStatementType(queryToExecute);
    const conn = useConnectionStore.getState().connections.find((c) => c.id === tab.connectionId);
    if (conn?.read_only && isDestructiveStatement(queryToExecute)) {
      useNotificationStore.getState().warn('Conexión en modo solo lectura: operación bloqueada', {
        variant: 'toast',
        source: 'business',
        autoCloseMs: 8000,
      });
      return;
    }
    if (type === 'UPDATE' || type === 'DELETE') {
      const { simulateAffectedRows } = await import('../utils/sql-simulator');
      const affected = await simulateAffectedRows(tab.connectionId, queryToExecute);
      const hasWhere = /\bWHERE\b/i.test(queryToExecute);
      let tableName = '';
      let schemaName: string | undefined = undefined;
      const mUpd = queryToExecute.match(/^\s*UPDATE\s+([^\s]+)/i);
      const mDel = queryToExecute.match(/^\s*DELETE\s+FROM\s+([^\s]+)/i);
      const fullName = mUpd?.[1] || mDel?.[1] || '';
      if (fullName) {
        if (fullName.includes('.')) {
          const parts = fullName.split('.');
          schemaName = parts[0];
          tableName = parts[1];
        } else {
          tableName = fullName;
        }
      }
      let hasPrimaryKey = false;
      if (tableName) {
        try {
          const { schemaApi } = await import('../infrastructure/tauri-api');
          const info = await schemaApi.getTableInfo(tab.connectionId, tableName, schemaName);
          hasPrimaryKey = !!info.primary_key && info.primary_key.columns.length > 0;
        } catch {
          hasPrimaryKey = false;
        }
      }
      let typeWarnings: string[] = [];
      let blockDueToType = false;
      if (type === 'UPDATE') {
        const { validateUpdateLiterals } = await import('../utils/sql-type-validator');
        const v = await validateUpdateLiterals(tab.connectionId, queryToExecute, schemaName);
        typeWarnings = v.warnings;
        blockDueToType = v.critical;
      }
      useUIStore.getState().showDestructiveOperation({
        operation: {
          type,
          sql: queryToExecute,
          affectedRows: affected ?? 0,
          hasWhereClause: hasWhere,
          hasPrimaryKey,
          warnings: typeWarnings,
        },
        onConfirm: async () => {
          if (blockDueToType && typeWarnings.length > 0) {
            throw new Error(typeWarnings.join(' • '));
          }
          const { buildSelectAllForUpdate, buildSelectAllForDelete } = await import('../utils/sql-simulator');
          const selectAll =
            type === 'UPDATE'
              ? buildSelectAllForUpdate(queryToExecute)
              : buildSelectAllForDelete(queryToExecute);
          let snapshotResult: QueryResult | null = null;
          if (selectAll) {
            snapshotResult = await queryApi.execute(tab.connectionId, selectAll);
          }
          if (snapshotResult) {
            const rawRows = snapshotResult.rows.map((row) =>
              row.map((cell: any) => {
                if (!cell || cell.type === 'Null') return null;
                return (cell as any).value ?? null;
              })
            );
            let pkCols: string[] = [];
            if (hasPrimaryKey && tableName) {
              const { schemaApi } = await import('../infrastructure/tauri-api');
              const tinfo = await schemaApi.getTableInfo(tab.connectionId, tableName, schemaName);
              pkCols = tinfo.primary_key?.columns || [];
            }
            useSafetyStore.getState().recordSnapshot({
              id: `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
              connectionId: tab.connectionId,
              type,
              tableName: schemaName ? `${schemaName}.${tableName}` : (tableName || ''),
              executedSql: queryToExecute,
              timestamp: Date.now(),
              columns: snapshotResult.columns.map((c) => c.name),
              rows: rawRows,
              primaryKeyColumns: pkCols,
            });
          }
          const tx = await queryApi.executeInTransaction(tab.connectionId, queryToExecute);
          useResultPanelsStore.getState().ensurePanelForStatement({
            id: `${tabId}:stmt:0`,
            query: queryToExecute,
            connectionId: tab.connectionId,
            affectedRows: tx.affected_rows,
            executedAt: new Date().toISOString(),
          });
          useNotificationStore.getState().info(`Operación ${type} ejecutada`, {
            variant: 'toast',
            source: 'business',
            autoCloseMs: 8000,
          });
        },
        onCancel: () => {},
      });
      return;
    }

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isExecuting: true, error: null, multiResults: null } : t
      ),
    }));

    try {
      const result = await queryApi.execute(
        tab.connectionId,
        queryToExecute,
        page,
        pageSize
      );
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, result, isExecuting: false } : t
        ),
      }));
      // Asegurar panel independiente para este resultado
      useResultPanelsStore.getState().ensurePanelFromResult({
        id: tabId,
        query: queryToExecute,
        connectionId: tab.connectionId,
        result,
      });
      useNotificationStore.getState().info('Consulta ejecutada con éxito', {
        variant: 'toast',
        source: 'business',
        autoCloseMs: 10000,
      });
    } catch (e) {
      if (isCancellation(e)) {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isExecuting: false } : t
          ),
        }));
        useNotificationStore.getState().info('Consulta cancelada', {
          variant: 'toast',
          source: 'business',
          autoCloseMs: 10000,
        });
        return;
      }
      // Extract error message from Tauri error object
      let errorMessage = 'Unknown error';
      if (typeof e === 'string') {
        errorMessage = e;
      } else if (e && typeof e === 'object') {
        // Tauri errors can have different structures
        if ('message' in e) {
          errorMessage = String((e as { message: unknown }).message);
        } else if ('error' in e) {
          errorMessage = String((e as { error: unknown }).error);
        } else {
          // Try to stringify the object
          try {
            errorMessage = JSON.stringify(e, null, 2);
          } catch {
            errorMessage = String(e);
          }
        }
      }
      
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, error: errorMessage, isExecuting: false }
            : t
        ),
      }));
      useNotificationStore.getState().error(errorMessage, {
        variant: 'toast',
        source: 'ipc',
        autoCloseMs: 10000,
        persistent: false,
      });
    }
  },

  executeMultiStatement: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    if (tab.isExecuting) return;

    // Parse statements
    const { parseMultipleStatements, isDestructiveStatement } = await import('../utils/sql-parser');
    const statements = parseMultipleStatements(tab.query);
    
    if (statements.length === 0) return;

    // Read-only enforcement (frontend UX)
    const conn = useConnectionStore.getState().connections.find((c) => c.id === tab.connectionId);
    if (conn?.read_only) {
      const hasDestructive = statements.some((s) => isDestructiveStatement(s.sql));
      if (hasDestructive) {
        useNotificationStore.getState().warn('Conexión en modo solo lectura: operación bloqueada', {
          variant: 'toast',
          source: 'business',
          autoCloseMs: 8000,
        });
        return;
      }
    }

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isExecuting: true, error: null, result: null } : t
      ),
    }));

    try {
      const results = await queryApi.executeMultiStatement(
        tab.connectionId,
        statements.map(s => s.sql)
      );
      
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, multiResults: results, isExecuting: false } : t
        ),
      }));
      // Crear paneles para cada statement que tenga resultado
      const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      results.forEach((stmt: any, idx: number) => {
        const id = `${tabId}:run:${runId}:stmt:${idx}`;
        useResultPanelsStore.getState().ensurePanelForStatement({
          id,
          query: stmt.sql,
          connectionId: tab.connectionId,
          result: stmt.result,
          affectedRows: stmt.affected_rows,
          executedAt: new Date().toISOString(),
        });
      });
      useNotificationStore.getState().info('Múltiples statements ejecutados', {
        variant: 'toast',
        source: 'business',
        autoCloseMs: 10000,
      });
    } catch (e) {
      if (isCancellation(e)) {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isExecuting: false } : t
          ),
        }));
        useNotificationStore.getState().info('Consulta cancelada', {
          variant: 'toast',
          source: 'business',
          autoCloseMs: 10000,
        });
        return;
      }
      let errorMessage = 'Unknown error';
      if (typeof e === 'string') {
        errorMessage = e;
      } else if (e && typeof e === 'object') {
        if ('message' in e) {
          errorMessage = String((e as { message: unknown }).message);
        } else if ('error' in e) {
          errorMessage = String((e as { error: unknown }).error);
        } else {
          try {
            errorMessage = JSON.stringify(e, null, 2);
          } catch {
            errorMessage = String(e);
          }
        }
      }
      
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, error: errorMessage, isExecuting: false }
            : t
        ),
      }));
      useNotificationStore.getState().error(errorMessage, {
        variant: 'toast',
        source: 'ipc',
        autoCloseMs: 10000,
        persistent: false,
      });
    }
  },

  cancelQuery: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    await queryApi.cancel(tab.connectionId);
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isExecuting: false } : t
      ),
    }));
    useNotificationStore.getState().info('Consulta cancelada', {
      variant: 'toast',
      source: 'business',
      autoCloseMs: 10000,
    });
  },

  loadHistory: async (connectionId) => {
    const history = await queryApi.getHistory(connectionId, 100);
    set({ history });
  },
}));
