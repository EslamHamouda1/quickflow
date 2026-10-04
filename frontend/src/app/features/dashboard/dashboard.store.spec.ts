import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  Dashboard,
  DashboardService,
  Habit,
  HabitFrequency,
  HabitsService,
  Plan,
  PlanItem,
  PlanItemSourceType,
  PlanStatus,
  PlansService,
  Task,
  TaskPriority,
  TaskStatus,
  TasksService,
} from '../../api';
import { todayIso } from '../../core/format';
import { NotificationService } from '../../core/notification.service';
import { NowService } from '../../core/now.service';
import { RefreshService } from '../../core/refresh.service';
import { PlansStore } from '../plans/plans.store';
import { DashboardStore, toMetrics } from './dashboard.store';

// T099 — traces US5 AS2 (tasks due today / overdue / completed today / completion %), AS3 (habit checklist
// with done-for-current-period, toggle in place), AS4 (in-progress plans with live rest time and progress),
// AS5 (learning snapshot), AS6 / FR-027 (reload on RefreshService bumps, every 60 s, on plan start/end;
// metrics re-synced from the server after every in-place change).

const NOW = Date.parse('2026-06-17T10:00:00Z');
const iso = (offsetMin: number) => new Date(NOW + offsetMin * 60_000).toISOString();

function task(id: number, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: TaskStatus.Todo,
    priority: TaskPriority.Medium,
    dueDate: '2026-06-17',
    createdAt: iso(-60),
    updatedAt: iso(-60),
    completedAt: null,
    archived: false,
    overdue: false,
    ...patch,
  };
}

function habit(id: number, patch: Partial<Habit> = {}): Habit {
  return {
    id,
    name: `Habit ${id}`,
    frequency: HabitFrequency.Daily,
    createdAt: iso(-600),
    active: true,
    completedToday: false,
    doneForCurrentPeriod: false,
    currentStreak: 0,
    completionRate: 0,
    lastCompletedDate: null,
    ...patch,
  };
}

function item(id: number, done = false): PlanItem {
  return { id, sourceType: PlanItemSourceType.Task, sourceId: id * 10, sourceTitle: `S${id}`, done, sourceAvailable: true };
}

function plan(id: number, patch: Partial<Plan> = {}): Plan {
  const items = patch.items ?? [item(id * 100), item(id * 100 + 1)];
  const done = items.filter((i) => i.done).length;
  return {
    id,
    title: `Plan ${id}`,
    estimatedDurationMinutes: 60,
    startDateTime: iso(-10),
    endDateTime: iso(50),
    priorityOrder: 1,
    status: PlanStatus.InProgress,
    createdAt: iso(-60),
    startNotifiedAt: iso(-10),
    items,
    itemsTotal: items.length,
    itemsDone: done,
    progressPercent: items.length ? Math.round((done * 100) / items.length) : 0,
    restSeconds: 3000,
    ...patch,
  };
}

function dashboard(patch: Partial<Dashboard> = {}): Dashboard {
  return {
    greetingName: 'Sara',
    today: '2026-06-17',
    tasks: {
      dueToday: [task(1), task(2)],
      overdue: [task(3, { dueDate: '2026-06-15', overdue: true })],
      completedTodayCount: 1,
      totalActive: 8,
      doneCount: 3,
      completionPercent: 38,
    },
    habits: {
      today: [
        habit(1),
        habit(2, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 2, lastCompletedDate: '2026-06-17' }),
        habit(3, { frequency: HabitFrequency.Weekly, doneForCurrentPeriod: true, lastCompletedDate: '2026-06-16' }),
      ],
      activeCount: 3,
      completedTodayCount: 1,
    },
    plans: {
      inProgress: [plan(1, { priorityOrder: 2 }), plan(2, { priorityOrder: 1, endDateTime: iso(20) })],
      upcomingCount: 2,
      completedCount: 4,
    },
    learning: { cardsTotal: 5, inProgressCount: 2, milestonesTotal: 10, milestonesDone: 6, milestonesCompletedLast7Days: 3 },
    ...patch,
  };
}

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('toMetrics', () => {
  it('maps every dashboard number and counts habits done for their current period', () => {
    expect(toMetrics(dashboard())).toEqual({
      taskPercent: 38,
      tasksDone: 3,
      tasksActive: 8,
      tasksCompletedToday: 1,
      habitsDone: 2, // daily done today + weekly done this week
      habitsActive: 3,
      plansInProgress: 2,
      plansUpcoming: 2,
      plansCompleted: 4,
      milestonesDone: 6,
      milestonesTotal: 10,
      milestonesLast7Days: 3,
      learningInProgress: 2,
      learningCards: 5,
    });
  });

  it('uses the live in-progress count when given', () => {
    expect(toMetrics(dashboard(), 1).plansInProgress).toBe(1);
  });
});

describe('DashboardStore', () => {
  let api: { getDashboard: ReturnType<typeof vi.fn> };
  let tasksApi: { completeTask: ReturnType<typeof vi.fn> };
  let habitsApi: { completeHabit: ReturnType<typeof vi.fn>; uncompleteHabit: ReturnType<typeof vi.fn> };
  let plansApi: { setPlanItemDone: ReturnType<typeof vi.fn> };
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; toast: ReturnType<typeof vi.fn> };
  let now: ReturnType<typeof signal<number>>;
  let inProgressCount: ReturnType<typeof signal<number>>;
  let store: DashboardStore;
  let refresh: RefreshService;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        { provide: DashboardService, useValue: api },
        { provide: TasksService, useValue: tasksApi },
        { provide: HabitsService, useValue: habitsApi },
        { provide: PlansService, useValue: plansApi },
        { provide: NotificationService, useValue: notify },
        { provide: NowService, useValue: { now, date: () => new Date(now()) } },
        { provide: PlansStore, useValue: { inProgressCount } },
      ],
    });
    store = TestBed.inject(DashboardStore);
    refresh = TestBed.inject(RefreshService);
  }

  beforeEach(() => {
    api = { getDashboard: vi.fn(() => of(dashboard())) };
    tasksApi = { completeTask: vi.fn(() => of(task(1, { status: TaskStatus.Done }))) };
    habitsApi = { completeHabit: vi.fn(() => of(habit(1))), uncompleteHabit: vi.fn(() => of(habit(2))) };
    plansApi = { setPlanItemDone: vi.fn(() => of(plan(1))) };
    notify = { success: vi.fn(), error: vi.fn(), toast: vi.fn() };
    now = signal(NOW);
    inProgressCount = signal(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
  }

  it('loads the dashboard once on creation and exposes lists and metrics', async () => {
    setup();
    expect(store.loaded()).toBe(false);
    await settle();
    expect(api.getDashboard).toHaveBeenCalledTimes(1);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.dueToday().map((t) => t.id)).toEqual([1, 2]);
    expect(store.overdue().map((t) => t.id)).toEqual([3]);
    expect(store.habits().map((h) => h.id)).toEqual([1, 2, 3]);
    expect(store.metrics()).toMatchObject({ taskPercent: 38, habitsDone: 2, habitsActive: 3, plansInProgress: 2 });
  });

  it('exposes empty lists and null metrics before data arrives', () => {
    api.getDashboard.mockReturnValue(new Subject<Dashboard>());
    setup();
    expect(store.dueToday()).toEqual([]);
    expect(store.overdue()).toEqual([]);
    expect(store.habits()).toEqual([]);
    expect(store.plans()).toEqual([]);
    expect(store.metrics()).toBeNull();
  });

  it('orders in-progress plans by priority then start, with live rest time from NowService', async () => {
    setup();
    await settle();
    expect(store.plans().map((p) => p.id)).toEqual([2, 1]);
    expect(store.plans().find((p) => p.id === 1)!.restSeconds).toBe(50 * 60);
    now.set(NOW + 5000);
    expect(store.plans().find((p) => p.id === 1)!.restSeconds).toBe(50 * 60 - 5);
    // plan 2 ends at +20 min → drops out without a reload, metric follows
    now.set(NOW + 20 * 60_000);
    expect(store.plans().map((p) => p.id)).toEqual([1]);
    expect(store.metrics()!.plansInProgress).toBe(1);
  });

  it('reloads on every RefreshService bump', async () => {
    setup();
    await settle();
    refresh.bump();
    await settle();
    refresh.bump();
    await settle();
    expect(api.getDashboard).toHaveBeenCalledTimes(3);
  });

  it('reloads every 60 s and stops polling on destroy', async () => {
    vi.useFakeTimers();
    setup();
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getDashboard).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DashboardStore.POLL_MS);
    expect(api.getDashboard).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(DashboardStore.POLL_MS);
    expect(api.getDashboard).toHaveBeenCalledTimes(3);
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(DashboardStore.POLL_MS * 2);
    expect(api.getDashboard).toHaveBeenCalledTimes(3);
  });

  it('reloads when the app-wide in-progress plan count changes (plan started / ended)', async () => {
    setup();
    await settle();
    expect(api.getDashboard).toHaveBeenCalledTimes(1);
    inProgressCount.set(3);
    await settle();
    expect(api.getDashboard).toHaveBeenCalledTimes(2);
    inProgressCount.set(3);
    await settle();
    expect(api.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('shows a load error, keeps the last data and ignores stale responses', async () => {
    setup();
    await settle();
    const slow = new Subject<Dashboard>();
    api.getDashboard.mockReturnValueOnce(slow).mockReturnValueOnce(of(dashboard({ greetingName: 'Fresh' })));
    const first = store.load();
    const second = store.load();
    await second;
    slow.next(dashboard({ greetingName: 'Stale' }));
    slow.complete();
    await first;
    expect(store.data()!.greetingName).toBe('Fresh');

    api.getDashboard.mockReturnValueOnce(problem(500, { detail: 'down' }));
    await store.load();
    expect(store.error()).toBe('down');
    expect(store.data()!.greetingName).toBe('Fresh');
    await store.load();
    expect(store.error()).toBeNull();
  });

  it('completes a due-today task in place: list, done count, completed today and % update', async () => {
    setup();
    await settle();
    const done = new Subject<Task>();
    tasksApi.completeTask.mockReturnValue(done);
    const p = store.completeTask(task(1));
    expect(store.dueToday().map((t) => t.id)).toEqual([2]);
    expect(store.data()!.tasks).toMatchObject({ doneCount: 4, completedTodayCount: 2, completionPercent: 50 });
    expect(store.pending().has('task:1')).toBe(true);
    // a second click while pending is ignored
    expect(await store.completeTask(task(1))).toBe(false);
    done.next(task(1, { status: TaskStatus.Done }));
    done.complete();
    expect(await p).toBe(true);
    expect(tasksApi.completeTask).toHaveBeenCalledTimes(1);
    expect(tasksApi.completeTask).toHaveBeenCalledWith(1);
    expect(notify.success).toHaveBeenCalledWith('Task completed', 'Task 1');
    expect(store.pending().has('task:1')).toBe(false);
    await settle();
    expect(api.getDashboard).toHaveBeenCalledTimes(2); // re-synced from the server
  });

  it('completes an overdue task in place', async () => {
    setup();
    await settle();
    await store.completeTask(task(3, { overdue: true }));
    expect(store.overdue()).toEqual([]);
  });

  it('rolls back via reload and shows an error when completing fails', async () => {
    setup();
    await settle();
    tasksApi.completeTask.mockReturnValue(problem(404, { detail: 'Task 1 not found' }));
    expect(await store.completeTask(task(1))).toBe(false);
    expect(notify.error).toHaveBeenCalledWith('Could not complete the task', 'Task 1 not found');
    await settle();
    expect(store.dueToday().map((t) => t.id)).toEqual([1, 2]);
  });

  it('toggles a habit done for today in place (habits metric +1)', async () => {
    setup();
    await settle();
    const p = store.toggleHabit(habit(1));
    expect(store.habits().find((h) => h.id === 1)).toMatchObject({ completedToday: true, doneForCurrentPeriod: true });
    expect(store.metrics()!.habitsDone).toBe(3);
    expect(await p).toBe(true);
    expect(habitsApi.completeHabit).toHaveBeenCalledWith(1, {});
    expect(notify.success).toHaveBeenCalledWith('Habit done for today', 'Habit 1');
  });

  it('untoggles a habit completed today (uncompletes its date)', async () => {
    setup();
    await settle();
    api.getDashboard.mockReturnValue(new Subject<Dashboard>()); // keep the optimistic view
    // the optimistic helper compares with the local today, so use it as the completion date
    const h2 = { ...dashboard().habits.today[1], lastCompletedDate: todayIso() };
    expect(await store.toggleHabit(h2)).toBe(true);
    expect(habitsApi.uncompleteHabit).toHaveBeenCalledWith(2, todayIso());
    expect(store.habits().find((h) => h.id === 2)).toMatchObject({ completedToday: false, doneForCurrentPeriod: false });
    expect(store.metrics()!.habitsDone).toBe(1);
  });

  it('uses today when a completed-today habit has no lastCompletedDate', async () => {
    setup();
    await settle();
    await store.toggleHabit(habit(9, { completedToday: true, doneForCurrentPeriod: true, lastCompletedDate: null }));
    expect(habitsApi.uncompleteHabit).toHaveBeenCalledWith(9, todayIso());
  });

  it('undoes a weekly habit done this week via uncompleteHabit', async () => {
    setup();
    await settle();
    api.getDashboard.mockReturnValue(new Subject<Dashboard>());
    await store.uncompleteHabit(dashboard().habits.today[2], '2026-06-16');
    expect(habitsApi.uncompleteHabit).toHaveBeenCalledWith(3, '2026-06-16');
    expect(store.habits().find((h) => h.id === 3)!.doneForCurrentPeriod).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Completion undone', 'Habit 3');
  });

  it('shows an info toast on 409 (already done) when toggling a habit', async () => {
    setup();
    await settle();
    habitsApi.completeHabit.mockReturnValue(problem(409, { detail: 'Already completed on 2026-06-17' }));
    expect(await store.toggleHabit(habit(1))).toBe(false);
    expect(notify.toast).toHaveBeenCalledWith('Already done', { kind: 'info', message: 'Already completed on 2026-06-17' });
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('marks a plan item done in place: progress updates immediately', async () => {
    setup();
    await settle();
    api.getDashboard.mockReturnValue(new Subject<Dashboard>());
    const p1 = dashboard().plans.inProgress[0];
    const p = store.setPlanItemDone(p1, p1.items[0], true);
    expect(store.plans().find((x) => x.id === 1)).toMatchObject({ itemsDone: 1, progressPercent: 50 });
    expect(await p).toBe(true);
    expect(plansApi.setPlanItemDone).toHaveBeenCalledWith(1, 100, { done: true });
    expect(notify.success).toHaveBeenCalledWith('Plan item done', 'S100');
    await store.setPlanItemDone(p1, p1.items[0], false);
    expect(notify.success).toHaveBeenCalledWith('Plan item reopened', 'S100');
    expect(store.plans().find((x) => x.id === 1)!.progressPercent).toBe(0);
  });

  it('a load in flight does not overwrite an optimistic change', async () => {
    setup();
    await settle();
    const slow = new Subject<Dashboard>();
    api.getDashboard.mockReturnValueOnce(slow);
    const loading = store.load();
    tasksApi.completeTask.mockReturnValue(new Subject<Task>());
    void store.completeTask(task(1));
    slow.next(dashboard());
    slow.complete();
    await loading;
    expect(store.dueToday().map((t) => t.id)).toEqual([2]);
  });
});
