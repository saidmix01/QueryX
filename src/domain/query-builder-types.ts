// Modelo intermedio del Query Builder - NO es SQL directo

export interface TableRef {
  name: string;
  schema?: string;
  alias?: string;
}

export interface ColumnRef {
  table: string; // nombre o alias de la tabla
  column: string;
  alias?: string;
}

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface JoinRef {
  type: JoinType;
  table: TableRef;
  on: JoinCondition;
}

export interface JoinCondition {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
}

export type ComparisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';

export interface Condition {
  column: ColumnRef;
  operator: ComparisonOperator;
  value?: string | number | boolean | null;
  values?: (string | number)[]; // Para IN
}

export type LogicalOperator = 'AND' | 'OR';

export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}

export type OrderDirection = 'ASC' | 'DESC';

export interface OrderRef {
  column: ColumnRef;
  direction: OrderDirection;
}

export interface QueryModel {
  from: TableRef;
  joins: JoinRef[];
  select: ColumnRef[];
  where?: ConditionGroup;
  groupBy: ColumnRef[];
  orderBy: OrderRef[];
  limit?: number;
}

export function createEmptyQueryModel(): QueryModel {
  return {
    from: { name: '', schema: undefined, alias: undefined },
    joins: [],
    select: [],
    groupBy: [],
    orderBy: [],
  };
}

export function createEmptyConditionGroup(): ConditionGroup {
  return {
    operator: 'AND',
    conditions: [],
  };
}
