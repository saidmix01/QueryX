// Tipos para persistencia del workspace

export type TabType = 'sql-editor' | 'table-view' | 'query-builder';

export interface TableRef {
  schema?: string;
  name: string;
}

export interface WorkspaceTab {
  id: string;
  tab_type: TabType;
  title: string;
  payload: TabPayload;
}

export type TabPayload =
  | { type: 'sqlEditor'; sql: string }
  | { type: 'tableView'; table: TableRef }
  | { type: 'queryBuilder'; query_model: unknown };

export interface WorkspaceState {
  connection_id: string;
  active_tab_id?: string;
  tabs: WorkspaceTab[];
  last_updated: string;
}

export interface SaveWorkspaceDto {
  connection_id: string;
  active_tab_id?: string;
  tabs: WorkspaceTab[];
}
