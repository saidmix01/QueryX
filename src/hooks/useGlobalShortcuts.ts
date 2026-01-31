import { useEffect } from 'react';
import { useCommandPaletteStore } from '../store/command-palette-store';
import { useQueryBuilderStore } from '../store/query-builder-store';
import { useUIStore } from '../store/ui-store';

/**
 * Hook para atajos de teclado globales
 */
export function useGlobalShortcuts() {
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const openQueryBuilder = useQueryBuilderStore((s) => s.open);
  const setAboutModalOpen = useUIStore((s) => s.setAboutModalOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P o Cmd+P - Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Ctrl+Shift+B o Cmd+Shift+B - Query Builder
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        openQueryBuilder();
        return;
      }

      // F1 - Acerca de
      if (e.key === 'F1') {
        e.preventDefault();
        setAboutModalOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette, openQueryBuilder, setAboutModalOpen]);
}
