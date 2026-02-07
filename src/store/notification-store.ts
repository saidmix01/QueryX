import { create } from 'zustand';
function genId() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type NotificationType = 'error' | 'warning' | 'info';
export type NotificationVariant = 'toast' | 'snackbar' | 'banner';

export interface Notification {
  id: string;
  type: NotificationType;
  variant: NotificationVariant;
  title?: string;
  message: string;
  source?: 'ui' | 'business' | 'ipc';
  autoCloseMs?: number;
  persistent?: boolean;
  createdAt: number;
}

interface NotificationState {
  notifications: Notification[];
  add: (n: Omit<Notification, 'id' | 'createdAt'> & { id?: string }) => string;
  remove: (id: string) => void;
  clear: () => void;
  info: (message: string, opts?: Partial<Notification>) => string;
  warn: (message: string, opts?: Partial<Notification>) => string;
  error: (message: string, opts?: Partial<Notification>) => string;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  add: (n) => {
    const id = n.id || genId();
    const notif: Notification = {
      id,
      type: n.type,
      variant: n.variant,
      title: n.title,
      message: n.message,
      source: n.source,
      autoCloseMs: n.autoCloseMs,
      persistent: n.persistent,
      createdAt: Date.now(),
    };
    set((s) => ({ notifications: [...s.notifications, notif] }));
    if (notif.autoCloseMs && !notif.persistent) {
      setTimeout(() => {
        get().remove(id);
      }, notif.autoCloseMs);
    }
    return id;
  },
  remove: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clear: () => set({ notifications: [] }),
  info: (message, opts) =>
    get().add({
      type: 'info',
      variant: 'toast',
      message,
      title: opts?.title,
      source: opts?.source,
      autoCloseMs: opts?.autoCloseMs ?? 10000,
      persistent: opts?.persistent ?? false,
    }),
  warn: (message, opts) =>
    get().add({
      type: 'warning',
      variant: 'toast',
      message,
      title: opts?.title,
      source: opts?.source,
      autoCloseMs: opts?.autoCloseMs ?? 10000,
      persistent: opts?.persistent ?? false,
    }),
  error: (message, opts) =>
    get().add({
      type: 'error',
      variant: 'toast',
      message,
      title: opts?.title || 'Error',
      source: opts?.source,
      autoCloseMs: opts?.autoCloseMs ?? 10000,
      persistent: opts?.persistent ?? false,
    }),
}));
