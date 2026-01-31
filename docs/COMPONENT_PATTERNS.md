# 🧩 Patrones de Componentes - SQLForge

## 📦 Componentes Reutilizables

### 1. Botón con Animación

```tsx
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

function AnimatedButton() {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="btn btn-primary h-7 px-2.5 text-xs shadow-glow-sm flex items-center gap-1.5"
    >
      <Play className="w-3 h-3" />
      Run Query
    </motion.button>
  );
}
```

### 2. Tab con Indicador Activo

```tsx
import { motion } from 'framer-motion';
import clsx from 'clsx';

function AnimatedTab({ isActive, label, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative px-3 py-2 text-xs cursor-pointer transition-colors',
        isActive 
          ? 'bg-dark-bg text-matrix-400' 
          : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover/30'
      )}
    >
      {label}
      
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-matrix-500 shadow-glow-sm"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </div>
  );
}
```

### 3. Tooltip con Backdrop Blur

```tsx
function TooltipButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-md hover:bg-dark-hover transition-colors group"
    >
      <Icon className="w-4 h-4" />
      
      {/* Tooltip */}
      <span className="absolute left-full ml-2 px-2 py-1 
        bg-dark-elevated/95 backdrop-blur-sm 
        border border-dark-border/50 rounded text-xs whitespace-nowrap 
        opacity-0 group-hover:opacity-100 transition-opacity 
        pointer-events-none z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
}
```

### 4. Modal con Animación

```tsx
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

function AnimatedModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-dark-surface border border-dark-border/50 rounded-lg shadow-2xl 
          w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 
          border-b border-dark-border/50 bg-dark-elevated/50">
          <h2 className="font-semibold text-matrix-400 text-sm">{title}</h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="btn btn-ghost p-1"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
```

### 5. Context Menu

```tsx
import { motion } from 'framer-motion';
import { Copy, Trash, Edit } from 'lucide-react';

function ContextMenu({ x, y, onClose, items }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 bg-dark-surface/95 backdrop-blur-sm 
          border border-dark-border/50 rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-xs 
              hover:bg-dark-hover/50 flex items-center gap-2 transition-colors"
          >
            {item.icon && <item.icon className="w-3.5 h-3.5" />}
            {item.label}
          </button>
        ))}
      </motion.div>
    </>
  );
}

// Uso
<ContextMenu
  x={100}
  y={200}
  onClose={() => setMenuOpen(false)}
  items={[
    { icon: Copy, label: 'Copy', onClick: handleCopy },
    { icon: Edit, label: 'Edit', onClick: handleEdit },
    { icon: Trash, label: 'Delete', onClick: handleDelete },
  ]}
/>
```

### 6. Loading Spinner

```tsx
import { motion } from 'framer-motion';

function LoadingSpinner({ size = 'md', label }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className={`${sizes[size]} border-2 border-matrix-500 border-t-transparent rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {label && <p className="text-sm text-dark-muted">{label}</p>}
    </div>
  );
}
```

### 7. Empty State

```tsx
import { motion } from 'framer-motion';
import { Database, Code2 } from 'lucide-react';

function EmptyState({ icon: Icon = Database, title, description, actions }) {
  return (
    <div className="h-full flex items-center justify-center bg-dark-bg">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="text-center max-w-md"
      >
        {/* Icon */}
        <div className="relative mb-6 inline-block">
          <Icon className="w-20 h-20 text-dark-border/50" />
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <Code2 className="w-9 h-9 text-matrix-500 drop-shadow-[0_0_12px_rgba(0,230,118,0.5)]" />
          </motion.div>
        </div>

        {/* Text */}
        <h2 className="text-lg font-semibold text-matrix-400 mb-2">{title}</h2>
        <p className="text-sm text-dark-muted/80 mb-6">{description}</p>

        {/* Actions */}
        {actions && (
          <div className="flex flex-col items-center gap-2.5 text-xs text-dark-muted/70">
            {actions.map((action, i) => (
              <div key={i} className="flex items-center gap-2">
                {action.kbd && <kbd className="text-xs">{action.kbd}</kbd>}
                <span>{action.label}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
```

### 8. Status Badge

```tsx
function StatusBadge({ status, label }) {
  const variants = {
    connected: 'bg-matrix-500 shadow-glow-sm',
    disconnected: 'bg-dark-muted',
    error: 'bg-accent-red shadow-[0_0_8px_rgba(255,82,82,0.4)]',
    loading: 'bg-matrix-500 animate-pulse-glow'
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${variants[status]}`} />
      {label && <span className="text-xs text-dark-muted">{label}</span>}
    </div>
  );
}
```

### 9. Collapsible Section

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dark-border/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between 
          hover:bg-dark-hover/30 transition-colors"
      >
        <span className="text-sm font-medium text-matrix-400">{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-4 h-4 text-dark-muted" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 10. Keyboard Shortcut Display

```tsx
function KeyboardShortcut({ keys, label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-dark-muted/70">
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd key={i} className="text-[10px] px-1.5 py-0.5">
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-[11px]">{label}</span>
    </div>
  );
}

// Uso
<KeyboardShortcut keys={['Ctrl', 'Enter']} label="Run Query" />
```

---

## 🎨 Patrones de Estilo

### Backdrop Blur Pattern

```tsx
// Overlay con blur
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

// Surface con blur
<div className="bg-dark-surface/80 backdrop-blur-sm" />

// Elevated con blur
<div className="bg-dark-elevated/95 backdrop-blur-sm" />
```

### Gradient Border Pattern

```tsx
<div className="relative p-px rounded-lg bg-gradient-to-r from-matrix-700 to-matrix-500">
  <div className="bg-dark-surface rounded-lg p-4">
    Content
  </div>
</div>
```

### Glow Effect Pattern

```tsx
// Glow en hover
<button className="hover:shadow-glow-sm transition-shadow">

// Glow permanente
<div className="shadow-glow-md">

// Glow animado
<div className="animate-pulse-glow">
```

### Sticky Header Pattern

```tsx
<thead className="sticky top-0 bg-dark-surface/90 backdrop-blur-sm z-10">
  <tr>
    <th className="px-3 py-2 text-left font-semibold text-matrix-400/90 
      border-b border-dark-border/50">
      Column
    </th>
  </tr>
</thead>
```

---

## 🔧 Hooks Personalizados

### useHover

```tsx
function useHover() {
  const [isHovered, setIsHovered] = useState(false);

  const hoverProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  return [isHovered, hoverProps];
}

// Uso
const [isHovered, hoverProps] = useHover();
<div {...hoverProps}>
  {isHovered && <Tooltip />}
</div>
```

### useKeyPress

```tsx
function useKeyPress(targetKey, callback) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === targetKey) {
        callback(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [targetKey, callback]);
}

// Uso
useKeyPress('Escape', () => closeModal());
```

### useClickOutside

```tsx
function useClickOutside(ref, callback) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, callback]);
}

// Uso
const menuRef = useRef();
useClickOutside(menuRef, () => setMenuOpen(false));
```

---

## 📚 Utilidades

### Class Name Helper

```tsx
import clsx from 'clsx';

function getButtonClasses(variant, size, disabled) {
  return clsx(
    'btn transition-all',
    {
      'btn-primary': variant === 'primary',
      'btn-secondary': variant === 'secondary',
      'btn-ghost': variant === 'ghost',
    },
    {
      'h-6 px-2 text-xs': size === 'sm',
      'h-7 px-2.5 text-xs': size === 'md',
      'h-8 px-3 text-sm': size === 'lg',
    },
    disabled && 'opacity-50 cursor-not-allowed'
  );
}
```

### Animation Variants

```tsx
const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.15 }
};

const scaleIn = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { duration: 0.12 }
};

const slideIn = {
  initial: { x: -10, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 10, opacity: 0 },
  transition: { duration: 0.15 }
};

// Uso
<motion.div {...fadeInUp}>Content</motion.div>
```

---

**Última actualización**: Enero 2026
