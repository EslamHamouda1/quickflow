import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

import { IconComponent } from '../../shared/ui/icon.component';
import { HabitFormDialogComponent } from '../habits/habit-form-dialog.component';
import { HabitsStore } from '../habits/habits.store';
import { LearningCardFormDialogComponent } from '../learning/learning-card-form-dialog.component';
import { LearningStore } from '../learning/learning.store';
import { PlanBuilderDialogComponent } from '../plans/plan-builder-dialog.component';
import { TaskFormDialogComponent } from '../tasks/task-form-dialog.component';
import { TasksStore } from '../tasks/tasks.store';

export type QuickAddKind = 'task' | 'habit' | 'learning' | 'plan';

/* The create dialogs talk to their feature store; each host provides one only while its dialog is open. */

@Component({
  selector: 'app-quick-add-task',
  imports: [TaskFormDialogComponent],
  providers: [TasksStore],
  template: `<app-task-form-dialog [task]="null" (closed)="closed.emit()" />`,
})
export class QuickAddTaskHostComponent {
  readonly closed = output<void>();
}

@Component({
  selector: 'app-quick-add-habit',
  imports: [HabitFormDialogComponent],
  providers: [HabitsStore],
  template: `<app-habit-form-dialog [habit]="null" (closed)="closed.emit()" />`,
})
export class QuickAddHabitHostComponent {
  readonly closed = output<void>();
}

@Component({
  selector: 'app-quick-add-learning',
  imports: [LearningCardFormDialogComponent],
  providers: [LearningStore],
  template: `<app-learning-card-form-dialog [card]="null" (closed)="closed.emit()" />`,
})
export class QuickAddLearningHostComponent {
  readonly closed = output<void>();
}

const ACTIONS: ReadonlyArray<{ kind: QuickAddKind; label: string; icon: string }> = [
  { kind: 'task', label: 'Task', icon: 'tasks' },
  { kind: 'habit', label: 'Habit', icon: 'habits' },
  { kind: 'learning', label: 'Learning card', icon: 'learning' },
  { kind: 'plan', label: 'Plan', icon: 'plans' },
];

/** Quick-add actions: each opens the matching create dialog in place (US5 scenario 7). */
@Component({
  selector: 'app-quick-add',
  imports: [
    IconComponent,
    PlanBuilderDialogComponent,
    QuickAddHabitHostComponent,
    QuickAddLearningHostComponent,
    QuickAddTaskHostComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="actions" role="group" aria-label="Quick add">
      @for (a of actions; track a.kind; let i = $index) {
        <button type="button" class="btn" [class.btn-primary]="i === 0" [attr.data-kind]="a.kind" [attr.aria-label]="'Add ' + a.label" (click)="open.set(a.kind)">
          <app-icon [name]="a.icon" [size]="16" /> {{ a.label }}
        </button>
      }
    </div>
    @switch (open()) {
      @case ('task') { <app-quick-add-task (closed)="open.set(null)" /> }
      @case ('habit') { <app-quick-add-habit (closed)="open.set(null)" /> }
      @case ('learning') { <app-quick-add-learning (closed)="open.set(null)" /> }
      @case ('plan') { <app-plan-builder-dialog (closed)="open.set(null)" /> }
    }
  `,
  styles: `
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  `,
})
export class QuickAddComponent {
  protected readonly actions = ACTIONS;
  protected readonly open = signal<QuickAddKind | null>(null);
}
