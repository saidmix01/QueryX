# Fix: Command Palette Multi-Schema Search

## Problema
El Command Palette (Ctrl+P) no mostraba tablas porque el `schemaStore` no se actualizaba cuando el usuario expandía schemas en el explorer.

## Causa Raíz
Había dos problemas:
1. El `schemaCatalog` solo se actualizaba con datos del `schemaStore.tables`, que estaba vacío
2. Cuando el usuario expandía la carpeta "Tables" de un schema en el explorer, no se llamaba a `schemaStore.loadTables()` para cargar las tablas

## Solución Implementada

### 1. Integración Explorer → Schema Store (`DatabaseTree.tsx`)
Cuando el usuario expande la carpeta "Tables" de un schema, ahora se cargan automáticamente las tablas en el schema store:

```typescript
const handleToggle = useCallback(
  async (nodeId: string) => {
    // ... código existente ...
    
    if (connectionId) {
      await toggleNode(nodeId, connectionId);
      
      // Si se expandió una carpeta de tablas, cargar las tablas en el schema store
      if (node.type === 'tables-folder' && node.isExpanded === false) {
        const schema = node.metadata?.schema as string;
        if (schema) {
          console.log('[DatabaseTree] Loading tables for schema:', schema);
          setSelectedSchema(schema);
          await loadTables(connectionId, schema);
        }
      }
    }
  },
  [nodes, activeConnectionId, toggleNode, loadTables, setSelectedSchema]
);
```

### 2. Extracción de Tablas del Explorer (`use-sql-completion.ts`)
Como respaldo, también se extraen tablas directamente del explorer:

```typescript
// Recorrer nodos del explorer para encontrar tablas
for (const [, node] of Object.entries(nodes)) {
  if (node.type === 'table' && node.metadata) {
    const tableName = node.name;
    const schemaName = node.metadata.schema as string;
    const connectionId = node.metadata.connectionId as string;
    
    // Solo agregar tablas de la conexión activa
    if (connectionId === activeConnectionId) {
      explorerTables.push(tableInfo);
    }
  }
}
```

### 3. Priorización Inteligente
El código prioriza las tablas del explorer cuando hay más que en el schema store:

```typescript
if (explorerTables.length > tables.length) {
  // Usar tablas del explorer como base
  allTables = [...explorerTables];
  
  // Reemplazar con tablas del schema store que tengan más información
  for (const schemaTable of tables) {
    if (index >= 0 && schemaTable.columns.length > 0) {
      allTables[index] = schemaTable;
    }
  }
}
```

## Comportamiento Resultante

### Flujo de Usuario
1. Usuario conecta a base de datos
2. Expande un schema en el explorer
3. Expande la carpeta "Tables"
4. **Automáticamente** se cargan las tablas en el `schemaStore`
5. El `schemaCatalog` se actualiza con las tablas
6. Command Palette (Ctrl+P) muestra las tablas disponibles

### Búsqueda
- Buscar por nombre: `users` → encuentra todas las tablas "users"
- Buscar por schema: `public.` → muestra todas las tablas de "public"
- Buscar completo: `auth.sessions` → encuentra directamente la tabla

## Archivos Modificados
- `src/components/DatabaseTree.tsx` - Integración con schema store al expandir carpeta Tables
- `src/sql-completion/use-sql-completion.ts` - Extracción de tablas del explorer como respaldo

## Testing
✅ Compilación TypeScript exitosa
✅ Build de producción exitoso
✅ Sin errores de diagnóstico

## Verificación
1. Iniciar la aplicación
2. Conectar a base de datos
3. Expandir un schema
4. Expandir la carpeta "Tables"
5. Verificar en consola: `[DatabaseTree] Loading tables for schema: <nombre>`
6. Presionar Ctrl+P
7. Buscar tablas - deberían aparecer en los resultados
