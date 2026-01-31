import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ConnectionModal } from './components/ConnectionModal';
import { QueryBuilder } from './components/QueryBuilder';
import { CommandPalette } from './components/CommandPalette';
import { WorkspaceRestoreIndicator } from './components/WorkspaceRestoreIndicator';
import { AboutModal } from './components/AboutModal';
import { TitleBar } from './components/TitleBar';
import { ResultPanelsManager } from './components/ResultPanelsManager';
import { useConnectionStore } from './store/connection-store';
import { useUIStore } from './store/ui-store';
import { useWorkspaceStore } from './store/workspace-store';
import { useQueryStore } from './store/query-store';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { setupWorkspaceAutoSave } from './store/workspace-store';
import { Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { invoke } from '@tauri-apps/api/tauri';

interface LaunchFileContent {
  path: string;
  content: string;
}

function App() {
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const isConnectionModalOpen = useUIStore((s) => s.isConnectionModalOpen);
  const { activeConnectionId } = useConnectionStore();
  const { restoreWorkspace } = useWorkspaceStore();
  const { addTab } = useQueryStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useGlobalShortcuts();

  useEffect(() => {
    loadConnections();
    setupWorkspaceAutoSave();
  }, [loadConnections]);

  useEffect(() => {
    if (activeConnectionId) {
      restoreWorkspace(activeConnectionId);
    }
  }, [activeConnectionId, restoreWorkspace]);

  // Check for launch file
  useEffect(() => {
    async function checkLaunchFile() {
      try {
        const fileData = await invoke<LaunchFileContent | null>('get_launch_file');
        if (fileData) {
          const { path, content } = fileData;
          // Extract filename for title
          const fileName = path.split(/[\\/]/).pop() || 'Untitled.sql';
          
          addTab({
            title: fileName,
            query: content,
            connectionId: useConnectionStore.getState().activeConnectionId || '',
          });
        }
      } catch (error) {
        console.error('Failed to open launch file:', error);
      }
    }
    
    checkLaunchFile();
  }, [addTab]); // Run once on mount (addTab is stable)

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-dark-bg">
      {/* Barra de título personalizada */}
      <TitleBar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Sidebar con colapso */}
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <Panel defaultSize={16} minSize={12} maxSize={25}>
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <Sidebar />
                </motion.div>
              </Panel>
            )}
          </AnimatePresence>

          {/* Resize Handle con botón de colapso */}
          {!sidebarCollapsed && (
            <PanelResizeHandle className="w-px bg-dark-border/50 hover:bg-matrix-700/50 transition-all relative group">
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-12 bg-dark-surface/90 border border-dark-border/50 rounded-r flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-dark-hover hover:border-matrix-700/50 hover:w-5"
                title="Collapse sidebar (Ctrl+B)"
              >
                <ChevronLeft className="w-3 h-3 text-matrix-400" />
              </button>
            </PanelResizeHandle>
          )}

          {/* Botón para expandir sidebar colapsado */}
          {sidebarCollapsed && (
            <motion.button
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSidebarCollapsed(false)}
              className="w-7 bg-dark-surface/80 border-r border-dark-border/50 flex flex-col items-center py-3 gap-2 hover:bg-dark-hover hover:w-8 transition-all group"
              title="Expand sidebar (Ctrl+B)"
            >
              <ChevronRight className="w-3.5 h-3.5 text-matrix-400 group-hover:text-matrix-300" />
              <div className="h-px w-3 bg-dark-border/50" />
              <Database className="w-3.5 h-3.5 text-dark-muted group-hover:text-matrix-400" />
            </motion.button>
          )}

          {/* Main Content Area */}
          <Panel minSize={50}>
            <MainContent />
          </Panel>
        </PanelGroup>
      </div>

      {/* Modals y overlays */}
      {isConnectionModalOpen && <ConnectionModal />}
      <ErrorBoundary
        fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-dark-surface border border-dark-border rounded-lg shadow-2xl w-[60vw] p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Error en Query Builder</h2>
              <p className="text-dark-muted">
                Ocurrió un problema al renderizar el Query Builder. Cierra y vuelve a abrir el modal.
              </p>
            </div>
          </div>
        }
      >
        <QueryBuilder />
      </ErrorBoundary>
      <CommandPalette />
      <WorkspaceRestoreIndicator />
      <AboutModal />
      <ResultPanelsManager />
    </div>
  );
}

export default App;
