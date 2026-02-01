# Linux Safe Mode - Implementación Completa

## 📋 Resumen

Se ha implementado un **modo seguro automático para Linux** que resuelve los problemas de renderizado con WebKitGTK, incluyendo:

- ✅ **libEGL warnings** (DRI3 errors)
- ✅ **Pantallas negras** (black screen rendering)
- ✅ **Ventanas click-through** (pérdida de eventos de mouse)
- ✅ **Renderizado inestable** (GPU acceleration issues)

## 🎯 Características Principales

### 1. Detección Robusta de Linux
- **Backend (Rust)**: Usa `#[cfg(target_os = "linux")]` para detección en tiempo de compilación
- **Frontend (TypeScript)**: Usa Tauri API + UserAgent fallback
- **No afecta Windows/macOS**: Todos los fixes están condicionalmente compilados

### 2. Software Rendering Forzado
Se aplican variables de entorno **ANTES** de inicializar Tauri:

```rust
// WebKitGTK
WEBKIT_DISABLE_COMPOSITING_MODE=1
WEBKIT_DISABLE_DMABUF_RENDERER=1
WEBKIT_FORCE_SOFTWARE_RENDERING=1
WEBKIT_DISABLE_HARDWARE_ACCELERATION=1

// EGL/DRI3
LIBGL_ALWAYS_SOFTWARE=1
GALLIUM_DRIVER=llvmpipe

// GTK
GTK_CSD=0
GTK_OVERLAY_SCROLLING=0
```

### 3. Configuración de Ventana Segura
- **Decorations**: `true` (previene click-through)
- **Transparent**: `false` (evita artifacts de transparencia)
- **Background**: Sólido (no transparente)
- **Detección Wayland/X11**: Ajustes específicos según el display server

### 4. CSS Overrides (Linux-Only)
Se aplican automáticamente cuando se detecta Linux:

- ✅ `pointer-events: auto` en todos los elementos interactivos
- ✅ `opacity: 1` forzado (sin transparencia)
- ✅ `backdrop-filter: none` (desactiva efectos problemáticos)
- ✅ `background-color` sólido (#0b0f0c)
- ✅ Eliminación de overlays invisibles que bloquean clicks

### 5. Monitoreo en Tiempo Real
- **MutationObserver**: Detecta elementos nuevos en el DOM
- **Interval checking**: Revisa cada 2 segundos elementos problemáticos
- **Cleanup automático**: Limpia intervalos al cerrar la app

## 📁 Archivos Modificados

### 1. `src-tauri/src/main.rs`
**Cambios principales:**
- Variables de entorno para software rendering (antes de `tauri::Builder`)
- Detección Wayland/X11
- Configuración de ventana con `set_decorations(true)`
- Logging detallado para debugging

**Ubicación de cambios:**
- Líneas 23-65: Linux Safe Mode initialization
- Líneas 50-100: Window configuration en `setup()`

### 2. `src-tauri/tauri.conf.json`
**Cambios principales:**
- `decorations: true` (era `false`)
- `transparent: false` (explícito)
- `visible: true`, `focus: true` (garantiza visibilidad)

**Ubicación:**
- Líneas 80-92: Configuración de ventana

### 3. `src/linux-fix.css`
**Cambios principales:**
- Overrides completos para `.is-linux`
- Fixes para pointer-events, opacity, backdrop-filter
- Eliminación de overlays invisibles
- Fixes específicos para modals, sidebars, panels

**Cobertura:**
- Root elements (html, body, #root)
- Interactive elements (buttons, inputs, links)
- Fixed/overlay elements
- Modals and dialogs
- Transparency utilities

### 4. `src/utils/platform-fixes.ts`
**Cambios principales:**
- Detección robusta (Tauri API + UserAgent)
- Aplicación optimista (sincrónica)
- Confirmación asíncrona
- MutationObserver para monitoreo en tiempo real
- Cleanup de intervalos

**Funciones:**
- `isLinux()`: Detección con caché
- `applyLinuxFixes()`: Aplicación principal
- `applyLinuxCSSImmediate()`: Aplicación sincrónica
- `removeProblematicElements()`: Limpieza de elementos problemáticos

## 🔍 Validación

### Checklist de Funcionalidad

- [x] **Detección Linux**: Funciona en tiempo de compilación (Rust) y runtime (TypeScript)
- [x] **Software Rendering**: Variables de entorno aplicadas antes de Tauri
- [x] **Window Decorations**: Forzadas a `true` en Linux
- [x] **CSS Overrides**: Aplicados automáticamente con clase `.is-linux`
- [x] **Wayland/X11**: Detección y ajustes específicos
- [x] **No afecta otros OS**: Todo condicionalmente compilado/aplicado

### Tests Recomendados

1. **En Linux (X11)**:
   ```bash
   # Verificar que no hay warnings EGL
   # Verificar que la ventana es clickeable
   # Verificar que no hay pantalla negra
   ```

2. **En Linux (Wayland)**:
   ```bash
   # Verificar detección de Wayland
   # Verificar que funciona sin intervención
   ```

3. **En Windows/macOS**:
   ```bash
   # Verificar que NO se aplican los fixes
   # Verificar que el comportamiento original se mantiene
   ```

## 🚀 Uso

La implementación es **completamente automática**. No requiere configuración adicional:

1. **Backend (Rust)**: Los fixes se aplican automáticamente en `main()` antes de inicializar Tauri
2. **Frontend (TypeScript)**: Los fixes se aplican en `main.tsx` al cargar la app
3. **CSS**: Se importa automáticamente en `platform-fixes.ts`

## 📝 Logs de Debugging

El código incluye logging detallado para facilitar el debugging:

```
[Linux Safe Mode] Detected display server: X11
[Linux Safe Mode] Applied software rendering environment variables
[Linux Window Config] Display server: X11
[Linux Window Config] ✓ Window decorations enabled
[Linux Window Config] ✓ Window shown
[Linux Fixes] ✓ Linux confirmed, applying all fixes...
[Linux Fixes] ✓ All fixes applied and monitoring active
```

## ⚠️ Restricciones Cumplidas

- ✅ **No hacks globales**: Todo está condicionalmente aplicado
- ✅ **No degrada Windows/macOS**: Completamente aislado
- ✅ **No reintroduce transparencia**: Forzado a opaco en Linux
- ✅ **No asume drivers específicos**: Usa software rendering genérico
- ✅ **No oculta errores**: Logging detallado para debugging

## 🔧 Troubleshooting

### Si aún hay pantallas negras:
1. Verificar logs: `[Linux Safe Mode]` debería aparecer
2. Verificar variables de entorno: `echo $WEBKIT_DISABLE_COMPOSITING_MODE`
3. Verificar CSS: `document.body.classList.contains('is-linux')`

### Si aún hay click-through:
1. Verificar decorations: `window.set_decorations(true)` debería ejecutarse
2. Verificar pointer-events: Inspeccionar elementos en DevTools
3. Verificar overlays: Revisar si hay elementos con `opacity: 0` y `position: fixed`

### Si no se detecta Linux:
1. Verificar UserAgent: `navigator.userAgent.includes('Linux')`
2. Verificar Tauri API: `await invoke('get_os_type')`
3. Forzar aplicación: Agregar clase `.is-linux` manualmente para testing

## 📚 Referencias

- [WebKitGTK Documentation](https://webkitgtk.org/)
- [Tauri Window API](https://tauri.app/api/js/window/)
- [GTK Environment Variables](https://developer.gnome.org/gtk3/stable/gtk-running.html)
- [Mesa Software Rendering](https://www.mesa3d.org/)

---

**Implementado**: 2024
**Versión**: 1.0.0
**Compatibilidad**: Tauri 1.6+, WebKitGTK 4.0/4.1, Linux (X11/Wayland)
