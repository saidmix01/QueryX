import { useState, useMemo } from 'react';
import { useQueryBuilderStore } from '../../store/query-builder-store';
import { useSchemaStore } from '../../store/schema-store';
import { useConnectionStore } from '../../store/connection-store';
import type { TableRef } from '../../domain/query-builder-types';

export function TableSelector() {
  const { model, setFromTable } = useQueryBuilderStore();
  const [search, setSearch] = useState('');
  const { activeConnectionId } = useConnectionStore();
  const tablesFromStore = useSchemaStore(
    (s) => (activeConnectionId ? s.byConnection[activeConnectionId]?.tables || [] : [])
  );

  const tables = useMemo(() => tablesFromStore, [tablesFromStore]);

  const filteredTables = useMemo(() => {
    if (!search) return tables;
    const lower = search.toLowerCase();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        (t.schema && t.schema.toLowerCase().includes(lower))
    );
  }, [tables, search]);

  const handleSelectTable = (tableName: string, schema?: string) => {
    const table: TableRef = {
      name: tableName,
      schema,
      alias: undefined,
    };
    setFromTable(table);
    setSearch('');
  };

  return (
    <div className="space-y-3">
      {model.from.name ? (
        <div className="flex items-center gap-3 p-3 bg-dark-bg rounded border border-dark-border">
          <div className="flex-1">
            <div className="font-mono text-sm">
              {model.from.schema && (
                <span className="text-primary-400">{model.from.schema}.</span>
              )}
              <span className="text-white">{model.from.name}</span>
              {model.from.alias && (
                <span className="text-dark-muted"> AS {model.from.alias}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setFromTable({ name: '', schema: undefined, alias: undefined })}
            className="btn btn-ghost btn-sm"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tabla..."
            className="input w-full mb-2"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto border border-dark-border rounded">
            {tables.length === 0 ? (
              <div className="p-4 text-center">
                <div className="text-red-500 text-sm mb-2">
                  ⚠️ No hay tablas disponibles en el catálogo
                </div>
                <div className="text-xs text-dark-muted">
                  Asegúrate de:
                  <ul className="list-disc text-left ml-5 mt-2">
                    <li>Estar conectado a una base de datos</li>
                    <li>Haber explorado el schema en el Database Explorer</li>
                  </ul>
                </div>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="p-4 text-center text-dark-muted text-sm">
                No se encontraron tablas con "{search}"
              </div>
            ) : (
              filteredTables.map((table) => (
                <button
                  key={`${table.schema}.${table.name}`}
                  onClick={() => handleSelectTable(table.name, table.schema)}
                  className="w-full text-left px-3 py-2 hover:bg-dark-hover border-b border-dark-border last:border-b-0 transition-colors"
                >
                  <div className="font-mono text-sm">
                    {table.schema && (
                      <span className="text-primary-400">{table.schema}.</span>
                    )}
                    <span>{table.name}</span>
                    <span className="ml-2 text-xs text-dark-muted">
                      ({table.type})
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
