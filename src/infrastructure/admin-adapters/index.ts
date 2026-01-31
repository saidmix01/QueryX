
import { AdminAdapter } from '../../domain/admin-types';
import { DatabaseEngine } from '../../domain/types';
import { PostgresAdminAdapter } from './postgres-adapter';
import { MySQLAdminAdapter } from './mysql-adapter';
import { SqliteAdminAdapter } from './sqlite-adapter';
import { SqlServerAdminAdapter } from './sqlserver-adapter';

export class AdminAdapterFactory {
  static getAdapter(engine: DatabaseEngine): AdminAdapter {
    switch (engine) {
      case 'postgresql':
        return new PostgresAdminAdapter();
      case 'mysql':
        return new MySQLAdminAdapter();
      case 'sqlite':
        return new SqliteAdminAdapter();
      case 'sqlserver':
        return new SqlServerAdminAdapter();
      default:
        throw new Error(`Unsupported engine for admin: ${engine}`);
    }
  }
}

export * from './postgres-adapter';
export * from './mysql-adapter';
export * from './sqlite-adapter';
export * from './sqlserver-adapter';
