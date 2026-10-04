import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Habit, HabitFrequency, HabitsService } from '../../api';
import { todayIso } from '../../core/format';
import { NotificationService } from '../../core/notification.service';
import { RefreshService } from '../../core/refresh.service';
import { HabitsStore, withCompletedToday, withoutCompletion } from './habits.store';

// T049 — traces US2 AS1 (create), AS2 (complete today), AS3 (duplicate → "Already done", no duplicate),
// AS4 (undo today / weekly undo), AS5 (streak in optimistic view), AS6 (deactivate / reactivate / remove),
// plus optimistic rollback and RefreshService bump.

const TODAY = todayIso();

function habit(id: number, patch: Partial<Habit> = {}): Habit {
  return {
    id,
    name: `Habit ${id}`,
    description: null,
    frequency: HabitFrequency.Daily,
    createdAt: '2026-06-15T10:00:00Z',
    active: true,
    completedToday: false,
    doneForCurrentPeriod: false,
    currentStreak: 0,
    completionRate: 0,
    lastCompletedDate: null,
    ...patch,
  };
}

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('withCompletedToday / withoutCompletion', () => {
  it('marks done and increments the streak only when the period was not done', () => {
    const h = withCompletedToday(habit(1, { currentStreak: 2 }), '2026-06-17');
    expect(h).toMatchObject({ completedToday: true, doneForCurrentPeriod: true, currentStreak: 3, lastCompletedDate: '2026-06-17' });
    const weeklyDone = habit(2, { frequency: HabitFrequency.Weekly, doneForCurrentPeriod: true, currentStreak: 4 });
    expect(withCompletedToday(weeklyDone, '2026-06-17').currentStreak).toBe(4);
  });

  it('removes today and decrements the streak (never below 0)', () => {
    const done = habit(1, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 3 });
    expect(withoutCompletion(done, '2026-06-17', '2026-06-17')).toMatchObject({
      completedToday: false, doneForCurrentPeriod: false, currentStreak: 2,
    });
    const zero = habit(1, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 0 });
    expect(withoutCompletion(zero, '2026-06-17', '2026-06-17').currentStreak).toBe(0);
  });

  it('weekly undo of an earlier date keeps completedToday and clears the period', () => {
    const w = habit(1, { frequency: HabitFrequency.Weekly, doneForCurrentPeriod: true, currentStreak: 1 });
    expect(withoutCompletion(w, '2026-06-15', '2026-06-17')).toMatchObject({
      completedToday: false, doneForCurrentPeriod: false, currentStreak: 0,
    });
  });
});

describe('HabitsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; toast: ReturnType<typeof vi.fn> };
  let store: HabitsStore;
  let refresh: RefreshService;
  let list: Habit[];

  beforeEach(() => {
    list = [
      habit(3, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 1, lastCompletedDate: TODAY }),
      habit(2),
      habit(1, { active: false }),
    ];
    api = {
      listHabits: vi.fn(() => of(list)),
      createHabit: vi.fn(),
      updateHabit: vi.fn(),
      completeHabit: vi.fn(),
      uncompleteHabit: vi.fn(),
      deactivateHabit: vi.fn(),
      activateHabit: vi.fn(),
      deleteHabit: vi.fn(),
    };
    notify = { success: vi.fn(), error: vi.fn(), toast: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        HabitsStore,
        { provide: HabitsService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    store = TestBed.inject(HabitsStore);
    refresh = TestBed.inject(RefreshService);
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
  }

  it('loads all habits on start and splits active / inactive with doneCount', async () => {
    await settle();
    expect(api['listHabits']).toHaveBeenCalledWith();
    expect(store.habits().map((h) => h.id)).toEqual([3, 2, 1]);
    expect(store.active().map((h) => h.id)).toEqual([3, 2]);
    expect(store.inactive().map((h) => h.id)).toEqual([1]);
    expect(store.doneCount()).toBe(1);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('shows a load error and ignores stale responses', async () => {
    await settle();
    const slow = new Subject<Habit[]>();
    api['listHabits'].mockReturnValueOnce(slow).mockReturnValueOnce(of([habit(9)]));
    const first = store.load();
    const second = store.load();
    await second;
    slow.next([habit(8)]);
    slow.complete();
    await first;
    expect(store.habits().map((h) => h.id)).toEqual([9]);

    api['listHabits'].mockReturnValueOnce(problem(500, { detail: 'down' }));
    await store.load();
    expect(store.error()).toBe('down');
  });

  it('creates a habit, prepends it and bumps refresh', async () => {
    await settle();
    const before = refresh.version();
    const created = habit(4, { name: 'Read' });
    api['createHabit'].mockReturnValue(of(created));
    api['listHabits'].mockReturnValue(of([created, ...list]));
    const result = await store.create({ name: 'Read', frequency: HabitFrequency.Weekly });
    expect(result).toEqual(created);
    expect(api['createHabit']).toHaveBeenCalledWith({ name: 'Read', frequency: HabitFrequency.Weekly });
    expect(store.habits()[0].id).toBe(4);
    expect(refresh.version()).toBe(before + 1);
  });

  it('create / update reject with field errors from problem+json', async () => {
    await settle();
    api['createHabit'].mockReturnValue(problem(400, { detail: 'Validation failed', errors: [{ field: 'name', message: 'Name is required' }] }));
    await expect(store.create({ name: '', frequency: HabitFrequency.Daily })).rejects.toMatchObject({
      status: 400, fieldErrors: { name: 'Name is required' },
    });
    api['updateHabit'].mockReturnValue(problem(404, { detail: 'Habit 2 not found' }));
    await expect(store.update(2, { name: 'x', frequency: HabitFrequency.Daily })).rejects.toMatchObject({ status: 404 });
  });

  it('updates a habit in place', async () => {
    await settle();
    const updated = habit(2, { name: 'Renamed' });
    api['updateHabit'].mockReturnValue(of(updated));
    api['listHabits'].mockReturnValue(of([list[0], updated, list[2]]));
    await store.update(2, { name: 'Renamed', frequency: HabitFrequency.Daily });
    expect(api['updateHabit']).toHaveBeenCalledWith(2, { name: 'Renamed', frequency: HabitFrequency.Daily });
    expect(store.habits().find((h) => h.id === 2)?.name).toBe('Renamed');
  });

  it('toggleToday off → completes today optimistically with an empty body (server date)', async () => {
    await settle();
    const server = new Subject<Habit>();
    api['completeHabit'].mockReturnValue(server);
    const done = store.toggleToday(store.habits()[1]);
    expect(store.habits()[1]).toMatchObject({ completedToday: true, doneForCurrentPeriod: true, currentStreak: 1 });
    expect(store.pending().has(2)).toBe(true);
    expect(store.doneCount()).toBe(2);
    expect(api['completeHabit']).toHaveBeenCalledWith(2, {});
    const fromServer = habit(2, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 5, completionRate: 40, lastCompletedDate: TODAY });
    api['listHabits'].mockReturnValue(of([list[0], fromServer, list[2]]));
    server.next(fromServer);
    server.complete();
    expect(await done).toBe(true);
    expect(store.habits()[1].currentStreak).toBe(5);
    expect(store.pending().has(2)).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Habit done for today', 'Habit 2');
  });

  it('toggleToday on → uncompletes lastCompletedDate', async () => {
    await settle();
    api['uncompleteHabit'].mockReturnValue(of(habit(3)));
    expect(await store.toggleToday(store.habits()[0])).toBe(true);
    expect(api['uncompleteHabit']).toHaveBeenCalledWith(3, TODAY);
  });

  it('weekly undo calls uncompleteHabit with the given date', async () => {
    await settle();
    api['uncompleteHabit'].mockReturnValue(of(habit(2)));
    await store.uncomplete(store.habits()[1], '2026-06-15');
    expect(api['uncompleteHabit']).toHaveBeenCalledWith(2, '2026-06-15');
  });

  it('409 duplicate keeps the habit done, shows "Already done" info and reloads', async () => {
    await settle();
    api['completeHabit'].mockReturnValue(problem(409, { detail: `Habit is already completed on ${TODAY}` }));
    const calls = api['listHabits'].mock.calls.length;
    // The reload returns the server state (already completed today); before it lands the optimistic view stays done.
    const reload = new Subject<Habit[]>();
    api['listHabits'].mockReturnValue(reload);
    expect(await store.completeToday(store.habits()[1])).toBe(false);
    expect(store.habits()[1].completedToday).toBe(true);
    reload.next([list[0], habit(2, { completedToday: true, doneForCurrentPeriod: true, currentStreak: 1 }), list[2]]);
    reload.complete();
    await settle();
    expect(store.habits()[1].completedToday).toBe(true);
    expect(notify.toast).toHaveBeenCalledWith('Already done', { kind: 'info', message: `Habit is already completed on ${TODAY}` });
    expect(notify.error).not.toHaveBeenCalled();
    expect(api['listHabits'].mock.calls.length).toBe(calls + 1);
  });

  it('rolls back only the failed habit and shows an error toast', async () => {
    await settle();
    api['deactivateHabit'].mockReturnValue(problem(500, { detail: 'boom' }));
    expect(await store.deactivate(store.habits()[1])).toBe(false);
    expect(store.habits()[1].active).toBe(true);
    expect(notify.error).toHaveBeenCalledWith('Could not update the habit', 'boom');
  });

  it('404 on a mutation rolls back and reloads the list', async () => {
    await settle();
    api['completeHabit'].mockReturnValue(problem(404, { detail: 'Habit 2 not found' }));
    const calls = api['listHabits'].mock.calls.length;
    await store.completeToday(store.habits()[1]);
    expect(store.habits()[1].completedToday).toBe(false);
    expect(api['listHabits'].mock.calls.length).toBe(calls + 1);
  });

  it('ignores a second mutation while one is pending for the same habit', async () => {
    await settle();
    const server = new Subject<Habit>();
    api['completeHabit'].mockReturnValue(server);
    const first = store.completeToday(store.habits()[1]);
    expect(await store.completeToday(store.habits()[1])).toBe(false);
    expect(api['completeHabit']).toHaveBeenCalledTimes(1);
    server.next(habit(2, { completedToday: true }));
    server.complete();
    await first;
  });

  it('deactivate / activate move the habit between sections optimistically', async () => {
    await settle();
    const pending = new Subject<Habit>();
    api['deactivateHabit'].mockReturnValue(pending);
    const p = store.deactivate(store.habits()[1]);
    expect(store.inactive().map((h) => h.id)).toEqual([2, 1]);
    pending.next(habit(2, { active: false }));
    pending.complete();
    await p;
    expect(notify.success).toHaveBeenCalledWith('Habit deactivated', 'History is kept; reactivate it at any time.');

    api['activateHabit'].mockReturnValue(of(habit(1)));
    await store.activate(store.habits().find((h) => h.id === 1)!);
    expect(api['activateHabit']).toHaveBeenCalledWith(1);
  });

  it('remove deletes optimistically and re-inserts at the old index on failure', async () => {
    await settle();
    api['deleteHabit'].mockReturnValue(problem(500, { detail: 'nope' }));
    await store.remove(store.habits()[1]);
    expect(store.habits().map((h) => h.id)).toEqual([3, 2, 1]);

    const before = refresh.version();
    api['deleteHabit'].mockReturnValue(of(undefined));
    api['listHabits'].mockReturnValue(of([list[0], list[2]]));
    expect(await store.remove(store.habits()[1])).toBe(true);
    expect(store.habits().map((h) => h.id)).toEqual([3, 1]);
    expect(refresh.version()).toBe(before + 1);
  });
});
