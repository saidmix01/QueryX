
import { DatabaseEngine } from './types';

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
  autoIncrement?: boolean;
  comment?: string;
}

export interface TableConstraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  referenceTable?: string;
  referenceColumns?: string[];
  definition?: string;
}

export interface TableDefinition {
  name: string;
  schema?: string;
  columns: TableColumn[];
  constraints: TableConstraint[];
  comment?: string;
  engine?: string; // For MySQL
  charset?: string; // For MySQL
}

export interface UserDefinition {
  name: string;
  password?: string; // Only for creation/update
  host?: string; // For MySQL
  roles?: string[];
}

export interface RoleDefinition {
  name: string;
  permissions?: string[];
}

export interface AdminFeatureMatrix {
  schemas: boolean;
  roles: boolean;
  users: boolean;
  grantRevoke: boolean;
  alterTable: boolean;
  viewDefinition: boolean;
}

export interface AdminAdapter {
  engine: DatabaseEngine;
  features: AdminFeatureMatrix;

  // Introspection (Generating SQL for preview, not execution)
  getCreateDatabaseSQL(name: string): string;
  getDropDatabaseSQL(name: string): string;
  
  getCreateTableSQL(table: TableDefinition): string;
  getAlterTableSQL(current: TableDefinition, target: TableDefinition): string;
  getDropTableSQL(schema: string, table: string): string;

  getCreateUserSQL(user: UserDefinition): string;
  getDropUserSQL(user: string): string;
  getAlterUserSQL(user: UserDefinition): string;

  getCreateRoleSQL(role: RoleDefinition): string;
  getDropRoleSQL(role: string): string;

  getGrantPermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string;
  getRevokePermissionSQL(target: string, type: 'TABLE' | 'SCHEMA' | 'DATABASE', name: string, permission: string): string;
  
  // Specific introspection queries (to be executed by the backend)
  getUsersQuery(): string;
  getRolesQuery(): string;

  // Introspection execution
  getTableDefinition(schema: string, table: string, executor: (sql: string) => Promise<any[]>): Promise<TableDefinition>;
  getUserDefinition(name: string, executor: (sql: string) => Promise<any[]>): Promise<UserDefinition>;
}
