import { create } from 'zustand';
import type {
  SavedQuery,
  QueryFolder,
  CreateSavedQueryDto,
  UpdateSavedQueryDto,
} from '../domain/saved-query-types';
import { savedQueryApi } from '../infrastructure/tauri-api';

interface SavedQueryState {
  queries: SavedQuery[];
  folders: QueryFolder[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadQueries: (connectionId: string) => Promise<void>;
  loadFolders: (connectionId: string) => Promise<void>;
  createQuery: (dto: CreateSavedQueryDto) => Promise<SavedQuery>;
  updateQuery: (id: string, dto: UpdateSavedQueryDto) => Promise<SavedQuery>;
  deleteQuery: (id: string) => Promise<void>;
  createFolder: (connectionId: string, name: string, parentId?: string) => Promise<QueryFolder>;
  deleteFolder: (id: string) => Promise<void>;
  findByTags: (connectionId: string, tags: string[]) => Promise<SavedQuery[]>;
}

export const useSavedQueryStore = create<SavedQueryState>((set) => ({
  queries: [],
  folders: [],
  isLoading: false,
  error: null,

  loadQueries: async (connectionId) => {
    set({ isLoading: true, error: null });
    try {
      const queries = await savedQueryApi.getByConnection(connectionId);
      set({ queries, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadFolders: async (connectionId) => {
    try {
      const folders = await savedQueryApi.getFolders(connectionId);
      set({ folders });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createQuery: async (dto) => {
    const query = await savedQueryApi.create(dto);
    set((state) => ({ queries: [...state.queries, query] }));
    return query;
  },

  updateQuery: async (id, dto) => {
    const updated = await savedQueryApi.update(id, dto);
    set((state) => ({
      queries: state.queries.map((q) => (q.id === id ? updated : q)),
    }));
    return updated;
  },

  deleteQuery: async (id) => {
    await savedQueryApi.delete(id);
    set((state) => ({
      queries: state.queries.filter((q) => q.id !== id),
    }));
  },

  createFolder: async (connectionId, name, parentId) => {
    const folder = await savedQueryApi.createFolder(connectionId, name, parentId);
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  deleteFolder: async (id) => {
    await savedQueryApi.deleteFolder(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      // Limpiar folder_id de queries que estaban en esta carpeta
      queries: state.queries.map((q) =>
        q.folder_id === id ? { ...q, folder_id: undefined } : q
      ),
    }));
  },

  findByTags: async (connectionId, tags) => {
    return await savedQueryApi.findByTags(connectionId, tags);
  },
}));
