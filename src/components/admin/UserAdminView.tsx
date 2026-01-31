
import React, { useState, useMemo, useEffect } from 'react';
import { UserDefinition } from '../../domain/admin-types';
import { DatabaseEngine, CellValue } from '../../domain/types';
import { AdminAdapterFactory } from '../../infrastructure/admin-adapters';
import { UserEditor } from './UserEditor';
import { SqlPreviewModal } from './SqlPreviewModal';
import { queryApi } from '../../infrastructure/tauri-api';

// Helper to extract value from CellValue
const getCellValue = (cell: CellValue | undefined): any => {
  if (!cell || cell.type === 'Null') return null;
  return (cell as any).value;
};

interface UserAdminViewProps {
  initialDefinition?: UserDefinition;
  engine: DatabaseEngine;
  connectionId: string;
  onClose: () => void;
  mode: 'create' | 'edit';
}

export const UserAdminView: React.FC<UserAdminViewProps> = ({
  initialDefinition,
  engine,
  connectionId,
  onClose,
  mode
}) => {
  const [definition, setDefinition] = useState<UserDefinition>(initialDefinition || {
    name: 'new_user',
    password: '',
    host: '%',
    roles: []
  });

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const adapter = useMemo(() => AdminAdapterFactory.getAdapter(engine), [engine]);

  useEffect(() => {
    const loadRoles = async () => {
      const query = adapter.getRolesQuery();
      if (query && adapter.features.roles) {
        try {
          const res = await queryApi.execute(connectionId, query);
          if (res.rows) {
             const roles = res.rows.map((row: any) => {
               const obj: Record<string, any> = {};
               res.columns.forEach((col, i) => {
                 obj[col.name] = getCellValue(row[i]);
               });
               return obj;
             });
             setAvailableRoles(roles.map((r: any) => r.name));
          }
        } catch (e) {
          console.error('Failed to load roles', e);
        }
      }
    };
    loadRoles();
  }, [adapter, connectionId]);

  const generatedSql = useMemo(() => {
    if (mode === 'create') {
      return adapter.getCreateUserSQL(definition);
    } else {
      return adapter.getAlterUserSQL(definition);
    }
  }, [adapter, definition, mode]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-xl font-bold">{mode === 'create' ? 'Create User' : `Edit User: ${definition.name}`}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(true)} className="btn btn-primary">
            Preview SQL
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <UserEditor
          definition={definition}
          onChange={setDefinition}
          engine={engine}
          availableRoles={availableRoles}
        />
      </div>

      <SqlPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        sql={generatedSql}
        title={mode === 'create' ? "Create User" : "Alter User"}
        connectionId={connectionId}
        isDangerous={mode === 'edit'}
        onSuccess={() => {
            onClose();
        }}
      />
    </div>
  );
};
