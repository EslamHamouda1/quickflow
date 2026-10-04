import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';
import { IconComponent } from './icon.component';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Native `<dialog>` confirm prompt: focus trapped inside, Esc cancels, focus returns to the opener. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      (cancel)="onCancel($event)"
      (keydown)="onKeydown($event)"
      (click)="onBackdrop($event)"
    >
      @if (service.request(); as req) {
        <div class="dialog__body">
          <div class="dialog__icon" [class.is-danger]="req.danger">
            <app-icon [name]="req.danger ? 'alert' : 'info'" [size]="22" />
          </div>
          <div class="dialog__text">
            <h2 id="confirm-dialog-title" class="dialog__title">{{ req.title }}</h2>
            <p id="confirm-dialog-message" class="dialog__message">{{ req.message }}</p>
          </div>
        </div>
        <div class="dialog__actions">
          <button #cancelBtn type="button" class="btn" (click)="service.close(false)">{{ req.cancelLabel }}</button>
          <button type="button" class="btn" [class.btn-danger]="req.danger" [class.btn-primary]="!req.danger" (click)="service.close(true)">
            {{ req.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(440px, calc(100vw - 2 * var(--space-4)));
      padding: var(--space-6);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      background: var(--bg-elevated);
      color: var(--text);
      box-shadow: var(--shadow-3);
    }
    .dialog[open] {
      animation: qf-scale-in var(--duration-base) var(--ease-out) both;
    }
    .dialog::backdrop {
      background: var(--scrim);
      animation: qf-fade-in var(--duration-base) var(--ease-out) both;
    }
    .dialog__body { display: flex; gap: var(--space-4); }
    .dialog__icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--info-soft);
      color: var(--info);
    }
    .dialog__icon.is-danger { background: var(--danger-soft); color: var(--danger); }
    .dialog__text { min-width: 0; }
    .dialog__title { font-size: var(--text-lg); margin-bottom: var(--space-1); }
    .dialog__message { color: var(--text-muted); font-size: var(--text-sm); }
    .dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-6);
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly service = inject(ConfirmDialogService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const open = this.service.request() !== null;
      const el = this.dialog().nativeElement;
      if (open && !el.open) {
        this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        el.showModal();
        // Safest default focus: the cancel button.
        queueMicrotask(() => this.cancelBtn()?.nativeElement.focus());
      } else if (!open && el.open) {
        el.close();
        this.opener?.focus();
        this.opener = null;
      }
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.service.close(false);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      const rect = this.dialog().nativeElement.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) {
        this.service.close(false);
      }
    }
  }

  /** Focus trap: Tab / Shift+Tab cycle within the dialog; Esc cancels. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.service.close(false);
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const items = Array.from(this.dialog().nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
