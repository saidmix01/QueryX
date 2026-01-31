import { useSchemaStore } from '../store/schema-store';
import { schemaCatalog } from '../sql-completion/schema-catalog';
import type { Connection } from '../domain/types';
import { useConnectionStore } from '../store/connection-store';
 
export async function ensureDefaultSchemaInitialized(
  connection: Connection,
  options?: { force?: boolean }
): Promise<void> {
  const { id, engine, database } = connection;
  const {
    getSelectedSchema,
    getSelectedDatabase,
    getDatabases,
    getSchemas,
    getTables,
    loadTables,
    loadDatabases,
    loadSchemas,
    setSelectedSchema,
    setSelectedDatabase,
  } = useSchemaStore.getState();
 
  // Siempre reconstruir el catálogo para la conexión actual
  schemaCatalog.clear();
  if (engine === 'postgresql') {
    let db = database || null;
    if (!db) {
      await loadDatabases(id);
      const list = getDatabases(id) || [];
      db = list.find((d) => d !== 'postgres' && !d.startsWith('template')) || list[0] || 'postgres';
      const { updateConnection, connect } = useConnectionStore.getState();
      await updateConnection(id, { database: db });
      await connect(id);
    }
    await loadSchemas(id, db);
    const schemas = getSchemas(id) || [];
    const candidate = schemas.find((s) => !s.is_system) || schemas.find((s) => s.name === 'public') || schemas[0];
    const schemaName = candidate ? candidate.name : 'public';
    setSelectedSchema(id, schemaName);
    await loadTables(id, schemaName);
    const tables = getTables(id) || [];
    // Recargar schemas para asegurar que incluyen las tablas recién cargadas
    const updatedSchemas = getSchemas(id) || [];
    schemaCatalog.update(id, engine, db || undefined, updatedSchemas, tables);
    return;
  }
 
  if (engine === 'mysql') {
    let db = getSelectedDatabase(id) || database || null;
    if (!db || options?.force) {
      await loadDatabases(id);
      const list = getDatabases(id) || [];
      db = db || list[0] || null;
    }
    if (db) {
      setSelectedDatabase(id, db);
      await loadSchemas(id, db);
      await loadTables(id, db);
      const schemas = getSchemas(id) || [];
      const tables = getTables(id) || [];
      schemaCatalog.update(id, engine, db || undefined, schemas, tables);
    } else {
      await loadTables(id);
      const schemas = getSchemas(id) || [];
      const tables = getTables(id) || [];
      schemaCatalog.update(id, engine, undefined, schemas, tables);
    }
    return;
  }
 
  if (engine === 'sqlite') {
    if (!getSelectedSchema(id) || options?.force) {
      setSelectedSchema(id, 'main');
      await loadTables(id, 'main');
    }
    const schemas = getSchemas(id) || [];
    const tables = getTables(id) || [];
    schemaCatalog.update(id, engine, undefined, schemas, tables);
    return;
  }
 
  await loadTables(id);
  const schemas = getSchemas(id) || [];
  const tables = getTables(id) || [];
  schemaCatalog.update(id, engine, undefined, schemas, tables);
}
