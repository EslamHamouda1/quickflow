import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { Dashboard, DashboardService, Habit, HabitsService, Plan, PlanItem, PlanStatus, PlansService, Task, TasksService } from '../../api';
import { ApiErrorInfo, toApiError } from '../../core/api-errors';
import { todayIso } from '../../core/format';
import { NotificationService } from '../../core/notification.service';
import { NowService } from '../../core/now.service';
import { RefreshService } from '../../core/refresh.service';
import { withCompletedToday, withoutCompletion } from '../habits/habits.store';
import { PlanView, PlansStore, compareActive, toPlanView, withItems } from '../plans/plans.store';

/** Summary metrics shown on the dashboard cards (all derived from the `Dashboard` response). */
export interface DashboardMetrics {
  taskPercent: number;
  tasksDone: number;
  tasksActive: number;
  tasksCompletedToday: number;
  habitsDone: number;
  habitsActive: number;
  plansInProgress: number;
  plansUpcoming: number;
  plansCompleted: number;
  milestonesDone: number;
  milestonesTotal: number;
  milestonesLast7Days: number;
  learningInProgress: number;
  learningCards: number;
}

/** Metrics from a dashboard response; `plansInProgress` is the client-derived live count when given. */
export function toMetrics(d: Dashboard, plansInProgress: number = d.plans.inProgress.length): DashboardMetrics {
  return {
    taskPercent: d.tasks.completionPercent,
    tasksDone: d.tasks.doneCount,
    tasksActive: d.tasks.totalActive,
    tasksCompletedToday: d.tasks.completedTodayCount,
    // Habits done for their current period (daily: today, weekly: this week) out of active habits.
    habitsDone: d.habits.today.filter((h) => h.doneForCurrentPeriod).length,
    habitsActive: d.habits.activeCount,
    plansInProgress,
    plansUpcoming: d.plans.upcomingCount,
    plansCompleted: d.plans.completedCount,
    milestonesDone: d.learning.milestonesDone,
    milestonesTotal: d.learning.milestonesTotal,
    milestonesLast7Days: d.learning.milestonesCompletedLast7Days,
    learningInProgress: d.learning.inProgressCount,
    learningCards: d.learning.cardsTotal,
  };
}

/**
 * Signal store of the Dashboard page (US5). Loads `getDashboard` through the generated client, reloads
 * on every `RefreshService` bump (mutations anywhere in the app) and every 60 s, and re-derives plan
 * rest time / status every second from `NowService`. In-place actions (complete task, toggle habit,
 * toggle plan item) are optimistic, then bump the refresh version so the dashboard and other views
 * reload from the server (FR-027).
 */
@Injectable()
export class DashboardStore {
  static readonly POLL_MS = 60_000;

  private readonly api = inject(DashboardService);
  private readonly tasksApi = inject(TasksService);
  private readonly habitsApi = inject(HabitsService);
  private readonly plansApi = inject(PlansService);
  private readonly refresh = inject(RefreshService);
  private readonly notify = inject(NotificationService);
  private readonly clock = inject(NowService);
  private readonly plansStore = inject(PlansStore);

  private readonly _data = signal<Dashboard | null>(null);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _pending = signal<ReadonlySet<string>>(new Set());

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  /** Keys (`task:1`, `habit:2`, `plan:3`) with a request in flight. */
  readonly pending = this._pending.asReadonly();

  readonly dueToday = computed(() => this._data()?.tasks.dueToday ?? []);
  readonly overdue = computed(() => this._data()?.tasks.overdue ?? []);
  readonly habits = computed(() => this._data()?.habits.today ?? []);
  /** In-progress plans with live rest time (re-evaluated every second); ended ones drop out at once. */
  readonly plans = computed<PlanView[]>(() => {
    const now = this.clock.now();
    return (this._data()?.plans.inProgress ?? [])
      .map((p) => toPlanView(p, now))
      .filter((p) => p.status === PlanStatus.InProgress)
      .sort(compareActive);
  });
  readonly metrics = computed<DashboardMetrics | null>(() => {
    const d = this._data();
    return d ? toMetrics(d, this.plans().length) : null;
  });

  private requestSeq = 0;

  constructor() {
    // Initial load + reload whenever any feature reports a change.
    effect(() => {
      this.refresh.version();
      untracked(() => void this.load());
    });
    // A plan starting (seen by the app-wide plans store) or ending changes the in-progress list.
    let lastPlanCount: number | null = null;
    effect(() => {
      const count = this.plansStore.inProgressCount();
      untracked(() => {
        if (lastPlanCount !== null && count !== lastPlanCount && this._loaded()) {
          void this.load();
        }
        lastPlanCount = count;
      });
    });
    const id = setInterval(() => void this.load(), DashboardStore.POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Fetches the dashboard; stale responses are ignored. */
  async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this._loading.set(true);
    try {
      const data = await firstValueFrom(this.api.getDashboard());
      if (seq !== this.requestSeq) {
        return;
      }
      this._data.set(data);
      this._error.set(null);
    } catch (err) {
      if (seq === this.requestSeq) {
        this._error.set(toApiError(err).message);
      }
    } finally {
      if (seq === this.requestSeq) {
        this._loading.set(false);
        this._loaded.set(true);
      }
    }
  }

  /** Completes a task in place: it leaves Today / Overdue immediately. */
  completeTask(task: Task): Promise<boolean> {
    return this.mutate(
      `task:${task.id}`,
      (d) => {
        const wasActive = [...d.tasks.dueToday, ...d.tasks.overdue].some((t) => t.id === task.id);
        const doneCount = d.tasks.doneCount + (wasActive ? 1 : 0);
        return {
          ...d,
          tasks: {
            ...d.tasks,
            dueToday: d.tasks.dueToday.filter((t) => t.id !== task.id),
            overdue: d.tasks.overdue.filter((t) => t.id !== task.id),
            doneCount,
            completedTodayCount: d.tasks.completedTodayCount + (wasActive ? 1 : 0),
            completionPercent: d.tasks.totalActive ? Math.round((doneCount * 100) / d.tasks.totalActive) : 0,
          },
        };
      },
      () => this.tasksApi.completeTask(task.id),
      'Task completed',
      task.title,
      'Could not complete the task',
    );
  }

  /** Habit toggle bound to `completedToday` (same rules as the Habits page). */
  toggleHabit(habit: Habit): Promise<boolean> {
    if (habit.completedToday) {
      return this.uncompleteHabit(habit, habit.lastCompletedDate ?? todayIso());
    }
    return this.mutate(
      `habit:${habit.id}`,
      (d) => replaceHabit(d, habit.id, (h) => withCompletedToday(h)),
      () => this.habitsApi.completeHabit(habit.id, {}),
      'Habit done for today',
      habit.name,
      'Could not update the habit',
    );
  }

  /** Removes the completion of `date` (today, or this week's latest one for a Weekly habit). */
  uncompleteHabit(habit: Habit, date: string): Promise<boolean> {
    return this.mutate(
      `habit:${habit.id}`,
      (d) => replaceHabit(d, habit.id, (h) => withoutCompletion(h, date)),
      () => this.habitsApi.uncompleteHabit(habit.id, date),
      'Completion undone',
      habit.name,
      'Could not update the habit',
    );
  }

  /** Marks a plan item done / not done (progress updates immediately). */
  setPlanItemDone(plan: Plan, item: PlanItem, done: boolean): Promise<boolean> {
    return this.mutate(
      `plan:${plan.id}`,
      (d) => ({
        ...d,
        plans: {
          ...d.plans,
          inProgress: d.plans.inProgress.map((p) =>
            p.id === plan.id ? withItems(p, p.items.map((i) => (i.id === item.id ? { ...i, done } : i))) : p,
          ),
        },
      }),
      () => this.plansApi.setPlanItemDone(plan.id, item.id, { done }),
      done ? 'Plan item done' : 'Plan item reopened',
      item.sourceTitle,
      'Could not update the plan item',
    );
  }

  /**
   * Applies `change` locally, runs `request`, then bumps the refresh version (which reloads the
   * dashboard and every other open view). On error the server state is reloaded and a toast shown.
   */
  private async mutate(
    key: string,
    change: (d: Dashboard) => Dashboard,
    request: () => Observable<unknown>,
    successTitle: string,
    successMessage: string,
    errorTitle: string,
  ): Promise<boolean> {
    if (this._pending().has(key)) {
      return false;
    }
    this.setPending(key, true);
    this.requestSeq++; // a load in flight must not overwrite the optimistic view
    const current = this._data();
    if (current) {
      this._data.set(change(current));
    }
    try {
      await firstValueFrom(request(), { defaultValue: undefined });
      this.notify.success(successTitle, successMessage);
      return true;
    } catch (err) {
      const info: ApiErrorInfo = toApiError(err);
      if (info.status === 409) {
        this.notify.toast('Already done', { kind: 'info', message: info.message });
      } else {
        this.notify.error(errorTitle, info.message);
      }
      return false;
    } finally {
      this.setPending(key, false);
      // Success: everyone reloads. Failure: re-sync (rolls the optimistic change back).
      this.refresh.bump();
    }
  }

  private setPending(key: string, on: boolean): void {
    this._pending.update((set) => {
      const next = new Set(set);
      if (on) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }
}

function replaceHabit(d: Dashboard, id: number, change: (h: Habit) => Habit): Dashboard {
  return { ...d, habits: { ...d.habits, today: d.habits.today.map((h) => (h.id === id ? change(h) : h)) } };
}
