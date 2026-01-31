# Sistema de Persistencia del Workspace y Consultas Guardadas

## Descripción General

Sistema completo que permite:
1. **Guardar consultas SQL** con nombre, descripción y tags
2. **Persistir el workspace** automáticamente (pestañas, contenido SQL, estado)
3. **Restaurar la sesión** al reabrir la aplicación

## Arquitectura

### Backend (Rust)

#### Entidades de Dominio

**SavedQuery** (`src-tauri/src/domain/entities/saved_query.rs`)
- Consultas SQL guardadas por el usuario
- Asociadas a una conexión específica
- Soporta tags y carpetas para organización

**WorkspaceState** (`src-tauri/src/domain/entities/workspace.rs`)
- Estado completo del workspace por conexión
- Lista de pestañas abiertas con su contenido
- Pestaña activa
- Última actualización

#### Repositorios

**FileSavedQueryRepository** (`src-tauri/src/infrastructure/repositories/file_saved_query_repository.rs`)
- Persistencia en JSON (`saved_queries.json`)
- CRUD completo de consultas guardadas
- Gestión de carpetas

**FileWorkspaceRepository** (`src-tauri/src/infrastructure/repositories/file_workspace_repository.rs`)
- Persistencia en JSON (`workspaces.json`)
- Guardado y restauración por conexión
- Tolerante a fallos

#### Use Cases

**SavedQueryUseCase** - Lógica de negocio para consultas guardadas
**WorkspaceUseCase** - Lógica de negocio para workspaces

#### Commands (Tauri)

**Saved Queries:**
- `get_saved_queries` - Obtener consultas de una conexión
- `create_saved_query` - Crear nueva consulta
- `update_saved_query` - Actualizar consulta
- `delete_saved_query` - Eliminar consulta
- `get_query_folders` - Obtener carpetas
- `create_query_folder` - Crear carpeta
- `delete_query_folder` - Eliminar carpeta

**Workspace:**
- `save_workspace` - Guardar estado del workspace
- `get_workspace` - Obtener workspace de una conexión
- `delete_workspace` - Eliminar workspace
- `get_all_workspaces` - Obtener todos los workspaces

### Frontend (React + TypeScript)

#### Tipos

**saved-query-types.ts** - Tipos para consultas guardadas
**workspace-types.ts** - Tipos para persistencia del workspace

#### Stores (Zustand)

**useSavedQueryStore** (`src/store/saved-query-store.ts`)
- Estado de consultas guardadas
- Acciones CRUD
- Gestión de carpetas

**useWorkspaceStore** (`src/store/workspace-store.ts`)
- Estado de restauración
- Auto-save con debounce (1 segundo)
- Restauración automática al conectar

#### Componentes

**SavedQueriesPanel** (`src/components/SavedQueriesPanel.tsx`)
- Panel lateral para ver y gestionar consultas guardadas
- Diálogo para guardar nueva consulta
- Click para abrir en nueva pestaña
- Eliminación con confirmación

**WorkspaceRestoreIndicator** (`src/components/WorkspaceRestoreIndicator.tsx`)
- Indicador visual durante la restauración
- Aparece temporalmente al iniciar

## Flujo de Uso

### Guardar Consulta

1. Usuario escribe SQL en el editor
2. Click en botón "Guardar" en panel de consultas
3. Ingresa nombre y descripción opcional
4. Se guarda en `saved_queries.json`
5. Aparece en el panel de consultas guardadas

### Persistencia Automática del Workspace

1. Usuario abre pestañas y escribe SQL
2. Sistema detecta cambios (debounced)
3. Auto-guarda cada 1 segundo en `workspaces.json`
4. Incluye:
   - Todas las pestañas abiertas
   - Contenido SQL de cada pestaña
   - Pestaña activa
   - Título de cada pestaña

### Restauración al Iniciar

1. Usuario abre la aplicación
2. Selecciona/conecta a una conexión
3. Sistema busca workspace guardado
4. Muestra indicador "Restaurando sesión..."
5. Recrea todas las pestañas con su contenido
6. Activa la última pestaña activa
7. **NO ejecuta queries automáticamente** (seguridad)

## Características de Seguridad

- ✅ **No guarda credenciales** en el workspace
- ✅ **No ejecuta queries automáticamente** al restaurar
- ✅ **Tolerante a fallos** - ignora conexiones eliminadas
- ✅ **Validación** de datos antes de guardar

## Características de UX

- ✅ **Auto-save transparente** - el usuario no necesita guardar manualmente
- ✅ **Debounce inteligente** - evita guardar en cada keystroke
- ✅ **Indicador visual** durante restauración
- ✅ **Organización con carpetas** (preparado para futuro)
- ✅ **Tags para búsqueda** rápida

## Archivos de Persistencia

Ubicación: `~/.local/share/sqlforge/` (Linux) o equivalente en Windows/Mac

```
saved_queries.json
{
  "queries": [
    {
      "id": "uuid",
      "connection_id": "uuid",
      "name": "Mi consulta",
      "sql": "SELECT * FROM users",
      "description": "Consulta de ejemplo",
      "tags": ["users", "select"],
      "folder_id": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "folders": []
}
```

```
workspaces.json
{
  "workspaces": {
    "connection-uuid": {
      "connection_id": "uuid",
      "active_tab_id": "tab-1",
      "tabs": [
        {
          "id": "tab-1",
          "tab_type": "sql-editor",
          "title": "Query 1",
          "payload": {
            "type": "SqlEditor",
            "sql": "SELECT * FROM users"
          }
        }
      ],
      "last_updated": "2024-01-01T00:00:00Z"
    }
  }
}
```

## Extensibilidad Futura

El sistema está preparado para:
- ✅ Workspaces por proyecto (múltiples workspaces por conexión)
- ✅ Sync opcional entre dispositivos
- ✅ Historial versionado de queries
- ✅ Compartir consultas entre usuarios
- ✅ Snippets y templates
- ✅ Soporte para Query Builder y Table View en workspace

## Testing

Para probar el sistema:

1. **Guardar consulta:**
   - Conectar a una base de datos
   - Escribir SQL en el editor
   - Click en "+ Guardar" en panel de consultas
   - Verificar que aparece en la lista

2. **Persistencia del workspace:**
   - Abrir varias pestañas con SQL
   - Cerrar la aplicación (incluso forzadamente)
   - Reabrir y conectar a la misma conexión
   - Verificar que todas las pestañas se restauran

3. **Auto-save:**
   - Escribir SQL en una pestaña
   - Esperar 1 segundo
   - Verificar en `workspaces.json` que se guardó

## Notas de Implementación

- **Debounce de 1 segundo** para auto-save (configurable)
- **Inicialización lazy** de repositorios en Rust
- **Suscripción a cambios** en Zustand para auto-save
- **Manejo de errores** robusto en toda la cadena
- **Logs** para debugging en desarrollo
