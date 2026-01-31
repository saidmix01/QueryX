# 🎨 Guía de Rediseño UI - SQLForge Matrix Green

## 🌟 Filosofía de Diseño

El rediseño se enfoca en crear una experiencia de IDE profesional con:
- **Máximo espacio útil** para código y resultados
- **Mínimo ruido visual** con opacidades y blur
- **Tema Matrix Green** elegante y profesional
- **Animaciones fluidas** sin sacrificar rendimiento

---

## 🎨 Paleta de Colores Matrix Green

### Colores Principales

```javascript
// Fondo y Superficies
dark-bg: '#0a0e0a'        // Fondo principal - muy oscuro
dark-surface: '#0d110d'   // Superficies elevadas
dark-elevated: '#111611'  // Elementos flotantes
dark-border: '#1a2e1f'    // Bordes con tinte verde

// Texto
dark-text: '#e0ffe0'      // Texto principal - verde claro
dark-muted: '#5a7a5a'     // Texto secundario

// Matrix Green Accent
matrix-500: '#00e676'     // Color primario brillante
matrix-400: '#1aff70'     // Variante clara
matrix-700: '#00a854'     // Variante oscura
matrix-800: '#004d2a'     // Fondos sutiles
matrix-900: '#002e19'     // Fondos muy sutiles

// Estados
hover: '#162216'
active: '#1a2a1a'
```

### Efectos Visuales

```css
/* Glow Effects */
shadow-glow-sm: '0 0 8px rgba(0, 230, 118, 0.2)'
shadow-glow-md: '0 0 16px rgba(0, 230, 118, 0.3)'

/* Backdrop Blur */
backdrop-blur-sm: blur(4px)
backdrop-blur-md: blur(8px)

/* Opacidades para reducir ruido */
border: opacity 30-50%
background: opacity 50-70%
```

---

## 📐 Estructura de Layout

### Top Bar (8px altura)

```tsx
<div className="h-8 bg-dark-surface/80 backdrop-blur-sm border-b border-dark-border/50">
  {/* Logo + Conexión + Estado */}
</div>
```

**Características**:
- Ultra delgada (8px vs 9px anterior)
- Backdrop blur para profundidad
- Indicador de conexión animado
- Bordes con 50% opacidad

### Sidebar (Colapsable)

```tsx
// Barra de íconos: 10px ancho
<div className="w-10 bg-dark-bg/50">
  {/* Íconos 4x4 */}
</div>

// Contenido: Flexible
<div className="flex-1 bg-dark-surface/50 backdrop-blur-sm">
  {/* Explorer, Queries, History */}
</div>
```

**Características**:
- Íconos minimalistas (4x4)
- Tooltips con backdrop blur
- Indicador activo animado
- Colapso suave con animación

### Editor SQL (60-70% vertical)

```tsx
// Toolbar: 7px altura
<div className="py-1.5 bg-dark-surface/70 backdrop-blur-md">
  {/* Run, Builder, Shortcuts */}
</div>

// Monaco Editor: Flex-1
<div className="flex-1">
  <Editor options={{
    fontSize: 14,
    lineHeight: 21,
    padding: { top: 12, bottom: 12 }
  }} />
</div>
```

**Características**:
- Toolbar ultra compacto
- Botones 7px altura
- Hints de shortcuts visibles
- Editor con padding reducido

### Panel de Resultados (Redimensionable)

```tsx
// Status bar compacto
<div className="py-1.5 text-xs">
  {/* Rows, Time, Affected */}
</div>

// Tabla optimizada
<table className="text-xs">
  <thead className="sticky top-0 bg-dark-surface/90 backdrop-blur-sm">
    {/* Headers con backdrop blur */}
  </thead>
</table>
```

**Características**:
- Status bar 1.5px padding
- Texto 12px en tabla
- Headers sticky con blur
- Hover states sutiles

---

## 🎭 Animaciones y Transiciones

### Duraciones Estándar

```javascript
// Transiciones rápidas
duration: 0.12s  // Hover, focus
duration: 0.15s  // Entrada/salida
duration: 0.2s   // Fade in/out

// Animaciones spring
type: 'spring'
stiffness: 500
damping: 30
```

### Ejemplos de Uso

```tsx
// Fade in suave
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.15 }}
>

// Scale en botones
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>

// Indicador activo con spring
<motion.div
  layoutId="activeTab"
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
/>
```

---

## 🎯 Componentes Clave

### Botones

```tsx
// Primario
<button className="btn btn-primary h-7 px-2.5 text-xs shadow-glow-sm">
  <Play className="w-3 h-3" />
  Run
</button>

// Secundario
<button className="btn btn-secondary h-7 px-2.5 text-xs">
  <Boxes className="w-3 h-3" />
  Builder
</button>

// Ghost
<button className="btn btn-ghost p-1">
  <X className="w-4 h-4" />
</button>
```

### Tabs

```tsx
<div className="bg-dark-surface/50 backdrop-blur-sm border-b border-dark-border/30">
  {tabs.map(tab => (
    <div className={clsx(
      'px-3 py-2 text-xs',
      isActive && 'bg-dark-bg text-matrix-400'
    )}>
      {/* Indicador activo */}
      {isActive && (
        <motion.div 
          layoutId="activeTabIndicator"
          className="absolute bottom-0 h-0.5 bg-matrix-500 shadow-glow-sm"
        />
      )}
    </div>
  ))}
</div>
```

### Tooltips

```tsx
<span className="absolute left-full ml-2 px-2 py-1 
  bg-dark-elevated/95 backdrop-blur-sm 
  border border-dark-border/50 rounded text-xs 
  opacity-0 group-hover:opacity-100 transition-opacity">
  Tooltip text
</span>
```

### Context Menu

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  className="bg-dark-surface/95 backdrop-blur-sm 
    border border-dark-border/50 rounded-lg shadow-xl">
  <button className="px-3 py-1.5 text-xs hover:bg-dark-hover/50">
    Action
  </button>
</motion.div>
```

---

## 📊 Comparativa Antes/Después

### Espaciado

| Elemento | Antes | Después | Reducción |
|----------|-------|---------|-----------|
| Top bar | 9px | 8px | -11% |
| Sidebar icons | 11px | 10px | -9% |
| Toolbar height | 8px | 7px | -12.5% |
| Tab padding | 2.5px | 2px | -20% |
| Button height | 8px | 7px | -12.5% |

### Tipografía

| Elemento | Antes | Después |
|----------|-------|---------|
| Top bar | 12px | 11px |
| Tabs | 14px | 12px |
| Toolbar | 12px | 11px |
| Table | 14px | 12px |
| Hints | 12px | 11px |

### Opacidades

| Elemento | Opacidad |
|----------|----------|
| Borders | 30-50% |
| Backgrounds | 50-80% |
| Hover states | 30-50% |
| Backdrop blur | 70-95% |

---

## 🚀 Mejores Prácticas

### 1. Uso de Backdrop Blur

```tsx
// ✅ Correcto - Blur selectivo
<div className="bg-dark-surface/80 backdrop-blur-sm">

// ❌ Evitar - Blur en todo
<div className="backdrop-blur-lg">
```

### 2. Animaciones Suaves

```tsx
// ✅ Correcto - Duraciones cortas
transition={{ duration: 0.15 }}

// ❌ Evitar - Animaciones lentas
transition={{ duration: 0.5 }}
```

### 3. Opacidades para Jerarquía

```tsx
// ✅ Correcto - Opacidades graduales
border-dark-border/30  // Sutil
border-dark-border/50  // Normal
border-dark-border     // Fuerte

// ❌ Evitar - Todo opaco
border-dark-border
```

### 4. Tamaños Consistentes

```tsx
// ✅ Correcto - Sistema de tamaños
w-3 h-3    // Íconos pequeños
w-3.5 h-3.5 // Íconos medianos
w-4 h-4    // Íconos normales

// ❌ Evitar - Tamaños arbitrarios
w-[13px] h-[13px]
```

---

## 🎨 Tokens de Diseño

### Espaciado

```javascript
xs: 0.5  // 2px
sm: 1    // 4px
md: 1.5  // 6px
lg: 2    // 8px
xl: 3    // 12px
```

### Bordes

```javascript
thin: 1px
normal: 1px
thick: 2px
radius: 0.375rem (6px)
```

### Sombras

```javascript
sm: '0 1px 2px rgba(0,0,0,0.05)'
md: '0 4px 6px rgba(0,0,0,0.1)'
glow-sm: '0 0 8px rgba(0,230,118,0.2)'
```

---

## 📝 Checklist de Implementación

- [x] Paleta de colores Matrix Green
- [x] Top bar ultra delgada (8px)
- [x] Sidebar colapsable con íconos minimalistas
- [x] Editor con toolbar compacto
- [x] Panel de resultados optimizado
- [x] Tabs minimalistas con animaciones
- [x] Scrollbars personalizados
- [x] Backdrop blur en overlays
- [x] Animaciones Framer Motion
- [x] Estados hover/active sutiles
- [x] Tooltips con blur
- [x] Context menus mejorados
- [x] Modales con animaciones
- [x] Empty states elegantes
- [x] Loading states suaves
- [x] Error states claros

---

## 🔧 Mantenimiento

### Agregar Nuevos Componentes

1. Usar colores de `tailwind.config.js`
2. Aplicar opacidades para jerarquía
3. Agregar backdrop blur en overlays
4. Usar animaciones Framer Motion
5. Mantener tamaños consistentes

### Modificar Colores

Editar `tailwind.config.js`:
```javascript
colors: {
  matrix: { ... },
  dark: { ... }
}
```

### Ajustar Animaciones

Editar duraciones en componentes:
```tsx
transition={{ duration: 0.15 }}
```

---

## 📚 Referencias

- **Framer Motion**: https://www.framer.com/motion/
- **Tailwind CSS**: https://tailwindcss.com/
- **React Resizable Panels**: https://github.com/bvaughn/react-resizable-panels
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/

---

**Última actualización**: Enero 2026
**Versión**: 2.0.0
**Tema**: Matrix Green Professional
