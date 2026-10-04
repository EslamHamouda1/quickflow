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

import { LearningCard, LearningCardRequest, LearningStatus } from '../../api';
import { ApiErrorInfo } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LearningStore } from './learning.store';

export const TITLE_MAX = 200;
export const LEARNING_DESCRIPTION_MAX = 2000;

type FieldName = 'title' | 'description' | 'status';
const FIELDS: readonly FieldName[] = ['title', 'description', 'status'];

export const STATUS_OPTIONS: readonly { value: LearningStatus; label: string }[] = [
  { value: LearningStatus.NotStarted, label: 'Not Started' },
  { value: LearningStatus.InProgress, label: 'In Progress' },
  { value: LearningStatus.Completed, label: 'Completed' },
];

export function learningStatusLabel(status: LearningStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

/** Client-side validation of the learning card form; returns one message per invalid field. */
export function validateLearningCardForm(value: {
  title: string;
  description: string;
}): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const title = value.title.trim();
  if (!title) {
    errors.title = 'Title is required.';
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title must be at most ${TITLE_MAX} characters (currently ${title.length}).`;
  }
  if (value.description.length > LEARNING_DESCRIPTION_MAX) {
    errors.description = `Description must be at most 2,000 characters (currently ${value.description.length.toLocaleString('en-US')}).`;
  }
  return errors;
}

/**
 * Create / edit learning card dialog (native modal `<dialog>`, Esc cancels): title required ≤ 200,
 * optional description/source ≤ 2,000; in edit mode a manual status select (FR-013).
 * Server `errors[]` are shown per field.
 */
@Component({
  selector: 'app-learning-card-form-dialog',
  imports: [FormFieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="learning-form-title"
      (cancel)="onCancel($event)"
      (click)="onBackdrop($event)"
    >
      <form class="form" novalidate (submit)="submit($event)">
        <header class="form__header">
          <h2 id="learning-form-title" class="form__title">{{ isEdit() ? 'Edit learning card' : 'Add learning card' }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Close" (click)="close()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        @if (formError()) {
          <p class="form__alert" role="alert" animate.enter="qf-enter-fade">
            <app-icon name="alert" [size]="16" /> {{ formError() }}
          </p>
        }

        <app-form-field label="Title" forId="learning-title" [required]="true" [error]="shownError('title')">
          <span fieldCounter class="counter" [class.is-over]="titleLength() > titleMax" aria-hidden="true">
            {{ titleLength() }}/{{ titleMax }}
          </span>
          <input
            #titleInput
            id="learning-title"
            name="title"
            class="input"
            type="text"
            autocomplete="off"
            aria-required="true"
            placeholder="e.g. Angular Signals course"
            [value]="title()"
            (input)="title.set(inputValue($event)); clearServerError('title')"
            (blur)="touch('title')"
          />
        </app-form-field>
        <p class="sr-only" aria-live="polite">{{ titleLength() > titleMax ? 'Title is too long' : '' }}</p>

        <app-form-field
          label="Description / source"
          forId="learning-description"
          [hint]="'Optional · ' + descriptionLength().toLocaleString('en-US') + ' / 2,000'"
          [error]="shownError('description')"
        >
          <textarea
            id="learning-description"
            name="description"
            class="textarea"
            rows="3"
            placeholder="Link, book author, topic notes…"
            [value]="description()"
            (input)="description.set(inputValue($event)); clearServerError('description')"
            (blur)="touch('description')"
          ></textarea>
        </app-form-field>

        @if (isEdit()) {
          <app-form-field
            label="Status"
            forId="learning-status"
            hint="Set manually; the next milestone add, toggle or removal recomputes it."
            [error]="shownError('status')"
          >
            <select
              id="learning-status"
              name="status"
              class="select"
              [value]="status()"
              (change)="status.set(selectValue($event)); clearServerError('status')"
            >
              @for (o of statusOptions; track o.value) {
                <option [value]="o.value" [selected]="status() === o.value">{{ o.label }}</option>
              }
            </select>
          </app-form-field>
        }

        <footer class="form__actions">
          <button type="button" class="btn" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner" aria-hidden="true"></span> Saving…
            } @else {
              <app-icon [name]="isEdit() ? 'check' : 'plus'" [size]="18" />
              {{ isEdit() ? 'Save changes' : 'Add card' }}
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
export class LearningCardFormDialogComponent {
  /** Card to edit; null opens the dialog in create mode. */
  readonly card = input<LearningCard | null>(null);
  /** Emits the saved card, or null when cancelled. */
  readonly closed = output<LearningCard | null>();

  private readonly store = inject(LearningStore);
  private readonly notify = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly titleMax = TITLE_MAX;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly status = signal<LearningStatus>(LearningStatus.NotStarted);

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<ReadonlySet<FieldName>>(new Set());
  protected readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = computed(() => !!this.card());
  protected readonly titleLength = computed(() => this.title().trim().length);
  protected readonly descriptionLength = computed(() => this.description().length);
  protected readonly clientErrors = computed(() =>
    validateLearningCardForm({ title: this.title(), description: this.description() }),
  );

  private opener: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      const c = this.card();
      if (c) {
        this.title.set(c.title);
        this.description.set(c.description ?? '');
        this.status.set(c.status);
      }
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.dialog().nativeElement.showModal();
      this.titleInput().nativeElement.focus();
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
    const live = field === 'description' || (field === 'title' && this.titleLength() > TITLE_MAX);
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

  protected selectValue(event: Event): LearningStatus {
    return (event.target as HTMLSelectElement).value as LearningStatus;
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
    const existing = this.card();
    const request: LearningCardRequest = {
      title: this.title().trim(),
      description: this.description().trim() ? this.description() : null,
    };
    // Only send a status when the user changed it, so an unchanged edit keeps the server's status.
    if (existing && this.status() !== existing.status) {
      request.status = this.status();
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const saved = existing ? await this.store.update(existing.id, request) : await this.store.create(request);
      this.notify.success(existing ? 'Learning card updated' : 'Learning card added', saved.title);
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

  private finish(result: LearningCard | null): void {
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
        (el ?? this.titleInput().nativeElement).focus();
      },
      { injector: this.injector },
    );
  }
}
