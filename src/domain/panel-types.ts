import type { QueryResult } from './types';
export type QueryType = 'SELECT' | 'UPDATE' | 'DELETE' | 'ALTER';

export type PanelState = 'docked' | 'modal' | 'minimized' | 'pinned';

export interface QueryResultPanel {
  id: string;
  query: string;
  type: QueryType;
  data?: any[];
  columns?: { name: string; data_type?: string }[];
  state: PanelState;
  executedAt: Date;
  connectionId: string;
  resultId?: string;
  result?: QueryResult;
}
