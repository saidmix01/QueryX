import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { useNotificationStore, Notification } from '../store/notification-store';

function getColors(type: Notification['type']) {
  switch (type) {
    case 'error':
      return {
        border: 'border-red-700',
        bg: 'bg-red-900/20',
        text: 'text-red-300',
        icon: <AlertOctagon className="w-4 h-4 text-red-400" />,
      };
    case 'warning':
      return {
        border: 'border-amber-600',
        bg: 'bg-amber-900/20',
        text: 'text-amber-200',
        icon: <AlertTriangle className="w-4 h-4 text-amber-300" />,
      };
    default:
      return {
        border: 'border-matrix-700',
        bg: 'bg-dark-surface/90',
        text: 'text-matrix-300',
        icon: <Info className="w-4 h-4 text-matrix-400" />,
      };
  }
}

function Toast({ n, onClose }: { n: Notification; onClose: () => void }) {
  const c = getColors(n.type);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`pointer-events-auto w-72 rounded-md border ${c.border} shadow-lg ${c.bg}`}
    >
      <div className="px-3 py-2 flex items-start gap-3">
        <div className="pt-0.5">{c.icon}</div>
        <div className="flex-1">
          {n.title && <div className="text-xs font-semibold">{n.title}</div>}
          <div className={`text-[11px] ${c.text}`}>{n.message}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="p-1 rounded hover:bg-dark-hover"
        >
          <X className="w-3.5 h-3.5 text-dark-muted" />
        </button>
      </div>
    </motion.div>
  );
}

// Todas las notificaciones se renderizan como toasts en la esquina superior derecha

export function NotificationCenter() {
  const { notifications, remove } = useNotificationStore();

  return (
    <>
      <div className="pointer-events-none fixed top-3 right-3 z-[60] flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {notifications.map((n) => (
            <Toast key={n.id} n={n} onClose={() => remove(n.id)} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
