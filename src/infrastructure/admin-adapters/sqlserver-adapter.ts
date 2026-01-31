
import { AdminAdapter, AdminFeatureMatrix, RoleDefinition, TableDefinition, UserDefinition } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';

export class SqlServerAdminAdapter implements AdminAdapter {
  engine: DatabaseEngine = 'sqlserver';
  features: AdminFeatureMatrix = {
    schemas: true,
    roles: true,
    users: true,
    grantRevoke: true,
    alterTable: true,
    viewDefinition: true,
  };

  getCreateDatabaseSQL(name: string): string {
    return `CREATE DATABASE [${name}];`;
  }

  getDropDatabaseSQL(name: string): string {
    return `DROP DATABASE [${name}];`;
  }

  getCreateTableSQL(table: TableDefinition): string {
    const columns = table.columns.map(col => {
      let def = `[${col.name}] ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.autoIncrement) def += ' IDENTITY(1,1)';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    const constraints = table.constraints.map(cons => {
      if (cons.type === 'PRIMARY KEY') {
        return `CONSTRAINT [${cons.name}] PRIMARY KEY (${cons.columns.map(c => `[${c}]`).join(', ')})`;
      }
      if (cons.type === 'FOREIGN KEY') {
        return `CONSTRAINT [${cons.name}] FOREIGN KEY (${cons.columns.map(c => `[${c}]`).join(', ')}) REFERENCES [${cons.referenceTable}] (${cons.referenceColumns?.map(c => `[${c}]`).join(', ')})`;
      }
      if (cons.type === 'UNIQUE') {
        return `CONSTRAINT [${cons.name}] UNIQUE (${cons.columns.map(c => `[${c}]`).join(', ')})`;
      }
      return '';
    }).filter(Boolean);

    const schema = table.schema || 'dbo';
    return `CREATE TABLE [${schema}].[${table.name}] (\n  ${[...columns, ...constraints].join(',\n  ')}\n);`;
  }

  getAlterTableSQL(current: TableDefinition, target: TableDefinition): string {
    const statements: string[] = [];
    const schema = target.schema || 'dbo';
    const tableName = `[${schema}].[${target.name}]`;

    if (current.name !== target.name) {
      statements.push(`EXEC sp_rename '[${schema}].[${current.name}]', '${target.name}';`);
    }

    // Add columns
    target.columns.forEach(targetCol => {
      const currentCol = current.columns.find(c => c.name === targetCol.name);
      if (!currentCol) {
        let def = `ADD [${targetCol.name}] ${targetCol.type}`;
        if (!targetCol.nullable) def += ' NOT NULL';
        if (targetCol.defaultValue) def += ` DEFAULT ${targetCol.defaultValue}`;
        statements.push(`ALTER TABLE ${tableName} ${def};`);
      }
    });

    // Drop columns
    current.columns.forEach(currentCol => {
      if (!target.columns.find(c => c.name === currentCol.name)) {
        statements.push(`ALTER TABLE ${tableName} DROP COLUMN [${currentCol.name}];`);
      }
    });

    // Type changes (simplified)
    target.columns.forEach(targetCol => {
      const currentCol = current.columns.find(c => c.name === targetCol.name);
      if (currentCol && currentCol.type !== targetCol.type) {
        let def = `ALTER COLUMN [${targetCol.name}] ${targetCol.type}`;
        if (!targetCol.nullable) def += ' NOT NULL';
        statements.push(`ALTER TABLE ${tableName} ${def};`);
      }
    });

    return statements.join('\n');
  }

  getDropTableSQL(schema: string, table: string): string {
    return `DROP TABLE [${schema}].[${table}];`;
  }

  getCreateUserSQL(user: UserDefinition): string {
    let sql = `CREATE USER [${user.name}]`;
    // SQL Server logins vs users is complex, assuming contained database user or login already exists
    sql += ';';
    return sql;
  }

  getDropUserSQL(user: string): string {
    return `DROP USER [${user}];`;
  }

  getAlterUserSQL(user: UserDefinition): string {
    return `ALTER USER [${user.name}] WITH ...; -- Implementation depends on login vs user`;
  }

  getCreateRoleSQL(role: RoleDefinition): string {
    return `CREATE ROLE [${role.name}];`;
  }

  getDropRoleSQL(role: string): string {
    return `DROP ROLE [${role}];`;
  }

  getGrantPermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string {
    if (type === 'TABLE') {
      return `GRANT ${permission} ON OBJECT::${name} TO [${target}];`;
    }
    if (type === 'SCHEMA') {
      return `GRANT ${permission} ON SCHEMA::${name} TO [${target}];`;
    }
    if (type === 'DATABASE') {
      return `GRANT ${permission} TO [${target}];`;
    }
    return '';
  }

  getRevokePermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string {
    if (type === 'TABLE') {
      return `REVOKE ${permission} ON OBJECT::${name} FROM [${target}];`;
    }
    if (type === 'SCHEMA') {
      return `REVOKE ${permission} ON SCHEMA::${name} FROM [${target}];`;
    }
    if (type === 'DATABASE') {
      return `REVOKE ${permission} FROM [${target}];`;
    }
    return '';
  }

  getUsersQuery(): string {
    return `SELECT name FROM sys.database_principals WHERE type IN ('S', 'U');`;
  }

  getRolesQuery(): string {
    return `SELECT name FROM sys.database_principals WHERE type = 'R';`;
  }

  async getTableDefinition(schema: string, table: string, executor: (sql: string) => Promise<any[]>): Promise<TableDefinition> {
    const columnsQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
      ORDER BY ORDINAL_POSITION;
    `;

    const columnsRows = await executor(columnsQuery);

    const columns = columnsRows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE + (row.CHARACTER_MAXIMUM_LENGTH ? `(${row.CHARACTER_MAXIMUM_LENGTH})` : ''),
      nullable: row.IS_NULLABLE === 'YES',
      primaryKey: false, // Need constraints query for this
      defaultValue: row.COLUMN_DEFAULT,
    }));

    return {
      name: table,
      schema,
      columns,
      constraints: [], // Constraints fetching requires more complex query
    };
  }

  async getUserDefinition(name: string, executor: (sql: string) => Promise<any[]>): Promise<UserDefinition> {
    const rolesQuery = `
      SELECT r.name as role_name
      FROM sys.database_role_members m
      JOIN sys.database_principals u ON m.member_principal_id = u.principal_id
      JOIN sys.database_principals r ON m.role_principal_id = r.principal_id
      WHERE u.name = '${name}';
    `;

    try {
      const rolesRows = await executor(rolesQuery);
      const roles = rolesRows.map((row: any) => row.role_name);
      return {
        name,
        roles,
      };
    } catch (e) {
      console.warn('Failed to fetch user roles:', e);
      return { name };
    }
  }
}
