import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';
type SidebarView = 'explorer' | 'history' | 'saved-queries';

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
  destructiveOperationModal: {
    operation: import('../domain/editable-result-types').DestructiveOperation;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  } | null;

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
  showDestructiveOperation: (data: {
    operation: import('../domain/editable-result-types').DestructiveOperation;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  }) => void;
  closeDestructiveOperation: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarView: 'explorer',
      sidebarWidth: 280,
      isConnectionModalOpen: false,
      editingConnectionId: null,
      isConfirmDialogOpen: false,
      confirmDialogConfig: null,
      isAboutModalOpen: false,
      destructiveOperationModal: null,

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
          editingConnectionId: typeof connectionId === 'string' ? connectionId : null,
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
      showDestructiveOperation: (data) => set({ destructiveOperationModal: data }),
      closeDestructiveOperation: () => set({ destructiveOperationModal: null }),
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
