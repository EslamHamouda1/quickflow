import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { Task, TaskStatus } from '../../api';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatDate, formatDateTime, priorityLabel, statusLabel } from './task-labels';

/** One task row: completion toggle, chips, overdue badge and row actions. */
@Component({
  selector: 'app-task-item',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    class: 'task',
    '[class.is-done]': 'isDone()',
    '[class.is-overdue]': 'task().overdue',
    '[class.is-archived]': 'task().archived',
    '[class.is-busy]': 'busy()',
    '[attr.data-id]': 'task().id',
    '[attr.aria-busy]': 'busy() || null',
  },
  template: `
    <button
      type="button"
      class="check"
      [class.is-checked]="isDone()"
      [class.is-popping]="popping()"
      [disabled]="busy() || task().archived"
      [attr.aria-pressed]="isDone()"
      [attr.aria-label]="(isDone() ? 'Mark as not done: ' : 'Mark as done: ') + task().title"
      [title]="task().archived ? 'Restore the task to change its status' : isDone() ? 'Mark as not done' : 'Mark as done'"
      (click)="onToggle()"
      (animationend)="popping.set(false)"
    >
      <app-icon name="check" [size]="16" />
    </button>

    <div class="task__body">
      <h3 class="task__title truncate" [title]="task().title">{{ task().title }}</h3>
      @if (task().description) {
        <p class="task__desc line-clamp-2" [title]="task().description">{{ task().description }}</p>
      }
      <div class="task__meta">
        <span class="chip status" [attr.data-status]="task().status">{{ statusText() }}</span>
        <span class="chip priority" [attr.data-priority]="task().priority">
          <span class="dot" aria-hidden="true"></span>{{ priorityText() }} priority
        </span>
        @if (task().overdue) {
          <span class="chip overdue qf-pop">
            <app-icon name="alert" [size]="12" /> Overdue
          </span>
        }
        @if (task().dueDate) {
          <span class="meta-text" [class.is-overdue]="task().overdue">
            <app-icon name="plans" [size]="14" /> Due {{ due() }}
          </span>
        }
        @if (task().archived) {
          <span class="chip archived"><app-icon name="archive" [size]="12" /> Archived</span>
        }
        @if (task().completedAt) {
          <span class="meta-text"><app-icon name="success" [size]="14" /> Completed {{ completed() }}</span>
        }
        <span class="meta-text subtle" [title]="'Created ' + created()">Updated {{ updated() }}</span>
      </div>
    </div>

    <div class="task__actions">
      @if (!task().archived) {
        <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Edit task: ' + task().title" title="Edit" (click)="edit.emit(task())">
          <app-icon name="edit" [size]="18" />
        </button>
        <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Archive task: ' + task().title" title="Archive" (click)="archive.emit(task())">
          <app-icon name="archive" [size]="18" />
        </button>
      } @else {
        <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Restore task: ' + task().title" title="Restore" (click)="restore.emit(task())">
          <app-icon name="restore" [size]="18" />
        </button>
      }
      <button type="button" class="btn btn-ghost btn-icon danger" [disabled]="busy()" [attr.aria-label]="'Delete task: ' + task().title" title="Delete" (click)="remove.emit(task())">
        <app-icon name="trash" [size]="18" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-left: 4px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-1);
      transition: border-color var(--duration-base) var(--ease-standard), background-color var(--duration-base) var(--ease-standard), opacity var(--duration-base) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard);
    }
    :host(:hover) { box-shadow: var(--shadow-2); }
    :host(.is-overdue) { border-left-color: var(--danger); }
    :host(.is-done) { border-left-color: var(--success); }
    :host(.is-archived) { background: var(--surface-2); }
    :host(.is-busy) { opacity: 0.7; }

    .check {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      margin-top: 2px;
      border: 2px solid var(--border-strong);
      border-radius: 50%;
      background: transparent;
      color: transparent;
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), transform var(--duration-instant) var(--ease-standard);
    }
    .check:hover:not(:disabled) { border-color: var(--success); color: var(--success); }
    .check:active:not(:disabled) { transform: scale(0.9); }
    .check:disabled { cursor: not-allowed; opacity: 0.6; }
    .check.is-checked { background: var(--success); border-color: var(--success); color: var(--text-inverse); }
    .check.is-checked:hover:not(:disabled) { color: var(--text-inverse); }
    .check.is-popping { animation: qf-pop var(--duration-slow) var(--ease-spring); }

    .task__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .task__title {
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
      transition: color var(--duration-base) var(--ease-standard);
    }
    :host(.is-done) .task__title { color: var(--text-muted); text-decoration: line-through; }
    .task__desc { color: var(--text-muted); font-size: var(--text-sm); }
    .task__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }
    .meta-text {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
    .meta-text.is-overdue { color: var(--danger); font-weight: var(--weight-semibold); }
    .status[data-status='TODO'] { background: var(--surface-2); color: var(--text-muted); }
    .status[data-status='IN_PROGRESS'] { background: var(--info-soft); color: var(--info); }
    .status[data-status='DONE'] { background: var(--success-soft); color: var(--success); }
    .priority .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .priority[data-priority='HIGH'] { background: var(--danger-soft); color: var(--danger); }
    .priority[data-priority='MEDIUM'] { background: var(--warning-soft); color: var(--warning); }
    .priority[data-priority='LOW'] { background: var(--surface-2); color: var(--text-muted); }
    .overdue { background: var(--danger); color: var(--text-inverse); }
    .archived { background: var(--surface-hover); color: var(--text-muted); }

    .task__actions { display: flex; flex-shrink: 0; gap: var(--space-1); }
    .task__actions .btn-icon { width: 36px; min-height: 36px; }
    .task__actions .danger:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }

    @media (max-width: 599px) {
      :host { flex-wrap: wrap; }
      .task__actions { width: 100%; justify-content: flex-end; }
    }
  `,
})
export class TaskItemComponent {
  readonly task = input.required<Task>();
  readonly busy = input(false);

  readonly toggleDone = output<Task>();
  readonly edit = output<Task>();
  readonly archive = output<Task>();
  readonly restore = output<Task>();
  readonly remove = output<Task>();

  protected readonly popping = signal(false);
  protected readonly isDone = computed(() => this.task().status === TaskStatus.Done);
  protected readonly statusText = computed(() => statusLabel(this.task().status));
  protected readonly priorityText = computed(() => priorityLabel(this.task().priority));
  protected readonly due = computed(() => formatDate(this.task().dueDate));
  protected readonly completed = computed(() => formatDateTime(this.task().completedAt));
  protected readonly updated = computed(() => formatDateTime(this.task().updatedAt));
  protected readonly created = computed(() => formatDateTime(this.task().createdAt));

  protected onToggle(): void {
    if (!this.isDone()) {
      this.popping.set(true);
    }
    this.toggleDone.emit(this.task());
  }
}
