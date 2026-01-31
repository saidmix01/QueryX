# Ejemplos de Uso: Workspace y Consultas Guardadas

## Escenario 1: Desarrollador trabajando en múltiples features

### Situación
Juan está trabajando en 3 features diferentes que requieren consultas SQL distintas.

### Flujo de trabajo

1. **Lunes - Feature A (Usuarios)**
```sql
-- Pestaña 1: Análisis de usuarios activos
SELECT user_id, last_login, COUNT(*) as sessions
FROM user_sessions
WHERE last_login > NOW() - INTERVAL '30 days'
GROUP BY user_id, last_login;

-- Pestaña 2: Usuarios sin actividad
SELECT u.id, u.email, u.created_at
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id
WHERE s.id IS NULL;
```

2. **Cierra la aplicación** (fin del día)

3. **Martes - Reabre la aplicación**
   - ✅ Todas las pestañas se restauran automáticamente
   - ✅ El SQL está exactamente como lo dejó
   - ✅ No necesita buscar en el historial

4. **Guarda consultas útiles**
   - Click en "+ Guardar" en panel de Queries
   - Nombre: "Usuarios activos últimos 30 días"
   - Tags: `usuarios`, `activos`, `analytics`
   - Descripción: "Para dashboard de actividad"

5. **Miércoles - Feature B (Productos)**
   - Abre nuevas pestañas para productos
   - Las pestañas de usuarios siguen ahí
   - Puede cambiar entre features sin perder contexto

## Escenario 2: DBA haciendo mantenimiento

### Situación
María necesita ejecutar varias tareas de mantenimiento en diferentes bases de datos.

### Flujo de trabajo

1. **Conexión: Producción**
```sql
-- Pestaña 1: Análisis de índices
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Pestaña 2: Tablas grandes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

2. **Guarda consultas de mantenimiento**
   - "Índices no utilizados" → Tags: `mantenimiento`, `índices`
   - "Tablas más grandes" → Tags: `mantenimiento`, `espacio`

3. **Cambia a Conexión: Staging**
   - ✅ Las pestañas de Producción se guardan automáticamente
   - ✅ Se restauran las pestañas de Staging (si las había)
   - ✅ Cada conexión mantiene su propio workspace

4. **Vuelve a Producción**
   - ✅ Todas las pestañas de Producción vuelven a aparecer
   - ✅ Sin perder el trabajo

## Escenario 3: Analista de datos explorando datos

### Situación
Carlos está explorando datos para un reporte y necesita probar múltiples queries.

### Flujo de trabajo

1. **Exploración inicial**
```sql
-- Pestaña 1: Estructura de datos
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales';

-- Pestaña 2: Datos de muestra
SELECT * FROM sales LIMIT 100;

-- Pestaña 3: Agregaciones
SELECT 
  DATE_TRUNC('month', sale_date) as month,
  SUM(amount) as total_sales,
  COUNT(*) as num_sales
FROM sales
GROUP BY month
ORDER BY month DESC;
```

2. **Iteración rápida**
   - Modifica la Pestaña 3 varias veces
   - ✅ Cada cambio se guarda automáticamente
   - ✅ Si crashea la app, no pierde nada

3. **Guarda la query final**
   - Nombre: "Ventas mensuales agregadas"
   - Tags: `ventas`, `reporte`, `mensual`
   - Descripción: "Para reporte ejecutivo mensual"

4. **Próximo mes**
   - Abre "Ventas mensuales agregadas" desde el panel
   - Modifica fechas si es necesario
   - Ejecuta y exporta

## Escenario 4: Equipo compartiendo consultas

### Situación
Un equipo necesita estandarizar consultas comunes.

### Flujo de trabajo

1. **Lead crea consultas estándar**
```sql
-- Consulta guardada: "Usuarios nuevos por día"
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_users
FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

2. **Guarda con tags específicos**
   - Tags: `estándar`, `usuarios`, `kpi`
   - Descripción: "KPI diario - No modificar sin aprobación"

3. **Otros miembros del equipo**
   - Buscan por tag `estándar`
   - Abren la consulta
   - Ejecutan sin modificar

## Escenario 5: Recuperación de desastre

### Situación
La aplicación crashea inesperadamente.

### Flujo de trabajo

1. **Antes del crash**
   - 5 pestañas abiertas con SQL complejo
   - Trabajando en una query de 100 líneas
   - NO había guardado manualmente

2. **Crash de la aplicación**
   - Sistema operativo se congela
   - Kill forzado del proceso

3. **Reabre la aplicación**
   - ✅ Muestra "Restaurando sesión..."
   - ✅ Todas las 5 pestañas vuelven
   - ✅ La query de 100 líneas está completa
   - ✅ Puede continuar donde quedó

## Escenario 6: Trabajo con múltiples conexiones

### Situación
Ana trabaja con 3 bases de datos diferentes simultáneamente.

### Flujo de trabajo

1. **Conexión: DB Producción**
```sql
-- 3 pestañas con queries de monitoreo
SELECT * FROM active_sessions;
SELECT * FROM slow_queries;
SELECT * FROM error_log;
```

2. **Conexión: DB Desarrollo**
```sql
-- 2 pestañas con queries de testing
SELECT * FROM test_users;
INSERT INTO test_data VALUES (...);
```

3. **Conexión: DB Analytics**
```sql
-- 4 pestañas con queries de análisis
SELECT * FROM daily_metrics;
SELECT * FROM user_behavior;
```

4. **Cambia entre conexiones**
   - ✅ Cada conexión mantiene sus propias pestañas
   - ✅ No hay confusión entre workspaces
   - ✅ Puede trabajar en paralelo

## Escenario 7: Debugging de producción

### Situación
Problema urgente en producción, necesita investigar rápido.

### Flujo de trabajo

1. **Abre consultas guardadas de debugging**
   - Busca por tag `debugging`
   - Abre "Transacciones bloqueadas"
   - Abre "Queries lentas activas"
   - Abre "Conexiones activas"

2. **Ejecuta y analiza**
   - Todas las queries están listas
   - No pierde tiempo escribiendo
   - Puede enfocarse en el problema

3. **Guarda nueva query de debugging**
```sql
-- Nueva query útil encontrada
SELECT 
  pid, usename, application_name, state,
  query_start, state_change, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
```
   - Nombre: "Queries colgadas más de 5 minutos"
   - Tags: `debugging`, `performance`, `urgente`

## Escenario 8: Onboarding de nuevo desarrollador

### Situación
Nuevo desarrollador necesita familiarizarse con las queries comunes.

### Flujo de trabajo

1. **Mentor comparte consultas**
   - Muestra el panel de "Queries"
   - Explica los tags: `onboarding`, `básico`, `importante`

2. **Nuevo desarrollador explora**
   - Filtra por tag `onboarding`
   - Abre cada consulta en una pestaña
   - Lee y ejecuta para entender

3. **Guarda sus propias variaciones**
   - Modifica queries para su caso de uso
   - Guarda con sus propios tags
   - Construye su biblioteca personal

## Beneficios Demostrados

### ✅ Productividad
- No pierde tiempo reescribiendo queries
- Cambio rápido entre contextos
- Recuperación instantánea después de crashes

### ✅ Seguridad
- Queries complejas guardadas de forma segura
- No se pierden cambios no guardados
- Backup automático del trabajo

### ✅ Colaboración
- Queries estandarizadas compartibles
- Tags para organización en equipo
- Documentación integrada (descripciones)

### ✅ Mantenibilidad
- Queries de mantenimiento siempre disponibles
- Historial implícito (última actualización)
- Fácil de encontrar queries antiguas

## Tips y Mejores Prácticas

### 🎯 Naming Convention
```
[Área] - [Acción] - [Detalle]
Ejemplos:
- "Users - Active - Last 30 days"
- "Sales - Report - Monthly aggregated"
- "Debug - Slow queries - Production"
```

### 🏷️ Tag Strategy
```
Categorías sugeridas:
- Por área: users, sales, products, orders
- Por tipo: report, debug, maintenance, kpi
- Por urgencia: urgent, routine, optional
- Por ambiente: production, staging, development
```

### 📝 Description Guidelines
```
Incluir:
- Propósito de la query
- Cuándo usarla
- Notas importantes
- Autor/fecha si es relevante

Ejemplo:
"Query para dashboard ejecutivo. 
Ejecutar al inicio de cada mes.
Nota: Puede tardar 2-3 minutos en producción."
```

### 🔄 Workspace Management
```
- Cerrar pestañas que no usas (se guardan igual)
- Renombrar pestañas con nombres descriptivos
- Agrupar pestañas relacionadas
- Usar una pestaña por feature/tarea
```
