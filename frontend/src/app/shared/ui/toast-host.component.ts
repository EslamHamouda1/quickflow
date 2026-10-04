import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../core/notification.service';
import { IconComponent } from './icon.component';

/** Renders in-app toasts with animated enter/leave; announced politely to screen readers. */
@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="toasts" aria-live="polite" aria-label="Notifications">
      @for (toast of notifications.toasts(); track toast.id) {
        <div
          class="toast"
          [attr.data-kind]="toast.kind"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
          animate.enter="qf-enter-toast"
          animate.leave="qf-leave-toast"
        >
          <app-icon class="toast__icon" [name]="toast.kind" [size]="20" />
          <div class="toast__body">
            <p class="toast__title">{{ toast.title }}</p>
            @if (toast.message) {
              <p class="toast__message">{{ toast.message }}</p>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-icon toast__close" (click)="notifications.dismiss(toast.id)" aria-label="Dismiss notification">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: min(380px, calc(100vw - 2 * var(--space-4)));
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-left: 4px solid var(--info);
      box-shadow: var(--shadow-3);
      pointer-events: auto;
    }
    .toast[data-kind='success'] { border-left-color: var(--success); }
    .toast[data-kind='success'] .toast__icon { color: var(--success); }
    .toast[data-kind='warning'] { border-left-color: var(--warning); }
    .toast[data-kind='warning'] .toast__icon { color: var(--warning); }
    .toast[data-kind='error'] { border-left-color: var(--danger); }
    .toast[data-kind='error'] .toast__icon { color: var(--danger); }
    .toast[data-kind='info'] .toast__icon { color: var(--info); }
    .toast__icon { margin-top: 2px; }
    .toast__body { flex: 1; min-width: 0; }
    .toast__title { font-weight: var(--weight-semibold); font-size: var(--text-sm); }
    .toast__message { color: var(--text-muted); font-size: var(--text-sm); }
    .toast__close { width: 32px; min-height: 32px; }
    .qf-enter-toast { animation: qf-slide-in-right var(--duration-base) var(--ease-out) both; }
    .qf-leave-toast { animation: qf-slide-out-right var(--duration-fast) var(--ease-in) both; }
  `,
})
export class ToastHostComponent {
  protected readonly notifications = inject(NotificationService);
}
