import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import {
  LearningCard,
  LearningCardRequest,
  LearningService,
  LearningStatus,
  Milestone,
  MilestoneRequest,
} from '../../api';
import { ApiErrorInfo, toApiError } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { RefreshService } from '../../core/refresh.service';

/** Status derived from milestones (FR-016): none done → Not Started, some → In Progress, all → Completed. */
export function deriveStatus(milestones: readonly Milestone[], current: LearningStatus): LearningStatus {
  if (milestones.length === 0) {
    return current;
  }
  const done = milestones.filter((m) => m.done).length;
  if (done === 0) {
    return LearningStatus.NotStarted;
  }
  return done === milestones.length ? LearningStatus.Completed : LearningStatus.InProgress;
}

/** Recomputes the derived counters/progress/status of a card for a new milestone list (optimistic view). */
export function withMilestones(card: LearningCard, milestones: Milestone[]): LearningCard {
  const done = milestones.filter((m) => m.done).length;
  return {
    ...card,
    milestones,
    milestonesTotal: milestones.length,
    milestonesDone: done,
    progressPercent: milestones.length ? Math.round((done * 100) / milestones.length) : 0,
    status: deriveStatus(milestones, card.status),
  };
}

/**
 * Signal store for the Learning Resources page. All backend calls go through the generated
 * `LearningService`. Milestone toggle/remove, note remove and card remove are optimistic with
 * per-card rollback; every successful mutation bumps `RefreshService` (dashboard snapshot).
 * Milestone/note operations return the full card, which replaces the local copy.
 */
@Injectable()
export class LearningStore {
  private readonly api = inject(LearningService);
  private readonly refresh = inject(RefreshService);
  private readonly notify = inject(NotificationService);

  private readonly _cards = signal<LearningCard[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _pending = signal<ReadonlySet<number>>(new Set());

  readonly cards = this._cards.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  /** Ids of cards with a request in flight. */
  readonly pending = this._pending.asReadonly();
  readonly completedCount = computed(
    () => this._cards().filter((c) => c.status === LearningStatus.Completed).length,
  );
  readonly inProgressCount = computed(
    () => this._cards().filter((c) => c.status === LearningStatus.InProgress).length,
  );

  private requestSeq = 0;

  constructor() {
    void this.load();
  }

  /** Fetches all cards (newest first); stale responses are ignored. */
  async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this._loading.set(true);
    try {
      const list = await firstValueFrom(this.api.listLearningCards());
      if (seq !== this.requestSeq) {
        return;
      }
      this._cards.set(list);
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

  /** Creates a card; rejects with `ApiErrorInfo` (field errors for the form). */
  async create(request: LearningCardRequest): Promise<LearningCard> {
    try {
      const created = await firstValueFrom(this.api.createLearningCard(request));
      this._cards.update((list) => [created, ...list.filter((c) => c.id !== created.id)]);
      this.afterMutation(true);
      return created;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Updates title/description/status (manual status, FR-013); rejects with `ApiErrorInfo`. */
  async update(id: number, request: LearningCardRequest): Promise<LearningCard> {
    try {
      const updated = await firstValueFrom(this.api.updateLearningCard(id, request));
      this.replaceLocal(updated);
      this.afterMutation(false);
      return updated;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Deletes a card with its milestones and notes (optimistic). */
  remove(card: LearningCard): Promise<boolean> {
    return this.mutate(card.id, null, () => this.api.deleteLearningCard(card.id), 'Learning card removed', card.title);
  }

  /** Adds a milestone; rejects with `ApiErrorInfo` so the inline form can show field errors. */
  async addMilestone(card: LearningCard, request: MilestoneRequest): Promise<LearningCard> {
    return this.nonOptimistic(card.id, () => this.api.addMilestone(card.id, request));
  }

  /** Marks a milestone done/undone (optimistic; status and progress recomputed locally). */
  toggleMilestone(card: LearningCard, milestone: Milestone): Promise<boolean> {
    const done = !milestone.done;
    return this.mutate(
      card.id,
      (c) =>
        withMilestones(
          c,
          c.milestones.map((m) =>
            m.id === milestone.id ? { ...m, done, completedAt: done ? new Date().toISOString() : null } : m,
          ),
        ),
      () =>
        this.api.updateMilestone(card.id, milestone.id, {
          title: milestone.title,
          targetDate: milestone.targetDate ?? null,
          done,
        }),
      null,
    );
  }

  /** Removes a milestone (optimistic). */
  removeMilestone(card: LearningCard, milestone: Milestone): Promise<boolean> {
    return this.mutate(
      card.id,
      (c) => withMilestones(c, c.milestones.filter((m) => m.id !== milestone.id)),
      () => this.api.deleteMilestone(card.id, milestone.id),
      'Milestone removed',
      milestone.title,
    );
  }

  /** Adds a note; rejects with `ApiErrorInfo`. */
  async addNote(card: LearningCard, text: string): Promise<LearningCard> {
    return this.nonOptimistic(card.id, () => this.api.addNote(card.id, { text }));
  }

  /** Removes a note (optimistic). */
  removeNote(card: LearningCard, noteId: number): Promise<boolean> {
    return this.mutate(
      card.id,
      (c) => ({ ...c, notes: c.notes.filter((n) => n.id !== noteId) }),
      () => this.api.deleteNote(card.id, noteId),
      'Note removed',
    );
  }

  private async nonOptimistic(id: number, request: () => Observable<LearningCard>): Promise<LearningCard> {
    this.setPending(id, true);
    try {
      const updated = await firstValueFrom(request());
      this.replaceLocal(updated);
      this.afterMutation(false);
      return updated;
    } catch (err) {
      const info = toApiError(err);
      if (info.status === 404) {
        this.notify.error('Learning card not found', info.message);
        void this.load();
      }
      throw info;
    } finally {
      this.setPending(id, false);
    }
  }

  private async mutate(
    id: number,
    change: ((c: LearningCard) => LearningCard) | null,
    request: () => Observable<unknown>,
    successTitle: string | null,
    successMessage?: string,
  ): Promise<boolean> {
    if (this._pending().has(id)) {
      return false;
    }
    const snapshot = this._cards();
    this.setPending(id, true);
    this._cards.update((list) =>
      change ? list.map((c) => (c.id === id ? change(c) : c)) : list.filter((c) => c.id !== id),
    );
    try {
      const result = await firstValueFrom(request(), { defaultValue: undefined });
      if (change && result && typeof result === 'object' && 'id' in result) {
        this.replaceLocal(result as LearningCard);
      }
      if (successTitle) {
        this.notify.success(successTitle, successMessage);
      }
      this.afterMutation(!change);
      return true;
    } catch (err) {
      const info: ApiErrorInfo = toApiError(err);
      this._cards.update((list) => rollback(list, snapshot, id));
      this.notify.error('Could not update the learning card', info.message);
      if (info.status === 404) {
        void this.load();
      }
      return false;
    } finally {
      this.setPending(id, false);
    }
  }

  private replaceLocal(card: LearningCard): void {
    this._cards.update((list) => list.map((c) => (c.id === card.id ? card : c)));
  }

  /** Notifies other pages; re-fetches the list after create/remove (sub-resource calls return the card). */
  private afterMutation(reload: boolean): void {
    this.refresh.bump();
    if (reload) {
      void this.load();
    }
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

/** Puts back the snapshot version of card `id` (re-inserting it at its old index if removed). */
function rollback(current: LearningCard[], snapshot: LearningCard[], id: number): LearningCard[] {
  const original = snapshot.find((c) => c.id === id);
  if (!original) {
    return current;
  }
  if (current.some((c) => c.id === id)) {
    return current.map((c) => (c.id === id ? original : c));
  }
  const index = snapshot.indexOf(original);
  const next = [...current];
  next.splice(Math.min(index, next.length), 0, original);
  return next;
}
