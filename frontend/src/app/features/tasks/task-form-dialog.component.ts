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

import { Task, TaskPriority, TaskRequest, TaskStatus } from '../../api';
import { ApiErrorInfo } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from './task-labels';
import { TasksStore } from './tasks.store';

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

type FieldName = 'title' | 'description' | 'status' | 'priority' | 'dueDate';

/** Client-side validation of the task form; returns one message per invalid field. */
export function validateTaskForm(value: { title: string; description: string }): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const title = value.title.trim();
  if (!title) {
    errors.title = 'Title is required.';
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title must be at most ${TITLE_MAX} characters (currently ${title.length}).`;
  }
  if (value.description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX.toLocaleString('en-US')} characters (currently ${value.description.length.toLocaleString('en-US')}).`;
  }
  return errors;
}

/**
 * Create / edit task dialog (native `<dialog>`, modal, Esc cancels). Validates on the client
 * (title 1-200 after trim, description ≤ 2,000) and shows server `errors[]` per field.
 */
@Component({
  selector: 'app-task-form-dialog',
  imports: [FormFieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="task-form-title"
      (cancel)="onCancel($event)"
      (click)="onBackdrop($event)"
    >
      <form class="form" novalidate (submit)="submit($event)">
        <header class="form__header">
          <h2 id="task-form-title" class="form__title">{{ isEdit() ? 'Edit task' : 'Add task' }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Close" (click)="close()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        @if (formError()) {
          <p class="form__alert" role="alert" animate.enter="qf-enter-fade">
            <app-icon name="alert" [size]="16" /> {{ formError() }}
          </p>
        }

        <app-form-field label="Title" forId="task-title" [required]="true" [error]="shownError('title')">
          <span fieldCounter class="counter" [class.is-over]="titleLength() > titleMax" aria-hidden="true">
            {{ titleLength() }}/{{ titleMax }}
          </span>
          <input
            #titleInput
            id="task-title"
            name="title"
            class="input"
            type="text"
            autocomplete="off"
            aria-required="true"
            [value]="title()"
            (input)="title.set(inputValue($event)); clearServerError('title')"
            (blur)="touch('title')"
          />
        </app-form-field>
        <p class="sr-only" aria-live="polite">{{ titleLength() > titleMax ? 'Title is too long' : '' }}</p>

        <app-form-field
          label="Description"
          forId="task-description"
          [hint]="'Optional · ' + descriptionLength().toLocaleString('en-US') + ' / 2,000'"
          [error]="shownError('description')"
        >
          <textarea
            id="task-description"
            name="description"
            class="textarea"
            rows="4"
            [value]="description()"
            (input)="description.set(inputValue($event)); clearServerError('description')"
            (blur)="touch('description')"
          ></textarea>
        </app-form-field>

        <div class="form__row">
          <app-form-field label="Status" forId="task-status" [error]="shownError('status')">
            <select
              id="task-status"
              name="status"
              class="select"
              [value]="status()"
              (change)="status.set($any(inputValue($event))); clearServerError('status')"
            >
              @for (o of statusOptions; track o.value) {
                <option [value]="o.value" [selected]="o.value === status()">{{ o.label }}</option>
              }
            </select>
          </app-form-field>

          <app-form-field label="Priority" forId="task-priority" [error]="shownError('priority')">
            <select
              id="task-priority"
              name="priority"
              class="select"
              [value]="priority()"
              (change)="priority.set($any(inputValue($event))); clearServerError('priority')"
            >
              @for (o of priorityOptions; track o.value) {
                <option [value]="o.value" [selected]="o.value === priority()">{{ o.label }}</option>
              }
            </select>
          </app-form-field>

          <app-form-field label="Due date" forId="task-due" hint="Optional" [error]="shownError('dueDate')">
            <input
              id="task-due"
              name="dueDate"
              class="input"
              type="date"
              [value]="dueDate()"
              (input)="dueDate.set(inputValue($event)); clearServerError('dueDate')"
            />
          </app-form-field>
        </div>

        <footer class="form__actions">
          <button type="button" class="btn" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner" aria-hidden="true"></span> Saving…
            } @else {
              <app-icon [name]="isEdit() ? 'check' : 'plus'" [size]="18" />
              {{ isEdit() ? 'Save changes' : 'Add task' }}
            }
          </button>
        </footer>
      </form>
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(560px, calc(100vw - 2 * var(--space-4)));
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
    .dialog::backdrop {
      background: var(--scrim);
      animation: qf-fade-in var(--duration-base) var(--ease-out) both;
    }
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
    .form__row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--space-4);
    }
    .form__actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }
    .counter {
      font-size: var(--text-xs);
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      transition: color var(--duration-fast) var(--ease-standard);
    }
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
export class TaskFormDialogComponent {
  /** Task to edit; null/undefined opens the dialog in create mode. */
  readonly task = input<Task | null>(null);
  /** Emits the saved task, or null when cancelled. */
  readonly closed = output<Task | null>();

  private readonly store = inject(TasksStore);
  private readonly notify = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly titleMax = TITLE_MAX;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly status = signal<TaskStatus>(TaskStatus.Todo);
  protected readonly priority = signal<TaskPriority>(TaskPriority.Medium);
  protected readonly dueDate = signal('');

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<ReadonlySet<FieldName>>(new Set());
  protected readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly isEdit = computed(() => !!this.task());
  protected readonly titleLength = computed(() => this.title().trim().length);
  protected readonly descriptionLength = computed(() => this.description().length);
  protected readonly clientErrors = computed(() =>
    validateTaskForm({ title: this.title(), description: this.description() }),
  );

  private opener: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      const t = this.task();
      if (t) {
        this.title.set(t.title);
        this.description.set(t.description ?? '');
        this.status.set(t.status);
        this.priority.set(t.priority);
        this.dueDate.set(t.dueDate ?? '');
      }
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.dialog().nativeElement.showModal();
      this.titleInput().nativeElement.focus();
    });
  }

  /** Error to display for a field: server error first, then client error once touched/submitted. */
  protected shownError(field: FieldName): string {
    const server = this.serverErrors()[field];
    if (server) {
      return server;
    }
    const client = this.clientErrors()[field];
    if (!client) {
      return '';
    }
    // Over-length errors show live; "required" waits for blur or submit.
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
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (this.saving()) {
      return;
    }
    const errors = this.clientErrors();
    if (Object.keys(errors).length > 0) {
      this.focusFirstInvalid();
      return;
    }
    const request: TaskRequest = {
      title: this.title().trim(),
      description: this.description().trim() ? this.description() : null,
      status: this.status(),
      priority: this.priority(),
      dueDate: this.dueDate() || null,
    };
    this.saving.set(true);
    this.formError.set(null);
    try {
      const existing = this.task();
      const saved = existing ? await this.store.update(existing.id, request) : await this.store.create(request);
      this.notify.success(existing ? 'Task updated' : 'Task added', saved.title);
      this.finish(saved);
    } catch (err) {
      const info = err as ApiErrorInfo;
      const known: Partial<Record<FieldName, string>> = {};
      const other: string[] = [];
      for (const [field, message] of Object.entries(info.fieldErrors ?? {})) {
        if (['title', 'description', 'status', 'priority', 'dueDate'].includes(field)) {
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

  private finish(result: Task | null): void {
    const el = this.dialog().nativeElement;
    if (el.open) {
      el.close();
    }
    this.opener?.focus();
    this.closed.emit(result);
  }

  private focusFirstInvalid(): void {
    // Wait for the render that sets aria-invalid on the controls.
    afterNextRender(
      () => {
        const el = this.dialog().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        (el ?? this.titleInput().nativeElement).focus();
      },
      { injector: this.injector },
    );
  }
}
