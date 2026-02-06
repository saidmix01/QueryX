import { useEffect, useState, lazy, Suspense } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ConnectionModal } from './components/ConnectionModal';
const QueryBuilderLazy = lazy(() =>
  import('./components/QueryBuilder').then((m) => ({ default: m.QueryBuilder }))
);
const CommandPaletteLazy = lazy(() =>
  import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const WorkspaceRestoreIndicatorLazy = lazy(() =>
  import('./components/WorkspaceRestoreIndicator').then((m) => ({ default: m.WorkspaceRestoreIndicator }))
);
const AboutModalLazy = lazy(() =>
  import('./components/AboutModal').then((m) => ({ default: m.AboutModal }))
);
import { TitleBar } from './components/TitleBar';
const ResultPanelsManagerLazy = lazy(() =>
  import('./components/ResultPanelsManager').then((m) => ({ default: m.ResultPanelsManager }))
);
import { useConnectionStore } from './store/connection-store';
import { useUIStore } from './store/ui-store';
import { useWorkspaceStore } from './store/workspace-store';
import { useQueryStore } from './store/query-store';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { setupWorkspaceAutoSave } from './store/workspace-store';
import { Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { invoke } from '@tauri-apps/api/tauri';
const NotificationCenterLazy = lazy(() =>
  import('./components/NotificationCenter').then((m) => ({ default: m.NotificationCenter }))
);
import { setupGlobalErrorHandlers } from './utils/global-error-handler';
import { ensureDefaultSchemaInitialized } from './utils/schema-init';
const DestructiveOperationModalLazy = lazy(() =>
  import('./components/DestructiveOperationModal').then((m) => ({ default: m.DestructiveOperationModal }))
);

interface LaunchFileContent {
  path: string;
  content: string;
}

function App() {
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const isConnectionModalOpen = useUIStore((s) => s.isConnectionModalOpen);
  const destructiveModal = useUIStore((s) => s.destructiveOperationModal);
  const closeDestructive = useUIStore((s) => s.closeDestructiveOperation);
  const { activeConnectionId } = useConnectionStore();
  const { restoreWorkspace } = useWorkspaceStore();
  const { addTab } = useQueryStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useGlobalShortcuts();
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    const defer = (fn: () => void) => {
      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout?: number }) => number)
        | undefined;
      if (typeof ric === 'function') {
        try {
          ric(fn, { timeout: 500 });
          return;
        } catch {
          // no-op
        }
      }
      setTimeout(fn, 50);
    };
    defer(() => {
      loadConnections();
      setupWorkspaceAutoSave();
    });
  }, [loadConnections]);

  useEffect(() => {
    if (activeConnectionId) {
      restoreWorkspace(activeConnectionId);
    }
  }, [activeConnectionId, restoreWorkspace]);
  
  useEffect(() => {
    if (!activeConnectionId) return;
    const ua = navigator.userAgent.toLowerCase();
    const isMac =
      ua.includes('mac os') ||
      ua.includes('macintosh') ||
      document.documentElement.classList.contains('is-mac');
    const conn = useConnectionStore.getState().connections.find((c) => c.id === activeConnectionId);
    if (conn) {
      ensureDefaultSchemaInitialized(conn, { force: isMac }).catch(() => {});
    }
  }, [activeConnectionId]);

  // Check for launch file
  useEffect(() => {
    async function checkLaunchFile() {
      try {
        if (!(window as any).__TAURI_IPC__) {
          return;
        }
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
      {(() => {
        const ua = navigator.userAgent.toLowerCase();
        const isMac =
          ua.includes('mac os') ||
          ua.includes('macintosh') ||
          document.documentElement.classList.contains('is-mac');
        return !isMac ? <TitleBar /> : null;
      })()}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Sidebar con colapso */}
          {!sidebarCollapsed && (
            <Panel defaultSize={16} minSize={12} maxSize={25}>
              <div className="h-full">
                <Sidebar />
              </div>
            </Panel>
          )}

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
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-7 bg-dark-surface/80 border-r border-dark-border/50 flex flex-col items-center py-3 gap-2 hover:bg-dark-hover hover:w-8 transition-all group"
              title="Expand sidebar (Ctrl+B)"
            >
              <ChevronRight className="w-3.5 h-3.5 text-matrix-400 group-hover:text-matrix-300" />
              <div className="h-px w-3 bg-dark-border/50" />
              <Database className="w-3.5 h-3.5 text-dark-muted group-hover:text-matrix-400" />
            </button>
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
        <Suspense fallback={null}>
          <QueryBuilderLazy />
        </Suspense>
      </ErrorBoundary>
      <Suspense fallback={null}>
        <CommandPaletteLazy />
      </Suspense>
      <Suspense fallback={null}>
        <WorkspaceRestoreIndicatorLazy />
      </Suspense>
      <Suspense fallback={null}>
        <AboutModalLazy />
      </Suspense>
      <Suspense fallback={null}>
        <ResultPanelsManagerLazy />
      </Suspense>
      <Suspense fallback={null}>
        <NotificationCenterLazy />
      </Suspense>
      {destructiveModal && (
        <Suspense fallback={null}>
          <DestructiveOperationModalLazy
            operation={destructiveModal.operation}
            onConfirm={async () => {
              await destructiveModal.onConfirm();
              closeDestructive();
            }}
            onCancel={() => closeDestructive()}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
