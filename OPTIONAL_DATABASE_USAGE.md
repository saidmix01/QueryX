# Guía de Uso: Conexión con Base de Datos Opcional

## Casos de Uso

### 1. Explorar Servidor PostgreSQL Completo

**Escenario:** Quieres ver todas las bases de datos en un servidor PostgreSQL sin saber cuál necesitas.

**Pasos:**
1. Crear nueva conexión
2. Llenar campos:
   - **Name:** "Production PostgreSQL"
   - **Engine:** PostgreSQL
   - **Host:** `prod.example.com`
   - **Port:** `5432`
   - **Database:** *(dejar vacío)*
   - **Username:** `admin`
   - **Password:** `***`
3. Guardar y conectar

**Resultado:**
```
Production PostgreSQL
├── postgres (system)
├── template0 (system)
├── template1 (system)
├── app_production
├── analytics_db
├── logs_db
└── reporting_db
```

**Beneficio:** Puedes explorar cualquier database sin crear múltiples conexiones.

---

### 2. Administrador de MySQL/MariaDB

**Escenario:** Eres DBA y necesitas gestionar múltiples bases de datos en el mismo servidor.

**Pasos:**
1. Crear conexión sin database específica
2. Conectar al servidor
3. Ver todas las databases disponibles
4. Hacer clic en cualquier database para ver su estructura

**Ejemplo:**
```
MySQL Server
├── information_schema (system)
├── mysql (system)
├── performance_schema (system)
├── sys (system)
├── customer_db
├── orders_db
├── inventory_db
└── users_db
```

**Ventaja:** Un solo punto de acceso para todo el servidor.

---

### 3. Desarrollo con Múltiples Databases

**Escenario:** Tu aplicación usa múltiples databases (microservicios) en el mismo servidor.

**Configuración:**
```typescript
{
  name: "Microservices Dev",
  engine: "postgresql",
  host: "localhost",
  port: 5432,
  database: undefined, // Sin database específica
  username: "dev_user"
}
```

**Workflow:**
1. Conectar una vez
2. Explorar `auth_service_db`
3. Explorar `payment_service_db`
4. Explorar `notification_service_db`
5. Ejecutar queries en cualquiera sin cambiar conexión

---

### 4. Migración de Datos entre Databases

**Escenario:** Necesitas copiar datos de una database a otra en el mismo servidor.

**Setup:**
```
Server Connection (sin database)
├── source_db
│   └── public
│       └── users (tabla)
└── target_db
    └── public
        └── users (tabla vacía)
```

**Query:**
```sql
-- Ver datos en source_db
SELECT * FROM source_db.public.users;

-- Copiar a target_db
INSERT INTO target_db.public.users
SELECT * FROM source_db.public.users;
```

---

### 5. Auditoría y Monitoreo

**Escenario:** Necesitas verificar el estado de todas las databases en un servidor.

**Queries útiles:**

**PostgreSQL:**
```sql
-- Ver tamaño de todas las databases
SELECT 
    datname as database,
    pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datistemplate = false
ORDER BY pg_database_size(datname) DESC;

-- Ver conexiones activas por database
SELECT 
    datname,
    count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

**MySQL:**
```sql
-- Ver tamaño de todas las databases
SELECT 
    table_schema as database,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
FROM information_schema.tables
GROUP BY table_schema
ORDER BY size_mb DESC;
```

---

## Comparación: Con vs Sin Database

### Modo Tradicional (Con Database)

**Conexión:**
```typescript
{
  name: "App Database",
  database: "myapp_db" // ← Específica
}
```

**Explorer:**
```
App Database
└── myapp_db
    ├── public
    │   ├── Tables
    │   └── Views
    └── other_schema
```

**Limitación:** Solo puedes ver `myapp_db`. Para ver otra database necesitas crear otra conexión.

---

### Modo Nuevo (Sin Database)

**Conexión:**
```typescript
{
  name: "App Server",
  database: undefined // ← Sin especificar
}
```

**Explorer:**
```
App Server
├── myapp_db
├── myapp_test
├── myapp_staging
└── myapp_analytics
```

**Ventaja:** Acceso a todas las databases con una sola conexión.

---

## Casos Especiales

### SQLite (Database Obligatoria)

SQLite **requiere** especificar el archivo de database:

```typescript
{
  name: "Local SQLite",
  engine: "sqlite",
  database: "/path/to/database.db", // ← Obligatorio
  file_path: "/path/to/database.db"
}
```

**Razón:** SQLite es un archivo único, no un servidor con múltiples databases.

---

### Filtrar Databases del Sistema

Si quieres ocultar databases del sistema (postgres, mysql, information_schema, etc.), puedes:

1. Usar el filtro en el explorer (futuro)
2. O crear queries específicas:

```sql
-- PostgreSQL: Solo databases de usuario
SELECT datname 
FROM pg_database 
WHERE datistemplate = false 
  AND datname NOT IN ('postgres', 'template0', 'template1');

-- MySQL: Solo databases de usuario
SHOW DATABASES 
WHERE `Database` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys');
```

---

## Tips y Mejores Prácticas

### 1. Nombrado de Conexiones

**❌ Mal:**
```
"Database 1"
"Database 2"
```

**✅ Bien:**
```
"Production Server (All DBs)"
"Dev Server (All DBs)"
"Staging PostgreSQL"
```

### 2. Organización

Si tienes muchas databases, considera:
- Usar prefijos: `app_`, `service_`, `analytics_`
- Agrupar por entorno: `prod_*`, `dev_*`, `test_*`

### 3. Permisos

Asegúrate de que el usuario tenga permisos para:
- Listar databases: `SHOW DATABASES` (MySQL) o acceso a `pg_database` (PostgreSQL)
- Acceder a las databases que necesitas explorar

### 4. Performance

- El listado de databases se cachea por 5 minutos
- No se cargan schemas hasta que expandas una database
- Usa refresh manual si necesitas actualizar la lista

---

## Troubleshooting

### "No databases shown"

**Posibles causas:**
1. Usuario sin permisos para listar databases
2. Servidor no permite conexiones sin database (raro)
3. Error de conexión

**Solución:**
```sql
-- PostgreSQL: Verificar permisos
SELECT has_database_privilege('datname', 'CONNECT');

-- MySQL: Verificar permisos
SHOW GRANTS FOR CURRENT_USER;
```

### "Connection failed"

**PostgreSQL:**
- Asegúrate de que el servidor permita conexiones a `postgres` database
- Verifica `pg_hba.conf` para permisos de acceso

**MySQL:**
- MySQL permite conexiones sin database por defecto
- Verifica usuario y password

### "SQLite requires database path"

**Solución:** SQLite siempre requiere especificar el archivo:
```typescript
{
  engine: "sqlite",
  file_path: "/path/to/file.db" // ← Obligatorio
}
```

---

## Ejemplos de Queries Cross-Database

### PostgreSQL

```sql
-- Copiar tabla entre databases
CREATE TABLE target_db.public.users AS 
SELECT * FROM source_db.public.users;

-- Join entre databases
SELECT 
    u.name,
    o.total
FROM users_db.public.users u
JOIN orders_db.public.orders o ON u.id = o.user_id;
```

### MySQL

```sql
-- Copiar datos entre databases
INSERT INTO target_db.users
SELECT * FROM source_db.users;

-- Comparar schemas
SELECT 
    table_schema,
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema IN ('db1', 'db2')
ORDER BY table_schema, table_name;
```

---

## Próximas Funcionalidades

### En Desarrollo
- [ ] Cambiar database activa sin reconectar
- [ ] Filtro de databases del sistema
- [ ] Indicador visual de database activa
- [ ] Búsqueda de databases por nombre

### Futuro
- [ ] Favoritos de databases
- [ ] Agrupación de databases por tags
- [ ] Comparación de schemas entre databases
- [ ] Sincronización de estructuras

---

## Feedback

Si encuentras problemas o tienes sugerencias, por favor reporta:
- Comportamiento inesperado
- Casos de uso no cubiertos
- Mejoras de UX
