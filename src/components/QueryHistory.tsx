import { useEffect } from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { useQueryStore } from '../store/query-store';
import { useConnectionStore } from '../store/connection-store';

export function QueryHistory() {
  const { history, loadHistory, updateQuery, activeTabId } = useQueryStore();
  const { activeConnectionId } = useConnectionStore();

  useEffect(() => {
    if (activeConnectionId) {
      loadHistory(activeConnectionId);
    }
  }, [activeConnectionId, loadHistory]);

  const handleSelectQuery = (query: string) => {
    if (activeTabId) {
      updateQuery(activeTabId, query);
    }
  };

  if (!activeConnectionId) {
    return (
      <div className="p-4 text-center text-dark-muted text-sm">
        Connect to a database to see query history
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-dark-muted text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        No queries executed yet
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {history.map((entry) => (
        <div
          key={entry.id}
          onClick={() => handleSelectQuery(entry.query)}
          className="p-2 rounded-lg hover:bg-dark-bg cursor-pointer group"
        >
          <div className="flex items-start gap-2">
            {entry.success ? (
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono truncate">{entry.query}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-dark-muted">
                <span>{new Date(entry.executed_at).toLocaleTimeString()}</span>
                {entry.execution_time_ms > 0 && (
                  <span>{entry.execution_time_ms}ms</span>
                )}
                {entry.row_count !== undefined && (
                  <span>{entry.row_count} rows</span>
                )}
              </div>
              {entry.error_message && (
                <p className="text-xs text-red-400 mt-1 truncate">
                  {entry.error_message}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
