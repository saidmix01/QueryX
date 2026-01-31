import { useMemo, useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryBuilderStore } from '../../store/query-builder-store';
import { useSchemaStore } from '../../store/schema-store';
import { useConnectionStore } from '../../store/connection-store';
import type { JoinRef, JoinType, TableRef } from '../../domain/query-builder-types';
import { SearchSelect } from '../ui/SearchSelect';

export function JoinBuilder() {
  const { model, addJoin, removeJoin } = useQueryBuilderStore();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddJoin = () => {
    setIsAdding(true);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
  };

  const handleSaveJoin = (join: JoinRef) => {
    addJoin(join);
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      {model.joins.map((join, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 bg-dark-bg rounded border border-dark-border"
        >
          <div className="flex-1 font-mono text-sm">
            <span className="text-primary-400">{join.type} JOIN</span>{' '}
            {join.table.schema && (
              <span className="text-primary-400">{join.table.schema}.</span>
            )}
            <span>{join.table.name}</span>
            {join.table.alias && (
              <span className="text-dark-muted"> AS {join.table.alias}</span>
            )}
            <span className="text-dark-muted"> ON </span>
            <span>{join.on.leftTable}.{join.on.leftColumn}</span>
            <span className="text-dark-muted"> = </span>
            <span>{join.on.rightTable}.{join.on.rightColumn}</span>
          </div>
          <button
            onClick={() => removeJoin(index)}
            className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {isAdding ? (
        <JoinForm onSave={handleSaveJoin} onCancel={handleCancelAdd} />
      ) : (
        <button
          onClick={handleAddJoin}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar JOIN
        </button>
      )}
    </div>
  );
}

interface JoinFormProps {
  onSave: (join: JoinRef) => void;
  onCancel: () => void;
}

function JoinForm({ onSave, onCancel }: JoinFormProps) {
  const { model } = useQueryBuilderStore();
  const [joinType, setJoinType] = useState<JoinType>('INNER');
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [alias, setAlias] = useState('');
  const [leftTable, setLeftTable] = useState(model.from.alias || model.from.name);
  const [leftColumn, setLeftColumn] = useState('');
  const [rightColumn, setRightColumn] = useState('');

  const availableTables = [model.from, ...model.joins.map((j) => j.table)];
  const { selectTable: loadTableInfo } = useSchemaStore();
  const { activeConnectionId } = useConnectionStore();
  const tablesFromStore = useSchemaStore(
    (s) => (activeConnectionId ? s.byConnection[activeConnectionId]?.tables || [] : [])
  );

  // Cargar columnas de la tabla seleccionada si no están cargadas
  useEffect(() => {
    if (selectedTable && activeConnectionId) {
      loadTableInfo(activeConnectionId, selectedTable, selectedSchema || undefined);
    }
  }, [selectedTable, selectedSchema, activeConnectionId, loadTableInfo]);

  const rightTableColumns = useMemo(() => {
    if (!selectedTable) return [];
    const match = tablesFromStore.find(
      (t) =>
        t.name === selectedTable &&
        ((selectedSchema && t.schema === selectedSchema) || !selectedSchema || !t.schema)
    );
    return match?.columns || [];
  }, [selectedTable, selectedSchema, tablesFromStore]);

  const tableOptions = useMemo(
    () =>
      tablesFromStore.map((t) => ({
        value: t.schema ? `${t.schema}.${t.name}` : t.name,
        label: t.schema ? `${t.schema}.${t.name}` : t.name,
      })),
    [tablesFromStore]
  );

  const leftColumnsOptions = useMemo(() => {
    return availableTables.flatMap((table) => {
      const tableRef = table.alias || table.name;
      const match = tablesFromStore.find((t) => t.name === table.name);
      const cols = match?.columns || [];
      return cols.map((col) => ({
        value: `${tableRef}.${col.name}`,
        label: `${tableRef}.${col.name}`,
        table: tableRef,
        column: col.name,
      }));
    });
  }, [availableTables, tablesFromStore]);

  const handleSave = () => {
    if (!selectedTable || !leftColumn || !rightColumn) return;

    const table: TableRef = {
      name: selectedTable,
      schema: selectedSchema || undefined,
      alias: alias || undefined,
    };

    const join: JoinRef = {
      type: joinType,
      table,
      on: {
        leftTable,
        leftColumn,
        rightTable: alias || selectedTable,
        rightColumn,
      },
    };

    onSave(join);
  };

  const isValid = selectedTable && leftColumn && rightColumn;

  return (
    <div className="border border-dark-border rounded-lg p-4 space-y-4 bg-dark-bg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Tipo de JOIN</label>
          <select
            value={joinType}
            onChange={(e) => setJoinType(e.target.value as JoinType)}
            className="input w-full"
          >
            <option value="INNER">INNER JOIN</option>
            <option value="LEFT">LEFT JOIN</option>
            <option value="RIGHT">RIGHT JOIN</option>
            <option value="FULL">FULL JOIN</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tabla</label>
          <SearchSelect
            options={tableOptions}
            value={selectedSchema ? `${selectedSchema}.${selectedTable}` : selectedTable}
            onChange={(val) => {
              const [schema, name] = val.includes('.') ? val.split('.') : ['', val];
              setSelectedTable(name);
              setSelectedSchema(schema);
            }}
            placeholder="Buscar y seleccionar tabla..."
          />
        </div>
      </div>

      {selectedTable && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Alias (opcional)
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Ej: t2"
            className="input w-full"
          />
        </div>
      )}

      {selectedTable && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Columna izquierda
            </label>
            <SearchSelect
              options={leftColumnsOptions}
              value={`${leftTable}.${leftColumn}`}
              onChange={(val) => {
                const [table, col] = val.split('.');
                setLeftTable(table);
                setLeftColumn(col);
              }}
              placeholder="Buscar y seleccionar columna..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Columna derecha
            </label>
            <SearchSelect
              options={rightTableColumns.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
              value={rightColumn}
              onChange={(val) => setRightColumn(val)}
              placeholder={
                rightTableColumns.length === 0
                  ? `Cargando columnas de ${selectedTable}...`
                  : 'Buscar y seleccionar columna...'
              }
              disabled={rightTableColumns.length === 0}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn btn-secondary btn-sm">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="btn btn-primary btn-sm disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
