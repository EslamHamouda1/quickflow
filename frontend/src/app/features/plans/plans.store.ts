import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Plan, PlanItem, PlanRequest, PlanStatus, PlansService } from '../../api';
import { ApiErrorInfo, toApiError } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { NowService } from '../../core/now.service';
import { RefreshService } from '../../core/refresh.service';
import { secondsUntil } from '../../core/format';

/** A plan with status / rest time re-derived on the client from `NowService` (FR-021, FR-022). */
export interface PlanView extends Plan {
  status: PlanStatus;
  restSeconds: number | null;
}

/**
 * Derived status (FR-021): Completed if all items are done or now ≥ end; otherwise In Progress if
 * now ≥ start; otherwise Not Started.
 */
export function derivePlanStatus(plan: Pick<Plan, 'startDateTime' | 'endDateTime' | 'items'>, nowMs: number): PlanStatus {
  const allDone = plan.items.length > 0 && plan.items.every((i) => i.done);
  if (allDone || nowMs >= Date.parse(plan.endDateTime)) {
    return PlanStatus.Completed;
  }
  return nowMs >= Date.parse(plan.startDateTime) ? PlanStatus.InProgress : PlanStatus.NotStarted;
}

/** Plan view at `nowMs`: derived status, rest time (end − now) only while In Progress. */
export function toPlanView(plan: Plan, nowMs: number): PlanView {
  const status = derivePlanStatus(plan, nowMs);
  return {
    ...plan,
    status,
    restSeconds: status === PlanStatus.InProgress ? secondsUntil(plan.endDateTime, nowMs) : null,
  };
}

/** Recomputes the item counters / progress of a plan for a new item list (optimistic view). */
export function withItems(plan: Plan, items: PlanItem[]): Plan {
  const done = items.filter((i) => i.done).length;
  return {
    ...plan,
    items,
    itemsTotal: items.length,
    itemsDone: done,
    progressPercent: items.length ? Math.round((done * 100) / items.length) : 0,
  };
}

/** Active & upcoming order (FR-025): priority order (1 = highest), then earlier start. */
export function compareActive(a: Plan, b: Plan): number {
  return a.priorityOrder - b.priorityOrder || Date.parse(a.startDateTime) - Date.parse(b.startDateTime) || a.id - b.id;
}

/** History order: most recently ended first. */
export function compareHistory(a: Plan, b: Plan): number {
  return Date.parse(b.endDateTime) - Date.parse(a.endDateTime) || b.id - a.id;
}

/**
 * App-wide signal store for Todo Plans (root, so the plan-start watcher runs on every page).
 * Polls `listPlans` every 30 s and on `RefreshService` bumps made by other features; status and
 * rest time are re-derived every second from `NowService`, so start/end boundaries flip without
 * waiting for the next poll. All backend calls go through the generated `PlansService`.
 */
@Injectable({ providedIn: 'root' })
export class PlansStore {
  static readonly POLL_MS = 30_000;

  private readonly api = inject(PlansService);
  private readonly refresh = inject(RefreshService);
  private readonly notify = inject(NotificationService);
  private readonly clock = inject(NowService);

  private readonly _plans = signal<Plan[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _pending = signal<ReadonlySet<number>>(new Set());

  readonly plans = this._plans.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  /** Ids of plans with a request in flight. */
  readonly pending = this._pending.asReadonly();

  /** All plans with client-derived status and rest time (re-evaluated every second). */
  readonly views = computed(() => {
    const now = this.clock.now();
    return this._plans().map((p) => toPlanView(p, now));
  });
  /** Not Started + In Progress, ordered by priority then start. */
  readonly active = computed(() =>
    this.views()
      .filter((p) => p.status !== PlanStatus.Completed)
      .sort(compareActive),
  );
  /** Completed plans (history with final percentage), most recently ended first. */
  readonly history = computed(() =>
    this.views()
      .filter((p) => p.status === PlanStatus.Completed)
      .sort(compareHistory),
  );
  readonly inProgressCount = computed(() => this.active().filter((p) => p.status === PlanStatus.InProgress).length);

  private requestSeq = 0;
  private started = false;
  /** Refresh version produced by this store's own mutations (no reload needed for those). */
  private ownVersion = -1;

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      const version = this.refresh.version();
      untracked(() => {
        if (this.started && version !== this.ownVersion) {
          void this.load();
        }
      });
    });
    const id = setInterval(() => {
      if (this.started) {
        void this.load();
      }
    }, PlansStore.POLL_MS);
    destroyRef.onDestroy(() => clearInterval(id));
  }

  /** Starts loading + polling (idempotent); called by the app shell's plan-start watcher and the page. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    void this.load();
  }

  /** Fetches all plans; stale responses are ignored. */
  async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this._loading.set(true);
    try {
      const list = await firstValueFrom(this.api.listPlans());
      if (seq !== this.requestSeq) {
        return;
      }
      // Keep optimistic local copies of plans with a request in flight.
      const pending = this._pending();
      const local = new Map(this._plans().map((p) => [p.id, p]));
      this._plans.set(list.map((p) => (pending.has(p.id) && local.has(p.id) ? local.get(p.id)! : p)));
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

  /** Creates a plan; rejects with `ApiErrorInfo` (field errors for the builder). */
  async create(request: PlanRequest): Promise<Plan> {
    try {
      const created = await firstValueFrom(this.api.createPlan(request));
      this.requestSeq++; // a list request in flight must not drop the new plan
      this._plans.update((list) => [...list.filter((p) => p.id !== created.id), created]);
      this.bump();
      return created;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Removes a plan (optimistic; source tasks/habits/cards are unaffected). */
  async remove(plan: Plan): Promise<boolean> {
    if (this._pending().has(plan.id)) {
      return false;
    }
    const snapshot = this._plans();
    this.setPending(plan.id, true);
    this._plans.update((list) => list.filter((p) => p.id !== plan.id));
    try {
      await firstValueFrom(this.api.deletePlan(plan.id), { defaultValue: undefined });
      this.notify.success('Plan removed', plan.title);
      this.bump();
      return true;
    } catch (err) {
      const info = toApiError(err);
      if (info.status === 404) {
        this.bump();
        return true;
      }
      const original = snapshot.find((p) => p.id === plan.id);
      if (original && !this._plans().some((p) => p.id === plan.id)) {
        this._plans.update((list) => [...list, original]);
      }
      this.notify.error('Could not remove the plan', info.message);
      return false;
    } finally {
      this.setPending(plan.id, false);
    }
  }

  /**
   * Marks an item done / not done (optimistic progress). Done on a task/habit item changes the source
   * on the server (FR-024), so other features are refreshed.
   */
  async setItemDone(plan: Plan, item: PlanItem, done: boolean): Promise<boolean> {
    if (this._pending().has(plan.id)) {
      return false;
    }
    const original = this._plans().find((p) => p.id === plan.id);
    this.setPending(plan.id, true);
    this.replaceWith(plan.id, (p) => withItems(p, p.items.map((i) => (i.id === item.id ? { ...i, done } : i))));
    try {
      const updated = await firstValueFrom(this.api.setPlanItemDone(plan.id, item.id, { done }));
      this.replaceWith(plan.id, () => updated);
      this.bump();
      return true;
    } catch (err) {
      const info: ApiErrorInfo = toApiError(err);
      if (original) {
        this.replaceWith(plan.id, () => original);
      }
      this.notify.error('Could not update the plan item', info.message);
      if (info.status === 404) {
        void this.load();
      }
      return false;
    } finally {
      this.setPending(plan.id, false);
    }
  }

  /** Records that the start notification was shown (idempotent on the server). */
  async acknowledgeStart(id: number): Promise<Plan | null> {
    try {
      const updated = await firstValueFrom(this.api.acknowledgePlanStart(id));
      this.replaceWith(id, () => updated);
      return updated;
    } catch {
      return null;
    }
  }

  private replaceWith(id: number, change: (p: Plan) => Plan): void {
    this._plans.update((list) => list.map((p) => (p.id === id ? change(p) : p)));
  }

  /** Tells other features (dashboard, tasks, habits) that data changed, without reloading plans. */
  private bump(): void {
    this.refresh.bump();
    this.ownVersion = this.refresh.version();
  }

  private setPending(id: number, on: boolean): void {
    this._pending.update((set) => {
      const next = new Set(set);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
