
import { AdminAdapter, AdminFeatureMatrix, RoleDefinition, TableDefinition, UserDefinition } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';

export class MySQLAdminAdapter implements AdminAdapter {
  engine: DatabaseEngine = 'mysql';
  features: AdminFeatureMatrix = {
    schemas: false, // MySQL uses databases as schemas roughly
    roles: false, // MySQL 8.0 has roles but simplified here for now as false or check version
    users: true,
    grantRevoke: true,
    alterTable: true,
    viewDefinition: true,
  };

  getCreateDatabaseSQL(name: string): string {
    return `CREATE DATABASE \`${name}\`;`;
  }

  getDropDatabaseSQL(name: string): string {
    return `DROP DATABASE \`${name}\`;`;
  }

  getCreateTableSQL(table: TableDefinition): string {
    const columns = table.columns.map(col => {
      let def = `\`${col.name}\` ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.autoIncrement) def += ' AUTO_INCREMENT';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      if (col.comment) def += ` COMMENT '${col.comment}'`;
      return def;
    });

    const constraints = table.constraints.map(cons => {
      if (cons.type === 'PRIMARY KEY') {
        return `PRIMARY KEY (${cons.columns.map(c => `\`${c}\``).join(', ')})`;
      }
      if (cons.type === 'FOREIGN KEY') {
        return `CONSTRAINT \`${cons.name}\` FOREIGN KEY (${cons.columns.map(c => `\`${c}\``).join(', ')}) REFERENCES \`${cons.referenceTable}\` (${cons.referenceColumns?.map(c => `\`${c}\``).join(', ')})`;
      }
      if (cons.type === 'UNIQUE') {
        return `UNIQUE INDEX \`${cons.name}\` (${cons.columns.map(c => `\`${c}\``).join(', ')})`;
      }
      return '';
    }).filter(Boolean);

    let sql = `CREATE TABLE \`${table.name}\` (\n  ${[...columns, ...constraints].join(',\n  ')}\n)`;
    
    if (table.engine) sql += ` ENGINE=${table.engine}`;
    if (table.charset) sql += ` DEFAULT CHARSET=${table.charset}`;
    if (table.comment) sql += ` COMMENT='${table.comment}'`;
    
    sql += ';';
    return sql;
  }

  getAlterTableSQL(current: TableDefinition, target: TableDefinition): string {
    const statements: string[] = [];
    const tableName = `\`${target.name}\``;

    if (current.name !== target.name) {
      statements.push(`RENAME TABLE \`${current.name}\` TO \`${target.name}\`;`);
    }

    // MySQL supports multiple ADD/DROP in one ALTER but keeping it simple for now
    target.columns.forEach(targetCol => {
      const currentCol = current.columns.find(c => c.name === targetCol.name);
      if (!currentCol) {
        let def = `ADD COLUMN \`${targetCol.name}\` ${targetCol.type}`;
        if (!targetCol.nullable) def += ' NOT NULL';
        if (targetCol.defaultValue) def += ` DEFAULT ${targetCol.defaultValue}`;
        statements.push(`ALTER TABLE ${tableName} ${def};`);
      }
    });

    current.columns.forEach(currentCol => {
      if (!target.columns.find(c => c.name === currentCol.name)) {
        statements.push(`ALTER TABLE ${tableName} DROP COLUMN \`${currentCol.name}\`;`);
      }
    });

    return statements.join('\n');
  }

  getDropTableSQL(_schema: string, table: string): string {
    return `DROP TABLE \`${table}\`;`;
  }

  getCreateUserSQL(user: UserDefinition): string {
    const host = user.host || '%';
    let sql = `CREATE USER '${user.name}'@'${host}'`;
    if (user.password) {
      sql += ` IDENTIFIED BY '${user.password}'`;
    }
    sql += ';';
    return sql;
  }

  getDropUserSQL(user: string): string {
    // Assuming user format 'name'@'host' or just 'name' (default %)
    if (user.includes('@')) {
      return `DROP USER ${user};`;
    }
    return `DROP USER '${user}'@'%';`;
  }

  getAlterUserSQL(user: UserDefinition): string {
    const host = user.host || '%';
    if (user.password) {
      return `ALTER USER '${user.name}'@'${host}' IDENTIFIED BY '${user.password}';`;
    }
    return '';
  }

  getCreateRoleSQL(role: RoleDefinition): string {
    // MySQL 8.0+
    return `CREATE ROLE '${role.name}';`;
  }

  getDropRoleSQL(role: string): string {
    return `DROP ROLE '${role}';`;
  }

  getGrantPermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string {
    // target should be 'user'@'host'
    const grantee = target.includes('@') ? target : `'${target}'@'%'`;
    
    if (type === 'TABLE') {
      return `GRANT ${permission} ON ${name} TO ${grantee};`;
    }
    if (type === 'DATABASE' || type === 'SCHEMA') {
      return `GRANT ${permission} ON ${name}.* TO ${grantee};`;
    }
    return '';
  }

  getRevokePermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string {
    const grantee = target.includes('@') ? target : `'${target}'@'%'`;

    if (type === 'TABLE') {
      return `REVOKE ${permission} ON ${name} FROM ${grantee};`;
    }
    if (type === 'DATABASE' || type === 'SCHEMA') {
      return `REVOKE ${permission} ON ${name}.* FROM ${grantee};`;
    }
    return '';
  }

  getUsersQuery(): string {
    return `SELECT User as name, Host as host FROM mysql.user;`;
  }

  getRolesQuery(): string {
    return `SELECT User as name FROM mysql.user;`; // Simplified
  }

  async getTableDefinition(schema: string, table: string, executor: (sql: string) => Promise<any[]>): Promise<TableDefinition> {
    const columnsQuery = `
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
      ORDER BY ORDINAL_POSITION;
    `;

    const columnsRows = await executor(columnsQuery);

    const columns = columnsRows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.COLUMN_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      primaryKey: row.COLUMN_KEY === 'PRI',
      defaultValue: row.COLUMN_DEFAULT,
      autoIncrement: row.EXTRA === 'auto_increment'
    }));

    // Basic constraint support
    const constraints: any[] = [];
    if (columns.some(c => c.primaryKey)) {
      constraints.push({
        name: 'PRIMARY',
        type: 'PRIMARY KEY',
        columns: columns.filter(c => c.primaryKey).map(c => c.name)
      });
    }

    return {
      name: table,
      schema,
      columns,
      constraints,
    };
  }

  async getUserDefinition(name: string, executor: (sql: string) => Promise<any[]>): Promise<UserDefinition> {
    const hostQuery = `SELECT Host FROM mysql.user WHERE User = '${name}'`;
    let host = '%';
    
    try {
      const hostRows = await executor(hostQuery);
      if (hostRows.length > 0) {
        host = hostRows[0].Host;
      }
    } catch (e) {
      console.warn('Failed to fetch user host:', e);
    }

    return {
      name,
      host,
      roles: [],
    };
  }
}
