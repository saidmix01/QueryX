// Tipos de schema

export interface DatabaseInfo {
  name: string;
  schemas: SchemaInfo[];
  size_bytes?: number;
  encoding?: string;
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
  views: ViewInfo[];
  functions: FunctionInfo[];
  sequences: SequenceInfo[];
  is_system: boolean;
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
  primary_key?: PrimaryKeyInfo;
  foreign_keys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  triggers: TriggerInfo[];
  row_count?: number;
  size_bytes?: number;
  comment?: string;
}

export interface ColumnSchema {
  name: string;
  data_type: string;
  native_type: string;
  nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
  is_unique: boolean;
  is_auto_increment: boolean;
  max_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  comment?: string;
  ordinal_position: number;
}

export interface PrimaryKeyInfo {
  name?: string;
  columns: string[];
}

export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referenced_table: string;
  referenced_schema?: string;
  referenced_columns: string[];
  on_update: ForeignKeyAction;
  on_delete: ForeignKeyAction;
}

export type ForeignKeyAction = 
  | 'NoAction' 
  | 'Restrict' 
  | 'Cascade' 
  | 'SetNull' 
  | 'SetDefault';

export interface IndexInfo {
  name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
}

export interface ConstraintInfo {
  name: string;
  constraint_type: ConstraintType;
  columns: string[];
  definition?: string;
}

export type ConstraintType = 
  | 'PrimaryKey' 
  | 'ForeignKey' 
  | 'Unique' 
  | 'Check' 
  | 'Exclusion';

export interface TriggerInfo {
  name: string;
  table_name: string;
  schema?: string;
  timing: TriggerTiming;
  events: TriggerEvent[];
  definition?: string;
  enabled: boolean;
}

export type TriggerTiming = 'Before' | 'After' | 'InsteadOf';
export type TriggerEvent = 'Insert' | 'Update' | 'Delete' | 'Truncate';

export interface SequenceInfo {
  name: string;
  schema?: string;
  data_type: string;
  start_value: number;
  increment: number;
  min_value?: number;
  max_value?: number;
  current_value?: number;
}

export interface ViewInfo {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
  definition?: string;
  is_materialized: boolean;
}

export interface FunctionInfo {
  name: string;
  schema?: string;
  return_type?: string;
  parameters: FunctionParameter[];
  language: string;
  definition?: string;
}

export interface FunctionParameter {
  name: string;
  data_type: string;
  mode: 'In' | 'Out' | 'InOut';
  default_value?: string;
}
