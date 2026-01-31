
import { AdminAdapter, AdminFeatureMatrix, RoleDefinition, TableDefinition, UserDefinition } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';

export class SqliteAdminAdapter implements AdminAdapter {
  engine: DatabaseEngine = 'sqlite';
  features: AdminFeatureMatrix = {
    schemas: false,
    roles: false,
    users: false,
    grantRevoke: false,
    alterTable: false, // Limited support
    viewDefinition: true,
  };

  getCreateDatabaseSQL(name: string): string {
    return `-- SQLite creates databases by creating files. This SQL is just a placeholder.\nATTACH DATABASE '${name}' AS '${name}';`;
  }

  getDropDatabaseSQL(name: string): string {
    return `-- SQLite cannot drop databases via SQL (file deletion required).\nDETACH DATABASE '${name}';`;
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
        return `PRIMARY KEY (${cons.columns.map(c => `"${c}"`).join(', ')})`;
      }
      if (cons.type === 'FOREIGN KEY') {
        return `CONSTRAINT "${cons.name}" FOREIGN KEY (${cons.columns.map(c => `"${c}"`).join(', ')}) REFERENCES "${cons.referenceTable}" (${cons.referenceColumns?.map(c => `"${c}"`).join(', ')})`;
      }
      if (cons.type === 'UNIQUE') {
        return `CONSTRAINT "${cons.name}" UNIQUE (${cons.columns.map(c => `"${c}"`).join(', ')})`;
      }
      return '';
    }).filter(Boolean);

    return `CREATE TABLE "${table.name}" (\n  ${[...columns, ...constraints].join(',\n  ')}\n);`;
  }

  getAlterTableSQL(current: TableDefinition, target: TableDefinition): string {
    const statements: string[] = [];
    
    if (current.name !== target.name) {
      statements.push(`ALTER TABLE "${current.name}" RENAME TO "${target.name}";`);
    }

    // SQLite only supports ADD COLUMN
    target.columns.forEach(targetCol => {
      const currentCol = current.columns.find(c => c.name === targetCol.name);
      if (!currentCol) {
        let def = `ADD COLUMN "${targetCol.name}" ${targetCol.type}`;
        if (!targetCol.nullable) def += ' NOT NULL'; // Only allowed if default value exists, usually
        if (targetCol.defaultValue) def += ` DEFAULT ${targetCol.defaultValue}`;
        statements.push(`ALTER TABLE "${target.name}" ${def};`);
      }
    });

    // If other changes are needed, SQLite requires table rebuild (create new, copy, drop old)
    // For now, we'll just return comments if complex changes are detected
    const complexChanges = current.columns.some(c => !target.columns.find(tc => tc.name === c.name)) || // Dropped columns
                           current.columns.some(c => {
                             const t = target.columns.find(tc => tc.name === c.name);
                             return t && t.type !== c.type; // Changed types
                           });

    if (complexChanges) {
      statements.push(`-- Complex changes detected (DROP COLUMN, TYPE CHANGE). SQLite requires table rebuild.`);
      statements.push(`-- 1. CREATE TABLE "${target.name}_new" ...`);
      statements.push(`-- 2. INSERT INTO "${target.name}_new" SELECT ... FROM "${target.name}"`);
      statements.push(`-- 3. DROP TABLE "${target.name}"`);
      statements.push(`-- 4. ALTER TABLE "${target.name}_new" RENAME TO "${target.name}"`);
    }

    return statements.join('\n');
  }

  getDropTableSQL(_schema: string, table: string): string {
    return `DROP TABLE "${table}";`;
  }

  getCreateUserSQL(_user: UserDefinition): string {
    return '-- SQLite does not support users';
  }

  getDropUserSQL(_user: string): string {
    return '-- SQLite does not support users';
  }

  getAlterUserSQL(_user: UserDefinition): string {
    return '-- SQLite does not support users';
  }

  getCreateRoleSQL(_role: RoleDefinition): string {
    return '-- SQLite does not support roles';
  }

  getDropRoleSQL(_role: string): string {
    return '-- SQLite does not support roles';
  }

  getGrantPermissionSQL(_target: string, _type: 'TABLE' | 'SCHEMA' | 'DATABASE', _name: string, _permission: string): string {
    return '-- SQLite does not support GRANT';
  }

  getRevokePermissionSQL(_target: string, _type: 'TABLE' | 'SCHEMA' | 'DATABASE', _name: string, _permission: string): string {
    return '-- SQLite does not support REVOKE';
  }

  getUsersQuery(): string {
    return '';
  }

  getRolesQuery(): string {
    return '';
  }

  async getTableDefinition(schema: string, table: string, executor: (sql: string) => Promise<any[]>): Promise<TableDefinition> {
    const columnsRows = await executor(`PRAGMA table_info("${table}")`);
    
    const columns = columnsRows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      primaryKey: row.pk > 0,
      defaultValue: row.dflt_value
    }));

    const constraints: any[] = [];
    // Extract PK constraint
    const pkColumns = columns.filter((c: any) => c.primaryKey);
    if (pkColumns.length > 0) {
      constraints.push({
        name: 'PK_' + table,
        type: 'PRIMARY KEY',
        columns: pkColumns.map((c: any) => c.name)
      });
    }

    return {
      name: table,
      schema,
      columns,
      constraints,
    };
  }

  async getUserDefinition(name: string, _executor: (sql: string) => Promise<any[]>): Promise<UserDefinition> {
    // SQLite has no user definition to fetch
    return { name };
  }
}
