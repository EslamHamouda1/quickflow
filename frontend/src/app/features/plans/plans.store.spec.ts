import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Plan, PlanItem, PlanItemSourceType, PlanStatus, PlansService } from '../../api';
import { NotificationService } from '../../core/notification.service';
import { NowService } from '../../core/now.service';
import { RefreshService } from '../../core/refresh.service';
import { PlansStore, compareActive, compareHistory, derivePlanStatus, toPlanView, withItems } from './plans.store';

// T081 — traces US4 AS3 (progress updates on toggle), AS5 (status / rest time derived from NowService,
// boundaries), AS7 (active & upcoming ordered by priority then start; history with final %), AS8 (remove),
// plus optimistic rollback, 404 reload, acknowledgeStart and RefreshService bumps.

const NOW = Date.parse('2026-06-17T10:00:00Z');
const iso = (offsetMin: number) => new Date(NOW + offsetMin * 60_000).toISOString();

function item(id: number, done = false, type: PlanItemSourceType = PlanItemSourceType.Task): PlanItem {
  return { id, sourceType: type, sourceId: id * 10, sourceTitle: `S${id}`, done, sourceAvailable: true };
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
    startNotifiedAt: null,
    items,
    itemsTotal: items.length,
    itemsDone: done,
    progressPercent: items.length ? Math.round((done * 100) / items.length) : 0,
    restSeconds: 3000,
    ...patch,
  };
}

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('plan helpers', () => {
  const p = { startDateTime: iso(0), endDateTime: iso(60), items: [item(1), item(2)] };

  it('derives Not Started → In Progress → Completed across start / end boundaries', () => {
    expect(derivePlanStatus(p, NOW - 1)).toBe(PlanStatus.NotStarted);
    expect(derivePlanStatus(p, NOW)).toBe(PlanStatus.InProgress);
    expect(derivePlanStatus(p, NOW + 60 * 60_000 - 1)).toBe(PlanStatus.InProgress);
    expect(derivePlanStatus(p, NOW + 60 * 60_000)).toBe(PlanStatus.Completed);
  });

  it('is Completed when all items are done, even before start', () => {
    expect(derivePlanStatus({ ...p, items: [item(1, true), item(2, true)] }, NOW - 3_600_000)).toBe(PlanStatus.Completed);
    expect(derivePlanStatus({ ...p, items: [] }, NOW + 1000)).toBe(PlanStatus.InProgress);
  });

  it('rest time = end − now only while In Progress', () => {
    const base = plan(1, { startDateTime: iso(0), endDateTime: iso(60) });
    expect(toPlanView(base, NOW + 1000)).toMatchObject({ status: PlanStatus.InProgress, restSeconds: 3599 });
    expect(toPlanView(base, NOW - 1000)).toMatchObject({ status: PlanStatus.NotStarted, restSeconds: null });
    expect(toPlanView(base, NOW + 61 * 60_000)).toMatchObject({ status: PlanStatus.Completed, restSeconds: null });
  });

  it('withItems recomputes counters and rounded progress', () => {
    const p3 = plan(1, { items: [item(1), item(2), item(3)] });
    expect(withItems(p3, [item(1, true), item(2), item(3)])).toMatchObject({ itemsTotal: 3, itemsDone: 1, progressPercent: 33 });
    expect(withItems(p3, [item(1, true), item(2, true), item(3)]).progressPercent).toBe(67);
    expect(withItems(p3, [])).toMatchObject({ itemsTotal: 0, itemsDone: 0, progressPercent: 0 });
  });

  it('orders active by priority, then start, then id; history most recently ended first', () => {
    const a = plan(1, { priorityOrder: 2, startDateTime: iso(-5) });
    const b = plan(2, { priorityOrder: 1, startDateTime: iso(30) });
    const c = plan(3, { priorityOrder: 2, startDateTime: iso(-20) });
    const d = plan(4, { priorityOrder: 2, startDateTime: iso(-20) });
    expect([a, b, c, d].sort(compareActive).map((x) => x.id)).toEqual([2, 3, 4, 1]);
    const h1 = plan(5, { endDateTime: iso(-100) });
    const h2 = plan(6, { endDateTime: iso(-10) });
    expect([h1, h2].sort(compareHistory).map((x) => x.id)).toEqual([6, 5]);
  });
});

describe('PlansStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; notify: ReturnType<typeof vi.fn> };
  let now: ReturnType<typeof signal<number>>;
  let store: PlansStore;
  let refresh: RefreshService;
  let list: Plan[];

  beforeEach(() => {
    list = [
      plan(1, { priorityOrder: 2, startDateTime: iso(-10), endDateTime: iso(50) }), // in progress P2
      plan(2, { priorityOrder: 1, startDateTime: iso(30), endDateTime: iso(90), status: PlanStatus.NotStarted }), // upcoming P1
      plan(3, { startDateTime: iso(-120), endDateTime: iso(-60), status: PlanStatus.Completed }), // history (time)
      plan(4, { items: [item(400, true), item(401, true)], status: PlanStatus.Completed }), // history (all done)
    ];
    api = {
      listPlans: vi.fn(() => of(list)),
      createPlan: vi.fn(),
      deletePlan: vi.fn(),
      setPlanItemDone: vi.fn(),
      acknowledgePlanStart: vi.fn(),
    };
    notify = { success: vi.fn(), error: vi.fn(), notify: vi.fn() };
    now = signal(NOW);
    TestBed.configureTestingModule({
      providers: [
        PlansStore,
        { provide: PlansService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: NowService, useValue: { now, date: () => new Date(now()) } },
      ],
    });
    store = TestBed.inject(PlansStore);
    refresh = TestBed.inject(RefreshService);
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
  }

  it('does not load before start(); start is idempotent', async () => {
    await settle();
    expect(api['listPlans']).not.toHaveBeenCalled();
    store.start();
    store.start();
    await settle();
    expect(api['listPlans']).toHaveBeenCalledTimes(1);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('groups active & upcoming (priority, then start) and history (completed)', async () => {
    store.start();
    await settle();
    expect(store.active().map((p) => p.id)).toEqual([2, 1]);
    expect(store.history().map((p) => p.id)).toEqual([4, 3]);
    expect(store.inProgressCount()).toBe(1);
    expect(store.history().find((p) => p.id === 4)?.progressPercent).toBe(100);
  });

  it('derives rest time from NowService and re-derives status at start / end boundaries', async () => {
    store.start();
    await settle();
    const p1 = () => store.views().find((p) => p.id === 1)!;
    expect(p1().restSeconds).toBe(50 * 60);
    now.set(NOW + 3000);
    expect(p1().restSeconds).toBe(50 * 60 - 3);
    // upcoming plan 2 starts at +30 min without a new poll
    now.set(NOW + 30 * 60_000);
    expect(store.views().find((p) => p.id === 2)).toMatchObject({ status: PlanStatus.InProgress, restSeconds: 60 * 60 });
    expect(store.inProgressCount()).toBe(2);
    // plan 1 ends at +50 min → moves to history
    now.set(NOW + 50 * 60_000);
    expect(p1()).toMatchObject({ status: PlanStatus.Completed, restSeconds: null });
    expect(store.history().map((p) => p.id)).toContain(1);
    expect(store.active().map((p) => p.id)).toEqual([2]);
  });

  it('reloads on foreign RefreshService bumps but not on its own', async () => {
    store.start();
    await settle();
    const base = api['listPlans'].mock.calls.length;
    refresh.bump();
    await settle();
    expect(api['listPlans']).toHaveBeenCalledTimes(base + 1);

    api['acknowledgePlanStart'].mockReturnValue(of(list[0]));
    api['setPlanItemDone'].mockReturnValue(of(plan(1, { items: [item(100, true), item(101)] })));
    await store.setItemDone(list[0], list[0].items[0], true);
    await settle();
    expect(api['listPlans']).toHaveBeenCalledTimes(base + 1);
  });

  it('shows a load error and ignores stale list responses', async () => {
    store.start();
    await settle();
    const slow = new Subject<Plan[]>();
    api['listPlans'].mockReturnValueOnce(slow).mockReturnValueOnce(of([plan(9)]));
    const first = store.load();
    const second = store.load();
    await second;
    slow.next([plan(8)]);
    slow.complete();
    await first;
    expect(store.plans().map((p) => p.id)).toEqual([9]);
    api['listPlans'].mockReturnValueOnce(problem(500, { detail: 'down' }));
    await store.load();
    expect(store.error()).toBe('down');
  });

  it('creates a plan, adds it and bumps refresh; rejects with field errors', async () => {
    store.start();
    await settle();
    const before = refresh.version();
    const created = plan(5, { title: 'New' });
    api['createPlan'].mockReturnValue(of(created));
    const req = {
      title: 'New',
      estimatedDurationMinutes: 60,
      startDateTime: iso(0),
      endDateTime: iso(60),
      priorityOrder: 1,
      items: [{ sourceType: PlanItemSourceType.Task, sourceId: 1 }],
    };
    expect(await store.create(req)).toEqual(created);
    expect(api['createPlan']).toHaveBeenCalledWith(req);
    expect(store.plans().some((p) => p.id === 5)).toBe(true);
    expect(refresh.version()).toBe(before + 1);

    api['createPlan'].mockReturnValue(
      problem(400, { detail: 'Validation failed', errors: [{ field: 'endDateTime', message: 'End must be after start' }] }),
    );
    await expect(store.create(req)).rejects.toMatchObject({ status: 400, fieldErrors: { endDateTime: 'End must be after start' } });
  });

  it('marks an item done optimistically, then takes the server plan', async () => {
    store.start();
    await settle();
    const server = new Subject<Plan>();
    api['setPlanItemDone'].mockReturnValue(server);
    const p1 = store.plans().find((p) => p.id === 1)!;
    const promise = store.setItemDone(p1, p1.items[0], true);
    const optimistic = store.plans().find((p) => p.id === 1)!;
    expect(optimistic).toMatchObject({ itemsDone: 1, progressPercent: 50 });
    expect(store.pending().has(1)).toBe(true);
    expect(api['setPlanItemDone']).toHaveBeenCalledWith(1, 100, { done: true });
    // a second mutation on the same plan while pending is ignored
    expect(await store.setItemDone(p1, p1.items[1], true)).toBe(false);
    server.next(plan(1, { title: 'srv', items: [item(100, true), item(101)] }));
    server.complete();
    expect(await promise).toBe(true);
    expect(store.plans().find((p) => p.id === 1)?.title).toBe('srv');
    expect(store.pending().has(1)).toBe(false);
  });

  it('marking all items done moves the plan to history immediately', async () => {
    store.start();
    await settle();
    api['setPlanItemDone'].mockReturnValueOnce(of(plan(1, { items: [item(100, true), item(101)] })));
    const p1 = store.plans().find((p) => p.id === 1)!;
    await store.setItemDone(p1, p1.items[0], true);
    expect(store.views().find((p) => p.id === 1)).toMatchObject({ status: PlanStatus.InProgress, progressPercent: 50 });
    api['setPlanItemDone'].mockReturnValueOnce(new Subject());
    const cur = store.plans().find((p) => p.id === 1)!;
    void store.setItemDone(cur, cur.items[1], true);
    expect(store.views().find((p) => p.id === 1)).toMatchObject({ status: PlanStatus.Completed, progressPercent: 100, restSeconds: null });
    expect(store.history().map((p) => p.id)).toContain(1);
    expect(store.active().map((p) => p.id)).toEqual([2]);
  });

  it('rolls back on error and reloads on 404', async () => {
    store.start();
    await settle();
    api['setPlanItemDone'].mockReturnValue(problem(500, { detail: 'boom' }));
    const p1 = store.plans().find((p) => p.id === 1)!;
    expect(await store.setItemDone(p1, p1.items[0], true)).toBe(false);
    expect(store.plans().find((p) => p.id === 1)?.itemsDone).toBe(0);
    expect(notify.error).toHaveBeenCalledWith('Could not update the plan item', 'boom');
    const base = api['listPlans'].mock.calls.length;
    api['setPlanItemDone'].mockReturnValue(problem(404, { detail: 'gone' }));
    await store.setItemDone(p1, p1.items[0], true);
    await settle();
    expect(api['listPlans']).toHaveBeenCalledTimes(base + 1);
  });

  it('removes a plan optimistically; restores it on failure; 404 counts as removed', async () => {
    store.start();
    await settle();
    api['deletePlan'].mockReturnValue(of(undefined));
    const before = refresh.version();
    expect(await store.remove(list[0])).toBe(true);
    expect(store.plans().some((p) => p.id === 1)).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Plan removed', 'Plan 1');
    expect(refresh.version()).toBe(before + 1);

    api['deletePlan'].mockReturnValue(problem(500, { detail: 'nope' }));
    expect(await store.remove(list[1])).toBe(false);
    expect(store.plans().some((p) => p.id === 2)).toBe(true);
    expect(notify.error).toHaveBeenCalledWith('Could not remove the plan', 'nope');

    api['deletePlan'].mockReturnValue(problem(404, { detail: 'gone' }));
    expect(await store.remove(list[2])).toBe(true);
  });

  it('acknowledgeStart stores the server plan; failure returns null', async () => {
    store.start();
    await settle();
    const acked = plan(1, { startNotifiedAt: iso(0) });
    api['acknowledgePlanStart'].mockReturnValue(of(acked));
    expect(await store.acknowledgeStart(1)).toEqual(acked);
    expect(api['acknowledgePlanStart']).toHaveBeenCalledWith(1);
    expect(store.plans().find((p) => p.id === 1)?.startNotifiedAt).toBe(iso(0));
    api['acknowledgePlanStart'].mockReturnValue(problem(500, {}));
    expect(await store.acknowledgeStart(1)).toBeNull();
  });
});
