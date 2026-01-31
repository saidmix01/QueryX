import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Plus as PlusIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ResultsTable } from './ResultsTable';
import type { QueryResult } from '../domain/types';
import { useResultPanelsStore } from '../store/result-panels-store';

interface StatementResult {
  statement_index: number;
  sql: string;
  success: boolean;
  affected_rows?: number;
  result?: QueryResult;
  error?: string;
  execution_time_ms: number;
}

interface MultiStatementResultsProps {
  results: StatementResult[];
  totalExecutionTimeMs: number;
  connectionId: string;
  tabId: string;
}

export function MultiStatementResults({
  results,
  totalExecutionTimeMs,
  connectionId,
  tabId,
}: MultiStatementResultsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedResult = results[selectedIndex];

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  function MenuActions({
    onModal,
    onPin,
  }: {
    onModal: () => void;
    onPin: () => void;
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        const insideTrigger = ref.current?.contains(target);
        const insideMenu = menuRef.current?.contains(target);
        if (!insideTrigger && !insideMenu) setOpen(false);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);
    return (
      <div ref={ref} className="relative">
        <button
          ref={buttonRef}
          onClick={() => {
            setOpen((v) => !v);
            const rect = buttonRef.current?.getBoundingClientRect();
            if (rect) {
              setCoords({ left: Math.min(rect.left, window.innerWidth - 160), top: rect.bottom + 4 });
            }
          }}
          className="btn btn-secondary px-2 py-1 text-xs flex items-center gap-1"
          title="Más acciones"
        >
          <PlusIcon className="w-3 h-3" />
          +
        </button>
        {open && coords && createPortal(
          <div
            ref={menuRef}
            className="fixed w-36 bg-dark-surface border border-dark-border/40 rounded shadow-xl"
            style={{ left: coords.left, top: coords.top, zIndex: 100000 }}
          >
            <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onModal(); }}>
              Modal
            </button>
            <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onPin(); }}>
              Pinear
            </button>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-dark-border/30 bg-dark-surface/50 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-1.5 text-matrix-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-medium">{successCount} succeeded</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-accent-red">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-medium">{errorCount} failed</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-dark-muted/80">
          <Clock className="w-3.5 h-3.5" />
          <span>Total: {totalExecutionTimeMs}ms</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Statement List */}
        <div className="w-64 border-r border-dark-border/30 bg-dark-surface/30 overflow-y-auto">
          <div className="p-2 space-y-1">
            {results.map((result, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedIndex(index)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedIndex === index
                    ? 'bg-matrix-900/30 border border-matrix-500/30'
                    : 'hover:bg-dark-hover/30 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {result.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-matrix-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-accent-red flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-dark-text truncate">
                    Statement {index + 1}
                  </span>
                </div>
                <div className="text-[10px] text-dark-muted/70 font-mono truncate">
                  {result.sql.substring(0, 40)}...
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-dark-muted/60">
                  <span>{result.execution_time_ms}ms</span>
                  {result.affected_rows !== undefined && (
                    <span>• {result.affected_rows} rows</span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Result Display */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Statement Header */}
          <div className="px-4 py-2 border-b border-dark-border/30 bg-dark-elevated/50">
            <div className="flex items-center gap-2 mb-1">
              {selectedResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-matrix-400" />
              ) : (
                <XCircle className="w-4 h-4 text-accent-red" />
              )}
              <span className="text-sm font-semibold text-dark-text">
                Statement {selectedIndex + 1}
              </span>
              <span className="text-xs text-dark-muted/70">
                {selectedResult.execution_time_ms}ms
              </span>
              <div className="ml-auto">
                <MenuActions
                  onModal={() => useResultPanelsStore.getState().setPanelState(`${tabId}:stmt:${selectedIndex}`, 'modal')}
                  onPin={() => useResultPanelsStore.getState().setPanelState(`${tabId}:stmt:${selectedIndex}`, 'pinned')}
                />
              </div>
            </div>
            <pre className="text-xs font-mono text-dark-muted/90 bg-dark-surface/50 px-2 py-1 rounded border border-dark-border/30 overflow-x-auto">
              {selectedResult.sql}
            </pre>
          </div>

          {/* Result Content */}
          <div className="flex-1 overflow-hidden">
            {selectedResult.error ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-accent-red/10 border border-accent-red/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-accent-red mb-2">
                        Execution Error
                      </h3>
                      <pre className="text-xs text-dark-text/90 font-mono whitespace-pre-wrap">
                        {selectedResult.error}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedResult.result ? (
              <ResultsTable
                tab={{
                  id: `multi-${selectedIndex}`,
                  connectionId,
                  query: selectedResult.sql,
                  result: selectedResult.result,
                  error: null,
                  isExecuting: false,
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-matrix-400 mx-auto mb-2" />
                  <p className="text-sm text-dark-text font-medium">
                    Statement executed successfully
                  </p>
                  {selectedResult.affected_rows !== undefined && (
                    <p className="text-xs text-dark-muted mt-1">
                      {selectedResult.affected_rows} rows affected
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
