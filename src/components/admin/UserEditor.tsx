
import React from 'react';
import { UserDefinition } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';

interface UserEditorProps {
  definition: UserDefinition;
  onChange: (def: UserDefinition) => void;
  engine: DatabaseEngine;
  availableRoles: string[];
}

export const UserEditor: React.FC<UserEditorProps> = ({ definition, onChange, engine, availableRoles }) => {
  const isMySQL = engine === 'mysql';

  const toggleRole = (role: string) => {
    const currentRoles = definition.roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    onChange({ ...definition, roles: newRoles });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2">User Details</h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label mb-1 block">Username</label>
            <input
              type="text"
              className="input w-full"
              value={definition.name}
              onChange={(e) => onChange({ ...definition, name: e.target.value })}
              placeholder="username"
            />
          </div>

          <div>
            <label className="label mb-1 block">Password</label>
            <input
              type="password"
              className="input w-full"
              value={definition.password || ''}
              onChange={(e) => onChange({ ...definition, password: e.target.value })}
              placeholder={definition.password === undefined ? "Leave empty to keep current" : "Enter password"}
            />
          </div>

          {isMySQL && (
            <div>
              <label className="label mb-1 block">Host</label>
              <input
                type="text"
                className="input w-full"
                value={definition.host || '%'}
                onChange={(e) => onChange({ ...definition, host: e.target.value })}
                placeholder="%"
              />
              <p className="text-xs text-muted-foreground mt-1">MySQL specific: Host from which the user can connect (default: %)</p>
            </div>
          )}
        </div>
      </div>

      {availableRoles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Roles & Groups</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-muted/20 p-4 rounded-md border">
            {availableRoles.map(role => (
              <label key={role} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={(definition.roles || []).includes(role)}
                  onChange={() => toggleRole(role)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">{role}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
