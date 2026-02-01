# Configuración de Iconos para Linux AppImage

## Resumen

Este documento describe la configuración completa del sistema de iconos para la aplicación QueryX, específicamente optimizado para Linux AppImage, pero compatible con Windows y macOS.

## Estructura de Iconos

### Icono Fuente
- **Ubicación**: `public/icon.png`
- **Tamaño**: 256x256 (mínimo recomendado: 512x512)
- **Formato**: PNG con transparencia (RGBA)

### Iconos Generados
Los iconos se generan automáticamente en `src-tauri/icons/` con los siguientes tamaños:

- `icon-32x32.png` - Para iconos pequeños en el sistema
- `icon-128x128.png` - Para iconos medianos
- `icon-256x256.png` - Para iconos grandes
- `icon-512x512.png` - Para iconos de alta resolución
- `icon.png` - Icono principal (256x256)
- `icon.ico` - Para Windows (ya existente)

## Generación Automática

### Script de Generación
El script `scripts/generate-icons.js` genera automáticamente todos los tamaños necesarios desde `public/icon.png`.

**Características:**
- Usa `sharp` para redimensionamiento de alta calidad
- Mantiene transparencia (alpha channel)
- Genera todos los tamaños requeridos por Linux AppImage
- Se ejecuta automáticamente antes de cada build

### Ejecución Manual
```bash
npm run generate-icons
```

### Ejecución Automática
El script se ejecuta automáticamente antes de cada build gracias al hook `prebuild` en `package.json`:

```json
{
  "scripts": {
    "prebuild": "npm run generate-icons"
  }
}
```

## Configuración en tauri.conf.json

### Array de Iconos
Los iconos están configurados en `tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "icon": [
        "icons/icon.ico",        // Windows
        "icons/icon.png",         // macOS/Linux principal
        "icons/icon-32x32.png",  // Linux AppImage
        "icons/icon-128x128.png", // Linux AppImage
        "icons/icon-256x256.png", // Linux AppImage
        "icons/icon-512x512.png"  // Linux AppImage
      ]
    }
  }
}
```

### Compatibilidad Multiplataforma

**Linux (AppImage):**
- Tauri usa automáticamente los iconos PNG en diferentes tamaños
- Genera el archivo `.desktop` con la referencia correcta al icono
- El icono aparece en:
  - Launcher del sistema
  - Dock/panel
  - Ventana de la aplicación
  - Procesos activos

**Windows:**
- Usa `icon.ico` (ya existente)
- Compatible con la configuración actual
- No requiere cambios adicionales

**macOS:**
- Usa `icon.png` y genera `.icns` automáticamente
- Compatible con la configuración actual
- No requiere cambios adicionales

## Proceso de Build

### Flujo Completo

1. **Pre-build**: Se ejecuta `npm run generate-icons`
   - Genera todos los tamaños desde `public/icon.png`
   - Coloca los iconos en `src-tauri/icons/`

2. **Build de Vite**: `npm run build`
   - Compila la aplicación frontend

3. **Build de Tauri**: `npm run tauri build`
   - Lee la configuración de `tauri.conf.json`
   - Incluye todos los iconos especificados en el array `icon`
   - Para Linux AppImage:
     - Genera el archivo `.desktop` con el icono correcto
     - Incluye los iconos PNG en el AppImage
     - Configura el icono de la ventana

## Verificación

### Verificar Iconos Generados
```bash
ls -lh src-tauri/icons/
```

Deberías ver:
- `icon-32x32.png`
- `icon-128x128.png`
- `icon-256x256.png`
- `icon-512x512.png`
- `icon.png`
- `icon.ico`

### Verificar en AppImage

Después de construir el AppImage:

1. **Ejecutar el AppImage**:
   ```bash
   ./QueryX_1.0.0_amd64.AppImage
   ```

2. **Verificar icono en el launcher**:
   - Buscar "QueryX" en el menú de aplicaciones
   - El icono debe aparecer correctamente

3. **Verificar icono en el dock**:
   - Anclar la aplicación al dock
   - El icono debe aparecer correctamente

4. **Verificar icono en la ventana**:
   - La ventana de la aplicación debe mostrar el icono en la barra de título

5. **Verificar icono en procesos**:
   - Abrir un monitor de procesos (htop, System Monitor, etc.)
   - El icono debe aparecer junto al proceso

## Solución de Problemas

### El icono no aparece en el AppImage

1. **Verificar que los iconos se generaron**:
   ```bash
   npm run generate-icons
   ls -lh src-tauri/icons/
   ```

2. **Verificar la configuración en tauri.conf.json**:
   - Asegurarse de que todos los iconos estén en el array `icon`
   - Verificar que las rutas sean relativas a `src-tauri/`

3. **Limpiar y reconstruir**:
   ```bash
   rm -rf src-tauri/target
   npm run tauri build
   ```

### El icono aparece pero es el por defecto

- Verificar que `public/icon.png` existe y es válido
- Ejecutar `npm run generate-icons` manualmente
- Verificar que los iconos generados tienen el tamaño correcto

### El icono no se actualiza después de cambiar public/icon.png

- Ejecutar `npm run generate-icons` manualmente
- O simplemente hacer un nuevo build (el script se ejecuta automáticamente)

## Mantenimiento

### Actualizar el Icono

1. Reemplazar `public/icon.png` con el nuevo icono
2. Ejecutar `npm run generate-icons` (o simplemente hacer un build)
3. Los iconos se regenerarán automáticamente

### Requisitos del Icono Fuente

- **Formato**: PNG
- **Tamaño mínimo**: 512x512 píxeles (recomendado)
- **Fondo**: Transparente o sólido (ambos funcionan)
- **Calidad**: Alta resolución para mejor resultado en todos los tamaños

## Notas Técnicas

### Por qué múltiples tamaños

Linux AppImage y los gestores de ventanas de Linux requieren iconos en diferentes tamaños para:
- Mostrar correctamente en diferentes contextos (launcher, dock, ventana)
- Optimizar el rendimiento (no redimensionar en tiempo de ejecución)
- Cumplir con las especificaciones de Desktop Entry

### Por qué sharp

`sharp` es la biblioteca más eficiente y de mayor calidad para procesamiento de imágenes en Node.js:
- Usa libvips (muy rápido)
- Mantiene alta calidad en el redimensionamiento
- Preserva transparencia correctamente
- Es multiplataforma

## Referencias

- [Tauri Bundle Configuration](https://tauri.app/v1/guides/building/bundler)
- [Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html)
- [AppImage Specification](https://docs.appimage.org/)
