import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  Dashboard,
  DashboardService,
  DefaultView,
  Habit,
  HabitFrequency,
  HabitsService,
  LearningService,
  Plan,
  PlanItem,
  PlanItemSourceType,
  PlanStatus,
  PlansService,
  SettingsService,
  Task,
  TaskPriority,
  TaskStatus,
  TasksService,
} from '../../api';
import { NotificationService } from '../../core/notification.service';
import { DashboardPageComponent } from './dashboard-page.component';
import { greetingFor } from './dashboard-greeting.component';

// T099 — traces US5 AS1 (greeting with the Settings display name), AS2 (due today / overdue / completed
// today / completion %), AS3 (habit checklist with done-for-current-period, toggle in place), AS4 (plans in
// progress with rest time and progress, item toggle), AS5 (learning snapshot), AS6 (re-sync after changes),
// AS7 (quick-add opens the matching create form); skeleton, error + retry and empty states.

const START = new Date(Date.now() - 10 * 60_000).toISOString();
const END = new Date(Date.now() + 50 * 60_000).toISOString();

function task(id: number, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: TaskStatus.Todo,
    priority: TaskPriority.High,
    dueDate: '2026-06-17',
    createdAt: START,
    updatedAt: START,
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
    createdAt: START,
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
  return { id, sourceType: PlanItemSourceType.Task, sourceId: id, sourceTitle: `Item ${id}`, done, sourceAvailable: true };
}

function plan(id: number, items: PlanItem[]): Plan {
  const done = items.filter((i) => i.done).length;
  return {
    id,
    title: `Plan ${id}`,
    estimatedDurationMinutes: 60,
    startDateTime: START,
    endDateTime: END,
    priorityOrder: 1,
    status: PlanStatus.InProgress,
    createdAt: START,
    startNotifiedAt: START,
    items,
    itemsTotal: items.length,
    itemsDone: done,
    progressPercent: Math.round((done * 100) / items.length),
    restSeconds: 3000,
  };
}

function data(patch: Partial<Dashboard> = {}): Dashboard {
  return {
    greetingName: 'Sara',
    today: '2026-06-17',
    tasks: {
      dueToday: [task(1), task(2)],
      overdue: [task(3, { dueDate: '2026-06-10', overdue: true })],
      completedTodayCount: 1,
      totalActive: 8,
      doneCount: 3,
      completionPercent: 38,
    },
    habits: {
      today: [
        habit(1),
        habit(2, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 3, lastCompletedDate: '2026-06-17' }),
        habit(3, { frequency: HabitFrequency.Weekly, doneForCurrentPeriod: true, lastCompletedDate: '2026-06-16' }),
      ],
      activeCount: 3,
      completedTodayCount: 1,
    },
    plans: { inProgress: [plan(7, [item(70), item(71)])], upcomingCount: 2, completedCount: 4 },
    learning: { cardsTotal: 5, inProgressCount: 2, milestonesTotal: 10, milestonesDone: 6, milestonesCompletedLast7Days: 3 },
    ...patch,
  };
}

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('greetingFor', () => {
  it('maps local hours to the time-of-day greeting', () => {
    expect([4, 5, 11, 12, 16, 17, 21, 22, 0].map(greetingFor)).toEqual([
      'Good night',
      'Good morning',
      'Good morning',
      'Good afternoon',
      'Good afternoon',
      'Good evening',
      'Good evening',
      'Good night',
      'Good night',
    ]);
  });
});

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let el: HTMLElement;
  let dashApi: { getDashboard: ReturnType<typeof vi.fn> };
  let tasksApi: Record<string, ReturnType<typeof vi.fn>>;
  let habitsApi: Record<string, ReturnType<typeof vi.fn>>;
  let plansApi: Record<string, ReturnType<typeof vi.fn>>;
  let notify: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(() => {
    // jsdom may lack the modal dialog API.
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
    if (!proto.showModal) {
      proto.showModal = function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
    }
    if (!proto.close) {
      proto.close = function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      };
    }
  });

  async function setup(response: Observable<Dashboard> = of(data())) {
    dashApi = { getDashboard: vi.fn(() => response) };
    tasksApi = { completeTask: vi.fn(() => of(task(1))), listTasks: vi.fn(() => of([])) };
    habitsApi = {
      completeHabit: vi.fn(() => of(habit(1))),
      uncompleteHabit: vi.fn(() => of(habit(2))),
      listHabits: vi.fn(() => of([])),
    };
    plansApi = { setPlanItemDone: vi.fn(() => of(plan(7, [item(70, true), item(71)]))), listPlans: vi.fn(() => of([])) };
    notify = { success: vi.fn(), error: vi.fn(), toast: vi.fn(), notify: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: dashApi },
        { provide: TasksService, useValue: tasksApi },
        { provide: HabitsService, useValue: habitsApi },
        { provide: PlansService, useValue: plansApi },
        { provide: LearningService, useValue: { listLearningCards: vi.fn(() => of([])) } },
        {
          provide: SettingsService,
          useValue: {
            getSettings: vi.fn(() =>
              of({ displayName: 'Friend', inAppNotifications: true, browserNotifications: false, defaultView: DefaultView.Dashboard }),
            ),
          },
        },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(DashboardPageComponent);
    el = fixture.nativeElement;
    await render();
  }

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const all = (sel: string) => [...el.querySelectorAll(sel)];
  const text = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim();
  const metricLabel = (key: string) => q(`[data-metric="${key}"] a`)?.getAttribute('aria-label');
  const byLabel = (label: string) => q<HTMLButtonElement>(`button[aria-label="${label}"]`);

  it('shows skeletons while loading', async () => {
    await setup(new Subject<Dashboard>());
    expect(q('[aria-busy="true"][aria-label="Loading dashboard"]')).toBeTruthy();
    expect(all('.sk-metric').length).toBe(4);
    expect(q('[data-metric]')).toBeNull();
  });

  it('greets with the display name from the dashboard (Settings) and shows today', async () => {
    await setup();
    const h1 = text('h1')!;
    expect(h1).toMatch(/^Good (morning|afternoon|evening|night), Sara$/);
    expect(q('time')!.getAttribute('datetime')).toBe('2026-06-17');
    expect(text('time')).toContain('2026');
  });

  it('renders four summary metric cards matching the data', async () => {
    await setup();
    expect(all('[data-metric]').map((m) => m.getAttribute('data-metric'))).toEqual(['tasks', 'habits', 'plans', 'learning']);
    expect(metricLabel('tasks')).toBe('Tasks done: 38%. 3 of 8 done · 1 completed today');
    expect(metricLabel('habits')).toBe('Habits this period: 2 of 3. Active habits done for today / this week');
    expect(metricLabel('plans')).toBe('Plans in progress: 1. 2 upcoming · 4 completed');
    expect(metricLabel('learning')).toBe('Learning milestones: 6 of 10. 3 completed in the last 7 days');
    expect(q('[data-metric="tasks"] a')!.getAttribute('href')).toBe('/tasks');
  });

  it('lists tasks due today, overdue tasks and the completed-today count', async () => {
    await setup();
    expect(text('[data-count="due-today"]')).toBe('2');
    expect(all('ul[aria-label="Tasks due today"] li').map((li) => li.getAttribute('data-id'))).toEqual(['1', '2']);
    expect(text('[data-count="overdue"]')).toBe('1');
    expect(all('ul[aria-label="Overdue tasks"] li').map((li) => li.getAttribute('data-id'))).toEqual(['3']);
    expect(text('ul[aria-label="Overdue tasks"] .due')).toContain('Overdue');
    expect(all('.panel__note').map((p) => p.textContent?.trim())).toContain('1 completed today');
  });

  it('completes a task in place and re-syncs from the server', async () => {
    await setup();
    const updated = data();
    updated.tasks = { ...updated.tasks, dueToday: [task(2)], doneCount: 4, completedTodayCount: 2, completionPercent: 50 };
    dashApi.getDashboard.mockReturnValue(of(updated));
    byLabel('Complete task: Task 1').click();
    await render();
    await render();
    expect(tasksApi['completeTask']).toHaveBeenCalledWith(1);
    expect(all('ul[aria-label="Tasks due today"] li').map((li) => li.getAttribute('data-id'))).toEqual(['2']);
    expect(metricLabel('tasks')).toBe('Tasks done: 50%. 4 of 8 done · 2 completed today');
    expect(dashApi.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('shows the habit checklist with done-for-current-period states', async () => {
    await setup();
    expect(text('[data-count="habits"]')).toBe('2 / 3');
    const rows = all('ul[aria-label="Today\'s habits"] li');
    expect(rows.map((r) => r.getAttribute('data-id'))).toEqual(['1', '2', '3']);
    expect(rows[0].textContent).toContain('Not done today yet');
    expect(rows[1].textContent).toContain('Done today');
    expect(rows[2].textContent).toContain('Done this week');
    expect(byLabel('Mark done for today: Habit 1').getAttribute('aria-pressed')).toBe('false');
    expect(byLabel("Undo today's completion: Habit 2").getAttribute('aria-pressed')).toBe('true');
    expect(byLabel("Undo this week's completion of Habit 3")).toBeTruthy();
  });

  it('toggles habits in place (complete, undo today, undo this week)', async () => {
    await setup();
    dashApi.getDashboard.mockReturnValue(new Subject<Dashboard>()); // keep optimistic state visible
    byLabel('Mark done for today: Habit 1').click();
    await render();
    expect(habitsApi['completeHabit']).toHaveBeenCalledWith(1, {});
    expect(text('[data-count="habits"]')).toBe('3 / 3');

    byLabel("Undo today's completion: Habit 2").click();
    await render();
    expect(habitsApi['uncompleteHabit']).toHaveBeenCalledWith(2, '2026-06-17');

    byLabel("Undo this week's completion of Habit 3").click();
    await render();
    expect(habitsApi['uncompleteHabit']).toHaveBeenCalledWith(3, '2026-06-16');
  });

  it('shows in-progress plans with rest time and progress; toggling an item updates progress', async () => {
    await setup();
    expect(text('[data-count="plans"]')).toBe('1');
    const p = q('li.plan[data-id="7"]');
    expect(p.querySelector('h3')!.textContent).toContain('Plan 7');
    const rest = Number(p.querySelector('.rest__value')!.getAttribute('data-rest-seconds'));
    expect(rest).toBeGreaterThan(49 * 60);
    expect(rest).toBeLessThanOrEqual(50 * 60);
    expect(p.querySelector('.count')!.textContent).toContain('0 of 2 done');

    dashApi.getDashboard.mockReturnValue(new Subject<Dashboard>());
    const box = p.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await render();
    expect(plansApi['setPlanItemDone']).toHaveBeenCalledWith(7, 70, { done: true });
    expect(q('li.plan[data-id="7"] .count')!.textContent).toContain('1 of 2 done');
  });

  it('shows the learning snapshot', async () => {
    await setup();
    expect(q('[data-stat="in-progress"] .count-up')!.getAttribute('data-value')).toBe('2');
    expect(q('[data-stat="cards"] .count-up')!.getAttribute('data-value')).toBe('5');
    expect(q('[data-stat="last7"] .count-up')!.getAttribute('data-value')).toBe('3');
    expect(text('[data-stat="milestones"]')).toBe('6 / 10');
  });

  it('shows empty states when there is nothing to show', async () => {
    await setup(
      of(
        data({
          tasks: { dueToday: [], overdue: [], completedTodayCount: 0, totalActive: 0, doneCount: 0, completionPercent: 0 },
          habits: { today: [], activeCount: 0, completedTodayCount: 0 },
          plans: { inProgress: [], upcomingCount: 1, completedCount: 0 },
          learning: { cardsTotal: 0, inProgressCount: 0, milestonesTotal: 0, milestonesDone: 0, milestonesCompletedLast7Days: 0 },
        }),
      ),
    );
    expect(el.textContent).toContain('Nothing due today.');
    expect(el.textContent).toContain('No overdue tasks.');
    expect(el.textContent).toContain('No active habits yet.');
    expect(el.textContent).toContain('No plan in progress · 1 upcoming');
    expect(metricLabel('tasks')).toBe('Tasks done: 0%. 0 of 0 done · 0 completed today');
    expect(metricLabel('habits')).toContain('No active habits');
  });

  it('shows an error with Retry when the first load fails', async () => {
    await setup(problem(500, { detail: 'Server down' }));
    expect(el.textContent).toContain('Could not load the dashboard');
    expect(el.textContent).toContain('Server down');
    dashApi.getDashboard.mockReturnValue(of(data()));
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'))!.click();
    await render();
    expect(q('[data-metric="tasks"]')).toBeTruthy();
  });

  it('offers four quick-add actions that open the matching create form', async () => {
    await setup();
    const group = q('[role="group"][aria-label="Quick add"]');
    expect([...group.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add Task',
      'Add Habit',
      'Add Learning card',
      'Add Plan',
    ]);
    const cases: Array<[string, string, string]> = [
      ['Add Task', 'app-quick-add-task', 'Add task'],
      ['Add Habit', 'app-quick-add-habit', 'Add habit'],
      ['Add Learning card', 'app-quick-add-learning', 'Add learning card'],
      ['Add Plan', 'app-plan-builder-dialog', 'Create plan'],
    ];
    for (const [label, host, title] of cases) {
      byLabel(label).click();
      await render();
      const opened = q(host);
      expect(opened, label).toBeTruthy();
      expect(opened.querySelector('h2')!.textContent).toContain(title);
    }
  });
});
