
import React, { useState, useMemo } from 'react';
import { TableDefinition } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';
import { AdminAdapterFactory } from '../../infrastructure/admin-adapters';
import { TableEditor } from './TableEditor';
import { SqlPreviewModal } from './SqlPreviewModal';

interface TableAdminViewProps {
  initialDefinition?: TableDefinition;
  engine: DatabaseEngine;
  connectionId: string;
  onClose: () => void;
  mode: 'create' | 'edit';
}

export const TableAdminView: React.FC<TableAdminViewProps> = ({
  initialDefinition,
  engine,
  connectionId,
  onClose,
  mode
}) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'permissions' | 'sql' | 'history'>('structure');
  
  const [definition, setDefinition] = useState<TableDefinition>(initialDefinition || {
    name: 'new_table',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true }
    ],
    constraints: []
  });

  const [showPreview, setShowPreview] = useState(false);

  const adapter = useMemo(() => AdminAdapterFactory.getAdapter(engine), [engine]);

  const generatedSql = useMemo(() => {
    if (mode === 'create') {
      return adapter.getCreateTableSQL(definition);
    } else if (initialDefinition) {
      return adapter.getAlterTableSQL(initialDefinition, definition);
    }
    return '';
  }, [adapter, definition, mode, initialDefinition]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-xl font-bold">{mode === 'create' ? 'Create Table' : `Edit Table: ${definition.name}`}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(true)} className="btn btn-primary">
            Preview SQL
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>

      <div className="flex border-b border-border">
        {['structure', 'permissions', 'sql', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'structure' && (
          <TableEditor
            definition={definition}
            onChange={setDefinition}
            engine={engine}
          />
        )}
        
        {activeTab === 'sql' && (
          <div className="p-4 h-full">
            <textarea
              readOnly
              value={generatedSql}
              className="w-full h-full bg-muted/50 p-4 font-mono text-sm resize-none focus:outline-none rounded-md"
            />
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="p-4 text-center text-muted-foreground">
            Permissions management coming soon...
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4 text-center text-muted-foreground">
            Table history coming soon...
          </div>
        )}
      </div>

      <SqlPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        sql={generatedSql}
        title={mode === 'create' ? "Create Table" : "Alter Table"}
        connectionId={connectionId}
        isDangerous={mode === 'edit'}
        onSuccess={() => {
            // Refresh explorer or show success
            onClose();
        }}
      />
    </div>
  );
};
