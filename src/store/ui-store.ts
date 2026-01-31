import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';
type SidebarView = 'connections' | 'explorer' | 'history' | 'saved-queries';

interface UIState {
  theme: Theme;
  sidebarView: SidebarView;
  sidebarWidth: number;
  isConnectionModalOpen: boolean;
  editingConnectionId: string | null;
  isConfirmDialogOpen: boolean;
  confirmDialogConfig: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null;
  isAboutModalOpen: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (width: number) => void;
  openConnectionModal: (connectionId?: string) => void;
  closeConnectionModal: () => void;
  showConfirmDialog: (config: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) => void;
  closeConfirmDialog: () => void;
  setAboutModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarView: 'connections',
      sidebarWidth: 280,
      isConnectionModalOpen: false,
      editingConnectionId: null,
      isConfirmDialogOpen: false,
      confirmDialogConfig: null,
      isAboutModalOpen: false,

      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },

      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
          return { theme: newTheme };
        }),

      setSidebarView: (sidebarView) => set({ sidebarView }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

      openConnectionModal: (connectionId) =>
        set({
          isConnectionModalOpen: true,
          editingConnectionId: connectionId ?? null,
        }),

      closeConnectionModal: () =>
        set({
          isConnectionModalOpen: false,
          editingConnectionId: null,
        }),

      showConfirmDialog: (config) =>
        set({
          isConfirmDialogOpen: true,
          confirmDialogConfig: config,
        }),

      closeConfirmDialog: () =>
        set({
          isConfirmDialogOpen: false,
          confirmDialogConfig: null,
        }),

      setAboutModalOpen: (open) => set({ isAboutModalOpen: open }),
    }),
    {
      name: 'sqlforge-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
