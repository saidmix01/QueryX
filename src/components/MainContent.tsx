import { motion } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { QueryEditor } from './QueryEditor';
import { ResultsTable } from './ResultsTable';
import { MultiStatementResults } from './MultiStatementResults';
import { QueryTabs } from './QueryTabs';
import { useQueryStore } from '../store/query-store';
import { useConnectionStore } from '../store/connection-store';
import { Database, Code2, Pin } from 'lucide-react';
import { useRef } from 'react';
import { useResultPanelsStore } from '../store/result-panels-store';

export function MainContent() {
  const { tabs, activeTabId } = useQueryStore();
  const { activeConnectionId } = useConnectionStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const editorPanelRef = useRef<ImperativePanelHandle>(null);
  const resultsPanelRef = useRef<ImperativePanelHandle>(null);
  const setPanelState = useResultPanelsStore((s) => s.setPanelState);
  const activePanel = useResultPanelsStore((s) => s.panels.find((p) => p.id === activeTab?.id));

  // Estado vacío - sin conexión o sin tabs
  if (!activeConnectionId || tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-center max-w-md"
        >
          {/* Ícono central */}
          <div className="relative mb-6 inline-block">
            <Database className="w-20 h-20 text-dark-border/50" />
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <Code2 className="w-9 h-9 text-matrix-500 drop-shadow-[0_0_12px_rgba(0,230,118,0.5)]" />
            </motion.div>
          </div>

          {/* Mensaje */}
          <h2 className="text-lg font-semibold text-matrix-400 mb-2">
            {!activeConnectionId ? 'No Active Connection' : 'No Open Queries'}
          </h2>
          <p className="text-sm text-dark-muted/80 mb-6">
            {!activeConnectionId 
              ? 'Connect to a database from the sidebar to start writing queries'
              : 'Create a new query tab to get started'
            }
          </p>

          {/* Shortcuts */}
          <div className="flex flex-col items-center gap-2.5 text-xs text-dark-muted/70">
            <div className="flex items-center gap-2">
              <kbd className="text-xs">Ctrl+P</kbd>
              <span>Command Palette</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="text-xs">Ctrl+Shift+B</kbd>
              <span>Query Builder</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="text-xs">Ctrl+Enter</kbd>
              <span>Execute Query</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Tabs - Minimalistas */}
      <QueryTabs />

      {/* Editor y Results - Layout vertical con resize */}
      {activeTab && (
        <PanelGroup direction="vertical" className="flex-1">
          {/* SQL Editor Panel - 60-70% del espacio */}
          <Panel defaultSize={65} minSize={30} maxSize={85} ref={editorPanelRef}>
            <QueryEditor tab={activeTab} />
          </Panel>

          {/* Resize Handle - Sutil pero funcional */}
          <PanelResizeHandle className="h-px bg-dark-border/30 hover:bg-matrix-700/50 transition-all relative group">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div 
                className="w-12 h-0.5 bg-dark-border/50 rounded-full group-hover:bg-matrix-700/70 group-hover:w-16 transition-all"
                whileHover={{ scaleY: 2 }}
              />
            </div>
          </PanelResizeHandle>

          {/* Results Panel - Redimensionable */}
          <Panel minSize={15} maxSize={70} ref={resultsPanelRef}>
            {activeTab.multiResults ? (
              <MultiStatementResults
                results={activeTab.multiResults}
                totalExecutionTimeMs={activeTab.multiResults.reduce((sum: number, r: any) => sum + r.execution_time_ms, 0)}
                connectionId={activeTab.connectionId}
                tabId={activeTab.id}
              />
            ) : (
              <ResultsTable tab={activeTab} />
            )}
          </Panel>
        </PanelGroup>
      )}
      {activePanel?.state === 'pinned' && (
        <div className="fixed bottom-0 left-0 right-0 bg-dark-surface/70 backdrop-blur-md border-t border-dark-border/30 px-4 py-1.5 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-matrix-600/40 text-matrix-400 bg-matrix-900/20">
            <Pin className="w-3 h-3" />
            Pineado
          </span>
        </div>
      )}
    </div>
  );
}
