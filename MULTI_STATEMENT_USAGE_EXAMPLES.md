# Ejemplos de Uso - Ejecución Multi-Statement

## 🎯 Casos de Uso

### 1. Ejecutar Statement Actual (Ctrl+Enter)

Cuando tienes múltiples queries en el editor y solo quieres ejecutar una:

```sql
-- Query 1: Obtener usuarios activos
SELECT * FROM users WHERE active = true;

-- Query 2: Obtener pedidos recientes
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '7 days';

-- Query 3: Estadísticas de ventas
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_orders,
  SUM(total_amount) as revenue
FROM orders
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Acción:** Posiciona el cursor en cualquier parte de la Query 2 y presiona `Ctrl+Enter`

**Resultado:** Solo se ejecuta la Query 2, los resultados aparecen en la tabla de resultados normal.

---

### 2. Ejecutar Todos los Statements (Ctrl+Shift+Enter)

Cuando quieres ejecutar todas las queries en secuencia:

```sql
-- Preparar datos de prueba
INSERT INTO users (name, email, active) 
VALUES ('Test User', 'test@example.com', true);

-- Verificar inserción
SELECT * FROM users WHERE email = 'test@example.com';

-- Actualizar datos
UPDATE users SET last_login = NOW() WHERE email = 'test@example.com';

-- Verificar actualización
SELECT name, email, last_login FROM users WHERE email = 'test@example.com';
```

**Acción:** Presiona `Ctrl+Shift+Enter`

**Resultado:** 
- Se ejecutan los 4 statements en orden
- Aparece una vista con lista de resultados
- Puedes navegar entre cada resultado
- Cada statement muestra su estado (✓ success / ✗ error)

---

### 3. Script de Migración

```sql
-- Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100),
  action VARCHAR(50),
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índice
CREATE INDEX idx_audit_log_table ON audit_log(table_name);

-- Insertar registro inicial
INSERT INTO audit_log (table_name, action, user_id)
VALUES ('audit_log', 'created', 1);

-- Verificar creación
SELECT * FROM audit_log;
```

**Resultado:**
- Statement 1: CREATE TABLE (success, 0 rows affected)
- Statement 2: CREATE INDEX (success, 0 rows affected)
- Statement 3: INSERT (success, 1 row affected)
- Statement 4: SELECT (success, muestra la tabla con datos)

---

### 4. Análisis de Datos Multi-Paso

```sql
-- Paso 1: Usuarios más activos
SELECT 
  user_id,
  COUNT(*) as order_count,
  SUM(total_amount) as total_spent
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_spent DESC
LIMIT 10;

-- Paso 2: Productos más vendidos
SELECT 
  p.name,
  COUNT(oi.id) as times_sold,
  SUM(oi.quantity) as total_quantity
FROM order_items oi
JOIN products p ON oi.product_id = p.id
WHERE oi.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name
ORDER BY times_sold DESC
LIMIT 10;

-- Paso 3: Ingresos por categoría
SELECT 
  c.name as category,
  COUNT(DISTINCT o.id) as order_count,
  SUM(o.total_amount) as revenue
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
JOIN categories c ON p.category_id = c.id
WHERE o.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name
ORDER BY revenue DESC;
```

**Resultado:**
- 3 tabs de resultados independientes
- Puedes comparar datos entre tabs
- Cada query tiene su propio tiempo de ejecución

---

### 5. Manejo de Errores

```sql
-- Query válida
SELECT * FROM users LIMIT 5;

-- Query con error (tabla no existe)
SELECT * FROM non_existent_table;

-- Query válida
SELECT COUNT(*) FROM users;
```

**Resultado:**
- Statement 1: ✓ Success (muestra 5 usuarios)
- Statement 2: ✗ Error (muestra mensaje de error detallado)
- Statement 3: ✓ Success (muestra el count)

**Nota:** Los statements se ejecutan independientemente. Si uno falla, los demás continúan.

---

## 🎨 Interfaz de Usuario

### Vista de Resultados Múltiples

```
┌─────────────────────────────────────────────────────────┐
│ ✓ 3 succeeded  ✗ 1 failed  ⏱ Total: 245ms             │
├──────────────┬──────────────────────────────────────────┤
│ Statements   │ Result Details                           │
│              │                                          │
│ ✓ Statement 1│ ┌──────────────────────────────────────┐│
│   SELECT...  │ │ Statement 1                          ││
│   125ms      │ │ SELECT * FROM users LIMIT 5;         ││
│              │ ├──────────────────────────────────────┤│
│ ✗ Statement 2│ │ [Table with 5 rows]                  ││
│   SELECT...  │ │                                      ││
│   15ms       │ │ id │ name    │ email              ││
│              │ │ 1  │ John    │ john@example.com   ││
│ ✓ Statement 3│ │ 2  │ Jane    │ jane@example.com   ││
│   UPDATE...  │ │ ...                                  ││
│   85ms       │ └──────────────────────────────────────┘│
│              │                                          │
│ ✓ Statement 4│                                          │
│   SELECT...  │                                          │
│   20ms       │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Indicadores Visuales

- **✓ Verde:** Statement ejecutado exitosamente
- **✗ Rojo:** Statement con error
- **Tiempo:** Tiempo de ejecución individual
- **Resumen:** Total de éxitos/errores y tiempo total

---

## 🔒 Seguridad y Transacciones

### Operaciones Destructivas (Futuro)

Cuando se implemente la edición de tablas, las operaciones UPDATE/DELETE mostrarán un modal de confirmación:

```sql
-- Generado automáticamente al editar una celda
UPDATE users 
SET email = 'newemail@example.com' 
WHERE id = 42;
```

**Modal de Confirmación:**
```
┌─────────────────────────────────────────────────┐
│ ⚠️  Confirm UPDATE Operation                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ ⚠️  Warnings:                                   │
│   • This will affect 1 row                     │
│                                                 │
│ SQL Statement:                                  │
│ ┌─────────────────────────────────────────────┐│
│ │ UPDATE users                                ││
│ │ SET email = 'newemail@example.com'          ││
│ │ WHERE id = 42;                              ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ Estimated affected rows: 1                      │
│                                                 │
│         [Cancel]  [⚠️  Execute UPDATE]          │
└─────────────────────────────────────────────────┘
```

---

## 💡 Tips y Mejores Prácticas

### 1. Organiza tus Queries con Comentarios

```sql
-- ============================================
-- SECCIÓN: Análisis de Usuarios
-- ============================================

-- Usuarios activos en los últimos 30 días
SELECT COUNT(*) FROM users 
WHERE last_login > NOW() - INTERVAL '30 days';

-- Usuarios inactivos
SELECT COUNT(*) FROM users 
WHERE last_login < NOW() - INTERVAL '90 days';

-- ============================================
-- SECCIÓN: Análisis de Ventas
-- ============================================

-- Ventas del mes actual
SELECT SUM(total_amount) FROM orders 
WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW());
```

### 2. Usa Transacciones para Operaciones Relacionadas

```sql
BEGIN;

UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
INSERT INTO transactions (from_account, to_account, amount) 
VALUES (1, 2, 100);

COMMIT;
```

**Nota:** Ejecuta esto como un solo statement (Ctrl+Enter) para mantener la transacción.

### 3. Debugging de Queries Complejas

```sql
-- Query compleja dividida en pasos

-- Paso 1: Ver datos base
SELECT * FROM orders WHERE user_id = 123;

-- Paso 2: Agregar JOIN
SELECT o.*, u.name 
FROM orders o 
JOIN users u ON o.user_id = u.id 
WHERE o.user_id = 123;

-- Paso 3: Agregar agregaciones
SELECT 
  u.name,
  COUNT(o.id) as order_count,
  SUM(o.total_amount) as total_spent
FROM orders o 
JOIN users u ON o.user_id = u.id 
WHERE o.user_id = 123
GROUP BY u.id, u.name;
```

Ejecuta cada paso individualmente (Ctrl+Enter) para verificar los resultados.

### 4. Scripts de Mantenimiento

```sql
-- Limpiar datos antiguos
DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Verificar eliminación
SELECT COUNT(*) FROM logs;

-- Vacuum (PostgreSQL)
VACUUM ANALYZE logs;

-- Verificar tamaño de tabla
SELECT pg_size_pretty(pg_total_relation_size('logs'));
```

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl+Enter` | Ejecutar statement actual |
| `Ctrl+Shift+Enter` | Ejecutar todos los statements |
| `Ctrl+P` | Abrir Command Palette |
| `Ctrl+Shift+B` | Abrir Query Builder |
| `Ctrl+/` | Comentar/descomentar línea |

---

## 🐛 Solución de Problemas

### Problema: "No se detectan múltiples statements"

**Causa:** Falta el `;` al final de cada statement

**Solución:**
```sql
-- ❌ Incorrecto
SELECT * FROM users
SELECT * FROM orders

-- ✓ Correcto
SELECT * FROM users;
SELECT * FROM orders;
```

### Problema: "Error en un statement detiene la ejecución"

**Respuesta:** Esto es el comportamiento esperado. Cada statement se ejecuta independientemente. Si uno falla, los demás continúan ejecutándose.

### Problema: "El parser divide incorrectamente mi query"

**Causa:** Uso de `;` dentro de strings o funciones

**Ejemplo:**
```sql
-- El parser maneja esto correctamente
SELECT 'Este texto tiene ; un punto y coma' as texto;
SELECT * FROM users;
```

El parser ignora el `;` dentro de las comillas.

---

## 📊 Métricas de Rendimiento

Cada statement muestra:
- **Tiempo de ejecución individual:** Cuánto tardó ese statement específico
- **Filas afectadas:** Para INSERT/UPDATE/DELETE
- **Número de filas:** Para SELECT
- **Tiempo total:** Suma de todos los tiempos de ejecución

Esto te ayuda a identificar queries lentas en scripts complejos.
