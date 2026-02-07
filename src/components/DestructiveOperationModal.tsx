import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2, AlertCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';
import type { DestructiveOperation } from '../domain/editable-result-types';

interface DestructiveOperationModalProps {
  operation: DestructiveOperation;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DestructiveOperationModal({
  operation,
  onConfirm,
  onCancel,
}: DestructiveOperationModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeError = (e: unknown): string => {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') {
      if ('message' in (e as any)) return String((e as any).message);
      if ('error' in (e as any)) return String((e as any).error);
      try {
        return JSON.stringify(e);
      } catch {
        return String(e);
      }
    }
    return 'Unknown error';
  };

  const handleConfirm = async () => {
    setIsExecuting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(normalizeError(e));
      setIsExecuting(false);
    }
  };

  const getOperationColor = () => {
    switch (operation.type) {
      case 'DELETE':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'UPDATE':
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'ALTER':
        return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      default:
        return 'text-accent-red border-accent-red/30 bg-accent-red/10';
    }
  };

  const hasWarnings = operation.warnings.length > 0 || 
    !operation.hasWhereClause || 
    !operation.hasPrimaryKey;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[11050] p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-dark-surface border border-dark-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-elevated/50">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getOperationColor()}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-dark-text">
                  Confirm {operation.type} Operation
                </h2>
                <p className="text-xs text-dark-muted">
                  This action will modify your database
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={isExecuting}
              className="btn btn-ghost p-1.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Warnings */}
            {hasWarnings && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-400 mb-2">
                      Warnings
                    </h3>
                    <ul className="text-xs text-dark-text/90 space-y-1">
                      {!operation.hasWhereClause && (
                        <li>• No WHERE clause detected - this will affect ALL rows</li>
                      )}
                      {!operation.hasPrimaryKey && (
                        <li>• No primary key detected - operation may be unsafe</li>
                      )}
                      {operation.warnings.map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* SQL Preview */}
            <div>
              <h3 className="text-sm font-semibold text-dark-text mb-2">
                SQL Statement
              </h3>
              <div className="border border-dark-border rounded-lg overflow-hidden">
                <Editor
                  height="150px"
                  language="sql"
                  value={operation.sql}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, Fira Code, monospace',
                    lineNumbers: 'off',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>
            </div>

            {/* Impact Info */}
            <div className="bg-dark-elevated/50 border border-dark-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-muted">Estimated affected rows:</span>
                <span className="font-semibold text-dark-text">
                  {operation.affectedRows > 0 ? operation.affectedRows : 'Unknown'}
                </span>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-accent-red mb-1">
                      Execution Error
                    </h3>
                    <pre className="text-xs text-dark-text/90 font-mono whitespace-pre-wrap">
                      {error}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dark-border bg-dark-elevated/50">
            <button
              onClick={onCancel}
              disabled={isExecuting}
              className="btn btn-ghost px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isExecuting}
              className={`btn px-4 py-2 flex items-center gap-2 ${
                operation.type === 'DELETE'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Execute {operation.type}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
