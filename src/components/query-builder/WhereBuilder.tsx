import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryBuilderStore } from '../../store/query-builder-store';
import { useSchemaStore } from '../../store/schema-store';
import { useConnectionStore } from '../../store/connection-store';
import type { Condition, ComparisonOperator, ColumnRef } from '../../domain/query-builder-types';
import { SearchSelect } from '../ui/SearchSelect';

export function WhereBuilder() {
  const { model, addCondition, removeCondition, setWhere } = useQueryBuilderStore();
  const [isAdding, setIsAdding] = useState(false);

  const conditions = model.where?.conditions || [];

  const handleAddCondition = () => {
    setIsAdding(true);
  };

  const handleSaveCondition = (condition: Condition) => {
    addCondition(condition);
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
  };

  const handleToggleOperator = () => {
    if (!model.where) return;
    const newOperator = model.where.operator === 'AND' ? 'OR' : 'AND';
    setWhere({
      ...model.where,
      operator: newOperator,
    });
  };

  return (
    <div className="space-y-3">
      {conditions.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-dark-muted">Operador lógico:</span>
          <button
            onClick={handleToggleOperator}
            className="btn btn-secondary btn-sm"
          >
            {model.where?.operator || 'AND'}
          </button>
        </div>
      )}

      {conditions.map((cond, index) => {
        if ('operator' in cond && (cond.operator === 'AND' || cond.operator === 'OR')) {
          return null; // Grupos anidados no soportados en UI simple
        }

        const condition = cond as Condition;
        return (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-dark-bg rounded border border-dark-border"
          >
            <div className="flex-1 font-mono text-sm">
              <span>{condition.column.table}.{condition.column.column}</span>
              <span className="text-primary-400 mx-2">{condition.operator}</span>
              {condition.operator !== 'IS NULL' && condition.operator !== 'IS NOT NULL' && (
                <span className="text-green-400">
                  {condition.operator === 'IN'
                    ? `(${condition.values?.join(', ')})`
                    : typeof condition.value === 'string'
                    ? `'${condition.value}'`
                    : condition.value}
                </span>
              )}
            </div>
            <button
              onClick={() => removeCondition(index)}
              className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      {isAdding ? (
        <ConditionForm onSave={handleSaveCondition} onCancel={handleCancelAdd} />
      ) : (
        <button
          onClick={handleAddCondition}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar Condición
        </button>
      )}
    </div>
  );
}

interface ConditionFormProps {
  onSave: (condition: Condition) => void;
  onCancel: () => void;
}

function ConditionForm({ onSave, onCancel }: ConditionFormProps) {
  const { model } = useQueryBuilderStore();
  const { activeConnectionId } = useConnectionStore();
  const tablesFromStore = useSchemaStore(
    (s) => (activeConnectionId ? s.byConnection[activeConnectionId]?.tables || [] : [])
  );
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [operator, setOperator] = useState<ComparisonOperator>('=');
  const [value, setValue] = useState('');
  const [inValues, setInValues] = useState('');

  const availableTables = [model.from, ...model.joins.map((j) => j.table)];

  // Obtener todas las columnas disponibles
  const allColumnsOptions = useMemo(() => {
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

  // Filtrar columnas por búsqueda
  const filteredColumns = allColumnsOptions;

  const handleSave = () => {
    if (!selectedTable || !selectedColumn) return;
    if (operator !== 'IS NULL' && operator !== 'IS NOT NULL' && !value && operator !== 'IN') return;
    if (operator === 'IN' && !inValues) return;

    const column: ColumnRef = {
      table: selectedTable,
      column: selectedColumn,
    };

    const condition: Condition = {
      column,
      operator,
      value: operator === 'IN' ? undefined : value,
      values: operator === 'IN' ? inValues.split(',').map((v) => v.trim()) : undefined,
    };

    onSave(condition);
  };

  const isValid =
    selectedTable &&
    selectedColumn &&
    (operator === 'IS NULL' ||
      operator === 'IS NOT NULL' ||
      (operator === 'IN' && inValues) ||
      value);

  return (
    <div className="border border-dark-border rounded-lg p-4 space-y-4 bg-dark-bg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Columna</label>
          <SearchSelect
            options={filteredColumns}
            value={`${selectedTable}.${selectedColumn}`}
            onChange={(val) => {
              const [table, col] = val.split('.');
              setSelectedTable(table);
              setSelectedColumn(col);
            }}
            placeholder="Buscar y seleccionar columna..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Operador</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as ComparisonOperator)}
            className="input w-full"
          >
            <option value="=">=</option>
            <option value="!=">!=</option>
            <option value=">">{'>'}</option>
            <option value="<">{'<'}</option>
            <option value=">=">{'>='}</option>
            <option value="<=">{'<='}</option>
            <option value="LIKE">LIKE</option>
            <option value="IN">IN</option>
            <option value="IS NULL">IS NULL</option>
            <option value="IS NOT NULL">IS NOT NULL</option>
          </select>
        </div>
      </div>

      {operator !== 'IS NULL' && operator !== 'IS NOT NULL' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {operator === 'IN' ? 'Valores (separados por coma)' : 'Valor'}
          </label>
          {operator === 'IN' ? (
            <input
              type="text"
              value={inValues}
              onChange={(e) => setInValues(e.target.value)}
              placeholder="1, 2, 3"
              className="input w-full"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Valor"
              className="input w-full"
            />
          )}
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
