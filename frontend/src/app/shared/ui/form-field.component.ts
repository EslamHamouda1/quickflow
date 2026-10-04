import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
} from '@angular/core';

/**
 * Label + hint + error wrapper. The projected control must have `id === forId`; the
 * component links hint/error to it via `aria-describedby` and sets `aria-invalid`.
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field__label-row">
      <label class="field__label" [attr.for]="forId()">
        {{ label() }}
        @if (required()) {
          <span class="field__req" aria-hidden="true">*</span>
        }
      </label>
      <ng-content select="[fieldCounter]" />
    </div>
    <ng-content />
    @if (hint() && !error()) {
      <p class="field__hint" [id]="hintId()">{{ hint() }}</p>
    }
    @if (error()) {
      <p class="field__error" [id]="errorId()" role="alert" animate.enter="qf-enter-fade">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }
    .field__label-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-2);
    }
    .field__label {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }
    .field__req { color: var(--danger); margin-left: 2px; }
    .field__hint { font-size: var(--text-xs); color: var(--text-muted); }
    .field__error { font-size: var(--text-xs); color: var(--danger); font-weight: var(--weight-medium); }
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly forId = input.required<string>();
  readonly hint = input('');
  readonly error = input<string | null | undefined>('');
  readonly required = input(false);

  protected readonly hintId = computed(() => `${this.forId()}-hint`);
  protected readonly errorId = computed(() => `${this.forId()}-error`);

  /** Space-separated ids describing the control (currently shown hint or error). */
  readonly describedBy = computed(() => {
    if (this.error()) {
      return this.errorId();
    }
    return this.hint() ? this.hintId() : '';
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect(() => {
      const describedBy = this.describedBy();
      const invalid = !!this.error();
      const control = this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(this.forId())}`);
      if (!control) {
        return;
      }
      if (describedBy) {
        control.setAttribute('aria-describedby', describedBy);
      } else {
        control.removeAttribute('aria-describedby');
      }
      if (invalid) {
        control.setAttribute('aria-invalid', 'true');
      } else {
        control.removeAttribute('aria-invalid');
      }
    });
  }
}
