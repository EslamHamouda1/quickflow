import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { Habit } from '../../api';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { HabitCardComponent } from './habit-card.component';
import { HabitFormDialogComponent } from './habit-form-dialog.component';
import { HabitsStore } from './habits.store';

interface FormState {
  habit: Habit | null;
}

/** Habits page (US2): active / inactive card grids, today's completion toggle, stats, CRUD. */
@Component({
  selector: 'app-habits-page',
  imports: [EmptyStateComponent, HabitCardComponent, HabitFormDialogComponent, IconComponent, PageHeaderComponent],
  providers: [HabitsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header heading="Habits" subtitle="Build routines that stick">
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <app-icon name="plus" [size]="18" /> Add Habit
      </button>
    </app-page-header>

    @if (!store.loaded()) {
      <div class="grid" aria-busy="true" aria-label="Loading habits">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton skeleton-card"></div>
        }
      </div>
    } @else if (store.error() && store.habits().length === 0) {
      <app-empty-state icon="error" heading="Could not load habits" [message]="store.error()!">
        <button type="button" class="btn" (click)="store.load()"><app-icon name="restore" [size]="16" /> Retry</button>
      </app-empty-state>
    } @else if (store.habits().length === 0) {
      <app-empty-state
        icon="habits"
        heading="No habits yet"
        message="Add a daily or weekly habit, then tick it off each period to build a streak."
        actionLabel="Add Habit"
        (action)="openCreate()"
      />
    } @else {
      <section class="section" aria-labelledby="habits-active-heading">
        <div class="section__head">
          <h2 id="habits-active-heading" class="section__title">Active habits</h2>
          <p class="section__count" aria-live="polite" aria-atomic="true">{{ activeSummary() }}</p>
          @if (store.loading()) {
            <span class="section__loading" role="status" aria-label="Updating habits"></span>
          }
        </div>
        @if (store.active().length > 0) {
          <div class="today-bar" aria-hidden="true">
            <div class="today-bar__fill" [style.transform]="'scaleX(' + todayRatio() + ')'"></div>
          </div>
          <div class="grid" role="list" aria-label="Active habits">
            @for (habit of store.active(); track habit.id) {
              <app-habit-card
                animate.enter="habit-enter"
                animate.leave="habit-leave"
                [habit]="habit"
                [busy]="store.pending().has(habit.id)"
                (toggleToday)="store.toggleToday($event)"
                (undoPeriod)="undoPeriod($event)"
                (edit)="openEdit($event)"
                (deactivate)="store.deactivate($event)"
                (remove)="confirmRemove($event)"
              />
            }
          </div>
        } @else {
          <p class="section__empty">No active habits. Reactivate one below or add a new habit.</p>
        }
      </section>

      @if (store.inactive().length > 0) {
        <section class="section" aria-labelledby="habits-inactive-heading" animate.enter="qf-enter-fade">
          <div class="section__head">
            <h2 id="habits-inactive-heading" class="section__title">Inactive habits</h2>
            <p class="section__count">{{ store.inactive().length }} paused · history kept</p>
          </div>
          <div class="grid" role="list" aria-label="Inactive habits">
            @for (habit of store.inactive(); track habit.id) {
              <app-habit-card
                animate.enter="habit-enter"
                animate.leave="habit-leave"
                [habit]="habit"
                [busy]="store.pending().has(habit.id)"
                (activate)="store.activate($event)"
                (remove)="confirmRemove($event)"
              />
            }
          </div>
        </section>
      }
    }

    @if (form(); as f) {
      <app-habit-form-dialog [habit]="f.habit" (closed)="form.set(null)" />
    }
  `,
  styles: `
    :host { display: block; }
    .section + .section { margin-top: var(--space-8); }
    .section__head { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-3); }
    .section__title { font-size: var(--text-lg); }
    .section__count { color: var(--text-muted); font-size: var(--text-sm); }
    .section__empty { color: var(--text-muted); font-size: var(--text-sm); }
    .section__loading {
      width: 14px;
      height: 14px;
      align-self: center;
      border: 2px solid var(--primary);
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin var(--duration-slow) linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .today-bar {
      height: 6px;
      margin-bottom: var(--space-4);
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      overflow: hidden;
    }
    .today-bar__fill {
      height: 100%;
      background: var(--success);
      transform-origin: left center;
      transition: transform var(--duration-slow) var(--ease-out);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
      gap: var(--space-4);
    }
    .skeleton-card { height: 220px; border-radius: var(--radius-lg); }

    .grid ::ng-deep .habit-enter { animation: qf-scale-in var(--duration-base) var(--ease-out) both; }
    .grid ::ng-deep .habit-leave { animation: qf-scale-out var(--duration-base) var(--ease-in) both; }
  `,
})
export class HabitsPageComponent {
  protected readonly store = inject(HabitsStore);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  /** `?new=1` (dashboard quick-add) opens the create form. */
  readonly newParam = input<string | undefined>(undefined, { alias: 'new' });

  protected readonly form = signal<FormState | null>(null);

  protected readonly activeSummary = computed(() => {
    const total = this.store.active().length;
    return `${this.store.doneCount()} of ${total} done for this period`;
  });
  protected readonly todayRatio = computed(() => {
    const total = this.store.active().length;
    return total ? this.store.doneCount() / total : 0;
  });

  constructor() {
    effect(() => {
      if (this.newParam()) {
        untracked(() => {
          this.openCreate();
          void this.router.navigate([], { queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
        });
      }
    });
  }

  protected openCreate(): void {
    this.form.set({ habit: null });
  }

  protected openEdit(habit: Habit): void {
    this.form.set({ habit });
  }

  protected undoPeriod(habit: Habit): void {
    if (habit.lastCompletedDate) {
      void this.store.uncomplete(habit, habit.lastCompletedDate);
    }
  }

  protected async confirmRemove(habit: Habit): Promise<void> {
    const name = habit.name.length > 80 ? `${habit.name.slice(0, 79)}…` : habit.name;
    const ok = await this.confirm.confirm({
      title: 'Remove habit?',
      message: `"${name}" and all its completion history will be permanently deleted. To keep the history, deactivate it instead.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) {
      await this.store.remove(habit);
    }
  }
}
