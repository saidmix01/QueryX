import { create } from 'zustand';
import type { QueryHistoryEntry, QueryResult } from '../domain/types';
import { queryApi } from '../infrastructure/tauri-api';
import { useResultPanelsStore } from './result-panels-store';

interface QueryTab {
  id: string;
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

    const queryToExecute = specificQuery || tab.query;

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
    } catch (e) {
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
    }
  },

  executeMultiStatement: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Parse statements
    const { parseMultipleStatements } = await import('../utils/sql-parser');
    const statements = parseMultipleStatements(tab.query);
    
    if (statements.length === 0) return;

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
      results.forEach((stmt: any, idx: number) => {
        const id = `${tabId}:stmt:${idx}`;
        useResultPanelsStore.getState().ensurePanelForStatement({
          id,
          query: stmt.sql,
          connectionId: tab.connectionId,
          result: stmt.result,
          affectedRows: stmt.affected_rows,
          executedAt: new Date().toISOString(),
        });
      });
    } catch (e) {
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
  },

  loadHistory: async (connectionId) => {
    const history = await queryApi.getHistory(connectionId, 100);
    set({ history });
  },
}));
