import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'message'>> {
  message: string;
  resolve: (confirmed: boolean) => void;
}

/** Opens the shared confirm dialog (rendered once in the shell) and resolves with the choice. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    // A pending request is cancelled when a new one arrives.
    this._request()?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this._request.set({
        title: options.title,
        message: options.message ?? '',
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        resolve,
      });
    });
  }

  /** Called by the dialog component. */
  close(confirmed: boolean): void {
    const req = this._request();
    if (!req) {
      return;
    }
    this._request.set(null);
    req.resolve(confirmed);
  }
}
