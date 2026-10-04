import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Habit } from '../../api';
import { SettingsStore } from '../../core/settings.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { DashboardGreetingComponent } from './dashboard-greeting.component';
import { DashboardHabitsComponent } from './dashboard-habits.component';
import { DashboardLearningComponent } from './dashboard-learning.component';
import { DashboardPlanToggle, DashboardPlansComponent } from './dashboard-plans.component';
import { DashboardTaskListComponent } from './dashboard-task-list.component';
import { DashboardStore } from './dashboard.store';
import { MetricCardComponent } from './metric-card.component';
import { QuickAddComponent } from './quick-add.component';

/**
 * Dashboard (US5): greeting, summary metric cards with count-up, today's / overdue tasks (complete in
 * place), today's habit checklist (toggle in place), in-progress plans with live rest time, learning
 * snapshot and quick-add actions. Data comes from `GET /api/dashboard` via `DashboardStore`, which
 * reloads after any change in the app, every 60 s, and when a plan starts or ends.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    DashboardGreetingComponent,
    DashboardHabitsComponent,
    DashboardLearningComponent,
    DashboardPlansComponent,
    DashboardTaskListComponent,
    EmptyStateComponent,
    IconComponent,
    MetricCardComponent,
    QuickAddComponent,
    RouterLink,
  ],
  providers: [DashboardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-greeting [name]="name()" [today]="store.data()?.today ?? null">
      <app-quick-add />
    </app-dashboard-greeting>

    @if (!store.loaded()) {
      <div aria-busy="true" aria-label="Loading dashboard">
        <div class="metrics">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton sk-metric"></div>
          }
        </div>
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton sk-panel"></div>
          }
        </div>
      </div>
    } @else if (store.error() && !store.data()) {
      <app-empty-state icon="error" heading="Could not load the dashboard" [message]="store.error()!">
        <button type="button" class="btn" (click)="store.load()"><app-icon name="restore" [size]="16" /> Retry</button>
      </app-empty-state>
    } @else if (store.data(); as d) {
      @if (store.metrics(); as m) {
        <h2 class="sr-only">Summary</h2>
        <div class="metrics" role="list" aria-label="Summary">
          <app-metric-card
            class="stagger" style="--i: 0"
            key="tasks" label="Tasks done" icon="tasks" link="/tasks"
            [value]="m.taskPercent" [percent]="true" [progress]="m.taskPercent"
            [caption]="m.tasksDone + ' of ' + m.tasksActive + ' done · ' + m.tasksCompletedToday + ' completed today'"
          />
          <app-metric-card
            class="stagger" style="--i: 1"
            key="habits" label="Habits this period" icon="habits" link="/habits"
            [value]="m.habitsDone" [total]="m.habitsActive" [progress]="m.habitsActive ? (m.habitsDone * 100) / m.habitsActive : 0"
            [caption]="m.habitsActive ? 'Active habits done for today / this week' : 'No active habits'"
          />
          <app-metric-card
            class="stagger" style="--i: 2"
            key="plans" label="Plans in progress" icon="plans" link="/plans"
            [value]="m.plansInProgress"
            [caption]="m.plansUpcoming + ' upcoming · ' + m.plansCompleted + ' completed'"
          />
          <app-metric-card
            class="stagger" style="--i: 3"
            key="learning" label="Learning milestones" icon="learning" link="/learning"
            [value]="m.milestonesDone" [total]="m.milestonesTotal"
            [progress]="m.milestonesTotal ? (m.milestonesDone * 100) / m.milestonesTotal : 0"
            [caption]="m.milestonesLast7Days + ' completed in the last 7 days'"
          />
        </div>
      }

      <div class="grid">
        <section class="panel stagger" style="--i: 4" aria-labelledby="dash-today">
          <header class="panel__head">
            <h2 id="dash-today" class="panel__title"><app-icon name="tasks" [size]="18" /> Due today</h2>
            <span class="badge" data-count="due-today">{{ d.tasks.dueToday.length }}</span>
            <a class="panel__link" routerLink="/tasks">All tasks</a>
          </header>
          <app-dashboard-task-list
            label="Tasks due today"
            [tasks]="d.tasks.dueToday"
            [pending]="store.pending()"
            emptyText="Nothing due today."
            (complete)="store.completeTask($event)"
          />
          @if (d.tasks.overdue.length > 0) {
            <h3 id="dash-overdue" class="panel__sub panel__sub--danger">
              <app-icon name="alert" [size]="16" /> Overdue
              <span class="badge badge--danger" data-count="overdue">{{ d.tasks.overdue.length }}</span>
            </h3>
            <app-dashboard-task-list
              label="Overdue tasks"
              [tasks]="d.tasks.overdue"
              [pending]="store.pending()"
              (complete)="store.completeTask($event)"
            />
          } @else {
            <p class="panel__note" data-count="overdue"><app-icon name="success" [size]="14" /> No overdue tasks.</p>
          }
          <p class="panel__note">{{ d.tasks.completedTodayCount }} completed today</p>
        </section>

        <section class="panel stagger" style="--i: 5" aria-labelledby="dash-habits">
          <header class="panel__head">
            <h2 id="dash-habits" class="panel__title"><app-icon name="habits" [size]="18" /> Today's habits</h2>
            @if (store.metrics(); as m) {
              <span class="badge" data-count="habits">{{ m.habitsDone }} / {{ m.habitsActive }}</span>
            }
            <a class="panel__link" routerLink="/habits">All habits</a>
          </header>
          <app-dashboard-habits
            [habits]="d.habits.today"
            [pending]="store.pending()"
            (toggle)="store.toggleHabit($event)"
            (undoPeriod)="undoPeriod($event)"
          />
        </section>

        <section class="panel stagger" style="--i: 6" aria-labelledby="dash-plans">
          <header class="panel__head">
            <h2 id="dash-plans" class="panel__title"><app-icon name="plans" [size]="18" /> Plans in progress</h2>
            <span class="badge" data-count="plans">{{ store.plans().length }}</span>
            <a class="panel__link" routerLink="/plans">All plans</a>
          </header>
          <app-dashboard-plans
            [plans]="store.plans()"
            [upcoming]="d.plans.upcomingCount"
            [pending]="store.pending()"
            (toggleItem)="togglePlanItem($event)"
          />
        </section>

        <section class="panel stagger" style="--i: 7" aria-labelledby="dash-learning">
          <header class="panel__head">
            <h2 id="dash-learning" class="panel__title"><app-icon name="learning" [size]="18" /> Learning</h2>
            <a class="panel__link" routerLink="/learning">All cards</a>
          </header>
          <app-dashboard-learning [learning]="d.learning" />
        </section>
      </div>

      @if (store.loading()) {
        <span class="sr-only" role="status">Updating dashboard</span>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: var(--space-4); align-items: start; }
    .panel { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-1); }
    .panel__head { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
    .panel__title { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); }
    .panel__title app-icon { color: var(--primary); }
    .panel__link { margin-left: auto; color: var(--primary); font-size: var(--text-sm); font-weight: var(--weight-medium); white-space: nowrap; }
    .panel__sub { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); font-size: var(--text-md); }
    .panel__sub--danger { color: var(--danger); }
    .panel__note { display: flex; align-items: center; gap: var(--space-1); color: var(--text-muted); font-size: var(--text-sm); }
    .badge { display: inline-grid; place-items: center; min-width: 24px; height: 22px; padding: 0 var(--space-2); border-radius: var(--radius-pill); background: var(--primary-soft); color: var(--primary); font-size: var(--text-xs); font-weight: var(--weight-bold); font-variant-numeric: tabular-nums; }
    .badge--danger { background: var(--danger-soft); color: var(--danger); }
    .sk-metric { height: 112px; border-radius: var(--radius-lg); }
    .sk-panel { height: 240px; border-radius: var(--radius-lg); }
    .stagger { animation: qf-slide-up var(--duration-slow) var(--ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
  `,
})
export class DashboardPageComponent {
  protected readonly store = inject(DashboardStore);
  private readonly settings = inject(SettingsStore);

  /** Display name from the dashboard (Settings) — falls back to the settings store while loading. */
  protected readonly name = computed(() => this.store.data()?.greetingName ?? this.settings.displayName());

  protected undoPeriod(habit: Habit): void {
    if (habit.lastCompletedDate) {
      void this.store.uncompleteHabit(habit, habit.lastCompletedDate);
    }
  }

  protected togglePlanItem(e: DashboardPlanToggle): void {
    void this.store.setPlanItemDone(e.plan, e.item, e.done);
  }
}
