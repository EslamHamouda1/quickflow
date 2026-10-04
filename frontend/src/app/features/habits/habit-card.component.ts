import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { Habit, HabitFrequency } from '../../api';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatDate } from '../tasks/task-labels';

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Habit card: today's completion toggle, period badge, streak, completion-rate ring and actions. */
@Component({
  selector: 'app-habit-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    class: 'habit',
    '[class.is-done]': 'habit().doneForCurrentPeriod',
    '[class.is-inactive]': '!habit().active',
    '[class.is-busy]': 'busy()',
    '[attr.data-id]': 'habit().id',
    '[attr.aria-busy]': 'busy() || null',
  },
  template: `
    <div class="habit__head">
      <button
        type="button"
        class="check"
        [class.is-checked]="habit().completedToday"
        [class.is-popping]="popping()"
        [disabled]="busy() || !habit().active"
        [attr.aria-pressed]="habit().completedToday"
        [attr.aria-label]="(habit().completedToday ? 'Undo today\\'s completion: ' : 'Mark done for today: ') + habit().name"
        [title]="toggleTitle()"
        (click)="onToggle()"
        (animationend)="popping.set(false)"
      >
        <app-icon name="check" [size]="20" />
      </button>

      <div class="habit__title-block">
        <h3 class="habit__name truncate" [title]="habit().name">{{ habit().name }}</h3>
        <div class="habit__chips">
          <span class="chip freq" [attr.data-frequency]="habit().frequency">{{ frequencyLabel() }}</span>
          @if (!habit().active) {
            <span class="chip inactive">Inactive</span>
          }
        </div>
      </div>
    </div>

    @if (habit().description) {
      <p class="habit__desc line-clamp-2" [title]="habit().description">{{ habit().description }}</p>
    }

    <div class="habit__period" aria-live="polite">
      @if (!habit().active) {
        <span class="period todo">Paused — reactivate to track</span>
      } @else if (habit().completedToday) {
        <span class="period done" animate.enter="qf-enter-scale">
          <app-icon name="success" [size]="14" /> Done today{{ isWeekly() ? ' · this week counted' : '' }}
        </span>
      } @else if (habit().doneForCurrentPeriod) {
        <span class="period done-week" animate.enter="qf-enter-scale">
          <app-icon name="success" [size]="14" /> Done this week
        </span>
        <button
          type="button"
          class="btn btn-ghost btn-sm undo"
          [disabled]="busy() || !habit().active"
          [attr.aria-label]="'Undo this week\\'s completion of ' + habit().name"
          (click)="undoPeriod.emit(habit())"
        >
          <app-icon name="restore" [size]="14" /> Undo
        </button>
      } @else {
        <span class="period todo">{{ isWeekly() ? 'Not done this week yet' : 'Not done today yet' }}</span>
      }
    </div>

    <div class="habit__stats">
      <div
        class="streak"
        [class.is-hot]="habit().currentStreak > 0"
        [class.is-bumping]="bumping()"
        (animationend)="bumping.set(false)"
        [attr.aria-label]="'Current streak: ' + streakText()"
        role="img"
      >
        <app-icon name="flame" [size]="20" />
        <span class="streak__count">{{ habit().currentStreak }}</span>
        <span class="streak__unit">{{ streakUnit() }}</span>
      </div>

      <div class="rate" role="img" [attr.aria-label]="'Completion rate ' + rate() + '% over the ' + rateWindow()">
        <svg class="ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle class="ring__track" cx="24" cy="24" [attr.r]="ringRadius" />
          <circle
            class="ring__fill"
            cx="24"
            cy="24"
            [attr.r]="ringRadius"
            [attr.stroke-dasharray]="ringCircumference"
            [attr.stroke-dashoffset]="ringOffset()"
          />
        </svg>
        <div class="rate__text">
          <span class="rate__value">{{ rate() }}%</span>
          <span class="rate__label">{{ rateWindow() }}</span>
        </div>
      </div>
    </div>

    <footer class="habit__foot">
      <span class="meta-text">
        @if (habit().lastCompletedDate) {
          Last done {{ lastDone() }}
        } @else {
          Never completed
        }
      </span>
      <div class="habit__actions">
        @if (habit().active) {
          <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Edit habit: ' + habit().name" title="Edit" (click)="edit.emit(habit())">
            <app-icon name="edit" [size]="18" />
          </button>
          <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Deactivate habit: ' + habit().name" title="Deactivate (keeps history)" (click)="deactivate.emit(habit())">
            <app-icon name="archive" [size]="18" />
          </button>
        } @else {
          <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Reactivate habit: ' + habit().name" title="Reactivate" (click)="activate.emit(habit())">
            <app-icon name="restore" [size]="18" />
          </button>
        }
        <button type="button" class="btn btn-ghost btn-icon danger" [disabled]="busy()" [attr.aria-label]="'Remove habit: ' + habit().name" title="Remove" (click)="remove.emit(habit())">
          <app-icon name="trash" [size]="18" />
        </button>
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-width: 0;
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-top: 4px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-1);
      transition: border-color var(--duration-base) var(--ease-standard), background-color var(--duration-base) var(--ease-standard), opacity var(--duration-base) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
    }
    :host(:hover) { box-shadow: var(--shadow-2); transform: translateY(-1px); }
    :host(.is-done) { border-top-color: var(--success); }
    :host(.is-inactive) { background: var(--surface-2); border-top-color: var(--border); }
    :host(.is-inactive) .habit__name { color: var(--text-muted); }
    :host(.is-busy) { opacity: 0.7; }

    .habit__head { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
    .habit__title-block { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .habit__name { font-size: var(--text-md); font-weight: var(--weight-semibold); }
    .habit__chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .freq[data-frequency='DAILY'] { background: var(--primary-soft); color: var(--primary); }
    .freq[data-frequency='WEEKLY'] { background: var(--info-soft); color: var(--info); }
    .inactive { background: var(--surface-hover); color: var(--text-muted); }
    .habit__desc { color: var(--text-muted); font-size: var(--text-sm); }

    .check {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border: 2px solid var(--border-strong);
      border-radius: 50%;
      background: transparent;
      color: transparent;
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), transform var(--duration-instant) var(--ease-standard);
    }
    .check:hover:not(:disabled) { border-color: var(--success); color: var(--success); }
    .check:active:not(:disabled) { transform: scale(0.9); }
    .check:disabled { cursor: not-allowed; opacity: 0.5; }
    .check.is-checked { background: var(--success); border-color: var(--success); color: var(--text-inverse); }
    .check.is-checked:hover:not(:disabled) { color: var(--text-inverse); }
    .check.is-popping { animation: habit-pop var(--duration-slow) var(--ease-spring); }
    @keyframes habit-pop {
      0% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 50%, transparent); }
      45% { transform: scale(1.2); }
      100% { transform: scale(1); box-shadow: 0 0 0 12px transparent; }
    }

    .habit__period { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); min-height: 28px; }
    .period {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px var(--space-2);
      border-radius: var(--radius-pill);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
    }
    .period.done { background: var(--success-soft); color: var(--success); }
    .period.done-week { background: var(--info-soft); color: var(--info); }
    .period.todo { color: var(--text-muted); padding-left: 0; }
    .undo { min-height: 28px; padding: 0 var(--space-2); font-size: var(--text-xs); }

    .habit__stats { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
    .streak {
      display: inline-flex;
      align-items: baseline;
      gap: var(--space-1);
      color: var(--text-muted);
    }
    .streak app-icon { align-self: center; transition: color var(--duration-base) var(--ease-standard); }
    .streak.is-hot app-icon { color: var(--warning); }
    .streak__count {
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
      font-variant-numeric: tabular-nums;
      color: var(--text);
      line-height: 1;
    }
    .streak__unit { font-size: var(--text-xs); }
    .streak.is-bumping { animation: streak-bump var(--duration-slow) var(--ease-spring); }
    @keyframes streak-bump {
      0% { transform: scale(1); }
      40% { transform: scale(1.25) rotate(-4deg); }
      100% { transform: scale(1); }
    }

    .rate { display: flex; align-items: center; gap: var(--space-2); }
    .ring { width: 48px; height: 48px; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 5; }
    .ring__track { stroke: var(--surface-hover); }
    .ring__fill {
      stroke: var(--primary);
      stroke-linecap: round;
      transition: stroke-dashoffset var(--duration-slow) var(--ease-out), stroke var(--duration-base) var(--ease-standard);
    }
    :host(.is-done) .ring__fill { stroke: var(--success); }
    .rate__text { display: flex; flex-direction: column; line-height: 1.2; }
    .rate__value { font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; }
    .rate__label { font-size: var(--text-xs); color: var(--text-muted); }

    .habit__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--border);
    }
    .meta-text { font-size: var(--text-xs); color: var(--text-muted); min-width: 0; }
    .habit__actions { display: flex; flex-shrink: 0; gap: var(--space-1); }
    .habit__actions .btn-icon { width: 36px; min-height: 36px; }
    .habit__actions .danger:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
  `,
})
export class HabitCardComponent {
  readonly habit = input.required<Habit>();
  readonly busy = input(false);

  /** Toggle bound to `completedToday` (on → record today, off → remove today's completion). */
  readonly toggleToday = output<Habit>();
  /** Weekly "done this week" undo: removes `lastCompletedDate`'s completion. */
  readonly undoPeriod = output<Habit>();
  readonly edit = output<Habit>();
  readonly deactivate = output<Habit>();
  readonly activate = output<Habit>();
  readonly remove = output<Habit>();

  protected readonly ringRadius = RING_RADIUS;
  protected readonly ringCircumference = RING_CIRCUMFERENCE;

  protected readonly popping = signal(false);
  protected readonly bumping = signal(false);
  protected readonly isWeekly = computed(() => this.habit().frequency === HabitFrequency.Weekly);
  protected readonly frequencyLabel = computed(() => (this.isWeekly() ? 'Weekly' : 'Daily'));
  protected readonly rate = computed(() => Math.max(0, Math.min(100, Math.round(this.habit().completionRate))));
  protected readonly ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - this.rate() / 100));
  protected readonly rateWindow = computed(() => (this.isWeekly() ? 'last 12 weeks' : 'last 30 days'));
  protected readonly streakUnit = computed(() => {
    const n = this.habit().currentStreak;
    return this.isWeekly() ? (n === 1 ? 'week' : 'weeks') : n === 1 ? 'day' : 'days';
  });
  protected readonly streakText = computed(() => `${this.habit().currentStreak} ${this.streakUnit()}`);
  protected readonly lastDone = computed(() => formatDate(this.habit().lastCompletedDate));
  protected readonly toggleTitle = computed(() => {
    const h = this.habit();
    if (!h.active) {
      return 'Reactivate the habit to track it';
    }
    return h.completedToday ? 'Already done today — click to undo' : 'Mark done for today';
  });

  private previousStreak: number | null = null;

  constructor() {
    // Bump the flame when the streak grows (not on first render).
    effect(() => {
      const streak = this.habit().currentStreak;
      if (this.previousStreak !== null && streak > this.previousStreak) {
        this.bumping.set(true);
      }
      this.previousStreak = streak;
    });
  }

  protected onToggle(): void {
    if (!this.habit().completedToday) {
      this.popping.set(true);
    }
    this.toggleToday.emit(this.habit());
  }
}
