import { create } from 'zustand';
import type { CatalogTable } from '../sql-completion/schema-catalog';
import type { SavedQuery } from '../domain/saved-query-types';

export type CommandPaletteAction = 'insert' | 'open-data';

export interface CommandPaletteItem {
  id: string;
  type: 'table' | 'view' | 'schema' | 'saved-query';
  name: string;
  schema?: string;
  database?: string;
  fullName: string;
  table?: CatalogTable;
  savedQuery?: SavedQuery;
}

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  items: CommandPaletteItem[];
  selectedIndex: number;
  action: CommandPaletteAction;

  // Actions
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  setItems: (items: CommandPaletteItem[]) => void;
  setSelectedIndex: (index: number) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  setAction: (action: CommandPaletteAction) => void;
  reset: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  query: '',
  items: [],
  selectedIndex: 0,
  action: 'insert',

  open: () => set({ isOpen: true, query: '', selectedIndex: 0 }),
  close: () => set({ isOpen: false }),
  
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  
  setItems: (items) => set({ items, selectedIndex: 0 }),
  
  setSelectedIndex: (index) =>
    set((state) => ({
      selectedIndex: Math.max(0, Math.min(index, state.items.length - 1)),
    })),
  
  selectNext: () =>
    set((state) => ({
      selectedIndex: Math.min(state.selectedIndex + 1, state.items.length - 1),
    })),
  
  selectPrevious: () =>
    set((state) => ({
      selectedIndex: Math.max(state.selectedIndex - 1, 0),
    })),
  
  setAction: (action) => set({ action }),
  
  reset: () =>
    set({
      query: '',
      items: [],
      selectedIndex: 0,
      action: 'insert',
    }),
}));
