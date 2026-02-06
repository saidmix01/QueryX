import { create } from 'zustand';
import type {
  Connection,
  ConnectionStatus,
  CreateConnectionDto,
  UpdateConnectionDto,
  ActiveContext,
} from '../domain/types';
import { connectionApi } from '../infrastructure/tauri-api';
import { useNotificationStore } from './notification-store';
import { normalizeError } from '../utils/global-error-handler';

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  connectionStatuses: Record<string, ConnectionStatus>;
  activeContexts: Record<string, ActiveContext>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConnections: () => Promise<void>;
  createConnection: (dto: CreateConnectionDto) => Promise<Connection>;
  updateConnection: (id: string, dto: UpdateConnectionDto) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  setActiveConnection: (id: string | null) => void;
  refreshStatus: (id: string) => Promise<void>;
  
  changeDatabase: (id: string, database: string) => Promise<void>;
  changeSchema: (id: string, schema: string) => Promise<void>;
  refreshContext: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectionStatuses: {},
  activeContexts: {},
  isLoading: false,
  error: null,

  loadConnections: async () => {
    set({ isLoading: true, error: null });
    try {
      const connections = await connectionApi.getAll();
      set({ connections, isLoading: false });
    } catch (e) {
      const msg = normalizeError(e);
      set({ error: msg, isLoading: false });
      useNotificationStore.getState().error(msg, {
        variant: 'toast',
        source: 'ipc',
        persistent: false,
        autoCloseMs: 10000,
      });
    }
  },

  createConnection: async (dto) => {
    // Sanitización defensiva en el store
    if (!dto || typeof dto !== 'object') {
      throw new Error('Invalid connection data: payload must be an object');
    }
    
    // Verificar si es un evento o tiene referencias circulares
    try {
      // Esto fallará rápido si hay referencias circulares antes de llegar a Tauri
      JSON.stringify(dto); 
    } catch (e) {
      console.error('Circular reference detected in createConnection payload:', dto);
      throw new Error('Invalid connection data: circular reference detected');
    }

    // Asegurar que no sea un evento de React/DOM
    if ('preventDefault' in dto || 'stopPropagation' in dto || 'nativeEvent' in dto) {
      console.error('Event object passed to createConnection instead of DTO:', dto);
      throw new Error('Invalid connection data: received Event object');
    }

    const connection = await connectionApi.create(dto);
    set((state) => ({
      connections: [...state.connections, connection],
    }));
    return connection;
  },

  updateConnection: async (id, dto) => {
    if (!id || typeof id !== 'string') throw new Error('Invalid ID for update');
    const updated = await connectionApi.update(id, dto);
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? updated : c
      ),
    }));
  },

  deleteConnection: async (id) => {
    try {
      await connectionApi.delete(id);
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        activeConnectionId:
          state.activeConnectionId === id ? null : state.activeConnectionId,
        activeContexts: { ...state.activeContexts, [id]: {} as any }, // Clear context
      }));
      useNotificationStore.getState().info('Conexión eliminada', {
        variant: 'toast',
        source: 'ui',
        autoCloseMs: 3000,
      });
    } catch (e) {
      useNotificationStore.getState().error(normalizeError(e), {
        variant: 'toast',
        source: 'ipc',
        persistent: false,
        autoCloseMs: 6000,
      });
      throw e;
    }
  },

  testConnection: async (id) => {
    // Validación estricta para asegurar que sea un UUID string y no un evento
    if (typeof id !== 'string') {
      console.error('Invalid ID passed to testConnection:', id);
      throw new Error(`Invalid connection ID: expected string, got ${typeof id}`);
    }
    await connectionApi.test(id);
  },

  connect: async (id) => {
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: 'Connecting' },
    }));
    try {
      await connectionApi.connect(id);
      
      // Fetch initial context
      const [db, schema] = await connectionApi.getActiveContext(id);
      
      set((state) => ({
        connectionStatuses: { ...state.connectionStatuses, [id]: 'Connected' },
        activeConnectionId: id,
        activeContexts: {
            ...state.activeContexts,
            [id]: { database: db || undefined, schema: schema || undefined }
        }
      }));
    } catch (e) {
      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [id]: { Error: normalizeError(e) },
        },
      }));
      useNotificationStore.getState().error(normalizeError(e), {
        variant: 'toast',
        source: 'ipc',
        autoCloseMs: 10000,
        persistent: false,
      });
      throw e;
    }
  },

  disconnect: async (id) => {
    try {
      await connectionApi.disconnect(id);
      set((state) => ({
        connectionStatuses: { ...state.connectionStatuses, [id]: 'Disconnected' },
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        activeContexts: { ...state.activeContexts, [id]: {} }, // Clear context
      }));
    } catch (e) {
      useNotificationStore.getState().error(normalizeError(e), {
        variant: 'toast',
        source: 'ipc',
        autoCloseMs: 10000,
        persistent: false,
      });
      throw e;
    }
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id });
  },

  refreshStatus: async (id) => {
    const status = await connectionApi.getStatus(id);
    if (status === 'Connected') {
        const [db, schema] = await connectionApi.getActiveContext(id);
        set((state) => ({
            connectionStatuses: { ...state.connectionStatuses, [id]: status },
            activeContexts: {
                ...state.activeContexts,
                [id]: { database: db || undefined, schema: schema || undefined }
            }
        }));
    } else {
        set((state) => ({
            connectionStatuses: { ...state.connectionStatuses, [id]: status },
        }));
    }
  },

  changeDatabase: async (id, database) => {
    try {
        await connectionApi.changeDatabase(id, database);
        await get().refreshContext(id);
    } catch (e) {
        useNotificationStore.getState().error(normalizeError(e), {
            variant: 'toast',
            source: 'ipc',
            autoCloseMs: 5000,
            persistent: false,
        });
        throw e;
    }
  },

  changeSchema: async (id, schema) => {
    try {
        await connectionApi.changeSchema(id, schema);
        await get().refreshContext(id);
    } catch (e) {
        useNotificationStore.getState().error(normalizeError(e), {
            variant: 'toast',
            source: 'ipc',
            autoCloseMs: 5000,
            persistent: false,
        });
        throw e;
    }
  },

  refreshContext: async (id) => {
    try {
        const [db, schema] = await connectionApi.getActiveContext(id);
        set((state) => ({
            activeContexts: {
                ...state.activeContexts,
                [id]: { database: db || undefined, schema: schema || undefined }
            }
        }));
    } catch (e) {
        console.error('Failed to refresh context', e);
    }
  }
}));
