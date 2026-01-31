import type { DatabaseEngine } from '../domain/types';
import type {
  QueryModel,
  TableRef,
  ColumnRef,
  JoinRef,
  Condition,
  ConditionGroup,
  OrderRef,
} from '../domain/query-builder-types';

/**
 * Compilador de QueryModel a SQL según el dialecto
 */
export class QueryToSqlCompiler {
  constructor(private engine: DatabaseEngine) {}

  compile(model: QueryModel): string {
    const parts: string[] = [];

    // SELECT
    parts.push(this.compileSelect(model.select));

    // FROM
    parts.push(this.compileFrom(model.from));

    // JOINs
    if (model.joins.length > 0) {
      parts.push(this.compileJoins(model.joins));
    }

    // WHERE
    if (model.where && model.where.conditions.length > 0) {
      parts.push(this.compileWhere(model.where));
    }

    // GROUP BY
    if (model.groupBy.length > 0) {
      parts.push(this.compileGroupBy(model.groupBy));
    }

    // ORDER BY
    if (model.orderBy.length > 0) {
      parts.push(this.compileOrderBy(model.orderBy));
    }

    // LIMIT
    if (model.limit !== undefined && model.limit > 0) {
      parts.push(this.compileLimit(model.limit));
    }

    return parts.join('\n') + ';';
  }

  private compileSelect(columns: ColumnRef[]): string {
    if (columns.length === 0) {
      return 'SELECT *';
    }

    const cols = columns.map((col) => {
      const colName = this.quoteIdentifier(col.column);
      const tableName = col.table ? `${this.quoteIdentifier(col.table)}.` : '';
      const alias = col.alias ? ` AS ${this.quoteIdentifier(col.alias)}` : '';
      return `${tableName}${colName}${alias}`;
    });

    return `SELECT ${cols.join(', ')}`;
  }

  private compileFrom(table: TableRef): string {
    const tableName = this.formatTableName(table);
    const alias = table.alias ? ` AS ${this.quoteIdentifier(table.alias)}` : '';
    return `FROM ${tableName}${alias}`;
  }

  private compileJoins(joins: JoinRef[]): string {
    return joins
      .map((join) => {
        const tableName = this.formatTableName(join.table);
        const alias = join.table.alias ? ` AS ${this.quoteIdentifier(join.table.alias)}` : '';
        const leftCol = `${this.quoteIdentifier(join.on.leftTable)}.${this.quoteIdentifier(join.on.leftColumn)}`;
        const rightCol = `${this.quoteIdentifier(join.on.rightTable)}.${this.quoteIdentifier(join.on.rightColumn)}`;
        
        return `${join.type} JOIN ${tableName}${alias} ON ${leftCol} = ${rightCol}`;
      })
      .join('\n');
  }

  private compileWhere(group: ConditionGroup): string {
    const clause = this.compileConditionGroup(group);
    return clause ? `WHERE ${clause}` : '';
  }

  private compileConditionGroup(group: ConditionGroup): string {
    const compiled = group.conditions
      .map((cond) => {
        if ('operator' in cond && cond.operator === 'AND' || cond.operator === 'OR') {
          // Es un ConditionGroup anidado
          const nested = this.compileConditionGroup(cond as ConditionGroup);
          return nested ? `(${nested})` : '';
        } else {
          // Es una Condition simple
          return this.compileCondition(cond as Condition);
        }
      })
      .filter((c) => c !== '');

    return compiled.join(` ${group.operator} `);
  }

  private compileCondition(cond: Condition): string {
    const colName = `${this.quoteIdentifier(cond.column.table)}.${this.quoteIdentifier(cond.column.column)}`;

    switch (cond.operator) {
      case 'IS NULL':
        return `${colName} IS NULL`;
      case 'IS NOT NULL':
        return `${colName} IS NOT NULL`;
      case 'IN':
        if (!cond.values || cond.values.length === 0) return '';
        const values = cond.values.map((v) => this.formatValue(v)).join(', ');
        return `${colName} IN (${values})`;
      case 'LIKE':
        return `${colName} LIKE ${this.formatValue(cond.value)}`;
      default:
        return `${colName} ${cond.operator} ${this.formatValue(cond.value)}`;
    }
  }

  private compileGroupBy(columns: ColumnRef[]): string {
    const cols = columns.map((col) => {
      const tableName = col.table ? `${this.quoteIdentifier(col.table)}.` : '';
      return `${tableName}${this.quoteIdentifier(col.column)}`;
    });
    return `GROUP BY ${cols.join(', ')}`;
  }

  private compileOrderBy(orders: OrderRef[]): string {
    const cols = orders.map((order) => {
      const tableName = order.column.table ? `${this.quoteIdentifier(order.column.table)}.` : '';
      const colName = `${tableName}${this.quoteIdentifier(order.column.column)}`;
      return `${colName} ${order.direction}`;
    });
    return `ORDER BY ${cols.join(', ')}`;
  }

  private compileLimit(limit: number): string {
    return `LIMIT ${limit}`;
  }

  private formatTableName(table: TableRef): string {
    if (table.schema) {
      return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
    }
    return this.quoteIdentifier(table.name);
  }

  private quoteIdentifier(name: string): string {
    switch (this.engine) {
      case 'postgresql':
        return `"${name}"`;
      case 'mysql':
        return `\`${name}\``;
      case 'sqlite':
        return `"${name}"`;
      default:
        return name;
    }
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    return String(value);
  }
}
