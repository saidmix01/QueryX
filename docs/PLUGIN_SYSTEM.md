# SQLForge Plugin System Architecture

## Overview

El sistema de plugins de SQLForge está diseñado para ser extensible sin modificar el core de la aplicación.
Soporta tres tipos de plugins:

1. **UI Plugins** - Extienden la interfaz de usuario
2. **Analysis Plugins** - Añaden capacidades de análisis SQL
3. **Export Plugins** - Nuevos formatos de exportación

## Plugin Manifest

Cada plugin debe incluir un `plugin.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "type": "ui|analysis|export",
  "author": "Author Name",
  "description": "Plugin description",
  "main": "index.js",
  "permissions": ["query:read", "schema:read"],
  "hooks": {
    "onQueryExecute": true,
    "onConnectionChange": true
  }
}
```

## Extension Points

### UI Extension Points

```typescript
interface UIExtensionPoint {
  // Sidebar panel
  sidebarPanel?: {
    id: string;
    title: string;
    icon: string;
    component: React.ComponentType;
  };

  // Toolbar actions
  toolbarActions?: {
    id: string;
    label: string;
    icon: string;
    onClick: () => void;
  }[];

  // Context menu items
  contextMenuItems?: {
    target: 'table' | 'column' | 'query';
    items: MenuItem[];
  };

  // Result formatters
  resultFormatters?: {
    dataType: string;
    formatter: (value: unknown) => React.ReactNode;
  }[];
}
```

### Analysis Extension Points

```rust
/// Trait para plugins de análisis
pub trait AnalysisPlugin: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    
    /// Analiza una query antes de ejecutarla
    fn analyze_query(&self, query: &str) -> AnalysisResult;
    
    /// Analiza el resultado de una query
    fn analyze_result(&self, result: &QueryResult) -> AnalysisResult;
    
    /// Sugiere optimizaciones
    fn suggest_optimizations(&self, query: &str) -> Vec<Suggestion>;
}

pub struct AnalysisResult {
    pub warnings: Vec<Warning>,
    pub suggestions: Vec<Suggestion>,
    pub metrics: HashMap<String, f64>,
}
```

### Export Extension Points

```rust
/// Trait para plugins de exportación
pub trait ExportPlugin: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn file_extension(&self) -> &str;
    fn mime_type(&self) -> &str;
    
    /// Exporta resultados a bytes
    fn export(&self, result: &QueryResult, options: ExportOptions) -> Result<Vec<u8>, ExportError>;
    
    /// Opciones de configuración del plugin
    fn config_schema(&self) -> serde_json::Value;
}
```

## Plugin Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Discover  │────▶│   Validate  │────▶│    Load     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Unload    │◀────│   Active    │◀────│ Initialize  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Security Model

### Permissions

| Permission | Description |
|------------|-------------|
| `query:read` | Leer queries ejecutadas |
| `query:write` | Modificar queries |
| `schema:read` | Leer información de schema |
| `connection:read` | Leer info de conexiones |
| `file:read` | Leer archivos locales |
| `file:write` | Escribir archivos locales |
| `network` | Acceso a red |

### Sandboxing

- UI Plugins corren en un iframe aislado
- Analysis Plugins corren en WASM sandbox
- Export Plugins tienen acceso limitado al filesystem

## Plugin API (Frontend)

```typescript
// Plugin context disponible para UI plugins
interface PluginContext {
  // Estado actual
  activeConnection: Connection | null;
  activeQuery: string;
  lastResult: QueryResult | null;

  // Acciones
  executeQuery: (query: string) => Promise<QueryResult>;
  showNotification: (message: string, type: 'info' | 'error' | 'success') => void;
  openModal: (component: React.ComponentType) => void;

  // Eventos
  on: (event: PluginEvent, handler: EventHandler) => Unsubscribe;
}

type PluginEvent =
  | 'connection:change'
  | 'query:execute'
  | 'query:complete'
  | 'schema:refresh'
  | 'table:select';
```

## Example Plugin: Query Formatter

```typescript
// plugins/query-formatter/index.ts
import { PluginContext, UIExtensionPoint } from '@sqlforge/plugin-api';

export default function createPlugin(ctx: PluginContext): UIExtensionPoint {
  return {
    toolbarActions: [
      {
        id: 'format-query',
        label: 'Format SQL',
        icon: 'wand',
        onClick: () => {
          const formatted = formatSQL(ctx.activeQuery);
          ctx.setQuery(formatted);
        },
      },
    ],
  };
}

function formatSQL(query: string): string {
  // Implementación de formateo
  return query;
}
```

## Future Considerations

### Plugin Marketplace
- Registro central de plugins verificados
- Sistema de ratings y reviews
- Actualizaciones automáticas

### Plugin Development Kit
- CLI para scaffolding
- Hot reload durante desarrollo
- Testing utilities

### Monetization
- Plugins premium
- Revenue sharing con desarrolladores
- Enterprise plugin bundles
