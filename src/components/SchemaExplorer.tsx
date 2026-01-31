import { useState } from 'react';
import { ChevronRight, ChevronDown, Table, Key, Hash } from 'lucide-react';
import clsx from 'clsx';
import { useSchemaStore } from '../store/schema-store';
import { useConnectionStore } from '../store/connection-store';
import type { ColumnSchema } from '../domain/schema-types';

interface TreeNodeProps {
  label: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
}

function TreeNode({ label, icon, children, onClick, isSelected }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Boolean(children);

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-dark-bg rounded',
          isSelected && 'bg-primary-900/30'
        )}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onClick?.();
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-dark-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-dark-muted" />
          )
        ) : (
          <span className="w-4" />
        )}
        {icon}
        <span className="text-sm truncate">{label}</span>
      </div>
      {expanded && children && <div className="ml-4">{children}</div>}
    </div>
  );
}

function ColumnNode({ column }: { column: ColumnSchema }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-sm text-dark-muted">
      <span className="w-4" />
      {column.is_primary_key ? (
        <Key className="w-3 h-3 text-yellow-500" />
      ) : (
        <Hash className="w-3 h-3" />
      )}
      <span className={clsx(column.is_primary_key && 'text-yellow-500')}>
        {column.name}
      </span>
      <span className="text-xs opacity-60">{column.data_type}</span>
      {column.nullable && <span className="text-xs opacity-40">NULL</span>}
    </div>
  );
}

export function SchemaExplorer() {
  const store = useSchemaStore();
  const { activeConnectionId } = useConnectionStore();
  const tables = activeConnectionId ? store.getTables(activeConnectionId) : [];
  const selectedTable = activeConnectionId ? store.getSelectedTable(activeConnectionId) : null;
  const isLoading = activeConnectionId ? !!store.isLoadingByConnection[activeConnectionId] : false;
  const selectTable = store.selectTable;

  if (!activeConnectionId) {
    return (
      <div className="p-4 text-center text-dark-muted text-sm">
        Connect to a database to explore schema
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-dark-muted text-sm">
        Loading schema...
      </div>
    );
  }

  return (
    <div className="p-2">
      <TreeNode label="Tables" icon={<Table className="w-4 h-4 text-blue-400" />}>
        {tables.map((table) => (
          <TreeNode
            key={table.name}
            label={table.name}
            icon={<Table className="w-4 h-4 text-dark-muted" />}
            isSelected={selectedTable?.name === table.name}
            onClick={() => selectTable(activeConnectionId, table.name, table.schema ?? undefined)}
          >
            {selectedTable?.name === table.name &&
              selectedTable.columns.map((col) => (
                <ColumnNode key={col.name} column={col} />
              ))}
          </TreeNode>
        ))}
      </TreeNode>
    </div>
  );
}
