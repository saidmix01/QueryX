
import React from 'react';
import { Plus, Trash } from 'lucide-react';
import { TableDefinition, TableColumn } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';

interface TableEditorProps {
  definition: TableDefinition;
  onChange: (def: TableDefinition) => void;
  engine: DatabaseEngine;
}

export const TableEditor: React.FC<TableEditorProps> = ({ definition, onChange, engine: _engine }) => {
  const handleColumnChange = (index: number, field: keyof TableColumn, value: any) => {
    const newColumns = [...definition.columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    onChange({ ...definition, columns: newColumns });
  };

  const addColumn = () => {
    onChange({
      ...definition,
      columns: [
        ...definition.columns,
        { name: 'new_column', type: 'VARCHAR(255)', nullable: true, primaryKey: false }
      ]
    });
  };

  const removeColumn = (index: number) => {
    const newColumns = definition.columns.filter((_, i) => i !== index);
    onChange({ ...definition, columns: newColumns });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Table Name</label>
          <input
            type="text"
            className="input"
            value={definition.name}
            onChange={(e) => onChange({ ...definition, name: e.target.value })}
          />
        </div>
        {definition.schema !== undefined && (
          <div>
            <label className="label">Schema</label>
            <input
              type="text"
              className="input"
              value={definition.schema}
              onChange={(e) => onChange({ ...definition, schema: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="border rounded-md">
        <div className="bg-muted p-2 font-medium flex gap-2">
          <div className="w-8"></div>
          <div className="flex-1">Name</div>
          <div className="w-32">Type</div>
          <div className="w-20 text-center">Nullable</div>
          <div className="w-20 text-center">PK</div>
          <div className="w-32">Default</div>
          <div className="w-8"></div>
        </div>
        <div className="divide-y">
          {definition.columns.map((col, idx) => (
            <div key={idx} className="flex gap-2 p-2 items-center hover:bg-muted/50">
              <div className="w-8 flex justify-center text-muted-foreground">
                {idx + 1}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  className="input h-8"
                  value={col.name}
                  onChange={(e) => handleColumnChange(idx, 'name', e.target.value)}
                />
              </div>
              <div className="w-32">
                <input
                  type="text"
                  className="input h-8"
                  value={col.type}
                  onChange={(e) => handleColumnChange(idx, 'type', e.target.value)}
                />
              </div>
              <div className="w-20 flex justify-center">
                <input
                  type="checkbox"
                  checked={col.nullable}
                  onChange={(e) => handleColumnChange(idx, 'nullable', e.target.checked)}
                />
              </div>
              <div className="w-20 flex justify-center">
                <input
                  type="checkbox"
                  checked={col.primaryKey}
                  onChange={(e) => handleColumnChange(idx, 'primaryKey', e.target.checked)}
                />
              </div>
              <div className="w-32">
                <input
                  type="text"
                  className="input h-8"
                  value={col.defaultValue || ''}
                  onChange={(e) => handleColumnChange(idx, 'defaultValue', e.target.value)}
                  placeholder="NULL"
                />
              </div>
              <div className="w-8">
                <button onClick={() => removeColumn(idx)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t bg-muted/20">
          <button onClick={addColumn} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">
            <Plus className="h-4 w-4" /> Add Column
          </button>
        </div>
      </div>
      
      {/* Constraints section could go here */}
      
    </div>
  );
};
