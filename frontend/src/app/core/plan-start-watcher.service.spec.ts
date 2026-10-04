import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { PlanStatus } from '../api';
import { PlanView, PlansStore } from '../features/plans/plans.store';
import { NotificationService } from './notification.service';
import { PlanStartWatcher } from './plan-start-watcher.service';

// T081 — traces US4 AS6 / FR-023: a plan that is In Progress with no recorded start notification triggers
// one in-app toast (+ browser notification flag), is acknowledged on the server and highlighted; it is
// notified once only, also when the store re-emits; plans already acknowledged are not notified again.

function view(id: number, patch: Partial<PlanView> = {}): PlanView {
  return {
    id,
    title: `Plan ${id}`,
    estimatedDurationMinutes: 60,
    startDateTime: '2026-06-17T10:00:00Z',
    endDateTime: '2026-06-17T11:00:00Z',
    priorityOrder: 1,
    status: PlanStatus.InProgress,
    createdAt: '2026-06-17T09:00:00Z',
    startNotifiedAt: null,
    items: [],
    itemsTotal: 3,
    itemsDone: 0,
    progressPercent: 0,
    restSeconds: 3600,
    ...patch,
  };
}

describe('PlanStartWatcher', () => {
  let views: ReturnType<typeof signal<PlanView[]>>;
  let store: { views: typeof views; start: ReturnType<typeof vi.fn>; acknowledgeStart: ReturnType<typeof vi.fn> };
  let notifications: { notify: ReturnType<typeof vi.fn> };
  let watcher: PlanStartWatcher;

  beforeEach(() => {
    views = signal<PlanView[]>([]);
    store = { views, start: vi.fn(), acknowledgeStart: vi.fn(() => Promise.resolve(null)) };
    notifications = { notify: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PlanStartWatcher,
        { provide: PlansStore, useValue: store },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    watcher = TestBed.inject(PlanStartWatcher);
  });

  it('start() starts the plans store once', () => {
    watcher.start();
    watcher.start();
    expect(store.start).toHaveBeenCalledTimes(1);
  });

  it('notifies once, acknowledges and highlights an in-progress plan without startNotifiedAt', () => {
    views.set([view(1)]);
    TestBed.tick();
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const [title, opts] = notifications.notify.mock.calls[0];
    expect(title).toBe('Plan started: Plan 1');
    expect(opts).toMatchObject({ kind: 'info', browser: true });
    expect(opts.message).toContain('3 items');
    expect(opts.message).toContain('left');
    expect(store.acknowledgeStart).toHaveBeenCalledWith(1);
    expect(watcher.highlighted().has(1)).toBe(true);

    // store re-emits (poll / ack not yet stored) → still only one notification
    views.set([view(1, { restSeconds: 3500 }), view(2, { status: PlanStatus.NotStarted })]);
    TestBed.tick();
    views.set([view(1, { restSeconds: 3400 })]);
    TestBed.tick();
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(store.acknowledgeStart).toHaveBeenCalledTimes(1);
  });

  it('does not notify Not Started, Completed or already acknowledged plans', () => {
    views.set([
      view(1, { status: PlanStatus.NotStarted, restSeconds: null }),
      view(2, { status: PlanStatus.Completed, restSeconds: null }),
      view(3, { startNotifiedAt: '2026-06-17T10:00:05Z' }),
    ]);
    TestBed.tick();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(store.acknowledgeStart).not.toHaveBeenCalled();
    expect(watcher.highlighted().size).toBe(0);
  });

  it('notifies when an upcoming plan reaches its start', () => {
    views.set([view(1, { status: PlanStatus.NotStarted, restSeconds: null })]);
    TestBed.tick();
    expect(notifications.notify).not.toHaveBeenCalled();
    views.set([view(1)]);
    TestBed.tick();
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(store.acknowledgeStart).toHaveBeenCalledWith(1);
  });

  it('uses singular "item" for a one-item plan and notifies each due plan', () => {
    views.set([view(1, { itemsTotal: 1 }), view(2)]);
    TestBed.tick();
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(notifications.notify.mock.calls[0][1].message).toMatch(/^1 item ·/);
    expect(store.acknowledgeStart).toHaveBeenCalledWith(2);
  });

  it('drops the highlight once the plan is no longer in progress', () => {
    views.set([view(1)]);
    TestBed.tick();
    expect(watcher.highlighted().has(1)).toBe(true);
    views.set([view(1, { status: PlanStatus.Completed, restSeconds: null, startNotifiedAt: '2026-06-17T10:00:05Z' })]);
    expect(watcher.highlighted().has(1)).toBe(false);
  });
});
