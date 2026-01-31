import { create } from 'zustand';
import type { SaveWorkspaceDto, WorkspaceTab } from '../domain/workspace-types';
import { workspaceApi } from '../infrastructure/tauri-api';
import { useQueryStore } from './query-store';
import { debounce } from '../utils/debounce';

interface WorkspaceStoreState {
  isRestoring: boolean;
  lastSaved: Record<string, Date>;

  // Actions
  saveWorkspace: (connectionId: string) => Promise<void>;
  restoreWorkspace: (connectionId: string) => Promise<void>;
  deleteWorkspace: (connectionId: string) => Promise<void>;
}

// Debounced save para evitar guardar en cada keystroke
const debouncedSave = debounce(async (connectionId: string) => {
  const queryStore = useQueryStore.getState();
  const tabs = queryStore.tabs.filter((t) => t.connectionId === connectionId);

  const workspaceTabs: WorkspaceTab[] = tabs.map((tab) => ({
    id: tab.id,
    tab_type: 'sql-editor',
    title: tab.title,
    payload: {
      type: 'sqlEditor',
      sql: tab.query,
    },
  }));

  const dto: SaveWorkspaceDto = {
    connection_id: connectionId,
    active_tab_id: queryStore.activeTabId || undefined,
    tabs: workspaceTabs,
  };

  await workspaceApi.save(dto);
}, 1000);

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  isRestoring: false,
  lastSaved: {},

  saveWorkspace: async (connectionId) => {
    await debouncedSave(connectionId);
    set((state) => ({
      lastSaved: { ...state.lastSaved, [connectionId]: new Date() },
    }));
  },

  restoreWorkspace: async (connectionId) => {
    set({ isRestoring: true });
    try {
      const workspace = await workspaceApi.get(connectionId);
      
      if (!workspace || workspace.tabs.length === 0) {
        set({ isRestoring: false });
        return;
      }

      const queryStore = useQueryStore.getState();

      // Restaurar pestañas
      workspace.tabs.forEach((tab) => {
        if (tab.payload.type === 'sqlEditor') {
          queryStore.addTab({
            title: tab.title,
            query: tab.payload.sql,
            connectionId,
          });
        }
      });

      // Restaurar pestaña activa
      if (workspace.active_tab_id) {
        queryStore.setActiveTab(workspace.active_tab_id);
      }

      set({ isRestoring: false });
    } catch (e) {
      console.error('Failed to restore workspace:', e);
      set({ isRestoring: false });
    }
  },

  deleteWorkspace: async (connectionId) => {
    await workspaceApi.delete(connectionId);
    set((state) => {
      const { [connectionId]: _, ...rest } = state.lastSaved;
      return { lastSaved: rest };
    });
  },
}));

// Auto-save cuando cambian las pestañas o el contenido
export const setupWorkspaceAutoSave = () => {
  let previousState: string | null = null;

  useQueryStore.subscribe((state) => {
    const currentState = JSON.stringify({
      tabs: state.tabs.map((t) => ({ id: t.id, query: t.query, connectionId: t.connectionId })),
      activeTabId: state.activeTabId,
    });

    if (currentState !== previousState) {
      previousState = currentState;

      // Guardar workspace para cada conexión activa
      const connections = new Set(state.tabs.map((t) => t.connectionId).filter(Boolean));
      connections.forEach((connId) => {
        useWorkspaceStore.getState().saveWorkspace(connId);
      });
    }
  });
};
