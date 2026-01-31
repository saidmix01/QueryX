import { motion, AnimatePresence } from 'framer-motion';
import { useResultPanelsStore } from '../store/result-panels-store';
import { X, PinOff } from 'lucide-react';
import { ResultsTable } from './ResultsTable';
import { createPortal } from 'react-dom';

export function ResultPanelsManager() {
  const { panels, setPanelState } = useResultPanelsStore();

  const renderTabFromPanel = (panel: any) => {
    if (!panel.result) return null;
    return (
      <ResultsTable
        tab={{
          id: panel.id,
          connectionId: panel.connectionId,
          query: panel.query,
          result: panel.result,
          error: null,
          isExecuting: false,
        }}
      />
    );
  };

  const ModalsLayer = (
    <AnimatePresence>
      {panels.filter((p) => p.state === 'modal').map((panel) => (
        <motion.div
          key={`modal-${panel.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center"
          onClick={() => setPanelState(panel.id, 'docked')}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-dark-surface border border-dark-border/50 rounded-lg shadow-2xl w-[94vw] h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-border/30 bg-dark-elevated/50">
              <span className="text-xs text-dark-muted">{panel.type} • {panel.executedAt.toLocaleString()}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPanelState(panel.id, 'pinned')}
                  className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                  title="Pinear"
                >
                  <PinOff className="w-3 h-3 rotate-45" />
                </button>
                <button
                  onClick={() => setPanelState(panel.id, 'docked')}
                  className="btn btn-ghost p-1"
                  title="Cerrar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-dark-bg">
              {renderTabFromPanel(panel)}
            </div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );

  const PinnedLayer = (
    <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-3 max-h-[80vh] overflow-auto pointer-events-auto">
      {panels.filter((p) => p.state === 'pinned').map((panel) => (
        <div key={`pinned-${panel.id}`} className="w-[420px] bg-dark-surface/90 border border-dark-border/50 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-border/30 bg-dark-elevated/50">
            <span className="text-xs text-dark-muted">{panel.type}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPanelState(panel.id, 'modal')}
                className="btn btn-ghost px-2 py-1 text-xs"
                title="Abrir en modal"
              >
                Modal
              </button>
              <button
                onClick={() => setPanelState(panel.id, 'docked')}
                className="btn btn-ghost px-2 py-1 text-xs"
                title="Volver a dock"
              >
                Dock
              </button>
              <button
                onClick={() => setPanelState(panel.id, 'docked')}
                className="btn btn-ghost p-1"
                title="Despinear"
              >
                <PinOff className="w-3 h-3 rotate-45" />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto bg-dark-bg">
            {renderTabFromPanel(panel)}
          </div>
        </div>
      ))}
    </div>
  );

  const DockLayer = null;

  return (
    <>
      {createPortal(ModalsLayer, document.body)}
      {createPortal(PinnedLayer, document.body)}
      {DockLayer}
    </>
  );
}
