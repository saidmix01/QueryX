import { Component, ReactNode } from 'react';
import { useNotificationStore } from '../store/notification-store';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    const { error: notifyError } = useNotificationStore.getState();
    const msg =
      typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in (error as any)
        ? String((error as any).message)
        : 'Unknown render error';
    notifyError(msg, { variant: 'toast', source: 'ui', autoCloseMs: 10000, persistent: false });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
