import { create } from 'zustand';
import type { SchemaInfo, TableInfo } from '../domain/schema-types';
import { schemaApi } from '../infrastructure/tauri-api';
import { schemaCatalog } from '../sql-completion/schema-catalog';

type PerConnectionState = {
  databases: string[];
  schemas: SchemaInfo[];
  tables: TableInfo[];
  selectedDatabase: string | null;
  selectedSchema: string | null;
  selectedTable: TableInfo | null;
};

interface SchemaState {
  byConnection: Record<string, PerConnectionState>;
  isLoadingByConnection: Record<string, boolean>;
  errorByConnection: Record<string, string | null>;

  // Getters
  getDatabases: (connectionId: string) => string[];
  getSchemas: (connectionId: string) => SchemaInfo[];
  getTables: (connectionId: string) => TableInfo[];
  getSelectedDatabase: (connectionId: string) => string | null;
  getSelectedSchema: (connectionId: string) => string | null;
  getSelectedTable: (connectionId: string) => TableInfo | null;

  // Actions
  loadDatabases: (connectionId: string) => Promise<void>;
  loadSchemas: (connectionId: string, database: string) => Promise<void>;
  loadTables: (connectionId: string, schema?: string) => Promise<void>;
  selectTable: (connectionId: string, table: string, schema?: string) => Promise<void>;
  setSelectedDatabase: (connectionId: string, database: string | null) => void;
  setSelectedSchema: (connectionId: string, schema: string | null) => void;
  clear: (connectionId?: string) => void;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  byConnection: {},
  isLoadingByConnection: {},
  errorByConnection: {},

  getDatabases: (connectionId) => get().byConnection[connectionId]?.databases || [],
  getSchemas: (connectionId) => get().byConnection[connectionId]?.schemas || [],
  getTables: (connectionId) => get().byConnection[connectionId]?.tables || [],
  getSelectedDatabase: (connectionId) => get().byConnection[connectionId]?.selectedDatabase ?? null,
  getSelectedSchema: (connectionId) => get().byConnection[connectionId]?.selectedSchema ?? null,
  getSelectedTable: (connectionId) => get().byConnection[connectionId]?.selectedTable ?? null,

  loadDatabases: async (connectionId) => {
    set((prev) => ({
      isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: true },
      errorByConnection: { ...prev.errorByConnection, [connectionId]: null },
    }));
    try {
      const databases = await schemaApi.listDatabases(connectionId);
      set((prev) => ({
        byConnection: {
          ...prev.byConnection,
          [connectionId]: {
            databases,
            schemas: prev.byConnection[connectionId]?.schemas || [],
            tables: prev.byConnection[connectionId]?.tables || [],
            selectedDatabase: prev.byConnection[connectionId]?.selectedDatabase ?? null,
            selectedSchema: prev.byConnection[connectionId]?.selectedSchema ?? null,
            selectedTable: prev.byConnection[connectionId]?.selectedTable ?? null,
          },
        },
        isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
      }));
    } catch (e) {
      set((prev) => ({
        errorByConnection: { ...prev.errorByConnection, [connectionId]: String(e) },
        isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
      }));
    }
  },

  loadSchemas: async (connectionId, database) => {
    set((prev) => ({
      isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: true },
      errorByConnection: { ...prev.errorByConnection, [connectionId]: null },
    }));
    try {
      const schemas = await schemaApi.listSchemas(connectionId, database);
      set((prev) => ({
        byConnection: {
          ...prev.byConnection,
          [connectionId]: {
            databases: prev.byConnection[connectionId]?.databases || [],
            schemas,
            tables: prev.byConnection[connectionId]?.tables || [],
            selectedDatabase: database,
            selectedSchema: prev.byConnection[connectionId]?.selectedSchema ?? null,
            selectedTable: prev.byConnection[connectionId]?.selectedTable ?? null,
          },
        },
        isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
      }));
    } catch (e) {
      set((prev) => ({
        errorByConnection: { ...prev.errorByConnection, [connectionId]: String(e) },
        isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
      }));
    }
  },

  loadTables: async (connectionId, schema) => {
    set((prev) => ({
      isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: true },
      errorByConnection: { ...prev.errorByConnection, [connectionId]: null },
    }));
    try {
      const tables = await schemaApi.listTables(connectionId, schema);
      set((prev) => {
        const prevConn = prev.byConnection[connectionId] || {
          databases: [],
          schemas: [],
          tables: [],
          selectedDatabase: null,
          selectedSchema: null,
          selectedTable: null,
        };
        const updatedSchemas = schema
          ? prevConn.schemas.map((s) => (s.name === schema ? { ...s, tables } : s))
          : prevConn.schemas;
        return {
          byConnection: {
            ...prev.byConnection,
            [connectionId]: {
              databases: prevConn.databases,
              schemas: updatedSchemas,
              tables,
              selectedDatabase: prevConn.selectedDatabase,
              selectedSchema: schema ?? null,
              selectedTable: prevConn.selectedTable,
            },
          },
          isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
        };
      });
    } catch (e) {
      set((prev) => ({
        errorByConnection: { ...prev.errorByConnection, [connectionId]: String(e) },
        isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
      }));
    }
  },

  selectTable: async (connectionId, table, schema) => {
    set((prev) => ({
      isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: true },
      errorByConnection: { ...prev.errorByConnection, [connectionId]: null },
    }));
    try {
      const tableInfo = await schemaApi.getTableInfo(connectionId, table, schema);
      const columns = await schemaApi.getColumns(connectionId, table, schema);
      const tableWithColumns = { ...tableInfo, columns };
      set((prev) => {
        const prevConn = prev.byConnection[connectionId] || {
          databases: [],
          schemas: [],
          tables: [],
          selectedDatabase: null,
          selectedSchema: null,
          selectedTable: null,
        };
        schemaCatalog.updateTable({
          ...tableWithColumns,
          schema: schema ?? tableWithColumns.schema,
        });
        const updatedTables = (() => {
          const idx = prevConn.tables.findIndex(
            (t) => t.name === table && ((schema && t.schema === schema) || !schema || !t.schema)
          );
          if (idx >= 0) {
            const next = [...prevConn.tables];
            next[idx] = tableWithColumns;
            return next;
          }
          return [...prevConn.tables, tableWithColumns];
        })();
        return {
          byConnection: {
            ...prev.byConnection,
            [connectionId]: {
              ...prevConn,
              selectedTable: tableWithColumns,
              tables: updatedTables,
            },
          },
          isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
        };
      });
    } catch (e) {
      set((prev) => ({
        errorByConnection: { ...prev.errorByConnection, [connectionId]: String(e) },
        isLoadingByConnection: { ...prev.isLoadingByConnection, [connectionId]: false },
      }));
    }
  },

  setSelectedDatabase: (connectionId, database) =>
    set((prev) => {
      const prevConn = prev.byConnection[connectionId] || {
        databases: [],
        schemas: [],
        tables: [],
        selectedDatabase: null,
        selectedSchema: null,
        selectedTable: null,
      };
      return {
        byConnection: {
          ...prev.byConnection,
          [connectionId]: { ...prevConn, selectedDatabase: database },
        },
      };
    }),

  setSelectedSchema: (connectionId, schema) =>
    set((prev) => {
      const prevConn = prev.byConnection[connectionId] || {
        databases: [],
        schemas: [],
        tables: [],
        selectedDatabase: null,
        selectedSchema: null,
        selectedTable: null,
      };
      return {
        byConnection: {
          ...prev.byConnection,
          [connectionId]: { ...prevConn, selectedSchema: schema },
        },
      };
    }),

  clear: (connectionId) =>
    set((prev) => {
      if (connectionId) {
        const newByConn = { ...prev.byConnection };
        delete newByConn[connectionId];
        const newLoading = { ...prev.isLoadingByConnection };
        delete newLoading[connectionId];
        const newError = { ...prev.errorByConnection };
        delete newError[connectionId];
        return {
          byConnection: newByConn,
          isLoadingByConnection: newLoading,
          errorByConnection: newError,
        };
      }
      return {
        byConnection: {},
        isLoadingByConnection: {},
        errorByConnection: {},
      };
    }),
}));
