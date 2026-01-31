# Implementación de Base de Datos Opcional

## Resumen

Se ha implementado la funcionalidad para permitir conexiones a servidores SQL sin especificar una base de datos específica. Cuando el campo `database` está vacío, el explorador muestra automáticamente todas las bases de datos disponibles en el servidor.

## Cambios Implementados

### 1. Backend (Rust)

#### Entidades y DTOs (`src-tauri/src/domain/entities/connection.rs`)

- **Campo `database` ahora es `Option<String>`**: Permite conexiones sin base de datos específica
- **Método `get_default_database()`**: Retorna la base de datos por defecto según el motor:
  - PostgreSQL: `"postgres"`
  - MySQL: `None` (puede conectar sin DB)
  - SQLite: Requiere database/file_path (obligatorio)

#### Estrategia de Conexión por Motor

**PostgreSQL:**
```rust
// Conecta a "postgres" por defecto si no se especifica database
let database = conn.database.as_deref().unwrap_or("postgres");
```

**MySQL:**
```rust
// Puede conectar sin database específica
if let Some(db) = &conn.database {
    format!("{}/{}", base, db)
} else {
    base // Sin database en la URL
}
```

**SQLite:**
```rust
// Requiere database o file_path (validación en create_connection)
if dto.engine == DatabaseEngine::SQLite && dto.database.is_none() && dto.file_path.is_none() {
    return Err(DomainError::validation("Database file path is required for SQLite"));
}
```

#### Connection Use Case (`src-tauri/src/application/use_cases/connection_use_case.rs`)

- **`build_connection_string()`**: Actualizado para manejar database opcional
- **`create_connection()`**: Validación específica para SQLite

#### Repository (`src-tauri/src/infrastructure/repositories/file_connection_repository.rs`)

- **`update()`**: Maneja correctamente `database` como `Option<String>`

### 2. Frontend (TypeScript)

#### Tipos (`src/domain/types.ts`)

```typescript
export interface Connection {
  database?: string; // Opcional
  // ...
}

export interface CreateConnectionDto {
  database?: string; // Opcional para server, requerido para SQLite
  // ...
}
```

#### Formulario de Conexión (`src/components/ConnectionModal.tsx`)

- Campo `database` ahora es opcional (sin `required`)
- Hint informativo: *"Optional — if left empty, all databases/schemas will be shown"*
- Validación solo para SQLite (file_path requerido)

#### Explorer Store (`src/store/explorer-store.ts`)

**`initializeConnection()`:**
- Si `database` está presente: Estructura tradicional (Connection → Database → Schemas)
- Si `database` es `undefined`: Connection carga lista de databases dinámicamente

**`loadChildren()` - Nuevo caso:**
```typescript
case 'connection': {
  // Cargar lista de databases cuando no hay database específica
  const databases = await schemaApi.listDatabases(connectionId);
  // Crear nodos de database dinámicamente
}
```

#### Database Tree (`src/components/DatabaseTree.tsx`)

- Pasa `conn.database || ''` a `initializeConnection()`
- Maneja correctamente conexiones sin database

## Flujo de Uso

### Conexión con Database Específica (Comportamiento Tradicional)

1. Usuario crea conexión con database: `myapp_db`
2. Explorer muestra:
   ```
   Connection
   └── myapp_db
       ├── public
       │   ├── Tables
       │   ├── Views
       │   └── ...
       └── other_schema
   ```

### Conexión sin Database (Nuevo Comportamiento)

1. Usuario crea conexión dejando database vacío
2. Al conectar, backend usa database por defecto:
   - PostgreSQL: Conecta a `postgres`
   - MySQL: Conecta sin database
3. Explorer muestra:
   ```
   Connection
   ├── database_1
   ├── database_2
   ├── database_3
   └── myapp_db
   ```
4. Al hacer clic en una database:
   - Se expande mostrando schemas
   - Se carga estructura completa (tablas, vistas, etc.)

## Seguridad y Performance

### Cache
- El listado de databases se cachea por 5 minutos
- Cache se invalida al hacer refresh manual

### Permisos
- No se ejecutan queries automáticas al listar databases
- Se usan comandos nativos del motor:
  - PostgreSQL: `SELECT datname FROM pg_database`
  - MySQL: `SHOW DATABASES`

### Pool de Conexiones
- Se reutiliza el pool existente
- No se abren múltiples conexiones innecesarias

## UX Mejorada

### Estado de Conexión
- Muestra claramente si está conectado al servidor
- Indica cuando se selecciona una database específica

### Validación
- SQLite muestra validación clara: "Database file path is required"
- Otros motores permiten campo vacío con hint explicativo

## Ejemplo de Uso

### PostgreSQL sin Database

```typescript
const connection = {
  name: "Production Server",
  engine: "postgresql",
  host: "prod.example.com",
  port: 5432,
  database: undefined, // ← Vacío
  username: "admin",
  password: "***"
};
```

**Resultado:**
- Conecta a `postgres` (database por defecto)
- Lista todas las databases: `app_db`, `analytics_db`, `logs_db`
- Usuario puede explorar cualquier database sin recrear conexión

### MySQL sin Database

```typescript
const connection = {
  name: "Dev Server",
  engine: "mysql",
  host: "localhost",
  port: 3306,
  database: undefined, // ← Vacío
  username: "root",
  password: "***"
};
```

**Resultado:**
- Conecta sin database específica
- Lista todas las databases disponibles
- Permite cambiar entre databases sin reconectar

## Testing

### Compilación
- ✅ Backend (Rust): `cargo check` - Sin errores
- ✅ Frontend (TypeScript): `npx tsc --noEmit` - Sin errores

### Casos de Prueba Recomendados

1. **PostgreSQL sin database**: Verificar listado de databases
2. **MySQL sin database**: Verificar listado de databases
3. **SQLite sin file_path**: Verificar error de validación
4. **Conexión existente con database**: Verificar comportamiento tradicional
5. **Cambio de database en explorer**: Verificar carga de schemas

## Próximos Pasos (Opcional)

1. **Cambio de Database Contextual**: Permitir cambiar database sin recrear conexión
2. **Indicador Visual**: Mostrar database activa en el UI
3. **Filtro de Databases**: Ocultar databases del sistema (opcional)
4. **SQL Server Support**: Implementar estrategia para SQL Server (conectar a `master`)

## Notas Técnicas

- Los drivers ya implementan `list_databases()` correctamente
- El schema API ya expone el comando `list_databases`
- La estructura del explorer es flexible y soporta ambos modos
- No se requieren migraciones de datos (retrocompatible)
