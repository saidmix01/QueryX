// Tipos del dominio - Espejo de las entidades Rust

export type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

export interface SslConfig {
  enabled: boolean;
  ca_cert_path?: string;
  client_cert_path?: string;
  client_key_path?: string;
  verify_server_cert: boolean;
}

export interface Connection {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host?: string;
  port?: number;
  database?: string; // Optional - if empty, will show all databases
  username?: string;
  file_path?: string;
  ssl: SslConfig;
  color?: string;
  read_only?: boolean;
  created_at: string;
  updated_at: string;
  last_connected_at?: string;
}

export interface CreateConnectionDto {
  name: string;
  engine: DatabaseEngine;
  host?: string;
  port?: number;
  database?: string; // Optional for server connections, required for SQLite
  username?: string;
  password?: string;
  file_path?: string;
  ssl?: SslConfig;
  color?: string;
  read_only?: boolean;
}

export interface UpdateConnectionDto {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: SslConfig;
  color?: string;
  read_only?: boolean;
}

export type ConnectionStatus = 
  | 'Disconnected' 
  | 'Connecting' 
  | 'Connected' 
  | { Error: string };

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
}

export type CellValue =
  | { type: 'Null' }
  | { type: 'Bool'; value: boolean }
  | { type: 'Int'; value: number }
  | { type: 'Float'; value: number }
  | { type: 'String'; value: string }
  | { type: 'Bytes'; value: number[] }
  | { type: 'Date'; value: string }
  | { type: 'Time'; value: string }
  | { type: 'DateTime'; value: string }
  | { type: 'Json'; value: unknown }
  | { type: 'Uuid'; value: string }
  | { type: 'Array'; value: CellValue[] };

export interface PaginationInfo {
  page: number;
  page_size: number;
  total_rows?: number;
  total_pages?: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface QueryResult {
  id: string;
  columns: ColumnInfo[];
  rows: CellValue[][];
  row_count: number;
  affected_rows?: number;
  execution_time_ms: number;
  query: string;
  executed_at: string;
  pagination?: PaginationInfo;
}

export interface QueryHistoryEntry {
  id: string;
  connection_id: string;
  query: string;
  executed_at: string;
  execution_time_ms: number;
  row_count?: number;
  success: boolean;
  error_message?: string;
}
