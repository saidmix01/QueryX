import { X, Play, Trash2 } from 'lucide-react';
import { useQueryBuilderStore } from '../store/query-builder-store';
import { useConnectionStore } from '../store/connection-store';
import { useQueryStore } from '../store/query-store';
import { QueryToSqlCompiler } from '../query-builder/query-compiler';
import { TableSelector } from './query-builder/TableSelector';
import { ColumnSelector } from './query-builder/ColumnSelector';
import { JoinBuilder } from './query-builder/JoinBuilder';
import { WhereBuilder } from './query-builder/WhereBuilder';
import { OrderByBuilder } from './query-builder/OrderByBuilder';
import { useEffect, useMemo } from 'react';
import { ensureDefaultSchemaInitialized } from '../utils/schema-init';
import { useSchemaStore } from '../store/schema-store';

export function QueryBuilder() {
  const { isOpen, close, model, reset, setLimit } = useQueryBuilderStore();
  const { connections, activeConnectionId } = useConnectionStore();
  const { activeTabId, updateQuery } = useQueryStore();
  const { selectTable, byConnection } = useSchemaStore();

  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const engine = activeConnection?.engine || 'postgresql';

  useEffect(() => {
    if (!isOpen || !activeConnectionId || !activeConnection) return;
    ensureDefaultSchemaInitialized(activeConnection);
  }, [isOpen, engine, activeConnectionId, activeConnection]);

  useEffect(() => {
    if (!isOpen || !activeConnectionId) return;
    const tablesToEnsure = [model.from, ...model.joins.map((j) => j.table)].filter(
      (t) => t && t.name
    );
    const connTables = byConnection[activeConnectionId]?.tables || [];
    tablesToEnsure.forEach((t) => {
      const match = connTables.find(
        (ct) =>
          ct.name === t.name &&
          ((t.schema && ct.schema === t.schema) || !t.schema || !ct.schema)
      );
      if (!match || !match.columns || match.columns.length === 0) {
        selectTable(activeConnectionId, t.name, t.schema);
      }
    });
  }, [isOpen, activeConnectionId, model.from, model.joins, byConnection, selectTable]);

  const previewSql = useMemo(() => {
    const compiler = new QueryToSqlCompiler(engine);
    return compiler.compile(model);
  }, [engine, model]);

  if (!isOpen) return null;

  const handleGenerateSQL = () => {
    const compiler = new QueryToSqlCompiler(engine);
    const sql = compiler.compile(model);
    
    if (activeTabId) {
      updateQuery(activeTabId, sql);
    }
    
    close();
  };

  const handleClose = () => {
    close();
  };

  const handleReset = () => {
    if (confirm('¿Resetear el query builder?')) {
      reset();
    }
  };

  const isValid = model.from.name !== '' && model.select.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-dark-surface border border-dark-border rounded-lg shadow-2xl w-[92vw] h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <div>
            <h2 className="text-xl font-semibold">Visual Query Builder</h2>
            <p className="text-sm text-dark-muted mt-1">
              Construye consultas SELECT sin escribir SQL
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="btn btn-secondary text-sm"
              title="Reset"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="btn btn-ghost"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-5 overflow-y-auto pr-2 space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-dark-muted uppercase mb-3">
                  1. Tabla Principal (FROM)
                </h3>
                <TableSelector />
              </section>
              {model.from.name && (
                <section>
                  <h3 className="text-sm font-semibold text-dark-muted uppercase mb-3">
                    2. Columnas (SELECT)
                  </h3>
                  <ColumnSelector />
                </section>
              )}
              {model.from.name && (
                <section>
                  <h3 className="text-sm font-semibold text-dark-muted uppercase mb-3">
                    3. Uniones (JOIN) - Opcional
                  </h3>
                  <JoinBuilder />
                </section>
              )}
            </div>
            <div className="col-span-7 overflow-y-auto pl-2 space-y-6">
              {model.from.name && model.select.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-dark-muted uppercase mb-3">
                    4. Condiciones (WHERE) - Opcional
                  </h3>
                  <WhereBuilder />
                </section>
              )}
              {model.from.name && model.select.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-dark-muted uppercase mb-3">
                    5. Ordenamiento (ORDER BY) - Opcional
                  </h3>
                  <OrderByBuilder />
                </section>
              )}
              {model.from.name && model.select.length > 0 && (
                <section className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-dark-muted uppercase">
                    6. Límite (LIMIT) - Opcional
                  </h3>
                  <input
                    type="number"
                    min="1"
                    value={model.limit || ''}
                    onChange={(e) => setLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Sin límite"
                    className="input w-32"
                  />
                </section>
              )}
              <section>
                <h3 className="text-sm font-semibold text-dark-muted uppercase mb-3">
                  Vista previa SQL
                </h3>
                <div className="bg-dark-bg border border-dark-border rounded p-3 h-40 overflow-auto font-mono text-sm">
                  {previewSql || ''}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-border">
          <div className="text-sm text-dark-muted">
            {!isValid && (
              <span className="text-yellow-500">
                ⚠ Selecciona una tabla y al menos una columna
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handleGenerateSQL}
              disabled={!isValid}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Generar SQL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
