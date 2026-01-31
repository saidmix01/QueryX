import { useState } from 'react';
import {
  Database,
  MoreVertical,
  Plug,
  PlugZap,
  Trash2,
  Edit,
  TestTube,
} from 'lucide-react';
import clsx from 'clsx';
import { useConnectionStore } from '../store/connection-store';
import { useSchemaStore } from '../store/schema-store';
import { useQueryStore } from '../store/query-store';
import { useUIStore } from '../store/ui-store';
import type { Connection, ConnectionStatus } from '../domain/types';
import { ensureDefaultSchemaInitialized } from '../utils/schema-init';

const engineIcons: Record<string, string> = {
  postgresql: '🐘',
  mysql: '🐬',
  sqlite: '📦',
};

function getStatusColor(status: ConnectionStatus): string {
  if (status === 'Connected') return 'bg-green-500';
  if (status === 'Connecting') return 'bg-yellow-500 animate-pulse';
  if (status === 'Disconnected') return 'bg-gray-500';
  return 'bg-red-500';
}

export function ConnectionList() {
  const {
    connections,
    activeConnectionId,
    connectionStatuses,
    connect,
    disconnect,
    deleteConnection,
    testConnection,
    setActiveConnection,
  } = useConnectionStore();
  const { clear: clearSchema } = useSchemaStore();
  const { createTab } = useQueryStore();
  const { openConnectionModal } = useUIStore();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const handleConnect = async (conn: Connection) => {
    try {
      await connect(conn.id);
      await ensureDefaultSchemaInitialized(conn);
      createTab(conn.id);
    } catch (e) {
      console.error('Connection failed:', e);
    }
  };

  const handleDisconnect = async (id: string) => {
    await disconnect(id);
    clearSchema();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      await testConnection(id);
      alert('Connection successful!');
    } catch (e) {
      alert(`Connection failed: ${e}`);
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      await deleteConnection(id);
    }
  };

  if (connections.length === 0) {
    return (
      <div className="p-4 text-center text-dark-muted">
        <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No connections yet</p>
        <button
          onClick={() => openConnectionModal()}
          className="mt-2 text-primary-400 hover:text-primary-300 text-sm"
        >
          Create your first connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {connections.map((conn) => {
        const status = connectionStatuses[conn.id] || 'Disconnected';
        const isActive = activeConnectionId === conn.id;
        const isConnected = status === 'Connected';

        return (
          <div
            key={conn.id}
            className={clsx(
              'group relative p-3 rounded-lg cursor-pointer transition-colors',
              isActive ? 'bg-primary-900/30 border border-primary-700' : 'hover:bg-dark-bg'
            )}
            onClick={() => {
              if (!isConnected) return;
              setActiveConnection(conn.id);
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{engineIcons[conn.engine]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{conn.name}</span>
                  <span className={clsx('w-2 h-2 rounded-full', getStatusColor(status))} />
                </div>
                <p className="text-xs text-dark-muted truncate">
                  {conn.engine === 'sqlite'
                    ? conn.file_path || conn.database
                    : `${conn.host}:${conn.port}/${conn.database}`}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isConnected ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnect(conn.id);
                    }}
                    className="p-1.5 rounded hover:bg-dark-border"
                    title="Disconnect"
                  >
                    <PlugZap className="w-4 h-4 text-red-400" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnect(conn);
                    }}
                    className="p-1.5 rounded hover:bg-dark-border"
                    title="Connect"
                  >
                    <Plug className="w-4 h-4 text-green-400" />
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === conn.id ? null : conn.id);
                    }}
                    className="p-1.5 rounded hover:bg-dark-border"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuOpen === conn.id && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTest(conn.id);
                          setMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-bg text-sm"
                        disabled={testing === conn.id}
                      >
                        <TestTube className="w-4 h-4" />
                        {testing === conn.id ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openConnectionModal(conn.id);
                          setMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-bg text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(conn.id);
                          setMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-bg text-sm text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
