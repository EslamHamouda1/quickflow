import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

export interface NotifyOptions {
  kind?: ToastKind;
  message?: string;
  /** Auto-dismiss delay in ms; 0 keeps the toast until dismissed. */
  durationMs?: number;
  /** Also raise a browser (system) notification when enabled and permitted. */
  browser?: boolean;
}

/** In-app toasts plus optional browser notifications. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  static readonly DEFAULT_DURATION_MS = 5000;
  static readonly MAX_TOASTS = 4;

  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  /** In-app notifications on/off — kept in sync with Settings by `SettingsStore`. */
  readonly inAppEnabled = signal(true);
  /** Browser notifications on/off — kept in sync with Settings by `SettingsStore`. */
  readonly browserEnabled = signal(false);

  /**
   * App notification (e.g. plan start): an in-app toast only when in-app notifications are on,
   * plus a system notification when `browser` is set, enabled in Settings and permitted.
   * Returns the toast id, or -1 when the toast was suppressed.
   */
  notify(title: string, options: NotifyOptions = {}): number {
    if (options.browser) {
      this.browserNotify(title, options.message);
    }
    if (!this.inAppEnabled()) {
      return -1;
    }
    return this.toast(title, options);
  }

  /** Always shows an in-app toast (feedback for user actions such as "Saved"). */
  toast(title: string, options: NotifyOptions = {}): number {
    const id = this.nextId++;
    const toast: Toast = { id, kind: options.kind ?? 'info', title, message: options.message };
    this._toasts.update((list) => {
      const next = [...list, toast];
      const overflow = next.length - NotificationService.MAX_TOASTS;
      if (overflow > 0) {
        next.slice(0, overflow).forEach((t) => this.clearTimer(t.id));
        return next.slice(overflow);
      }
      return next;
    });
    const duration = options.durationMs ?? NotificationService.DEFAULT_DURATION_MS;
    if (duration > 0) {
      this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
    }
    return id;
  }

  success(title: string, message?: string): number {
    return this.toast(title, { kind: 'success', message });
  }

  error(title: string, message?: string): number {
    return this.toast(title, { kind: 'error', message, durationMs: 8000 });
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Whether the browser supports notifications and permission is granted. */
  browserPermission(): NotificationPermission | 'unsupported' {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  async requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }
    return Notification.requestPermission();
  }

  /** Raises a system notification only when enabled and permitted; returns whether it was shown. */
  browserNotify(title: string, body?: string): boolean {
    if (!this.browserEnabled() || this.browserPermission() !== 'granted') {
      return false;
    }
    try {
      new Notification(title, { body, tag: `quickflow-${title}` });
      return true;
    } catch {
      return false;
    }
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
