import { create } from 'zustand';
import type {
  Connection,
  ConnectionStatus,
  CreateConnectionDto,
  UpdateConnectionDto,
} from '../domain/types';
import { connectionApi } from '../infrastructure/tauri-api';

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  connectionStatuses: Record<string, ConnectionStatus>;
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
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  activeConnectionId: null,
  connectionStatuses: {},
  isLoading: false,
  error: null,

  loadConnections: async () => {
    set({ isLoading: true, error: null });
    try {
      const connections = await connectionApi.getAll();
      set({ connections, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createConnection: async (dto) => {
    const connection = await connectionApi.create(dto);
    set((state) => ({
      connections: [...state.connections, connection],
    }));
    return connection;
  },

  updateConnection: async (id, dto) => {
    const updated = await connectionApi.update(id, dto);
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? updated : c
      ),
    }));
  },

  deleteConnection: async (id) => {
    await connectionApi.delete(id);
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      activeConnectionId:
        state.activeConnectionId === id ? null : state.activeConnectionId,
    }));
  },

  testConnection: async (id) => {
    await connectionApi.test(id);
  },

  connect: async (id) => {
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: 'Connecting' },
    }));
    try {
      await connectionApi.connect(id);
      set((state) => ({
        connectionStatuses: { ...state.connectionStatuses, [id]: 'Connected' },
        activeConnectionId: id,
      }));
    } catch (e) {
      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [id]: { Error: String(e) },
        },
      }));
      throw e;
    }
  },

  disconnect: async (id) => {
    await connectionApi.disconnect(id);
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: 'Disconnected' },
    }));
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id });
  },

  refreshStatus: async (id) => {
    const status = await connectionApi.getStatus(id);
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: status },
    }));
  },
}));
