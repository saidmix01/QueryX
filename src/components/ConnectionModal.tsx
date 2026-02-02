import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../store/ui-store';
import { useConnectionStore } from '../store/connection-store';
import type { DatabaseEngine, CreateConnectionDto } from '../domain/types';

const engines: { value: DatabaseEngine; label: string; icon: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { value: 'mysql', label: 'MySQL / MariaDB', icon: '🐬' },
  { value: 'sqlite', label: 'SQLite', icon: '📦' },
];

const defaultPorts: Record<DatabaseEngine, number> = {
  postgresql: 5432,
  mysql: 3306,
  sqlite: 0,
  sqlserver: 1433,
};

export function ConnectionModal() {
  const { closeConnectionModal, editingConnectionId } = useUIStore();
  const { connections, createConnection, updateConnection, testConnection } =
    useConnectionStore();

  const editingConnection = editingConnectionId
    ? connections.find((c) => c.id === editingConnectionId)
    : null;

  const [form, setForm] = useState<CreateConnectionDto>({
    name: '',
    engine: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: undefined,
    username: '',
    password: '',
    file_path: '',
    read_only: false,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSQLite = form.engine === 'sqlite';

  const getPayload = (): CreateConnectionDto => {
    // Sanitización explícita campo por campo para asegurar tipos primitivos
    const safeName = String(form.name || '');
    const safeEngine = (['postgresql', 'mysql', 'sqlite', 'sqlserver'].includes(form.engine) ? form.engine : 'postgresql') as DatabaseEngine;
    const safeHost = String(form.host || 'localhost');
    const safePort = Number(form.port) || defaultPorts[safeEngine];
    const safeDatabase = form.database ? String(form.database) : undefined;
    const safeUsername = form.username ? String(form.username) : undefined;
    const safePassword = form.password ? String(form.password) : undefined;
    const safeFilePath = form.file_path ? String(form.file_path) : undefined;

    const rawPayload = {
      name: safeName,
      engine: safeEngine,
      database: isSQLite ? safeFilePath : safeDatabase,
      host: isSQLite ? undefined : safeHost,
      port: isSQLite ? undefined : safePort,
      username: isSQLite ? undefined : safeUsername,
      password: isSQLite ? undefined : safePassword,
      file_path: isSQLite ? safeFilePath : undefined,
      read_only: form.read_only ?? false,
    };
    
    // Doble seguridad: clonación profunda para romper cualquier referencia oculta
    try {
      return JSON.parse(JSON.stringify(rawPayload));
    } catch (e) {
      console.error('Error sanitizing payload:', e);
      // Fallback a un objeto seguro mínimo si falla la clonación
      return {
        name: safeName,
        engine: safeEngine,
        host: 'localhost',
        port: 5432
      };
    }
  };

  useEffect(() => {
    if (editingConnection) {
      setForm({
        name: editingConnection.name,
        engine: editingConnection.engine,
        host: editingConnection.host || 'localhost',
        port: editingConnection.port || defaultPorts[editingConnection.engine],
        database: editingConnection.database,
        username: editingConnection.username || '',
        password: '',
        file_path: editingConnection.file_path || '',
        read_only: editingConnection.read_only ?? false,
      });
    }
  }, [editingConnection]);

  const handleEngineChange = (engine: DatabaseEngine) => {
    setForm((f) => ({
      ...f,
      engine,
      port: defaultPorts[engine],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setIsSaving(true);

    try {
      const payload = getPayload();

      console.log('Creating connection with payload:', payload);

      if (editingConnectionId) {
        await updateConnection(editingConnectionId, {
          name: payload.name,
          host: payload.host,
          port: payload.port,
          database: payload.database,
          username: payload.username,
          password: payload.password || undefined,
          read_only: payload.read_only,
        });
      } else {
        await createConnection(payload);
      }
      closeConnectionModal();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (e?: React.MouseEvent | any) => {
    console.log('--- HANDLE TEST START (SANITIZED V3) ---');
    // Prevenir uso accidental del evento
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    setError(null);
    setIsTesting(true);

    try {
      // Para test, primero creamos temporalmente si es nueva
      if (!editingConnectionId) {
        const payload = getPayload();
        console.log('Payload for test:', payload);
        
        // Verificar payload antes de enviar
        if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
        
        const conn = await createConnection(payload);
        await testConnection(conn.id);
        alert('Connection successful!');
      } else {
        await testConnection(editingConnectionId);
        alert('Connection successful!');
      }
    } catch (e) {
      console.error('Connection test error:', e);
      setError(String(e));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-surface rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">
            {editingConnectionId ? 'Edit Connection' : 'New Connection'}
          </h2>
          <button
            onClick={closeConnectionModal}
            className="p-1 rounded hover:bg-dark-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Engine Selection */}
          <div>
            <label className="label">Database Type</label>
            <div className="grid grid-cols-3 gap-2">
              {engines.map((eng) => (
                <button
                  key={eng.value}
                  type="button"
                  onClick={() => handleEngineChange(eng.value)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    form.engine === eng.value
                      ? 'border-primary-500 bg-primary-900/30'
                      : 'border-dark-border hover:border-dark-muted'
                  }`}
                >
                  <span className="text-2xl block mb-1">{eng.icon}</span>
                  <span className="text-sm">{eng.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="label">Connection Name</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="My Database"
              required
            />
          </div>

          {isSQLite ? (
            /* SQLite: File Path */
            <div>
              <label className="label">Database File</label>
              <input
                type="text"
                className="input"
                value={form.file_path}
                onChange={(e) =>
                  setForm((f) => ({ ...f, file_path: e.target.value, database: e.target.value }))
                }
                placeholder="/path/to/database.db"
                required
              />
            </div>
          ) : (
            /* Server-based DBs */
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="label">Host</label>
                  <input
                    type="text"
                    className="input"
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                    placeholder="localhost"
                    required
                  />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input
                    type="number"
                    className="input"
                    value={form.port}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setForm((f) => ({ ...f, port: isNaN(val) ? defaultPorts[f.engine] : val }));
                    }}
                    min={1}
                    max={65535}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Database</label>
                <input
                  type="text"
                  className="input"
                  value={form.database || ''}
                  onChange={(e) => setForm((f) => ({ ...f, database: e.target.value || undefined }))}
                  placeholder="mydb"
                />
                <p className="text-xs text-dark-muted mt-1">
                  Optional — if left empty, all databases/schemas will be shown
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    className="input"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder={form.engine === 'postgresql' ? 'postgres' : 'root'}
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

        {/* Read-Only Mode */}
        <div className="flex items-center justify-between p-3 border border-dark-border rounded-lg">
          <div>
            <div className="text-sm font-semibold">Read-Only Mode</div>
            <div className="text-xs text-dark-muted">
              Bloquea operaciones destructivas (UPDATE/DELETE/DROP/TRUNCATE/ALTER)
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle"
              checked={!!form.read_only}
              onChange={(e) => setForm((f) => ({ ...f, read_only: e.target.checked }))}
            />
            <span className="text-sm">{form.read_only ? 'ON' : 'OFF'}</span>
          </label>
        </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="btn btn-secondary"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
            >
              {isSaving ? 'Saving...' : editingConnectionId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
