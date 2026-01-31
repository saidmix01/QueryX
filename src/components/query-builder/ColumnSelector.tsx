import { useMemo, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useQueryBuilderStore } from '../../store/query-builder-store';
import { useSchemaStore } from '../../store/schema-store';
import { useConnectionStore } from '../../store/connection-store';
import type { ColumnRef } from '../../domain/query-builder-types';

export function ColumnSelector() {
  const { model, toggleColumn, addColumn } = useQueryBuilderStore();
  const { selectTable } = useSchemaStore();
  const { activeConnectionId } = useConnectionStore();
  const tablesFromStore = useSchemaStore(
    (s) => (activeConnectionId ? s.byConnection[activeConnectionId]?.tables || [] : [])
  );

  const availableTables = useMemo(() => {
    const tables = [model.from];
    model.joins.forEach((join) => tables.push(join.table));
    return tables;
  }, [model.from, model.joins]);

  // Asegurar columnas cargadas para todas las tablas disponibles (FROM y JOINs)
  useEffect(() => {
    if (!activeConnectionId) return;
    availableTables.forEach((table) => {
      if (!table.name) return;
      const match = tablesFromStore.find(
        (t) =>
          t.name === table.name &&
          ((table.schema && t.schema === table.schema) || !table.schema || !t.schema)
      );
      if (!match || !match.columns || match.columns.length === 0) {
        selectTable(activeConnectionId, table.name, table.schema);
      }
    });
  }, [availableTables, activeConnectionId, selectTable, tablesFromStore]);

  // Debug: verificar si hay tablas disponibles
  console.log('ColumnSelector - availableTables:', availableTables);
  console.log('ColumnSelector - model.from:', model.from);

  const handleToggleColumn = (table: string, columnName: string) => {
    const column: ColumnRef = {
      table,
      column: columnName,
    };
    toggleColumn(column);
  };

  const handleSelectAll = (tableName: string) => {
    const table = tablesFromStore.find((t) => t.name === tableName);
    if (!table) return;

    table.columns.forEach((col) => {
      const column: ColumnRef = {
        table: tableName,
        column: col.name,
      };
      // Solo agregar si no existe
      const exists = model.select.some(
        (c) => c.table === tableName && c.column === col.name
      );
      if (!exists) {
        addColumn(column);
      }
    });
  };

  const isColumnSelected = (table: string, column: string) => {
    return model.select.some((c) => c.table === table && c.column === column);
  };

  return (
    <div className="space-y-4">
      {model.select.length === 0 && tablesFromStore.length > 0 && (
        <div className="text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
          ⚠ Selecciona al menos una columna
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableTables.map((table) => {
          const catalogTable = tablesFromStore.find(
            (t) =>
              t.name === table.name &&
              ((table.schema && t.schema === table.schema) || !table.schema || !t.schema)
          );
          
          // Debug
          console.log('Buscando tabla:', table.name, 'Encontrada:', catalogTable);
          
          if (!catalogTable) {
            return (
              <div key={table.name} className="border border-red-500/50 rounded-lg p-4 text-red-400">
                <p className="text-sm">⚠️ Tabla "{table.name}" no encontrada en el catálogo</p>
                <p className="text-xs mt-2">Asegúrate de estar conectado a la base de datos</p>
              </div>
            );
          }

          // Verificar si la tabla tiene columnas
          if (!catalogTable.columns || catalogTable.columns.length === 0) {
            return (
              <div key={table.name} className="border border-yellow-500/50 rounded-lg p-4">
                <div className="font-mono text-sm font-semibold mb-2">
                  {table.schema && (
                    <span className="text-primary-400">{table.schema}.</span>
                  )}
                  {table.name}
                </div>
                <div className="text-yellow-500 text-xs">
                  ⚠️ Esta tabla no tiene columnas cargadas.
                </div>
                <div className="text-xs text-dark-muted mt-2">
                  Haz clic en la tabla en el Database Explorer para cargar sus columnas.
                </div>
              </div>
            );
          }

          const tableRef = table.alias || table.name;

          return (
            <div
              key={tableRef}
              className="border border-dark-border rounded-lg overflow-hidden"
            >
              <div className="bg-dark-hover px-3 py-2 flex items-center justify-between">
                <div className="font-mono text-sm font-semibold">
                  {table.schema && (
                    <span className="text-primary-400">{table.schema}.</span>
                  )}
                  {table.name}
                  {table.alias && (
                    <span className="text-dark-muted"> ({table.alias})</span>
                  )}
                </div>
                <button
                  onClick={() => handleSelectAll(tableRef)}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  Todas
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {catalogTable.columns.map((col) => {
                  const selected = isColumnSelected(tableRef, col.name);
                  return (
                    <button
                      key={col.name}
                      onClick={() => handleToggleColumn(tableRef, col.name)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-dark-hover transition-colors border-b border-dark-border last:border-b-0 ${
                        selected ? 'bg-primary-500/10' : ''
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selected
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-dark-border'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm truncate">
                          {col.name}
                        </div>
                        <div className="text-xs text-dark-muted truncate">
                          {col.data_type}
                          {col.is_primary_key && ' • PK'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {model.select.length > 0 && (
        <div className="text-sm text-dark-muted">
          {model.select.length} columna{model.select.length !== 1 ? 's' : ''}{' '}
          seleccionada{model.select.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
