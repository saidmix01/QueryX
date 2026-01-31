import { useEffect, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import { useSchemaStore } from '../store/schema-store';
import { useConnectionStore } from '../store/connection-store';
import { useExplorerStore } from '../store/explorer-store';
import { schemaCatalog } from './schema-catalog';
import { registerSqlCompletionProvider } from './completion-provider';
import type { SchemaInfo, TableInfo } from '../domain/schema-types';

/**
 * Hook para integrar el autocompletado SQL con Monaco Editor
 * Sincroniza el SchemaCatalog con el schema store y registra el provider
 */
export function useSqlCompletion(monaco: typeof Monaco | null) {
  const disposableRef = useRef<Monaco.IDisposable | null>(null);
  const { connections, activeConnectionId } = useConnectionStore();
  const { nodes } = useExplorerStore();
  const schemas = useSchemaStore((s) =>
    activeConnectionId ? s.byConnection[activeConnectionId]?.schemas || [] : []
  );
  const tables = useSchemaStore((s) =>
    activeConnectionId ? s.byConnection[activeConnectionId]?.tables || [] : []
  );
  const selectedDatabase = useSchemaStore((s) =>
    activeConnectionId ? s.byConnection[activeConnectionId]?.selectedDatabase || null : null
  );
  const selectedTable = useSchemaStore((s) =>
    activeConnectionId ? s.byConnection[activeConnectionId]?.selectedTable || null : null
  );

  // Obtener el engine de la conexión activa
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const engine = activeConnection?.engine ?? 'postgresql';

  // Actualizar el catálogo cuando cambia la metadata
  // Combinar datos del schema store con datos del explorer
  useEffect(() => {
    // Extraer todas las tablas del explorer
    const explorerTables: TableInfo[] = [];
    const explorerSchemas: SchemaInfo[] = [];
    
    // Recorrer nodos del explorer para encontrar tablas
    for (const [, node] of Object.entries(nodes)) {
      if (node.type === 'schema' && node.metadata) {
        const schemaName = node.metadata.schema as string;
        const schemaInfo: SchemaInfo = {
          name: schemaName,
          tables: [],
          views: [],
          functions: [],
          sequences: [],
          is_system: node.metadata.isSystem as boolean || false,
        };
        explorerSchemas.push(schemaInfo);
      }
      
      if (node.type === 'table' && node.metadata) {
        const tableName = node.name;
        const schemaName = node.metadata.schema as string;
        const connectionId = node.metadata.connectionId as string;
        
        // Solo agregar tablas de la conexión activa
        if (connectionId === activeConnectionId) {
          const tableInfo: TableInfo = {
            name: tableName,
            schema: schemaName,
            columns: [],
            foreign_keys: [],
            indexes: [],
            constraints: [],
            triggers: [],
          };
          explorerTables.push(tableInfo);
        }
      }
      
      if (node.type === 'view' && node.metadata) {
        const viewName = node.name;
        const schemaName = node.metadata.schema as string;
        const connectionId = node.metadata.connectionId as string;
        
        // Solo agregar vistas de la conexión activa
        if (connectionId === activeConnectionId) {
          const tableInfo: TableInfo = {
            name: viewName,
            schema: schemaName,
            columns: [],
            foreign_keys: [],
            indexes: [],
            constraints: [],
            triggers: [],
          };
          explorerTables.push(tableInfo);
        }
      }
    }
    
    // Combinar schemas del schema store con los del explorer
    const allSchemas = [...schemas];
    for (const explorerSchema of explorerSchemas) {
      if (!allSchemas.find(s => s.name === explorerSchema.name)) {
        allSchemas.push(explorerSchema);
      }
    }
    
    // Priorizar tablas del explorer si hay más que en el schema store
    // Esto permite que el Command Palette funcione incluso sin seleccionar un schema
    let allTables: TableInfo[];
    
    if (explorerTables.length > tables.length) {
      // Usar tablas del explorer como base
      allTables = [...explorerTables];
      
      // Agregar tablas del schema store que tengan columnas (más detalle)
      for (const schemaTable of tables) {
        const fullName = schemaTable.schema 
          ? `${schemaTable.schema}.${schemaTable.name}`
          : schemaTable.name;
        
        const index = allTables.findIndex(t => {
          const tFullName = t.schema ? `${t.schema}.${t.name}` : t.name;
          return tFullName === fullName;
        });
        
        // Reemplazar si la del schema store tiene más información (columnas)
        if (index >= 0 && schemaTable.columns.length > 0) {
          allTables[index] = schemaTable;
        } else if (index < 0) {
          allTables.push(schemaTable);
        }
      }
    } else {
      // Usar tablas del schema store como base
      allTables = [...tables];
      
      // Agregar tablas del explorer que no estén
      for (const explorerTable of explorerTables) {
        const fullName = explorerTable.schema 
          ? `${explorerTable.schema}.${explorerTable.name}`
          : explorerTable.name;
        
        const exists = allTables.find(t => {
          const tFullName = t.schema ? `${t.schema}.${t.name}` : t.name;
          return tFullName === fullName;
        });
        
        if (!exists) {
          allTables.push(explorerTable);
        }
      }
    }
    
    if (activeConnectionId) {
      schemaCatalog.update(activeConnectionId, engine, selectedDatabase ?? undefined, allSchemas, allTables);
    }
  }, [engine, selectedDatabase, schemas, tables, nodes, activeConnectionId]);

  // Actualizar tabla específica cuando se selecciona
  useEffect(() => {
    if (selectedTable) {
      schemaCatalog.updateTable(selectedTable);
    }
  }, [selectedTable]);

  // Registrar el provider cuando Monaco está disponible
  useEffect(() => {
    if (!monaco) return;

    // Limpiar provider anterior si existe
    if (disposableRef.current) {
      disposableRef.current.dispose();
    }

    // Registrar nuevo provider
    disposableRef.current = registerSqlCompletionProvider(monaco);

    return () => {
      if (disposableRef.current) {
        disposableRef.current.dispose();
        disposableRef.current = null;
      }
    };
  }, [monaco]);

  // Limpiar catálogo cuando se desconecta
  useEffect(() => {
    if (!activeConnectionId) {
      schemaCatalog.clear();
    }
  }, [activeConnectionId]);
}
