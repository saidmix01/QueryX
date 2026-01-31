# QueryX - Cambio de Marca y Modal "Acerca de"

## Resumen de Cambios

Se ha realizado un rebranding completo de la aplicación de **SQLForge** a **QueryX**, incluyendo la integración del logo en la UI y la creación de un modal "Acerca de" con información del programa.

## Cambios Realizados

### 1. Cambio de Nombre en Archivos de Configuración

- **package.json**: Actualizado nombre a `queryx` y versión a `1.0.0`
- **index.html**: Actualizado título y favicon a `icon.ico`
- **src-tauri/tauri.conf.json**: 
  - Nombre del producto: `QueryX`
  - Título de ventana: `QueryX - Professional SQL Database Manager`
  - Identificador: `com.queryx.app`
  - Copyright: `© 2024-2026 QueryX`
  - Iconos actualizados: `icon.ico` y `icon.png`
  - Versión: `1.0.0`
- **README.md**: Actualizado con el nuevo nombre QueryX

### 2. Integración de Iconos

- Copiados `icon.ico` e `icon.png` desde `src-tauri/icons/` a `public/`
- Integrado el logo en la barra superior de la aplicación (App.tsx)
- Configurado favicon en el HTML

### 3. Componente "Acerca de" (AboutModal)

Creado nuevo componente `src/components/AboutModal.tsx` con:

- **Diseño moderno** con animaciones de Framer Motion
- **Logo de la aplicación** con efecto de resplandor
- **Información del programa**:
  - Nombre: QueryX
  - Versión: 1.0.0
  - Descripción completa
  - Características principales (Multi-motor, Editor SQL, Query Builder, Workspaces)
  - Stack tecnológico (React, TypeScript, Tauri, Rust, Monaco Editor)
  - Copyright © 2024-2026 QueryX

### 4. Integración en la UI

- **Botón en la barra superior**: Icono de información (Info) en la esquina superior derecha
- **Atajo de teclado**: `F1` para abrir el modal "Acerca de"
- **Estado en UI Store**: Agregado `isAboutModalOpen` y `setAboutModalOpen`
- **Hook de atajos globales**: Actualizado para incluir F1

### 5. Archivos Modificados

```
✓ index.html
✓ package.json
✓ src-tauri/tauri.conf.json
✓ README.md
✓ src/App.tsx
✓ src/store/ui-store.ts
✓ src/hooks/useGlobalShortcuts.ts
✓ src/components/AboutModal.tsx (nuevo)
✓ public/icon.ico (copiado)
✓ public/icon.png (copiado)
```

## Características del Modal "Acerca de"

- ✅ Diseño profesional con gradientes y efectos visuales
- ✅ Logo de la aplicación con resplandor animado
- ✅ Información completa del programa
- ✅ Versión y copyright
- ✅ Lista de características principales
- ✅ Stack tecnológico con badges
- ✅ Animaciones suaves de entrada/salida
- ✅ Responsive y accesible
- ✅ Fallback si el logo no carga

## Atajos de Teclado

- `F1` - Abrir modal "Acerca de"
- `Ctrl+P` - Command Palette
- `Ctrl+Shift+B` - Query Builder
- `Ctrl+Enter` - Ejecutar query
- `Esc` - Cerrar modales

## Cómo Usar

1. **Abrir el modal "Acerca de"**:
   - Presionar `F1`
   - Hacer clic en el icono de información (ⓘ) en la barra superior

2. **Cerrar el modal**:
   - Presionar `Esc`
   - Hacer clic en el botón X
   - Hacer clic fuera del modal

## Próximos Pasos Sugeridos

- [ ] Agregar enlaces a documentación o sitio web
- [ ] Agregar botón de "Buscar actualizaciones"
- [ ] Agregar información de licencia
- [ ] Agregar créditos y agradecimientos
- [ ] Integrar sistema de telemetría/analytics (opcional)
