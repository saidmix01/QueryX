import { create } from 'zustand';
import type { QueryResult } from '../domain/types';
import type { QueryResultPanel, PanelState, QueryType } from '../domain/panel-types';

function detectQueryType(sql: string): QueryType {
  const head = (sql || '').trim().toUpperCase();
  if (head.startsWith('SELECT')) return 'SELECT';
  if (head.startsWith('UPDATE')) return 'UPDATE';
  if (head.startsWith('DELETE')) return 'DELETE';
  if (head.startsWith('ALTER')) return 'ALTER';
  return 'SELECT';
}

interface ResultPanelsState {
  panels: QueryResultPanel[];
  minimizedOrder: string[];
  ensurePanelFromResult: (opts: {
    id: string;
    query: string;
    connectionId: string;
    result: QueryResult;
  }) => void;
  ensurePanelForStatement: (opts: {
    id: string;
    query: string;
    connectionId: string;
    result?: QueryResult;
    affectedRows?: number;
    executedAt?: string;
  }) => void;
  setPanelState: (id: string, state: PanelState) => void;
  closePanel: (id: string) => void;
  getPanel: (id: string) => QueryResultPanel | undefined;
}

export const useResultPanelsStore = create<ResultPanelsState>((set, get) => ({
  panels: [],
  minimizedOrder: [],

  ensurePanelFromResult: ({ id, query, connectionId, result }) => {
    const existing = get().panels.find((p) => p.id === id);
    const base: QueryResultPanel = {
      id,
      query,
      type: detectQueryType(query),
      state: existing?.state ?? 'docked',
      executedAt: new Date(result.executed_at),
      connectionId,
      resultId: result.id,
      data: result.rows,
      columns: result.columns.map((c) => ({ name: c.name, data_type: c.data_type })),
      result,
    };
    if (existing) {
      set((s) => ({
        panels: s.panels.map((p) => (p.id === id ? { ...base } : p)),
      }));
    } else {
      set((s) => ({
        panels: [...s.panels, base],
      }));
    }
  },

  ensurePanelForStatement: ({ id, query, connectionId, result, affectedRows, executedAt }) => {
    const existing = get().panels.find((p) => p.id === id);
    const base: QueryResultPanel = {
      id,
      query,
      type: detectQueryType(query),
      state: existing?.state ?? 'docked',
      executedAt: executedAt ? new Date(executedAt) : new Date(),
      connectionId,
      resultId: result?.id,
      data: result?.rows,
      columns: result?.columns?.map((c) => ({ name: c.name, data_type: c.data_type })),
      result,
    };
    if (existing) {
      set((s) => ({ panels: s.panels.map((p) => (p.id === id ? { ...base } : p)) }));
    } else {
      set((s) => ({ panels: [...s.panels, base] }));
    }
  },

  setPanelState: (id, state) => {
    set((s) => {
      const wasMinimized = s.panels.find((p) => p.id === id)?.state === 'minimized';
      const panels = s.panels.map((p) => (p.id === id ? { ...p, state } as QueryResultPanel : p));
      let minimizedOrder = s.minimizedOrder;
      if (state === 'minimized' && !s.minimizedOrder.includes(id)) {
        minimizedOrder = [id, ...s.minimizedOrder];
      } else if (wasMinimized && state !== 'minimized') {
        minimizedOrder = s.minimizedOrder.filter((x) => x !== id);
      }
      return { panels, minimizedOrder };
    });
  },

  closePanel: (id) => {
    set((s) => ({
      panels: s.panels.filter((p) => p.id !== id),
      minimizedOrder: s.minimizedOrder.filter((x) => x !== id),
    }));
  },

  getPanel: (id) => get().panels.find((p) => p.id === id),
}));
