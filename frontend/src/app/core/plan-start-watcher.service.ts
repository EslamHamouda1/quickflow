import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { PlanStatus } from '../api';
import { PlanView, PlansStore } from '../features/plans/plans.store';
import { formatDuration } from './format';
import { NotificationService } from './notification.service';

/**
 * Plan start notifications (FR-023). Started once from the app shell, so it runs on every page:
 * whenever a plan's client-derived status is In Progress and the server has not recorded a start
 * notification (`startNotifiedAt` null), it shows a toast (+ browser notification when enabled and
 * permitted), calls `acknowledgePlanStart` so the user is notified only once (also across reloads),
 * and highlights the plan (pulse) on the Todo Plans page while it is in progress.
 */
@Injectable({ providedIn: 'root' })
export class PlanStartWatcher {
  private readonly store = inject(PlansStore);
  private readonly notifications = inject(NotificationService);

  /** Plan ids already notified in this session (guards against re-notifying before the ack returns). */
  private readonly notified = new Set<number>();
  private readonly _highlighted = signal<ReadonlySet<number>>(new Set());
  private started = false;

  /** Ids of plans that started during this session and are still In Progress. */
  readonly highlighted = computed(() => {
    const ids = this._highlighted();
    if (ids.size === 0) {
      return ids;
    }
    const inProgress = new Set(
      this.store
        .views()
        .filter((p) => p.status === PlanStatus.InProgress)
        .map((p) => p.id),
    );
    return new Set([...ids].filter((id) => inProgress.has(id)));
  });

  /** Plans that are In Progress and still need their start notification. */
  private readonly due = computed(
    () => this.store.views().filter((p) => p.status === PlanStatus.InProgress && !p.startNotifiedAt),
    { equal: (a, b) => a.length === b.length && a.every((p, i) => p.id === b[i].id) },
  );

  constructor() {
    effect(() => {
      const due = this.due();
      untracked(() => due.forEach((plan) => this.announce(plan)));
    });
  }

  /** Begins loading/polling plans (idempotent). */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.store.start();
  }

  private announce(plan: PlanView): void {
    if (this.notified.has(plan.id)) {
      return;
    }
    this.notified.add(plan.id);
    this._highlighted.update((set) => new Set(set).add(plan.id));
    this.notifications.notify(`Plan started: ${plan.title}`, {
      kind: 'info',
      message: `${plan.itemsTotal} item${plan.itemsTotal === 1 ? '' : 's'} · ${formatDuration(plan.restSeconds)} left`,
      durationMs: 10_000,
      browser: true,
    });
    void this.store.acknowledgeStart(plan.id);
  }
}
