import { invoke } from '@tauri-apps/api/tauri';
import type {
  Connection,
  ConnectionStatus,
  CreateConnectionDto,
  QueryHistoryEntry,
  QueryResult,
  UpdateConnectionDto,
} from '../domain/types';
import type {
  ColumnSchema,
  ConstraintInfo,
  DatabaseInfo,
  FunctionInfo,
  IndexInfo,
  SchemaInfo,
  SequenceInfo,
  TableInfo,
  TriggerInfo,
  ViewInfo,
} from '../domain/schema-types';

// Connection API
export const connectionApi = {
  getAll: () => invoke<Connection[]>('get_connections'),
  
  getById: (id: string) => invoke<Connection>('get_connection', { id }),
  
  create: (dto: CreateConnectionDto) => 
    invoke<Connection>('create_connection', { dto }),
  
  update: (id: string, dto: UpdateConnectionDto) =>
    invoke<Connection>('update_connection', { id, dto }),
  
  delete: (id: string) => invoke<void>('delete_connection', { id }),
  
  test: (id: string) => invoke<void>('test_connection', { id }),
  
  connect: (id: string) => invoke<void>('connect', { id }),
  
  disconnect: (id: string) => invoke<void>('disconnect', { id }),
  
  getStatus: (id: string) => 
    invoke<ConnectionStatus>('get_connection_status', { id }),

  changeDatabase: (id: string, database: string) =>
    invoke<void>('change_database', { id, database }),

  changeSchema: (id: string, schema: string) =>
    invoke<void>('change_schema', { id, schema }),

  getActiveContext: (id: string) =>
    invoke<[string | null, string | null]>('get_active_context', { id }),
};

// Query API
export const queryApi = {
  execute: (
    connectionId: string,
    query: string,
    page?: number,
    pageSize?: number
  ) =>
    invoke<QueryResult>('execute_query', {
      connectionId,
      query,
      page,
      pageSize,
    }),

  executeStatement: (connectionId: string, statement: string) =>
    invoke<number>('execute_statement', { connectionId, statement }),

  executeMultiStatement: (connectionId: string, statements: string[]) =>
    invoke<any[]>('execute_multi_statement', { connectionId, statements }),

  executeInTransaction: (connectionId: string, statement: string) =>
    invoke<{ affected_rows: number; execution_time_ms: number; committed: boolean }>('execute_in_transaction', { connectionId, statement }),

  getHistory: (connectionId: string, limit?: number) =>
    invoke<QueryHistoryEntry[]>('get_query_history', { connectionId, limit }),

  searchHistory: (query: string, limit?: number) =>
    invoke<QueryHistoryEntry[]>('search_query_history', { query, limit }),

  cancel: (connectionId: string) =>
    invoke<void>('cancel_query', { connectionId }),

  insertRow: (
    connectionId: string,
    schema: string | null,
    table: string,
    values: Record<string, any>
  ) =>
    invoke<QueryResult>('insert_row', {
      connectionId,
      schema,
      table,
      values,
    }),
};

// Schema API
export const schemaApi = {
  listDatabases: (connId: string) => {
    console.log('[API] listDatabases:', { connId });
    return invoke<string[]>('list_databases', { connectionId: connId });
  },

  getDatabaseInfo: (connId: string, database: string) => {
    console.log('[API] getDatabaseInfo:', { connId, database });
    return invoke<DatabaseInfo>('get_database_info', { connectionId: connId, database });
  },

  listSchemas: (connId: string, database: string) => {
    console.log('[API] listSchemas:', { connId, database });
    return invoke<SchemaInfo[]>('list_schemas', { connectionId: connId, database });
  },

  listTables: (connId: string, schema?: string) => {
    console.log('[API] listTables:', { connId, schema });
    return invoke<TableInfo[]>('list_tables', { connectionId: connId, schema });
  },

  getTableInfo: (connId: string, table: string, schema?: string) =>
    invoke<TableInfo>('get_table_info', { connectionId: connId, table, schema }),

  getColumns: (connId: string, table: string, schema?: string) =>
    invoke<ColumnSchema[]>('get_columns', { connectionId: connId, table, schema }),

  listIndexes: (connId: string, table: string, schema?: string) =>
    invoke<IndexInfo[]>('list_indexes', { connectionId: connId, table, schema }),

  listConstraints: (connId: string, table: string, schema?: string) =>
    invoke<ConstraintInfo[]>('list_constraints', { connectionId: connId, table, schema }),

  listTriggers: (connId: string, table: string, schema?: string) =>
    invoke<TriggerInfo[]>('list_triggers', { connectionId: connId, table, schema }),

  listViews: (connId: string, schema?: string) =>
    invoke<ViewInfo[]>('list_views', { connectionId: connId, schema }),

  listFunctions: (connId: string, schema?: string) =>
    invoke<FunctionInfo[]>('list_functions', { connectionId: connId, schema }),

  listSequences: (connId: string, schema?: string) =>
    invoke<SequenceInfo[]>('list_sequences', { connectionId: connId, schema }),

  getServerVersion: (connId: string) =>
    invoke<string>('get_server_version', { connectionId: connId }),
};

// Saved Query API
import type {
  SavedQuery,
  QueryFolder,
  CreateSavedQueryDto,
  UpdateSavedQueryDto,
} from '../domain/saved-query-types';

export const savedQueryApi = {
  getByConnection: (connectionId: string) =>
    invoke<SavedQuery[]>('get_saved_queries', { connectionId }),

  getById: (id: string) =>
    invoke<SavedQuery>('get_saved_query', { id }),

  create: (dto: CreateSavedQueryDto) =>
    invoke<SavedQuery>('create_saved_query', { dto }),

  update: (id: string, dto: UpdateSavedQueryDto) =>
    invoke<SavedQuery>('update_saved_query', { id, dto }),

  delete: (id: string) =>
    invoke<void>('delete_saved_query', { id }),

  findByTags: (connectionId: string, tags: string[]) =>
    invoke<SavedQuery[]>('find_saved_queries_by_tags', { connectionId, tags }),

  getFolders: (connectionId: string) =>
    invoke<QueryFolder[]>('get_query_folders', { connectionId }),

  createFolder: (connectionId: string, name: string, parentId?: string) =>
    invoke<QueryFolder>('create_query_folder', { connectionId, name, parentId }),

  deleteFolder: (id: string) =>
    invoke<void>('delete_query_folder', { id }),
};

// Workspace API
import type { WorkspaceState, SaveWorkspaceDto } from '../domain/workspace-types';

export const workspaceApi = {
  save: (dto: SaveWorkspaceDto) =>
    invoke<WorkspaceState>('save_workspace', { dto }),

  get: (connectionId: string) =>
    invoke<WorkspaceState | null>('get_workspace', { connectionId }),

  delete: (connectionId: string) =>
    invoke<void>('delete_workspace', { connectionId }),

  getAll: () =>
    invoke<WorkspaceState[]>('get_all_workspaces'),
};

// Export API
export const exportApi = {
  exportXlsx: (columns: string[], rows: any[][], path: string) =>
    invoke<void>('export_results_xlsx', { columns, rows, path }),
};
