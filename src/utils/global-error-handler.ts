import { useNotificationStore } from '../store/notification-store';

function normalizeError(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    if ('message' in e) return String((e as any).message);
    if ('error' in e) return String((e as any).error);
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return 'Unknown error';
}

function isCancellation(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === 'string') {
    const s = e.toLowerCase();
    return s.includes('cancel') || s.includes('canceled') || s.includes('cancelled');
  }
  if (typeof e === 'object') {
    const anyE = e as any;
    const type = String(anyE?.type || '').toLowerCase();
    const msg = String(anyE?.msg || anyE?.message || '').toLowerCase();
    return type.includes('cancel') || msg.includes('cancel');
  }
  return false;
}

export function setupGlobalErrorHandlers() {
  const { error } = useNotificationStore.getState();

  if (!(window as any).__qxGlobalErrorsInstalled) {
    window.addEventListener('error', (ev) => {
      const reason = ev.error ?? ev.message;
      if (isCancellation(reason)) return;
      const msg = normalizeError(reason);
      error(msg, { variant: 'toast', source: 'ui', autoCloseMs: 10000, persistent: false });
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev.reason;
      if (isCancellation(reason)) return;
      const msg = normalizeError(reason);
      error(msg, { variant: 'toast', source: 'ui', autoCloseMs: 10000, persistent: false });
    });
    (window as any).__qxGlobalErrorsInstalled = true;
  }
}
