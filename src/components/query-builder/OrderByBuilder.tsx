import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useQueryBuilderStore } from '../../store/query-builder-store';
import { schemaCatalog } from '../../sql-completion/schema-catalog';
import type { OrderRef, OrderDirection, ColumnRef } from '../../domain/query-builder-types';

export function OrderByBuilder() {
  const { model, addOrderBy, removeOrderBy, updateOrderBy } = useQueryBuilderStore();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddOrder = () => {
    setIsAdding(true);
  };

  const handleSaveOrder = (order: OrderRef) => {
    addOrderBy(order);
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
  };

  const handleToggleDirection = (index: number) => {
    const order = model.orderBy[index];
    const newDirection: OrderDirection = order.direction === 'ASC' ? 'DESC' : 'ASC';
    updateOrderBy(index, { ...order, direction: newDirection });
  };

  return (
    <div className="space-y-3">
      {model.orderBy.map((order, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 bg-dark-bg rounded border border-dark-border"
        >
          <div className="flex-1 font-mono text-sm">
            <span>{order.column.table}.{order.column.column}</span>
            <span className="text-primary-400 mx-2">{order.direction}</span>
          </div>
          <button
            onClick={() => handleToggleDirection(index)}
            className="btn btn-ghost btn-sm"
            title="Cambiar dirección"
          >
            {order.direction === 'ASC' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => removeOrderBy(index)}
            className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {isAdding ? (
        <OrderForm onSave={handleSaveOrder} onCancel={handleCancelAdd} />
      ) : (
        <button
          onClick={handleAddOrder}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar Ordenamiento
        </button>
      )}
    </div>
  );
}

interface OrderFormProps {
  onSave: (order: OrderRef) => void;
  onCancel: () => void;
}

function OrderForm({ onSave, onCancel }: OrderFormProps) {
  const { model } = useQueryBuilderStore();
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [direction, setDirection] = useState<OrderDirection>('ASC');
  const [columnSearch, setColumnSearch] = useState('');

  const availableTables = [model.from, ...model.joins.map((j) => j.table)];

  // Obtener todas las columnas disponibles
  const allColumnsOptions = availableTables.flatMap((table) => {
    const tableRef = table.alias || table.name;
    const cols = schemaCatalog.getColumns(table.name);
    return cols.map((col) => ({
      value: `${tableRef}.${col.name}`,
      label: `${tableRef}.${col.name}`,
      table: tableRef,
      column: col.name,
    }));
  });

  // Filtrar columnas por búsqueda
  const filteredColumns = allColumnsOptions.filter((col) => {
    if (!columnSearch) return true;
    return col.label.toLowerCase().includes(columnSearch.toLowerCase());
  });

  const handleSave = () => {
    if (!selectedTable || !selectedColumn) return;

    const column: ColumnRef = {
      table: selectedTable,
      column: selectedColumn,
    };

    const order: OrderRef = {
      column,
      direction,
    };

    onSave(order);
  };

  const isValid = selectedTable && selectedColumn;

  return (
    <div className="border border-dark-border rounded-lg p-4 space-y-4 bg-dark-bg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Columna</label>
          <input
            type="text"
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            placeholder="Buscar columna..."
            className="input w-full mb-2"
          />
          <select
            value={`${selectedTable}.${selectedColumn}`}
            onChange={(e) => {
              const [table, col] = e.target.value.split('.');
              setSelectedTable(table);
              setSelectedColumn(col);
              setColumnSearch('');
            }}
            className="input w-full"
            size={5}
          >
            <option value="">Seleccionar...</option>
            {filteredColumns.map((col) => (
              <option key={col.value} value={col.value}>
                {col.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Dirección</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as OrderDirection)}
            className="input w-full"
          >
            <option value="ASC">Ascendente (ASC)</option>
            <option value="DESC">Descendente (DESC)</option>
          </select>
        </div>
      </div>

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
