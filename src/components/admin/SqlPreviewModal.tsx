
import React, { useState } from 'react';
import { X, AlertTriangle, Play } from 'lucide-react';
import { queryApi } from '../../infrastructure/tauri-api';

interface SqlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sql: string;
  title: string;
  isDangerous?: boolean;
  connectionId: string;
  onSuccess?: () => void;
}

export const SqlPreviewModal: React.FC<SqlPreviewModalProps> = ({
  isOpen,
  onClose,
  sql: initialSql,
  title,
  isDangerous = false,
  connectionId,
  onSuccess
}) => {
  const [sql, setSql] = useState(initialSql);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    try {
      await queryApi.executeStatement(connectionId, sql);
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            {isDangerous && <AlertTriangle className="h-5 w-5 text-destructive" />}
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 rounded-md border border-border bg-muted/50 p-2">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="h-64 w-full resize-none bg-transparent font-mono text-sm focus:outline-none"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
              disabled={isExecuting}
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white ${
                isDangerous ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
              }`}
              disabled={isExecuting}
            >
              <Play className="h-4 w-4" />
              {isExecuting ? 'Executing...' : 'Execute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
