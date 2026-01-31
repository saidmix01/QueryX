# Implementación de Edición de Resultados

## Resumen

Se ha implementado la funcionalidad para editar registros directamente desde la tabla de resultados. La edición solo está disponible para queries SELECT simples de una sola tabla que tengan primary keys definidas.

## Características Implementadas

### 1. Análisis de Query Editable

**Archivo:** `src/utils/query-analyzer.ts`

La función `analyzeQueryEditability()` determina si una query es editable verificando:

✅ **Permitido:**
- SELECT simple de una sola tabla
- Con o sin WHERE clause
- Con o sin ORDER BY
- Con o sin LIMIT

❌ **No Permitido:**
- Queries con JOINs
- Queries con GROUP BY
- Queries con DISTINCT
- Queries con funciones de agregación (COUNT, SUM, AVG, MIN, MAX)
- Queries con UNION
- Queries que no sean SELECT

### 2. Detección de Primary Keys

El sistema automáticamente:
1. Analiza la query para extraer el nombre de la tabla
2. Consulta el schema para obtener las primary keys
3. Muestra un icono de llave (🔑) en las columnas que son primary key
4. Solo habilita el modo de edición si hay primary keys definidas

### 3. Modo de Edición

**Activación:**
- Botón "Edit Mode" en la barra de estado (solo visible si la query es editable)
- Se muestra el motivo si la query no es editable

**Funcionalidades:**
- **Editar celda**: Doble clic en cualquier celda
- **Guardar cambio**: Enter o perder foco
- **Cancelar edición**: Escape
- **Indicador visual**: Celdas modificadas se muestran en color matrix (verde)
- **Contador**: Muestra cuántas filas han sido modificadas
- **Confirmación**: Modal profesional antes de guardar cambios

### 4. Operaciones Disponibles

#### Editar Celdas
```typescript
// Doble clic en una celda para editarla
// Los cambios se marcan visualmente
// Se pueden editar múltiples celdas antes de guardar
```

#### Guardar Cambios
```typescript
// Botón "Save Changes" (solo activo si hay cambios)
// Muestra modal de confirmación con:
//   - Número de filas a actualizar
//   - SQL statements que se ejecutarán
//   - Advertencia sobre irreversibilidad
// Genera UPDATE statements automáticamente
// Usa primary keys en la cláusula WHERE
// Refresca los resultados después de guardar
```

#### Eliminar Fila
```typescript
// Click derecho en cualquier celda → "Delete Row"
// Muestra modal de confirmación con:
//   - Advertencia de eliminación permanente
//   - SQL DELETE statement que se ejecutará
//   - Botón rojo de confirmación
// Genera DELETE statement con WHERE usando primary keys
// Refresca los resultados después de eliminar
```

### 5. Generación de SQL

**UPDATE Statement:**
```sql
UPDATE "schema"."table"
SET "column1" = 'value1', "column2" = 'value2'
WHERE "id" = 123 AND "user_id" = 456;
```

**DELETE Statement:**
```sql
DELETE FROM "schema"."table"
WHERE "id" = 123 AND "user_id" = 456;
```

**Características:**
- Identifiers correctamente quoted según el motor (PostgreSQL: `"`, MySQL: `` ` ``)
- Valores escapados correctamente
- WHERE clause siempre incluye todas las primary keys
- Soporte para NULL values

### 6. Tipos de Datos Soportados

El sistema maneja automáticamente la conversión de tipos:

| Tipo SQL | Conversión |
|----------|------------|
| NULL | `NULL` o campo vacío |
| Boolean | `true`, `false`, `1`, `0`, `t`, `f` |
| Integer | Parsing automático |
| Float | Parsing automático con decimales |
| String | Texto directo |
| JSON | Parsing y validación JSON |
| Date/Time | Formato ISO |

### 7. Menú Contextual Mejorado

**Click derecho en una celda:**
- Copy Value
- View Full Content (para valores largos)
- **[Modo Edición]** Edit Cell
- **[Modo Edición]** Delete Row

### 8. Indicadores Visuales

**Status Bar:**
- Muestra si la query es editable
- Muestra el motivo si no es editable
- Contador de filas modificadas
- Botones de acción (Edit Mode, Save Changes, Cancel)

**Tabla:**
- 🔑 Icono en columnas primary key
- Fondo verde claro en filas modificadas
- Texto verde en celdas modificadas
- Input inline al editar

## Flujo de Uso

### Caso 1: Editar un Registro

1. Ejecutar query SELECT simple:
   ```sql
   SELECT * FROM users WHERE active = true;
   ```

2. Click en "Edit Mode"

3. Doble click en la celda que quieres editar

4. Modificar el valor y presionar Enter

5. Repetir para otras celdas si es necesario

6. Click en "Save Changes"

7. Los cambios se aplican y la tabla se refresca

### Caso 2: Eliminar un Registro

1. Estar en modo de edición

2. Click derecho en cualquier celda de la fila

3. Seleccionar "Delete Row"

4. Confirmar la eliminación

5. La fila se elimina y la tabla se refresca

### Caso 3: Query No Editable

```sql
-- ❌ No editable: tiene JOIN
SELECT u.*, o.total 
FROM users u 
JOIN orders o ON u.id = o.user_id;
```

**Resultado:** Muestra mensaje "Queries with JOINs cannot be edited"

## Seguridad

### Prevención de SQL Injection
- Todos los valores son escapados correctamente
- Uso de prepared statements implícito
- Validación de tipos de datos

### Validación de Primary Keys
- No se permite edición sin primary keys
- WHERE clause siempre incluye todas las PKs
- Previene actualizaciones masivas accidentales

### Confirmación de Operaciones Destructivas

#### Modal de Confirmación de Cambios (UPDATE)
Cuando el usuario hace clic en "Save Changes", se muestra un modal profesional con:

**Características:**
- 🟡 Icono de advertencia amarillo
- Contador de filas a actualizar
- Vista previa de todos los SQL statements
- Nota sobre irreversibilidad
- Botones claramente diferenciados (Cancel / Confirm & Save)

**Ejemplo:**
```
┌─────────────────────────────────────────┐
│ ⚠️  Confirm Changes                     │
├─────────────────────────────────────────┤
│ You are about to update 2 rows         │
│                                         │
│ SQL Statements to Execute:              │
│ ┌─────────────────────────────────────┐ │
│ │ UPDATE "users"                      │ │
│ │ SET "email" = 'new@email.com'       │ │
│ │ WHERE "id" = 123;                   │ │
│ │                                     │ │
│ │ UPDATE "users"                      │ │
│ │ SET "active" = FALSE                │ │
│ │ WHERE "id" = 456;                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ℹ️  These changes will be applied      │
│    immediately and cannot be undone.   │
│                                         │
│              [Cancel] [Confirm & Save]  │
└─────────────────────────────────────────┘
```

#### Modal de Confirmación de Eliminación (DELETE)
Cuando el usuario selecciona "Delete Row", se muestra un modal de advertencia con:

**Características:**
- 🔴 Diseño en rojo para enfatizar peligro
- Advertencia clara de eliminación permanente
- Vista previa del SQL DELETE statement
- Nota sobre irreversibilidad
- Botón rojo de confirmación

**Ejemplo:**
```
┌─────────────────────────────────────────┐
│ 🗑️  Confirm Delete                      │
├─────────────────────────────────────────┤
│ ⚠️  You are about to permanently       │
│    delete this row from the database.  │
│                                         │
│ SQL Statement to Execute:               │
│ ┌─────────────────────────────────────┐ │
│ │ DELETE FROM "users"                 │ │
│ │ WHERE "id" = 123;                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⚠️  This action cannot be undone.      │
│    Make sure you have backups.         │
│                                         │
│              [Cancel] [🗑️ Confirm Delete]│
└─────────────────────────────────────────┘
```

### Beneficios de los Modales
1. **Transparencia**: Usuario ve exactamente qué SQL se ejecutará
2. **Prevención de errores**: Doble confirmación antes de cambios
3. **Educación**: Usuario aprende SQL viendo los statements
4. **Seguridad**: Reduce accidentes y cambios no intencionados
5. **Profesionalismo**: UX pulida y confiable

## Limitaciones Conocidas

1. **Solo una tabla**: No soporta queries con múltiples tablas
2. **Primary keys requeridas**: La tabla debe tener PK definida
3. **Sin transacciones**: Cada UPDATE/DELETE es independiente
4. **Sin validación de constraints**: No valida foreign keys antes de guardar
5. **Sin undo**: Una vez guardado, no se puede deshacer (usar transacciones de DB)

## Mejoras Futuras

### Corto Plazo
- [ ] Validación de constraints antes de guardar
- [ ] Soporte para INSERT de nuevas filas
- [ ] Undo/Redo de cambios antes de guardar
- [ ] Edición de múltiples celdas con selección

### Mediano Plazo
- [ ] Transacciones: Guardar todos los cambios en una transacción
- [ ] Validación de foreign keys
- [ ] Autocompletado en celdas con FK
- [ ] Edición inline de JSON/Arrays

### Largo Plazo
- [ ] Soporte para views editables
- [ ] Edición de queries con JOINs (limitado)
- [ ] Historial de cambios
- [ ] Sincronización en tiempo real

## Ejemplos de Uso

### Ejemplo 1: Actualizar Email de Usuario

```sql
-- Query inicial
SELECT id, name, email, active FROM users WHERE id = 123;

-- Resultado:
-- id  | name      | email           | active
-- 123 | John Doe  | old@email.com   | true

-- Acciones:
-- 1. Click "Edit Mode"
-- 2. Doble click en celda "email"
-- 3. Cambiar a "new@email.com"
-- 4. Click "Save Changes"

-- SQL generado:
UPDATE "users"
SET "email" = 'new@email.com'
WHERE "id" = 123;
```

### Ejemplo 2: Desactivar Usuario

```sql
-- Query inicial
SELECT * FROM users WHERE name LIKE 'John%';

-- Acciones:
-- 1. Click "Edit Mode"
-- 2. Doble click en celda "active"
-- 3. Cambiar a "false"
-- 4. Click "Save Changes"

-- SQL generado:
UPDATE "users"
SET "active" = FALSE
WHERE "id" = 123;
```

### Ejemplo 3: Eliminar Registro

```sql
-- Query inicial
SELECT * FROM temp_data WHERE created_at < '2024-01-01';

-- Acciones:
-- 1. Click "Edit Mode"
-- 2. Click derecho en cualquier celda de la fila
-- 3. Seleccionar "Delete Row"
-- 4. Confirmar

-- SQL generado:
DELETE FROM "temp_data"
WHERE "id" = 456;
```

## Testing

### Casos de Prueba Recomendados

1. **Query editable simple**
   ```sql
   SELECT * FROM users LIMIT 10;
   ```
   ✅ Debe permitir edición

2. **Query con JOIN**
   ```sql
   SELECT u.*, o.total FROM users u JOIN orders o ON u.id = o.user_id;
   ```
   ❌ No debe permitir edición

3. **Query con GROUP BY**
   ```sql
   SELECT category, COUNT(*) FROM products GROUP BY category;
   ```
   ❌ No debe permitir edición

4. **Tabla sin primary key**
   ```sql
   SELECT * FROM logs;
   ```
   ❌ No debe permitir edición (si logs no tiene PK)

5. **Edición de NULL**
   - Cambiar valor a vacío → debe guardar como NULL
   - Escribir "NULL" → debe guardar como NULL

6. **Edición de tipos**
   - Boolean: "true", "false", "1", "0"
   - Integer: "123", "-456"
   - Float: "123.45", "-67.89"
   - JSON: '{"key": "value"}'

## Troubleshooting

### "Edit Mode button not visible"
**Causa:** Query no es editable
**Solución:** Verificar que sea SELECT simple de una tabla

### "Edit Mode button disabled"
**Causa:** Tabla no tiene primary keys
**Solución:** Agregar primary key a la tabla

### "Save Changes failed"
**Causa:** Error en UPDATE statement
**Solución:** Verificar permisos y constraints de la tabla

### "Changes not reflected"
**Causa:** Cache de resultados
**Solución:** La tabla se refresca automáticamente después de guardar

## Notas Técnicas

- **Performance**: Los UPDATEs se ejecutan secuencialmente (no en batch)
- **Concurrencia**: No hay lock optimista, última escritura gana
- **Memoria**: Los cambios se mantienen en memoria hasta guardar
- **Validación**: La validación de tipos es básica, confía en la DB para validación completa
