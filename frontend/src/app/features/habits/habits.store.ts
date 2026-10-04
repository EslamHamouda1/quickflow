import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { Habit, HabitRequest, HabitsService } from '../../api';
import { ApiErrorInfo, toApiError } from '../../core/api-errors';
import { todayIso } from '../../core/format';
import { NotificationService } from '../../core/notification.service';
import { RefreshService } from '../../core/refresh.service';

/** Optimistic view of a habit after recording today's completion (server response replaces it). */
export function withCompletedToday(h: Habit, today: string = todayIso()): Habit {
  return {
    ...h,
    completedToday: true,
    doneForCurrentPeriod: true,
    currentStreak: h.doneForCurrentPeriod ? h.currentStreak : h.currentStreak + 1,
    lastCompletedDate: today,
  };
}

/** Optimistic view of a habit after removing the completion of `date` in the current period. */
export function withoutCompletion(h: Habit, date: string, today: string = todayIso()): Habit {
  return {
    ...h,
    completedToday: date === today ? false : h.completedToday,
    // A Weekly habit may still have another completion this week; the server response corrects it.
    doneForCurrentPeriod: false,
    currentStreak: h.doneForCurrentPeriod ? Math.max(0, h.currentStreak - 1) : h.currentStreak,
  };
}

/**
 * Signal store for the Habits page. All backend calls go through the generated `HabitsService`.
 * Completion toggle, deactivate/activate and remove are optimistic with per-habit rollback; every
 * successful mutation bumps `RefreshService` (dashboard etc.) and re-fetches the list.
 */
@Injectable()
export class HabitsStore {
  private readonly api = inject(HabitsService);
  private readonly refresh = inject(RefreshService);
  private readonly notify = inject(NotificationService);

  private readonly _habits = signal<Habit[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _pending = signal<ReadonlySet<number>>(new Set());

  readonly habits = this._habits.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pending = this._pending.asReadonly();
  readonly active = computed(() => this._habits().filter((h) => h.active));
  readonly inactive = computed(() => this._habits().filter((h) => !h.active));
  /** Active habits done for their current period. */
  readonly doneCount = computed(() => this.active().filter((h) => h.doneForCurrentPeriod).length);

  private requestSeq = 0;

  constructor() {
    void this.load();
  }

  /** Fetches all habits (active and inactive, newest first); stale responses are ignored. */
  async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this._loading.set(true);
    try {
      const list = await firstValueFrom(this.api.listHabits());
      if (seq !== this.requestSeq) {
        return;
      }
      this._habits.set(list);
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

  /** Creates a habit; rejects with `ApiErrorInfo` (field errors for the form). */
  async create(request: HabitRequest): Promise<Habit> {
    try {
      const created = await firstValueFrom(this.api.createHabit(request));
      this._habits.update((list) => [created, ...list.filter((h) => h.id !== created.id)]);
      this.afterMutation();
      return created;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Updates name/description/frequency; rejects with `ApiErrorInfo`. */
  async update(id: number, request: HabitRequest): Promise<Habit> {
    try {
      const updated = await firstValueFrom(this.api.updateHabit(id, request));
      this.replaceLocal(updated);
      this.afterMutation();
      return updated;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Toggle bound to `completedToday`: records today's completion, or removes it when already done. */
  toggleToday(habit: Habit): Promise<boolean> {
    if (habit.completedToday) {
      // lastCompletedDate is the server's "today" here (no future completions exist).
      return this.uncomplete(habit, habit.lastCompletedDate ?? todayIso());
    }
    return this.completeToday(habit);
  }

  /** Records a completion for today (server date). A 409 means it was already done: shown as info. */
  completeToday(habit: Habit): Promise<boolean> {
    return this.optimistic(
      habit.id,
      (h) => withCompletedToday(h),
      () => this.api.completeHabit(habit.id, {}),
      'Habit done for today',
      habit.name,
    );
  }

  /** Removes the completion of `date` (today, or the latest one this week for a Weekly habit). */
  uncomplete(habit: Habit, date: string): Promise<boolean> {
    return this.optimistic(
      habit.id,
      (h) => withoutCompletion(h, date),
      () => this.api.uncompleteHabit(habit.id, date),
      'Completion undone',
      habit.name,
    );
  }

  deactivate(habit: Habit): Promise<boolean> {
    return this.optimistic(
      habit.id,
      (h) => ({ ...h, active: false }),
      () => this.api.deactivateHabit(habit.id),
      'Habit deactivated',
      'History is kept; reactivate it at any time.',
    );
  }

  activate(habit: Habit): Promise<boolean> {
    return this.optimistic(
      habit.id,
      (h) => ({ ...h, active: true }),
      () => this.api.activateHabit(habit.id),
      'Habit reactivated',
      habit.name,
    );
  }

  /** Deletes a habit and its completions (optimistic). */
  remove(habit: Habit): Promise<boolean> {
    return this.optimistic(habit.id, null, () => this.api.deleteHabit(habit.id), 'Habit removed', habit.name);
  }

  private async optimistic(
    id: number,
    change: ((h: Habit) => Habit) | null,
    request: () => Observable<unknown>,
    successTitle: string,
    successMessage?: string,
  ): Promise<boolean> {
    if (this._pending().has(id)) {
      return false;
    }
    const snapshot = this._habits();
    this.setPending(id, true);
    this._habits.update((list) =>
      change ? list.map((h) => (h.id === id ? change(h) : h)) : list.filter((h) => h.id !== id),
    );
    try {
      const result = await firstValueFrom(request(), { defaultValue: undefined });
      if (change && result && typeof result === 'object' && 'id' in result) {
        this.replaceLocal(result as Habit);
      }
      this.notify.success(successTitle, successMessage);
      this.afterMutation();
      return true;
    } catch (err) {
      const info: ApiErrorInfo = toApiError(err);
      if (info.status === 409) {
        // Duplicate completion: it is already recorded, so keep it shown as done and resync.
        this.notify.toast('Already done', { kind: 'info', message: info.message });
        void this.load();
        return false;
      }
      this._habits.update((list) => rollback(list, snapshot, id));
      this.notify.error('Could not update the habit', info.message);
      if (info.status === 404) {
        void this.load();
      }
      return false;
    } finally {
      this.setPending(id, false);
    }
  }

  private replaceLocal(habit: Habit): void {
    this._habits.update((list) => list.map((h) => (h.id === habit.id ? habit : h)));
  }

  private afterMutation(): void {
    this.refresh.bump();
    void this.load();
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

/** Puts back the snapshot version of habit `id` (re-inserting it at its old index if removed). */
function rollback(current: Habit[], snapshot: Habit[], id: number): Habit[] {
  const original = snapshot.find((h) => h.id === id);
  if (!original) {
    return current;
  }
  if (current.some((h) => h.id === id)) {
    return current.map((h) => (h.id === id ? original : h));
  }
  const index = snapshot.indexOf(original);
  const next = [...current];
  next.splice(Math.min(index, next.length), 0, original);
  return next;
}
