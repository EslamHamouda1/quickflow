import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Task } from '../../api';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatDate, priorityLabel } from '../tasks/task-labels';

/** Compact task list for the dashboard (Today / Overdue) with an in-place "complete" check. */
@Component({
  selector: 'app-dashboard-task-list',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tasks().length === 0) {
      <p class="empty" animate.enter="qf-enter-fade"><app-icon [name]="emptyIcon()" [size]="18" /> {{ emptyText() }}</p>
    } @else {
      <ul class="list" role="list" [attr.aria-label]="label()">
        @for (task of tasks(); track task.id) {
          <li class="row" [attr.data-id]="task.id" [class.is-busy]="pending().has('task:' + task.id)" animate.enter="row-enter" animate.leave="row-leave">
            <button
              type="button"
              class="check"
              [disabled]="pending().has('task:' + task.id)"
              [attr.aria-label]="'Complete task: ' + task.title"
              title="Mark as done"
              (click)="complete.emit(task)"
            >
              <app-icon name="check" [size]="16" />
            </button>
            <div class="body">
              <span class="title truncate" [title]="task.title">{{ task.title }}</span>
              <span class="meta">
                <span class="chip priority" [attr.data-priority]="task.priority">{{ priority(task) }}</span>
                @if (task.dueDate) {
                  <span class="due" [class.is-overdue]="task.overdue">
                    <app-icon name="clock" [size]="12" />
                    {{ task.overdue ? 'Overdue · ' : 'Due ' }}{{ date(task.dueDate) }}
                  </span>
                }
              </span>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .list { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    .row { display: flex; align-items: center; gap: var(--space-3); min-width: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); transition: opacity var(--duration-base); }
    .row.is-busy { opacity: 0.6; }
    .check {
      flex-shrink: 0; display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
      border: 2px solid var(--border-strong); border-radius: 50%; background: var(--surface); color: transparent; cursor: pointer;
      transition: border-color var(--duration-fast), color var(--duration-fast), background var(--duration-fast), transform var(--duration-fast) var(--ease-spring);
    }
    .check:hover:not(:disabled), .check:focus-visible { border-color: var(--success); color: var(--success); }
    .check:active:not(:disabled) { transform: scale(0.9); }
    .check:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .check:disabled { background: var(--success); border-color: var(--success); color: var(--on-primary); cursor: default; }
    .body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .title { font-weight: var(--weight-medium); }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted); }
    .due { display: inline-flex; align-items: center; gap: 4px; }
    .due.is-overdue { color: var(--danger); font-weight: var(--weight-semibold); }
    .priority[data-priority='HIGH'] { background: var(--danger-soft); color: var(--danger); }
    .priority[data-priority='MEDIUM'] { background: var(--warning-soft); color: var(--warning); }
    .priority[data-priority='LOW'] { background: var(--surface); color: var(--text-muted); }
    .empty { display: flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-2) 0; }
    .row-enter { animation: qf-slide-up var(--duration-base) var(--ease-out) both; }
    .row-leave { animation: row-out var(--duration-base) var(--ease-in) both; }
    @keyframes row-out { to { opacity: 0; transform: translateX(24px); } }
  `,
})
export class DashboardTaskListComponent {
  readonly tasks = input.required<Task[]>();
  readonly label = input.required<string>();
  readonly pending = input<ReadonlySet<string>>(new Set());
  readonly emptyText = input('Nothing here.');
  readonly emptyIcon = input('success');
  readonly complete = output<Task>();

  protected readonly date = formatDate;

  protected priority(task: Task): string {
    return priorityLabel(task.priority);
  }
}
