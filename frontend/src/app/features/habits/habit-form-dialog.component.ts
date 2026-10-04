import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { Habit, HabitFrequency, HabitRequest } from '../../api';
import { ApiErrorInfo } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { HabitsStore } from './habits.store';

export const NAME_MAX = 150;
export const HABIT_DESCRIPTION_MAX = 2000;

type FieldName = 'name' | 'description' | 'frequency';
const FIELDS: readonly FieldName[] = ['name', 'description', 'frequency'];

export const FREQUENCY_OPTIONS: readonly { value: HabitFrequency; label: string; hint: string }[] = [
  { value: HabitFrequency.Daily, label: 'Daily', hint: 'Once every day' },
  { value: HabitFrequency.Weekly, label: 'Weekly', hint: 'Once every week (Mon–Sun)' },
];

/** Client-side validation of the habit form; returns one message per invalid field. */
export function validateHabitForm(value: { name: string; description: string }): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const name = value.name.trim();
  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters (currently ${name.length}).`;
  }
  if (value.description.length > HABIT_DESCRIPTION_MAX) {
    errors.description = `Description must be at most 2,000 characters (currently ${value.description.length.toLocaleString('en-US')}).`;
  }
  return errors;
}

/**
 * Create / edit habit dialog (native modal `<dialog>`, Esc cancels): name required ≤ 150,
 * optional description ≤ 2,000, Daily/Weekly segmented control (radio group). Server `errors[]`
 * are shown per field.
 */
@Component({
  selector: 'app-habit-form-dialog',
  imports: [FormFieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="habit-form-title"
      (cancel)="onCancel($event)"
      (click)="onBackdrop($event)"
    >
      <form class="form" novalidate (submit)="submit($event)">
        <header class="form__header">
          <h2 id="habit-form-title" class="form__title">{{ isEdit() ? 'Edit habit' : 'Add habit' }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Close" (click)="close()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        @if (formError()) {
          <p class="form__alert" role="alert" animate.enter="qf-enter-fade">
            <app-icon name="alert" [size]="16" /> {{ formError() }}
          </p>
        }

        <app-form-field label="Name" forId="habit-name" [required]="true" [error]="shownError('name')">
          <span fieldCounter class="counter" [class.is-over]="nameLength() > nameMax" aria-hidden="true">
            {{ nameLength() }}/{{ nameMax }}
          </span>
          <input
            #nameInput
            id="habit-name"
            name="name"
            class="input"
            type="text"
            autocomplete="off"
            aria-required="true"
            placeholder="e.g. Read 20 pages"
            [value]="name()"
            (input)="name.set(inputValue($event)); clearServerError('name')"
            (blur)="touch('name')"
          />
        </app-form-field>
        <p class="sr-only" aria-live="polite">{{ nameLength() > nameMax ? 'Name is too long' : '' }}</p>

        <app-form-field
          label="Description"
          forId="habit-description"
          [hint]="'Optional · ' + descriptionLength().toLocaleString('en-US') + ' / 2,000'"
          [error]="shownError('description')"
        >
          <textarea
            id="habit-description"
            name="description"
            class="textarea"
            rows="3"
            [value]="description()"
            (input)="description.set(inputValue($event)); clearServerError('description')"
            (blur)="touch('description')"
          ></textarea>
        </app-form-field>

        <fieldset class="freq">
          <legend class="freq__label">Frequency</legend>
          <div class="segmented" role="radiogroup" aria-label="Frequency" [attr.aria-describedby]="shownError('frequency') ? 'habit-frequency-error' : null">
            <span class="segmented__thumb" aria-hidden="true" [style.transform]="'translateX(' + frequencyIndex() * 100 + '%)'"></span>
            @for (o of frequencyOptions; track o.value) {
              <label class="segmented__option" [class.is-selected]="frequency() === o.value" [title]="o.hint">
                <input
                  type="radio"
                  name="frequency"
                  class="sr-only"
                  [value]="o.value"
                  [checked]="frequency() === o.value"
                  (change)="frequency.set(o.value); clearServerError('frequency')"
                />
                {{ o.label }}
              </label>
            }
          </div>
          <p class="freq__hint">{{ frequencyHint() }}</p>
          @if (shownError('frequency')) {
            <p id="habit-frequency-error" class="freq__error" role="alert">{{ shownError('frequency') }}</p>
          }
        </fieldset>

        <footer class="form__actions">
          <button type="button" class="btn" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner" aria-hidden="true"></span> Saving…
            } @else {
              <app-icon [name]="isEdit() ? 'check' : 'plus'" [size]="18" />
              {{ isEdit() ? 'Save changes' : 'Add habit' }}
            }
          </button>
        </footer>
      </form>
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(520px, calc(100vw - 2 * var(--space-4)));
      max-height: calc(100dvh - 2 * var(--space-4));
      padding: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      background: var(--bg-elevated);
      color: var(--text);
      box-shadow: var(--shadow-3);
      overflow: auto;
    }
    .dialog[open] { animation: qf-scale-in var(--duration-base) var(--ease-out) both; }
    .dialog::backdrop { background: var(--scrim); animation: qf-fade-in var(--duration-base) var(--ease-out) both; }
    .form { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6); }
    .form__header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .form__title { font-size: var(--text-xl); }
    .form__alert {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      background: var(--danger-soft);
      color: var(--danger);
      font-size: var(--text-sm);
    }
    .form__actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }
    .counter { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .counter.is-over { color: var(--danger); font-weight: var(--weight-semibold); }

    .freq { border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .freq__label { padding: 0; margin-bottom: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-medium); }
    .freq__hint { font-size: var(--text-xs); color: var(--text-muted); }
    .freq__error { font-size: var(--text-xs); color: var(--danger); }
    .segmented {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 4px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      max-width: 320px;
    }
    .segmented__thumb {
      position: absolute;
      top: 4px;
      bottom: 4px;
      left: 4px;
      width: calc(50% - 4px);
      border-radius: var(--radius-pill);
      background: var(--primary);
      box-shadow: var(--shadow-1);
      transition: transform var(--duration-base) var(--ease-spring);
    }
    .segmented__option {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      min-height: 36px;
      border-radius: var(--radius-pill);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      transition: color var(--duration-fast) var(--ease-standard);
    }
    .segmented__option.is-selected { color: var(--on-primary); }
    .segmented__option:has(input:focus-visible) { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin var(--duration-slow) linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class HabitFormDialogComponent {
  /** Habit to edit; null opens the dialog in create mode. */
  readonly habit = input<Habit | null>(null);
  /** Emits the saved habit, or null when cancelled. */
  readonly closed = output<Habit | null>();

  private readonly store = inject(HabitsStore);
  private readonly notify = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly nameMax = NAME_MAX;
  protected readonly frequencyOptions = FREQUENCY_OPTIONS;

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly frequency = signal<HabitFrequency>(HabitFrequency.Daily);

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<ReadonlySet<FieldName>>(new Set());
  protected readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = computed(() => !!this.habit());
  protected readonly nameLength = computed(() => this.name().trim().length);
  protected readonly descriptionLength = computed(() => this.description().length);
  protected readonly frequencyIndex = computed(() =>
    Math.max(0, FREQUENCY_OPTIONS.findIndex((o) => o.value === this.frequency())),
  );
  protected readonly frequencyHint = computed(
    () => FREQUENCY_OPTIONS.find((o) => o.value === this.frequency())?.hint ?? '',
  );
  protected readonly clientErrors = computed(() =>
    validateHabitForm({ name: this.name(), description: this.description() }),
  );

  private opener: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      const h = this.habit();
      if (h) {
        this.name.set(h.name);
        this.description.set(h.description ?? '');
        this.frequency.set(h.frequency);
      }
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.dialog().nativeElement.showModal();
      this.nameInput().nativeElement.focus();
    });
  }

  /** Server error first, then client error once touched/submitted (over-length errors show live). */
  protected shownError(field: FieldName): string {
    const server = this.serverErrors()[field];
    if (server) {
      return server;
    }
    const client = this.clientErrors()[field];
    if (!client) {
      return '';
    }
    const live = field === 'description' || (field === 'name' && this.nameLength() > NAME_MAX);
    return live || this.submitted() || this.touched().has(field) ? client : '';
  }

  protected touch(field: FieldName): void {
    this.touched.update((s) => new Set(s).add(field));
  }

  protected clearServerError(field: FieldName): void {
    if (this.serverErrors()[field]) {
      this.serverErrors.update(({ [field]: _removed, ...rest }) => rest);
    }
    this.formError.set(null);
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (this.saving()) {
      return;
    }
    if (Object.keys(this.clientErrors()).length > 0) {
      this.focusFirstInvalid();
      return;
    }
    const request: HabitRequest = {
      name: this.name().trim(),
      description: this.description().trim() ? this.description() : null,
      frequency: this.frequency(),
    };
    this.saving.set(true);
    this.formError.set(null);
    try {
      const existing = this.habit();
      const saved = existing ? await this.store.update(existing.id, request) : await this.store.create(request);
      this.notify.success(existing ? 'Habit updated' : 'Habit added', saved.name);
      this.finish(saved);
    } catch (err) {
      const info = err as ApiErrorInfo;
      const known: Partial<Record<FieldName, string>> = {};
      const other: string[] = [];
      for (const [field, message] of Object.entries(info.fieldErrors ?? {})) {
        if ((FIELDS as readonly string[]).includes(field)) {
          known[field as FieldName] = message;
        } else {
          other.push(`${field}: ${message}`);
        }
      }
      this.serverErrors.set(known);
      const hasFieldErrors = Object.keys(known).length > 0;
      this.formError.set(
        other.length ? other.join(' ') : hasFieldErrors ? 'Please fix the highlighted fields.' : info.message,
      );
      this.saving.set(false);
      if (hasFieldErrors) {
        this.focusFirstInvalid();
      }
    }
  }

  protected close(): void {
    this.finish(null);
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    const el = this.dialog().nativeElement;
    if (event.target !== el) {
      return;
    }
    const r = el.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {
      this.close();
    }
  }

  private finish(result: Habit | null): void {
    const el = this.dialog().nativeElement;
    if (el.open) {
      el.close();
    }
    this.opener?.focus();
    this.closed.emit(result);
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () => {
        const el = this.dialog().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        (el ?? this.nameInput().nativeElement).focus();
      },
      { injector: this.injector },
    );
  }
}
