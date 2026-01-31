
import { AdminAdapter, AdminFeatureMatrix, RoleDefinition, TableDefinition, UserDefinition } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';

export class PostgresAdminAdapter implements AdminAdapter {
  engine: DatabaseEngine = 'postgresql';
  features: AdminFeatureMatrix = {
    schemas: true,
    roles: true,
    users: true,
    grantRevoke: true,
    alterTable: true,
    viewDefinition: true,
  };

  getCreateDatabaseSQL(name: string): string {
    return `CREATE DATABASE "${name}";`;
  }

  getDropDatabaseSQL(name: string): string {
    return `DROP DATABASE "${name}";`;
  }

  getCreateTableSQL(table: TableDefinition): string {
    const columns = table.columns.map(col => {
      let def = `"${col.name}" ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    const constraints = table.constraints.map(cons => {
      if (cons.type === 'PRIMARY KEY') {
        return `CONSTRAINT "${cons.name}" PRIMARY KEY (${cons.columns.map(c => `"${c}"`).join(', ')})`;
      }
      if (cons.type === 'FOREIGN KEY') {
        return `CONSTRAINT "${cons.name}" FOREIGN KEY (${cons.columns.map(c => `"${c}"`).join(', ')}) REFERENCES "${cons.referenceTable}" (${cons.referenceColumns?.map(c => `"${c}"`).join(', ')})`;
      }
      if (cons.type === 'UNIQUE') {
        return `CONSTRAINT "${cons.name}" UNIQUE (${cons.columns.map(c => `"${c}"`).join(', ')})`;
      }
      return '';
    }).filter(Boolean);

    const schema = table.schema || 'public';
    return `CREATE TABLE "${schema}"."${table.name}" (
  ${[...columns, ...constraints].join(',\n  ')}
);${table.comment ? `\nCOMMENT ON TABLE "${schema}"."${table.name}" IS '${table.comment}';` : ''}`;
  }

  getAlterTableSQL(current: TableDefinition, target: TableDefinition): string {
    // Simplified diff logic - in a real app this would be more complex
    const statements: string[] = [];
    const schema = target.schema || 'public';
    const tableName = `"${schema}"."${target.name}"`;

    if (current.name !== target.name) {
      statements.push(`ALTER TABLE "${schema}"."${current.name}" RENAME TO "${target.name}";`);
    }

    // Add columns
    target.columns.forEach(targetCol => {
      const currentCol = current.columns.find(c => c.name === targetCol.name);
      if (!currentCol) {
        let def = `ADD COLUMN "${targetCol.name}" ${targetCol.type}`;
        if (!targetCol.nullable) def += ' NOT NULL';
        if (targetCol.defaultValue) def += ` DEFAULT ${targetCol.defaultValue}`;
        statements.push(`ALTER TABLE ${tableName} ${def};`);
      }
    });

    // Drop columns
    current.columns.forEach(currentCol => {
      if (!target.columns.find(c => c.name === currentCol.name)) {
        statements.push(`ALTER TABLE ${tableName} DROP COLUMN "${currentCol.name}";`);
      }
    });

    return statements.join('\n');
  }

  getDropTableSQL(schema: string, table: string): string {
    return `DROP TABLE "${schema}"."${table}";`;
  }

  getCreateUserSQL(user: UserDefinition): string {
    let sql = `CREATE USER "${user.name}"`;
    if (user.password) {
      sql += ` WITH PASSWORD '${user.password}'`;
    }
    sql += ';';
    return sql;
  }

  getDropUserSQL(user: string): string {
    return `DROP USER "${user}";`;
  }

  getAlterUserSQL(user: UserDefinition): string {
    let sql = `ALTER USER "${user.name}"`;
    if (user.password) {
      sql += ` WITH PASSWORD '${user.password}'`;
    }
    sql += ';';
    return sql;
  }

  getCreateRoleSQL(role: RoleDefinition): string {
    return `CREATE ROLE "${role.name}";`;
  }

  getDropRoleSQL(role: string): string {
    return `DROP ROLE "${role}";`;
  }

  getGrantPermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string {
    if (type === 'TABLE') {
      return `GRANT ${permission} ON TABLE ${name} TO "${target}";`;
    }
    if (type === 'SCHEMA') {
      return `GRANT ${permission} ON ALL TABLES IN SCHEMA ${name} TO "${target}";`;
    }
    if (type === 'DATABASE') {
      return `GRANT ${permission} ON DATABASE ${name} TO "${target}";`;
    }
    return '';
  }

  getRevokePermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string {
    if (type === 'TABLE') {
      return `REVOKE ${permission} ON TABLE ${name} FROM "${target}";`;
    }
    if (type === 'SCHEMA') {
      return `REVOKE ${permission} ON ALL TABLES IN SCHEMA ${name} FROM "${target}";`;
    }
    if (type === 'DATABASE') {
      return `REVOKE ${permission} ON DATABASE ${name} FROM "${target}";`;
    }
    return '';
  }

  getUsersQuery(): string {
    return `SELECT usename as name FROM pg_catalog.pg_user;`;
  }

  getRolesQuery(): string {
    return `SELECT rolname as name FROM pg_roles WHERE rolcanlogin = false;`;
  }

  async getTableDefinition(schema: string, table: string, executor: (sql: string) => Promise<any[]>): Promise<TableDefinition> {
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${table}'
      ORDER BY ordinal_position;
    `;

    const constraintsQuery = `
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, 
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = '${schema}' AND tc.table_name = '${table}';
    `;

    const [columnsRows, constraintsRows] = await Promise.all([
      executor(columnsQuery),
      executor(constraintsQuery)
    ]);

    const columns = columnsRows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type + (row.character_maximum_length ? `(${row.character_maximum_length})` : ''),
      nullable: row.is_nullable === 'YES',
      primaryKey: false, // Will be updated from constraints
      defaultValue: row.column_default,
    }));

    const constraints: any[] = [];
    const constraintMap = new Map<string, any>();

    constraintsRows.forEach((row: any) => {
      if (!constraintMap.has(row.constraint_name)) {
        constraintMap.set(row.constraint_name, {
          name: row.constraint_name,
          type: row.constraint_type,
          columns: [],
          referenceTable: row.foreign_table_name,
          referenceColumns: [],
        });
      }
      const constraint = constraintMap.get(row.constraint_name);
      constraint.columns.push(row.column_name);
      if (row.foreign_column_name) {
        constraint.referenceColumns.push(row.foreign_column_name);
      }
    });

    constraintMap.forEach(c => constraints.push(c));

    // Update primary key flag in columns
    constraints.filter(c => c.type === 'PRIMARY KEY').forEach(pk => {
      pk.columns.forEach((colName: string) => {
        const col = columns.find((c: any) => c.name === colName);
        if (col) col.primaryKey = true;
      });
    });

    return {
      name: table,
      schema,
      columns,
      constraints,
    };
  }

  async getUserDefinition(name: string, executor: (sql: string) => Promise<any[]>): Promise<UserDefinition> {
    const rolesQuery = `
      SELECT r.rolname
      FROM pg_catalog.pg_roles r
      JOIN pg_catalog.pg_auth_members m ON r.oid = m.roleid
      JOIN pg_catalog.pg_roles u ON m.member = u.oid
      WHERE u.rolname = '${name}';
    `;
    
    try {
      const rolesRows = await executor(rolesQuery);
      const roles = rolesRows.map((row: any) => row.rolname);
      return {
        name,
        roles,
      };
    } catch (e) {
      // Fallback if permission denied or other error
      console.warn('Failed to fetch user roles:', e);
      return { name };
    }
  }
}
