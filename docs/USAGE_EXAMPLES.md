# 📖 Ejemplos de Uso - Query Builder & Command Palette

## Escenario 1: Consulta Simple de Usuarios

### Objetivo
Obtener todos los usuarios activos ordenados por fecha de creación.

### Con Query Builder (Ctrl+Shift+B)

1. **Abrir Query Builder**: `Ctrl+Shift+B`

2. **Seleccionar tabla FROM**:
   - Buscar "users"
   - Seleccionar `public.users`

3. **Seleccionar columnas SELECT**:
   - Marcar: `id`, `name`, `email`, `created_at`

4. **Agregar condición WHERE**:
   - Columna: `users.active`
   - Operador: `=`
   - Valor: `true`

5. **Agregar ordenamiento ORDER BY**:
   - Columna: `users.created_at`
   - Dirección: `DESC`

6. **Generar SQL** → Resultado:
```sql
SELECT "users"."id", "users"."name", "users"."email", "users"."created_at"
FROM "public"."users"
WHERE "users"."active" = TRUE
ORDER BY "users"."created_at" DESC;
```

---

## Escenario 2: Búsqueda Rápida con Command Palette

### Objetivo
Explorar rápidamente la tabla de productos.

### Con Command Palette (Ctrl+P)

1. **Abrir Command Palette**: `Ctrl+P`

2. **Buscar**: Escribir "prod"

3. **Resultados**:
   ```
   📘 public.products (Tabla • 15 columnas)
   📘 public.product_categories (Tabla • 8 columnas)
   👁️ public.products_view (Vista • 20 columnas)
   ```

4. **Seleccionar**: Navegar con `↓` y presionar `Enter`

5. **Resultado en editor**:
```sql
SELECT * FROM public.products
```

6. **Ejecutar**: `Ctrl+Enter`

---

## Escenario 3: JOIN entre Usuarios y Pedidos

### Objetivo
Obtener usuarios con sus pedidos, mostrando solo pedidos mayores a $100.

### Con Query Builder

1. **FROM**: `public.users`

2. **SELECT**:
   - `users.id`
   - `users.name`
   - `orders.id` (alias: `order_id`)
   - `orders.total`
   - `orders.created_at` (alias: `order_date`)

3. **JOIN**:
   - Tipo: `INNER JOIN`
   - Tabla: `public.orders`
   - ON: `users.id = orders.user_id`

4. **WHERE**:
   - Condición 1: `orders.total > 100`
   - Operador: `AND`
   - Condición 2: `orders.status = 'completed'`

5. **ORDER BY**:
   - `orders.created_at DESC`

6. **LIMIT**: `50`

7. **SQL Generado**:
```sql
SELECT "users"."id", "users"."name", "orders"."id" AS "order_id", "orders"."total", "orders"."created_at" AS "order_date"
FROM "public"."users"
INNER JOIN "public"."orders" ON "users"."id" = "orders"."user_id"
WHERE "orders"."total" > 100 AND "orders"."status" = 'completed'
ORDER BY "orders"."created_at" DESC
LIMIT 50;
```

---

## Escenario 4: Múltiples JOINs

### Objetivo
Obtener pedidos con información de usuario y productos.

### Con Query Builder

1. **FROM**: `public.orders`

2. **SELECT**:
   - `orders.id`
   - `users.name` (alias: `customer_name`)
   - `products.name` (alias: `product_name`)
   - `order_items.quantity`
   - `order_items.price`

3. **JOIN 1**:
   - Tipo: `INNER JOIN`
   - Tabla: `public.users`
   - ON: `orders.user_id = users.id`

4. **JOIN 2**:
   - Tipo: `INNER JOIN`
   - Tabla: `public.order_items`
   - ON: `orders.id = order_items.order_id`

5. **JOIN 3**:
   - Tipo: `INNER JOIN`
   - Tabla: `public.products`
   - ON: `order_items.product_id = products.id`

6. **WHERE**:
   - `orders.created_at > '2024-01-01'`

7. **SQL Generado**:
```sql
SELECT "orders"."id", "users"."name" AS "customer_name", "products"."name" AS "product_name", "order_items"."quantity", "order_items"."price"
FROM "public"."orders"
INNER JOIN "public"."users" ON "orders"."user_id" = "users"."id"
INNER JOIN "public"."order_items" ON "orders"."id" = "order_items"."order_id"
INNER JOIN "public"."products" ON "order_items"."product_id" = "products"."id"
WHERE "orders"."created_at" > '2024-01-01';
```

---

## Escenario 5: LEFT JOIN para Usuarios sin Pedidos

### Objetivo
Encontrar usuarios que NO han hecho pedidos.

### Con Query Builder

1. **FROM**: `public.users`

2. **SELECT**:
   - `users.id`
   - `users.name`
   - `users.email`

3. **JOIN**:
   - Tipo: `LEFT JOIN`
   - Tabla: `public.orders`
   - ON: `users.id = orders.user_id`

4. **WHERE**:
   - Columna: `orders.id`
   - Operador: `IS NULL`

5. **SQL Generado**:
```sql
SELECT "users"."id", "users"."name", "users"."email"
FROM "public"."users"
LEFT JOIN "public"."orders" ON "users"."id" = "orders"."user_id"
WHERE "orders"."id" IS NULL;
```

---

## Escenario 6: Búsqueda con IN

### Objetivo
Obtener productos de categorías específicas.

### Con Query Builder

1. **FROM**: `public.products`

2. **SELECT**: Todas las columnas (botón "Todas")

3. **WHERE**:
   - Columna: `products.category_id`
   - Operador: `IN`
   - Valores: `1, 2, 5, 8`

4. **SQL Generado**:
```sql
SELECT "products"."id", "products"."name", "products"."price", "products"."category_id"
FROM "public"."products"
WHERE "products"."category_id" IN (1, 2, 5, 8);
```

---

## Escenario 7: Búsqueda con LIKE

### Objetivo
Buscar usuarios cuyo nombre contenga "john".

### Con Query Builder

1. **FROM**: `public.users`

2. **SELECT**:
   - `users.id`
   - `users.name`
   - `users.email`

3. **WHERE**:
   - Columna: `users.name`
   - Operador: `LIKE`
   - Valor: `%john%`

4. **SQL Generado**:
```sql
SELECT "users"."id", "users"."name", "users"."email"
FROM "public"."users"
WHERE "users"."name" LIKE '%john%';
```

---

## Escenario 8: Condiciones Complejas con OR

### Objetivo
Obtener pedidos urgentes o de alto valor.

### Con Query Builder

1. **FROM**: `public.orders`

2. **SELECT**: Todas las columnas

3. **WHERE** (cambiar operador a OR):
   - Condición 1: `orders.priority = 'urgent'`
   - Operador: `OR`
   - Condición 2: `orders.total > 1000`

4. **SQL Generado**:
```sql
SELECT "orders"."id", "orders"."total", "orders"."priority", "orders"."status"
FROM "public"."orders"
WHERE "orders"."priority" = 'urgent' OR "orders"."total" > 1000;
```

---

## Escenario 9: Workflow Combinado

### Objetivo
Explorar una tabla desconocida y luego construir una query compleja.

### Paso 1: Exploración con Command Palette

1. `Ctrl+P`
2. Buscar "invoice"
3. Seleccionar `public.invoices`
4. Ejecutar `SELECT * FROM public.invoices` para ver estructura
5. Revisar columnas y datos

### Paso 2: Construcción con Query Builder

1. `Ctrl+Shift+B`
2. FROM: `public.invoices`
3. SELECT: Columnas relevantes basadas en la exploración
4. JOIN: Con `public.customers` si es necesario
5. WHERE: Filtros según necesidad
6. Generar SQL optimizado

---

## Escenario 10: Modificación Manual Post-Generación

### Objetivo
Usar Query Builder como punto de partida y refinar manualmente.

### Workflow

1. **Query Builder**: Construir query base
   ```sql
   SELECT "users"."id", "users"."name"
   FROM "public"."users"
   WHERE "users"."active" = TRUE;
   ```

2. **Modificación Manual**: Agregar funciones agregadas
   ```sql
   SELECT 
     "users"."id", 
     "users"."name",
     COUNT("orders"."id") AS order_count,
     SUM("orders"."total") AS total_spent
   FROM "public"."users"
   LEFT JOIN "public"."orders" ON "users"."id" = "orders"."user_id"
   WHERE "users"."active" = TRUE
   GROUP BY "users"."id", "users"."name"
   HAVING COUNT("orders"."id") > 5;
   ```

3. **Ejecutar**: `Ctrl+Enter`

---

## Tips y Trucos

### Query Builder

✅ **Usa el botón "Todas"** para seleccionar rápidamente todas las columnas de una tabla

✅ **Resetea con cuidado** - El botón de reset limpia todo el modelo

✅ **Alias de tablas** - Útil cuando haces self-joins o múltiples joins a la misma tabla

✅ **Validación visual** - Presta atención a los warnings amarillos

✅ **Modificación post-generación** - El SQL generado es editable, úsalo como base

### Command Palette

✅ **Búsqueda vacía** - Presiona `Ctrl+P` sin escribir para ver todas las tablas

✅ **Búsqueda por schema** - Escribe "public." para filtrar por schema

✅ **Navegación rápida** - Usa `↑↓` en lugar del mouse para mayor velocidad

✅ **Cierre rápido** - `Esc` cierra inmediatamente

### Combinación de Ambos

✅ **Exploración + Construcción**:
   1. `Ctrl+P` → Explorar tabla
   2. `Ctrl+Enter` → Ver datos
   3. `Ctrl+Shift+B` → Construir query compleja

✅ **Iteración rápida**:
   1. Query Builder → Generar base
   2. Modificar manualmente
   3. Ejecutar y refinar
   4. Repetir

---

## Atajos de Teclado Completos

| Atajo | Acción |
|-------|--------|
| `Ctrl+P` | Abrir Command Palette |
| `Ctrl+Shift+B` | Abrir Query Builder |
| `Ctrl+Enter` | Ejecutar query |
| `Esc` | Cerrar modales |
| `↑` / `↓` | Navegar en Command Palette |
| `Enter` | Seleccionar en Command Palette |

---

## Casos de Uso Avanzados (Futuro)

### GROUP BY con HAVING
```sql
-- Actualmente requiere modificación manual
SELECT "category", COUNT(*) as "count"
FROM "products"
GROUP BY "category"
HAVING COUNT(*) > 10;
```

### Subconsultas
```sql
-- Actualmente requiere modificación manual
SELECT *
FROM "users"
WHERE "id" IN (
  SELECT "user_id" 
  FROM "orders" 
  WHERE "total" > 1000
);
```

### CTEs (Common Table Expressions)
```sql
-- Actualmente requiere modificación manual
WITH active_users AS (
  SELECT * FROM "users" WHERE "active" = TRUE
)
SELECT * FROM active_users;
```

Estas funcionalidades podrían agregarse al Query Builder en futuras versiones.
