import type { SchemaInfo, TableInfo, ColumnSchema, ViewInfo } from '../domain/schema-types';
import type { DatabaseEngine } from '../domain/types';

/**
 * Entrada de tabla en el catálogo con metadata completa
 */
export interface CatalogTable {
  name: string;
  schema?: string;
  database?: string;
  columns: CatalogColumn[];
  type: 'table' | 'view';
}

export interface CatalogColumn {
  name: string;
  dataType: string;
  nativeType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  comment?: string;
}

export interface CatalogSchema {
  name: string;
  tables: CatalogTable[];
}

/**
 * SchemaCatalog - Catálogo en memoria de metadata de base de datos
 * Optimizado para búsquedas rápidas durante el autocompletado
 */
export class SchemaCatalog {
  private schemas: Map<string, CatalogSchema> = new Map();
  private tablesByName: Map<string, CatalogTable[]> = new Map();
  private tablesByFullName: Map<string, CatalogTable> = new Map();
  private engine: DatabaseEngine = 'postgresql';
  private currentDatabase?: string;
  private connectionId?: string;
  private listeners: Set<() => void> = new Set();

  /**
   * Suscribe a cambios en el catálogo
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Actualiza una tabla específica en el catálogo
   */
  updateTable(tableInfo: TableInfo): void {
    const catalogTable = this.convertTable(tableInfo, tableInfo.schema);
    
    // Actualizar en el índice por nombre completo
    const fullName = this.getFullTableName(catalogTable);
    this.tablesByFullName.set(fullName.toLowerCase(), catalogTable);
    
    // Actualizar en el índice por nombre simple
    const lowerName = catalogTable.name.toLowerCase();
    const existing = this.tablesByName.get(lowerName) || [];
    const index = existing.findIndex(t => 
      this.getFullTableName(t).toLowerCase() === fullName.toLowerCase()
    );
    
    if (index >= 0) {
      existing[index] = catalogTable;
    } else {
      existing.push(catalogTable);
    }
    this.tablesByName.set(lowerName, existing);
    
    // Actualizar en el schema si existe
    if (catalogTable.schema) {
      const schema = this.schemas.get(catalogTable.schema);
      if (schema) {
        const tableIndex = schema.tables.findIndex(t => t.name === catalogTable.name);
        if (tableIndex >= 0) {
          schema.tables[tableIndex] = catalogTable;
        } else {
          schema.tables.push(catalogTable);
        }
      }
    }

    this.notify();
  }

  /**
   * Actualiza el catálogo con nueva metadata del schema store
   */
  update(
    connectionId: string,
    engine: DatabaseEngine,
    database: string | undefined,
    schemas: SchemaInfo[],
    tables: TableInfo[]
  ): void {
    this.clear(false); // No notificar en clear interno para evitar doble notificación
    this.connectionId = connectionId;
    this.engine = engine;
    this.currentDatabase = database;

    // Procesar schemas con sus tablas y vistas
    for (const schema of schemas) {
      const catalogSchema: CatalogSchema = {
        name: schema.name,
        tables: [],
      };

      // Agregar tablas del schema
      for (const table of schema.tables) {
        const catalogTable = this.convertTable(table, schema.name);
        catalogSchema.tables.push(catalogTable);
        this.indexTable(catalogTable);
      }

      // Agregar vistas del schema
      for (const view of schema.views) {
        const catalogTable = this.convertView(view, schema.name);
        catalogSchema.tables.push(catalogTable);
        this.indexTable(catalogTable);
      }

      this.schemas.set(schema.name, catalogSchema);
    }

    // Procesar tablas sueltas (sin schema específico)
    for (const table of tables) {
      if (!table.schema || !this.schemas.has(table.schema)) {
        const catalogTable = this.convertTable(table, table.schema);
        this.indexTable(catalogTable);
      }
    }

    this.notify();
  }

  private convertTable(table: TableInfo, schema?: string): CatalogTable {
    return {
      name: table.name,
      schema,
      database: this.currentDatabase,
      type: 'table',
      columns: table.columns.map((col) => this.convertColumn(col)),
    };
  }

  private convertView(view: ViewInfo, schema?: string): CatalogTable {
    return {
      name: view.name,
      schema,
      database: this.currentDatabase,
      type: 'view',
      columns: view.columns.map((col) => this.convertColumn(col)),
    };
  }

  private convertColumn(col: ColumnSchema): CatalogColumn {
    return {
      name: col.name,
      dataType: col.data_type,
      nativeType: col.native_type,
      nullable: col.nullable,
      isPrimaryKey: col.is_primary_key,
      comment: col.comment,
    };
  }

  private indexTable(table: CatalogTable): void {
    // Índice por nombre simple
    const existing = this.tablesByName.get(table.name.toLowerCase()) || [];
    existing.push(table);
    this.tablesByName.set(table.name.toLowerCase(), existing);

    // Índice por nombre completo
    const fullName = this.getFullTableName(table);
    this.tablesByFullName.set(fullName.toLowerCase(), table);
  }

  private getFullTableName(table: CatalogTable): string {
    if (this.engine === 'postgresql' && table.schema) {
      return `${table.schema}.${table.name}`;
    }
    if (this.engine === 'mysql' && table.database) {
      return `${table.database}.${table.name}`;
    }
    return table.name;
  }

  /**
   * Obtiene todos los schemas disponibles
   */
  getSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Obtiene todas las tablas, opcionalmente filtradas por schema
   */
  getTables(schemaName?: string): CatalogTable[] {
    if (schemaName) {
      const schema = this.schemas.get(schemaName);
      return schema?.tables || [];
    }
    return Array.from(this.tablesByFullName.values());
  }

  /**
   * Busca una tabla por nombre (simple o completo)
   */
  findTable(name: string): CatalogTable | undefined {
    const lowerName = name.toLowerCase();
    
    // Primero buscar por nombre completo
    const byFullName = this.tablesByFullName.get(lowerName);
    if (byFullName) return byFullName;

    // Luego buscar por nombre simple (retorna la primera coincidencia)
    const byName = this.tablesByName.get(lowerName);
    return byName?.[0];
  }

  /**
   * Obtiene las columnas de una tabla
   */
  getColumns(tableName: string): CatalogColumn[] {
    const table = this.findTable(tableName);
    return table?.columns || [];
  }

  /**
   * Busca tablas que coincidan con un prefijo
   */
  searchTables(prefix: string): CatalogTable[] {
    const lowerPrefix = prefix.toLowerCase();
    const results: CatalogTable[] = [];

    for (const table of this.tablesByFullName.values()) {
      if (
        table.name.toLowerCase().startsWith(lowerPrefix) ||
        this.getFullTableName(table).toLowerCase().startsWith(lowerPrefix)
      ) {
        results.push(table);
      }
    }

    return results;
  }

  /**
   * Busca columnas que coincidan con un prefijo en una tabla específica
   */
  searchColumns(tableName: string, prefix: string): CatalogColumn[] {
    const columns = this.getColumns(tableName);
    const lowerPrefix = prefix.toLowerCase();
    
    return columns.filter((col) =>
      col.name.toLowerCase().startsWith(lowerPrefix)
    );
  }

  /**
   * Obtiene el motor de base de datos actual
   */
  getEngine(): DatabaseEngine {
    return this.engine;
  }

  getConnectionId(): string | undefined {
    return this.connectionId;
  }

  /**
   * Limpia el catálogo
   */
  clear(notify = true): void {
    this.schemas.clear();
    this.tablesByName.clear();
    this.tablesByFullName.clear();
    this.connectionId = undefined;
    if (notify) {
      this.notify();
    }
  }

  /**
   * Verifica si el catálogo tiene datos
   */
  isEmpty(): boolean {
    return this.tablesByFullName.size === 0;
  }
}

// Singleton del catálogo
export const schemaCatalog = new SchemaCatalog();
