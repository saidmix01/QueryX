# 🧪 Guía de Pruebas - Query Builder & Command Palette

## 🚀 Inicio Rápido

### 1. Iniciar la Aplicación

```bash
# Modo desarrollo
npm run tauri dev

# O compilar para producción
npm run tauri build
```

### 2. Conectar a una Base de Datos

1. Abrir la aplicación
2. Hacer clic en "New Connection"
3. Configurar conexión (PostgreSQL, MySQL o SQLite)
4. Conectar

---

## ✅ Test Suite - Command Palette (Ctrl+P)

### Test 1: Apertura Básica
**Objetivo**: Verificar que el Command Palette se abre correctamente

**Pasos**:
1. Presionar `Ctrl+P`
2. Verificar que aparece el modal centrado
3. Verificar que el input tiene foco automático
4. Presionar `Esc`
5. Verificar que el modal se cierra

**Resultado Esperado**: ✅ Modal se abre y cierra correctamente

---

### Test 2: Búsqueda Sin Query
**Objetivo**: Verificar que muestra todas las tablas cuando no hay búsqueda

**Pasos**:
1. Presionar `Ctrl+P`
2. NO escribir nada
3. Observar la lista de resultados

**Resultado Esperado**: ✅ Muestra todas las tablas y vistas disponibles

---

### Test 3: Búsqueda Fuzzy
**Objetivo**: Verificar que la búsqueda fuzzy funciona correctamente

**Pasos**:
1. Presionar `Ctrl+P`
2. Escribir "user"
3. Observar resultados filtrados
4. Escribir "usr"
5. Observar que sigue mostrando "users"

**Resultado Esperado**: ✅ Búsqueda fuzzy funciona, encuentra coincidencias parciales

---

### Test 4: Navegación por Teclado
**Objetivo**: Verificar navegación con flechas

**Pasos**:
1. Presionar `Ctrl+P`
2. Presionar `↓` varias veces
3. Verificar que la selección se mueve
4. Presionar `↑` varias veces
5. Verificar que la selección retrocede
6. Verificar scroll automático

**Resultado Esperado**: ✅ Navegación fluida, scroll automático funciona

---

### Test 5: Selección e Inserción
**Objetivo**: Verificar que inserta SQL correctamente

**Pasos**:
1. Presionar `Ctrl+P`
2. Buscar una tabla (ej: "users")
3. Presionar `Enter`
4. Verificar que se inserta `SELECT * FROM schema.tabla` en el editor

**Resultado Esperado**: ✅ SQL insertado correctamente en el editor activo

---

### Test 6: Diferenciación Tabla/Vista
**Objetivo**: Verificar iconos y colores diferentes

**Pasos**:
1. Presionar `Ctrl+P`
2. Observar los iconos:
   - 📘 Azul para tablas
   - 👁️ Morado para vistas
3. Verificar que el texto dice "Tabla" o "Vista"

**Resultado Esperado**: ✅ Diferenciación visual clara

---

### Test 7: Contador de Resultados
**Objetivo**: Verificar que el contador funciona

**Pasos**:
1. Presionar `Ctrl+P`
2. Observar el footer: "X resultados"
3. Escribir algo para filtrar
4. Verificar que el contador se actualiza

**Resultado Esperado**: ✅ Contador actualizado en tiempo real

---

### Test 8: Límite de Resultados
**Objetivo**: Verificar que limita a 50 resultados

**Pasos**:
1. Conectar a una BD con más de 50 tablas
2. Presionar `Ctrl+P`
3. Verificar que muestra máximo 50 resultados

**Resultado Esperado**: ✅ Máximo 50 resultados mostrados

---

## ✅ Test Suite - Query Builder (Ctrl+Shift+B)

### Test 9: Apertura Básica
**Objetivo**: Verificar que el Query Builder se abre correctamente

**Pasos**:
1. Presionar `Ctrl+Shift+B`
2. Verificar que aparece el modal grande
3. Verificar que muestra las secciones numeradas (1, 2, 3...)
4. Presionar `Esc` o botón X
5. Verificar que se cierra

**Resultado Esperado**: ✅ Modal se abre y cierra correctamente

---

### Test 10: Selección de Tabla FROM
**Objetivo**: Verificar selección de tabla principal

**Pasos**:
1. Abrir Query Builder
2. En sección "1. Tabla Principal (FROM)":
   - Buscar "users"
   - Seleccionar una tabla
3. Verificar que muestra la tabla seleccionada
4. Hacer clic en "Cambiar"
5. Verificar que puede cambiar la tabla

**Resultado Esperado**: ✅ Selección y cambio de tabla funciona

---

### Test 11: Selección de Columnas SELECT
**Objetivo**: Verificar selección múltiple de columnas

**Pasos**:
1. Seleccionar tabla FROM
2. En sección "2. Columnas (SELECT)":
   - Marcar varias columnas con checkboxes
   - Verificar que se marcan visualmente
   - Desmarcar algunas
   - Verificar que se desmarcan
3. Hacer clic en botón "Todas"
4. Verificar que selecciona todas las columnas

**Resultado Esperado**: ✅ Selección múltiple funciona, botón "Todas" funciona

---

### Test 12: Validación de Columnas
**Objetivo**: Verificar warning cuando no hay columnas

**Pasos**:
1. Seleccionar tabla FROM
2. NO seleccionar ninguna columna
3. Observar warning amarillo: "⚠ Selecciona al menos una columna"

**Resultado Esperado**: ✅ Warning visible cuando no hay columnas

---

### Test 13: Agregar JOIN Simple
**Objetivo**: Verificar creación de JOIN

**Pasos**:
1. Seleccionar tabla FROM (ej: "users")
2. Seleccionar algunas columnas
3. En sección "3. Uniones (JOIN)":
   - Hacer clic en "Agregar JOIN"
   - Seleccionar tipo: INNER JOIN
   - Seleccionar tabla: "orders"
   - Seleccionar columna izquierda: "users.id"
   - Seleccionar columna derecha: "user_id"
   - Hacer clic en "Agregar"
4. Verificar que el JOIN aparece en la lista

**Resultado Esperado**: ✅ JOIN creado y visible

---

### Test 14: Múltiples JOINs
**Objetivo**: Verificar múltiples JOINs

**Pasos**:
1. Crear un JOIN (como en Test 13)
2. Agregar otro JOIN con otra tabla
3. Verificar que ambos aparecen en la lista
4. Eliminar uno con el botón de basura
5. Verificar que se elimina

**Resultado Esperado**: ✅ Múltiples JOINs funcionan, eliminación funciona

---

### Test 15: Tipos de JOIN
**Objetivo**: Verificar todos los tipos de JOIN

**Pasos**:
1. Crear JOINs con cada tipo:
   - INNER JOIN
   - LEFT JOIN
   - RIGHT JOIN
   - FULL JOIN
2. Verificar que cada uno se muestra correctamente

**Resultado Esperado**: ✅ Todos los tipos de JOIN disponibles

---

### Test 16: Condición WHERE Simple
**Objetivo**: Verificar creación de condición WHERE

**Pasos**:
1. Configurar FROM y SELECT
2. En sección "4. Condiciones (WHERE)":
   - Hacer clic en "Agregar Condición"
   - Seleccionar columna: "users.active"
   - Seleccionar operador: "="
   - Ingresar valor: "true"
   - Hacer clic en "Agregar"
3. Verificar que la condición aparece

**Resultado Esperado**: ✅ Condición WHERE creada

---

### Test 17: Operadores WHERE
**Objetivo**: Verificar todos los operadores

**Pasos**:
1. Crear condiciones con cada operador:
   - = (igual)
   - != (diferente)
   - > (mayor)
   - < (menor)
   - >= (mayor o igual)
   - <= (menor o igual)
   - LIKE
   - IN
   - IS NULL
   - IS NOT NULL
2. Verificar que cada uno funciona

**Resultado Esperado**: ✅ Todos los operadores disponibles y funcionales

---

### Test 18: Operador IN
**Objetivo**: Verificar operador IN con múltiples valores

**Pasos**:
1. Agregar condición WHERE
2. Seleccionar operador: "IN"
3. Ingresar valores separados por coma: "1, 2, 3, 4"
4. Agregar condición
5. Verificar que muestra: `column IN (1, 2, 3, 4)`

**Resultado Esperado**: ✅ Operador IN funciona con múltiples valores

---

### Test 19: Operadores Lógicos AND/OR
**Objetivo**: Verificar toggle entre AND y OR

**Pasos**:
1. Agregar 2 o más condiciones WHERE
2. Observar botón de operador lógico (AND por defecto)
3. Hacer clic en el botón
4. Verificar que cambia a OR
5. Hacer clic de nuevo
6. Verificar que vuelve a AND

**Resultado Esperado**: ✅ Toggle AND/OR funciona

---

### Test 20: ORDER BY
**Objetivo**: Verificar ordenamiento

**Pasos**:
1. Configurar FROM y SELECT
2. En sección "5. Ordenamiento (ORDER BY)":
   - Agregar ordenamiento
   - Seleccionar columna
   - Seleccionar dirección: ASC
   - Agregar
3. Hacer clic en el botón de flecha
4. Verificar que cambia a DESC
5. Agregar otro ordenamiento
6. Verificar que ambos aparecen

**Resultado Esperado**: ✅ ORDER BY funciona, toggle ASC/DESC funciona

---

### Test 21: LIMIT
**Objetivo**: Verificar límite de resultados

**Pasos**:
1. Configurar FROM y SELECT
2. En sección "6. Límite (LIMIT)":
   - Ingresar número: 100
3. Verificar que acepta el valor

**Resultado Esperado**: ✅ LIMIT funciona

---

### Test 22: Generación SQL - PostgreSQL
**Objetivo**: Verificar SQL generado para PostgreSQL

**Pasos**:
1. Conectar a PostgreSQL
2. Configurar query completo:
   - FROM: public.users
   - SELECT: id, name, email
   - WHERE: active = true
   - ORDER BY: created_at DESC
   - LIMIT: 10
3. Hacer clic en "Generar SQL"
4. Verificar SQL en editor:
```sql
SELECT "users"."id", "users"."name", "users"."email"
FROM "public"."users"
WHERE "users"."active" = TRUE
ORDER BY "users"."created_at" DESC
LIMIT 10;
```

**Resultado Esperado**: ✅ SQL correcto con comillas dobles

---

### Test 23: Generación SQL - MySQL
**Objetivo**: Verificar SQL generado para MySQL

**Pasos**:
1. Conectar a MySQL
2. Configurar query similar al Test 22
3. Generar SQL
4. Verificar que usa backticks: `` `tabla`.`columna` ``

**Resultado Esperado**: ✅ SQL correcto con backticks

---

### Test 24: Generación SQL - SQLite
**Objetivo**: Verificar SQL generado para SQLite

**Pasos**:
1. Conectar a SQLite
2. Configurar query similar al Test 22
3. Generar SQL
4. Verificar que usa comillas dobles

**Resultado Esperado**: ✅ SQL correcto con comillas dobles

---

### Test 25: Reset Query Builder
**Objetivo**: Verificar reset del builder

**Pasos**:
1. Configurar un query completo
2. Hacer clic en botón de basura (Reset)
3. Confirmar en el diálogo
4. Verificar que todo se limpia

**Resultado Esperado**: ✅ Reset funciona, requiere confirmación

---

### Test 26: Validación de Query Incompleto
**Objetivo**: Verificar que no permite generar SQL incompleto

**Pasos**:
1. Seleccionar solo tabla FROM
2. NO seleccionar columnas
3. Intentar hacer clic en "Generar SQL"
4. Verificar que el botón está deshabilitado
5. Observar warning: "⚠ Selecciona una tabla y al menos una columna"

**Resultado Esperado**: ✅ Validación funciona, botón deshabilitado

---

## ✅ Test Suite - Integración

### Test 27: Workflow Completo
**Objetivo**: Verificar workflow completo Command Palette → Query Builder

**Pasos**:
1. Presionar `Ctrl+P`
2. Buscar y seleccionar tabla "users"
3. Verificar SQL insertado: `SELECT * FROM users`
4. Ejecutar con `Ctrl+Enter`
5. Ver resultados
6. Presionar `Ctrl+Shift+B`
7. Construir query más compleja
8. Generar SQL
9. Ejecutar con `Ctrl+Enter`

**Resultado Esperado**: ✅ Workflow completo funciona sin problemas

---

### Test 28: Modificación Manual Post-Generación
**Objetivo**: Verificar que el SQL generado es editable

**Pasos**:
1. Generar SQL con Query Builder
2. Modificar manualmente el SQL en el editor
3. Agregar funciones, comentarios, etc.
4. Ejecutar con `Ctrl+Enter`

**Resultado Esperado**: ✅ SQL editable y ejecutable

---

### Test 29: Múltiples Tabs
**Objetivo**: Verificar que funciona con múltiples tabs

**Pasos**:
1. Abrir varios tabs de query
2. En tab 1: Usar Command Palette
3. Verificar que inserta en tab 1
4. Cambiar a tab 2
5. Usar Query Builder
6. Verificar que inserta en tab 2

**Resultado Esperado**: ✅ Funciona correctamente con múltiples tabs

---

### Test 30: Reconexión
**Objetivo**: Verificar que funciona después de reconectar

**Pasos**:
1. Desconectar de la BD
2. Intentar abrir Command Palette
3. Reconectar a la BD
4. Usar Command Palette
5. Usar Query Builder

**Resultado Esperado**: ✅ Funciona correctamente después de reconectar

---

## 🐛 Casos Edge

### Edge Case 1: Tabla Sin Columnas
**Pasos**:
1. Conectar a BD con tabla vacía (sin columnas)
2. Intentar usar en Query Builder

**Resultado Esperado**: ✅ Maneja gracefully, muestra mensaje apropiado

---

### Edge Case 2: Nombres con Caracteres Especiales
**Pasos**:
1. Tabla con nombre: `user-data` o `user data`
2. Usar en Query Builder
3. Generar SQL
4. Verificar que escapa correctamente

**Resultado Esperado**: ✅ Escapa correctamente caracteres especiales

---

### Edge Case 3: Schemas Múltiples
**Pasos**:
1. Conectar a BD con múltiples schemas
2. Usar Command Palette
3. Verificar que muestra schema.tabla
4. Usar Query Builder
5. Verificar que incluye schema en SQL

**Resultado Esperado**: ✅ Maneja múltiples schemas correctamente

---

### Edge Case 4: Búsqueda Sin Resultados
**Pasos**:
1. Presionar `Ctrl+P`
2. Buscar algo que no existe: "xyzabc123"
3. Verificar mensaje: "No se encontraron tablas"

**Resultado Esperado**: ✅ Muestra mensaje apropiado

---

## 📊 Checklist de Pruebas

### Command Palette
- [ ] Test 1: Apertura básica
- [ ] Test 2: Búsqueda sin query
- [ ] Test 3: Búsqueda fuzzy
- [ ] Test 4: Navegación por teclado
- [ ] Test 5: Selección e inserción
- [ ] Test 6: Diferenciación tabla/vista
- [ ] Test 7: Contador de resultados
- [ ] Test 8: Límite de resultados

### Query Builder - Básico
- [ ] Test 9: Apertura básica
- [ ] Test 10: Selección de tabla FROM
- [ ] Test 11: Selección de columnas SELECT
- [ ] Test 12: Validación de columnas

### Query Builder - JOINs
- [ ] Test 13: Agregar JOIN simple
- [ ] Test 14: Múltiples JOINs
- [ ] Test 15: Tipos de JOIN

### Query Builder - WHERE
- [ ] Test 16: Condición WHERE simple
- [ ] Test 17: Operadores WHERE
- [ ] Test 18: Operador IN
- [ ] Test 19: Operadores lógicos AND/OR

### Query Builder - Otros
- [ ] Test 20: ORDER BY
- [ ] Test 21: LIMIT
- [ ] Test 25: Reset Query Builder
- [ ] Test 26: Validación de query incompleto

### SQL Multi-Dialecto
- [ ] Test 22: Generación SQL - PostgreSQL
- [ ] Test 23: Generación SQL - MySQL
- [ ] Test 24: Generación SQL - SQLite

### Integración
- [ ] Test 27: Workflow completo
- [ ] Test 28: Modificación manual post-generación
- [ ] Test 29: Múltiples tabs
- [ ] Test 30: Reconexión

### Edge Cases
- [ ] Edge Case 1: Tabla sin columnas
- [ ] Edge Case 2: Nombres con caracteres especiales
- [ ] Edge Case 3: Schemas múltiples
- [ ] Edge Case 4: Búsqueda sin resultados

---

## 🎯 Criterios de Éxito

### Funcionalidad
- ✅ Todos los tests pasan
- ✅ No hay errores en consola
- ✅ No hay crashes
- ✅ Performance fluida

### UX
- ✅ Atajos de teclado funcionan
- ✅ Navegación intuitiva
- ✅ Feedback visual claro
- ✅ Mensajes de error apropiados

### Integración
- ✅ Compatible con sistema existente
- ✅ No rompe funcionalidades previas
- ✅ SQL generado es válido
- ✅ Funciona con todos los motores

---

## 🚨 Reporte de Bugs

Si encuentras algún bug, reportar con:

1. **Descripción**: Qué pasó
2. **Pasos para reproducir**: Cómo reproducirlo
3. **Resultado esperado**: Qué debería pasar
4. **Resultado actual**: Qué pasó realmente
5. **Motor de BD**: PostgreSQL/MySQL/SQLite
6. **Logs**: Errores en consola

---

## ✅ Conclusión

Después de completar todos los tests, las funcionalidades deberían estar:
- ✅ Completamente funcionales
- ✅ Integradas correctamente
- ✅ Listas para producción

**¡Happy Testing!** 🎉
