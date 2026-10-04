import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Habit, HabitFrequency } from '../../api';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Today's habit checklist. Same rules as the Habits page (T045): the check is bound to
 * `completedToday`; a Weekly habit done earlier this week shows "Done this week" with an Undo of
 * that completion; the row's done styling follows `doneForCurrentPeriod`.
 */
@Component({
  selector: 'app-dashboard-habits',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (habits().length === 0) {
      <p class="empty"><app-icon name="habits" [size]="18" /> No active habits yet.</p>
    } @else {
      <ul class="list" role="list" aria-label="Today's habits">
        @for (habit of habits(); track habit.id) {
          <li class="row" [attr.data-id]="habit.id" [class.is-done]="habit.doneForCurrentPeriod" [class.is-busy]="busy(habit)" animate.enter="row-enter">
            <button
              type="button"
              class="check"
              [class.is-checked]="habit.completedToday"
              [disabled]="busy(habit)"
              [attr.aria-pressed]="habit.completedToday"
              [attr.aria-label]="(habit.completedToday ? 'Undo today\\'s completion: ' : 'Mark done for today: ') + habit.name"
              [title]="habit.completedToday ? 'Undo today\\'s completion' : 'Mark done for today'"
              (click)="toggle.emit(habit)"
            >
              <app-icon name="check" [size]="16" />
            </button>
            <div class="body">
              <span class="name truncate" [title]="habit.name">{{ habit.name }}</span>
              <span class="meta" aria-live="polite">
                <span class="chip freq" [attr.data-frequency]="habit.frequency">{{ weekly(habit) ? 'Weekly' : 'Daily' }}</span>
                @if (habit.completedToday) {
                  <span class="state done">Done today{{ weekly(habit) ? ' · this week counted' : '' }}</span>
                } @else if (habit.doneForCurrentPeriod) {
                  <span class="state done">Done this week</span>
                } @else {
                  <span class="state">{{ weekly(habit) ? 'Not done this week yet' : 'Not done today yet' }}</span>
                }
                @if (habit.currentStreak > 0) {
                  <span class="streak" [title]="'Current streak: ' + habit.currentStreak"><app-icon name="flame" [size]="12" />{{ habit.currentStreak }}</span>
                }
              </span>
            </div>
            @if (!habit.completedToday && habit.doneForCurrentPeriod && habit.lastCompletedDate) {
              <button type="button" class="btn btn-ghost undo" [disabled]="busy(habit)" [attr.aria-label]="'Undo this week\\'s completion of ' + habit.name" (click)="undoPeriod.emit(habit)">
                <app-icon name="restore" [size]="14" /> Undo
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .list { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    .row { display: flex; align-items: center; gap: var(--space-3); min-width: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); transition: background var(--duration-base), opacity var(--duration-base); }
    .row.is-done { background: var(--success-soft); }
    .row.is-busy { opacity: 0.6; }
    .check {
      flex-shrink: 0; display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
      border: 2px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: transparent; cursor: pointer;
      transition: border-color var(--duration-fast), color var(--duration-fast), background var(--duration-fast);
    }
    .check:hover:not(:disabled) { border-color: var(--success); color: var(--success); }
    .check:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .check.is-checked { background: var(--success); border-color: var(--success); color: var(--on-primary); animation: qf-pop var(--duration-slow) var(--ease-spring); }
    .check:disabled { cursor: default; }
    .body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .name { font-weight: var(--weight-medium); transition: color var(--duration-base); }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted); }
    .state.done { color: var(--success); font-weight: var(--weight-semibold); }
    .freq { background: var(--surface); }
    .streak { display: inline-flex; align-items: center; gap: 2px; color: var(--warning); font-weight: var(--weight-semibold); }
    .undo { flex-shrink: 0; min-height: 32px; padding: 0 var(--space-2); }
    .empty { display: flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-2) 0; }
    .row-enter { animation: qf-slide-up var(--duration-base) var(--ease-out) both; }
  `,
})
export class DashboardHabitsComponent {
  readonly habits = input.required<Habit[]>();
  readonly pending = input<ReadonlySet<string>>(new Set());
  readonly toggle = output<Habit>();
  readonly undoPeriod = output<Habit>();

  protected busy(habit: Habit): boolean {
    return this.pending().has(`habit:${habit.id}`);
  }

  protected weekly(habit: Habit): boolean {
    return habit.frequency === HabitFrequency.Weekly;
  }
}
