import { useEffect, useState } from 'react';
import { useSavedQueryStore } from '../store/saved-query-store';
import { useConnectionStore } from '../store/connection-store';
import { useQueryStore } from '../store/query-store';
import type { SavedQuery } from '../domain/saved-query-types';
import { normalizeError } from '../utils/global-error-handler';

export function SavedQueriesPanel() {
  const { activeConnectionId } = useConnectionStore();
  const { queries, loadQueries, loadFolders, deleteQuery, createQuery } =
    useSavedQueryStore();
  const { addTab } = useQueryStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newQueryName, setNewQueryName] = useState('');
  const [newQueryDescription, setNewQueryDescription] = useState('');

  useEffect(() => {
    if (activeConnectionId) {
      loadQueries(activeConnectionId);
      loadFolders(activeConnectionId);
    }
  }, [activeConnectionId, loadQueries, loadFolders]);

  const handleOpenQuery = (query: SavedQuery) => {
    addTab({
      title: query.name,
      query: query.sql,
      connectionId: query.connection_id,
    });
  };

  const handleDeleteQuery = async (id: string) => {
    if (confirm('¿Eliminar esta consulta guardada?')) {
      await deleteQuery(id);
    }
  };

  const handleSaveCurrentQuery = async () => {
    if (!activeConnectionId) return;

    const currentTab = useQueryStore.getState().tabs.find(
      (t) => t.id === useQueryStore.getState().activeTabId
    );

    if (!currentTab || !currentTab.query.trim()) {
      alert('No hay consulta para guardar');
      return;
    }

    try {
      await createQuery({
        connection_id: activeConnectionId,
        name: newQueryName,
        sql: currentTab.query,
        description: newQueryDescription || undefined,
      });
      setShowSaveDialog(false);
      setNewQueryName('');
      setNewQueryDescription('');
    } catch (e) {
      alert('Error al guardar: ' + normalizeError(e));
    }
  };

  if (!activeConnectionId) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Selecciona una conexión para ver las consultas guardadas
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Consultas Guardadas</h3>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
        >
          + Guardar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {queries.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm text-center">
            No hay consultas guardadas
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {queries.map((query) => (
              <div
                key={query.id}
                className="group p-2 rounded hover:bg-gray-700 cursor-pointer"
                onClick={() => handleOpenQuery(query)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{query.name}</div>
                    {query.description && (
                      <div className="text-xs text-gray-400 truncate">
                        {query.description}
                      </div>
                    )}
                    {query.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {query.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 bg-gray-600 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteQuery(query.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1 hover:bg-red-600 rounded"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Guardar Consulta</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={newQueryName}
                  onChange={(e) => setNewQueryName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Mi consulta"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newQueryDescription}
                  onChange={(e) => setNewQueryDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Descripción de la consulta"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveCurrentQuery}
                disabled={!newQueryName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewQueryName('');
                  setNewQueryDescription('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
