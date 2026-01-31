# Visual Query Builder & Command Palette

## 🎯 Funcionalidades Implementadas

### 1. Visual Query Builder

Constructor gráfico de consultas SELECT orientado a usuarios técnicos que prefieren no escribir SQL manualmente.

#### Características

- **Selección de tabla principal (FROM)**
  - Búsqueda de tablas con filtrado en tiempo real
  - Soporte para schemas
  - Visualización de tipo (tabla/vista)

- **Selección de columnas (SELECT)**
  - Selección múltiple con checkboxes
  - Agrupadas por tabla
  - Botón "Todas" para seleccionar todas las columnas de una tabla
  - Visualización de tipo de dato y primary keys

- **JOINs gráficos**
  - INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL JOIN
  - Selección visual de tablas y columnas de unión
  - Soporte para alias de tablas
  - Visualización clara de las condiciones ON

- **Condiciones WHERE**
  - Operadores: =, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL
  - Operadores lógicos: AND / OR
  - Interfaz tipo dropdown para columnas y operadores
  - Input de valores con validación

- **GROUP BY**
  - Selección de columnas para agrupamiento

- **ORDER BY**
  - Ordenamiento ASC/DESC
  - Múltiples columnas
  - Toggle rápido de dirección

- **LIMIT**
  - Input numérico simple

#### Modelo Intermedio

El Query Builder NO trabaja directamente con SQL, sino con un modelo intermedio:

```typescript
interface QueryModel {
  from: TableRef;
  joins: JoinRef[];
  select: ColumnRef[];
  where?: ConditionGroup;
  groupBy: ColumnRef[];
  orderBy: OrderRef[];
  limit?: number;
}
```

#### Compilador SQL

El `QueryToSqlCompiler` convierte el modelo a SQL según el dialecto:
- PostgreSQL: Usa comillas dobles `"tabla"`
- MySQL: Usa backticks `` `tabla` ``
- SQLite: Usa comillas dobles `"tabla"`

#### Uso

1. **Atajo de teclado**: `Ctrl+Shift+B` (o `Cmd+Shift+B` en Mac)
2. **Botón en el editor**: "Query Builder"
3. Construir la consulta visualmente
4. Hacer clic en "Generar SQL"
5. El SQL se inserta en el editor actual
6. El usuario puede modificarlo manualmente

#### Seguridad

- ✅ Nunca ejecuta SQL automáticamente
- ✅ Solo genera SQL y lo inserta en el editor
- ✅ El usuario tiene control total antes de ejecutar

---

### 2. Command Palette (Ctrl+P)

Búsqueda rápida de tablas y vistas con navegación por teclado.

#### Características

- **Búsqueda fuzzy en tiempo real**
  - Busca en nombres de tablas
  - Busca en nombres de schemas
  - Busca en nombres completos (schema.tabla)
  - Scoring inteligente para ordenar resultados

- **Navegación por teclado**
  - `↑` / `↓`: Navegar entre resultados
  - `Enter`: Seleccionar
  - `Esc`: Cerrar

- **Visualización clara**
  - Iconos diferenciados para tablas y vistas
  - Muestra schema y nombre
  - Muestra cantidad de columnas
  - Resalta el elemento seleccionado

- **Acción automática**
  - Al seleccionar una tabla, inserta: `SELECT * FROM schema.tabla`
  - El SQL se inserta en el editor actual

#### Uso

1. **Atajo de teclado**: `Ctrl+P` (o `Cmd+P` en Mac)
2. Escribir para buscar (opcional)
3. Navegar con flechas
4. Presionar `Enter` para insertar

#### Performance

- ✅ Indexación en memoria (SchemaCatalog)
- ✅ No hace queries SQL al buscar
- ✅ Debounce automático en el input
- ✅ Limita resultados a 50 para evitar lag
- ✅ Memoización de resultados

---

## 🏗️ Arquitectura

### Stores (Zustand)

#### `query-builder-store.ts`
- Estado del Query Builder
- Modelo de la consulta
- Acciones para modificar el modelo

#### `command-palette-store.ts`
- Estado del Command Palette
- Query de búsqueda
- Items filtrados
- Índice seleccionado

### Componentes

#### Query Builder
- `QueryBuilder.tsx` - Modal principal
- `TableSelector.tsx` - Selector de tabla FROM
- `ColumnSelector.tsx` - Selector de columnas SELECT
- `JoinBuilder.tsx` - Constructor de JOINs
- `WhereBuilder.tsx` - Constructor de condiciones WHERE
- `OrderByBuilder.tsx` - Constructor de ORDER BY

#### Command Palette
- `CommandPalette.tsx` - Modal de búsqueda

### Hooks

#### `useGlobalShortcuts.ts`
- Maneja atajos de teclado globales
- `Ctrl+P`: Abre Command Palette
- `Ctrl+Shift+B`: Abre Query Builder

### Compilador

#### `query-compiler.ts`
- Convierte `QueryModel` a SQL
- Soporte para PostgreSQL, MySQL, SQLite
- Maneja quoting de identificadores según dialecto
- Escapa valores correctamente

---

## 🚀 Integración

### SchemaCatalog

Ambas funcionalidades se integran con el `SchemaCatalog` existente:

```typescript
// El catálogo se actualiza automáticamente
schemaCatalog.update(engine, database, schemas, tables);

// Query Builder y Command Palette lo usan
const tables = schemaCatalog.getTables();
const columns = schemaCatalog.getColumns(tableName);
```

### Editor SQL (Monaco)

- El SQL generado se inserta en el tab activo
- El usuario puede modificarlo antes de ejecutar
- Compatible con el autocompletado existente

---

## 🎨 UX/UI

### Query Builder
- Modal centrado, 90% viewport width, 85% height
- Scroll vertical para secciones largas
- Validación visual (warnings)
- Botones de acción claros
- Diseño paso a paso (1, 2, 3...)

### Command Palette
- Modal centrado, 600px width
- Máximo 500px height con scroll
- Búsqueda instantánea
- Navegación fluida por teclado
- Footer con ayuda de atajos

---

## 🔧 Extensibilidad

### Query Builder
- Fácil agregar nuevos operadores en `ComparisonOperator`
- Fácil agregar soporte para GROUP BY con HAVING
- Fácil agregar soporte para subconsultas

### Command Palette
- Preparado para agregar comandos adicionales
- Tipo `CommandPaletteItem` extensible
- Acciones configurables (`insert`, `open-data`, etc.)

---

## 📝 Ejemplos de Uso

### Query Builder

1. Usuario abre Query Builder (`Ctrl+Shift+B`)
2. Selecciona tabla `users`
3. Selecciona columnas `id`, `name`, `email`
4. Agrega JOIN con `orders` en `users.id = orders.user_id`
5. Agrega condición WHERE `users.active = true`
6. Agrega ORDER BY `users.created_at DESC`
7. Agrega LIMIT 100
8. Genera SQL:

```sql
SELECT "users"."id", "users"."name", "users"."email"
FROM "users"
INNER JOIN "orders" ON "users"."id" = "orders"."user_id"
WHERE "users"."active" = TRUE
ORDER BY "users"."created_at" DESC
LIMIT 100;
```

### Command Palette

1. Usuario presiona `Ctrl+P`
2. Escribe "user"
3. Ve resultados: `public.users`, `public.user_roles`, etc.
4. Navega con flechas
5. Presiona Enter
6. Se inserta: `SELECT * FROM public.users`

---

## ✅ Checklist de Implementación

- [x] Modelo intermedio `QueryModel`
- [x] Compilador `QueryToSqlCompiler` con soporte multi-dialecto
- [x] Store `query-builder-store`
- [x] Store `command-palette-store`
- [x] Componente `QueryBuilder` con modal
- [x] Componente `TableSelector`
- [x] Componente `ColumnSelector`
- [x] Componente `JoinBuilder`
- [x] Componente `WhereBuilder`
- [x] Componente `OrderByBuilder`
- [x] Componente `CommandPalette`
- [x] Hook `useGlobalShortcuts`
- [x] Integración con `SchemaCatalog`
- [x] Integración con editor Monaco
- [x] Atajos de teclado globales
- [x] Búsqueda fuzzy con scoring
- [x] Navegación por teclado
- [x] Validación de queries
- [x] Soporte para PostgreSQL, MySQL, SQLite
- [x] Documentación completa
