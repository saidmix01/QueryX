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
    await connectionApi.delete(id);
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      activeConnectionId:
        state.activeConnectionId === id ? null : state.activeConnectionId,
    }));
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
