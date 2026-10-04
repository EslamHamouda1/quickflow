import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { LearningCard, LearningService, LearningStatus, Milestone } from '../../api';
import { NotificationService } from '../../core/notification.service';
import { RefreshService } from '../../core/refresh.service';
import { LearningStore, deriveStatus, withMilestones } from './learning.store';

// T064 — traces US3 AS1 (create, Not Started), AS3 (add / toggle / remove milestone updates progress),
// AS4 (add / remove note), AS5 (derived status, manual status via update), AS6 (remove card),
// plus optimistic rollback, 404 reload and RefreshService bump.

function ms(id: number, done = false, patch: Partial<Milestone> = {}): Milestone {
  return { id, title: `M${id}`, done, targetDate: null, completedAt: done ? '2026-06-17T10:00:00Z' : null, ...patch };
}

function card(id: number, patch: Partial<LearningCard> = {}): LearningCard {
  const milestones = patch.milestones ?? [];
  const done = milestones.filter((m) => m.done).length;
  return {
    id,
    title: `Card ${id}`,
    description: null,
    status: LearningStatus.NotStarted,
    createdAt: '2026-06-17T10:00:00Z',
    milestones,
    notes: [],
    milestonesTotal: milestones.length,
    milestonesDone: done,
    progressPercent: milestones.length ? Math.round((done * 100) / milestones.length) : 0,
    ...patch,
  };
}

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('deriveStatus / withMilestones', () => {
  it('derives none → Not Started, some → In Progress, all → Completed', () => {
    expect(deriveStatus([ms(1), ms(2)], LearningStatus.Completed)).toBe(LearningStatus.NotStarted);
    expect(deriveStatus([ms(1, true), ms(2)], LearningStatus.NotStarted)).toBe(LearningStatus.InProgress);
    expect(deriveStatus([ms(1, true), ms(2, true)], LearningStatus.NotStarted)).toBe(LearningStatus.Completed);
  });

  it('keeps the current status with no milestones', () => {
    expect(deriveStatus([], LearningStatus.InProgress)).toBe(LearningStatus.InProgress);
    expect(deriveStatus([], LearningStatus.Completed)).toBe(LearningStatus.Completed);
  });

  it('recomputes counters, rounded progress and status', () => {
    const c = withMilestones(card(1), [ms(1, true), ms(2), ms(3)]);
    expect(c).toMatchObject({ milestonesTotal: 3, milestonesDone: 1, progressPercent: 33, status: LearningStatus.InProgress });
    expect(withMilestones(card(1), [ms(1, true), ms(2, true), ms(3)]).progressPercent).toBe(67);
    expect(withMilestones(card(1, { status: LearningStatus.Completed }), [])).toMatchObject({
      milestonesTotal: 0, milestonesDone: 0, progressPercent: 0, status: LearningStatus.Completed,
    });
  });
});

describe('LearningStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; toast: ReturnType<typeof vi.fn> };
  let store: LearningStore;
  let refresh: RefreshService;
  let list: LearningCard[];

  beforeEach(() => {
    list = [
      card(3, { status: LearningStatus.InProgress, milestones: [ms(30, true), ms(31)] }),
      card(2, { status: LearningStatus.Completed, milestones: [ms(20, true)] }),
      card(1, { notes: [{ id: 10, text: 'n', createdAt: '2026-06-17T10:00:00Z' }] }),
    ];
    api = {
      listLearningCards: vi.fn(() => of(list)),
      createLearningCard: vi.fn(),
      updateLearningCard: vi.fn(),
      deleteLearningCard: vi.fn(),
      addMilestone: vi.fn(),
      updateMilestone: vi.fn(),
      deleteMilestone: vi.fn(),
      addNote: vi.fn(),
      deleteNote: vi.fn(),
    };
    notify = { success: vi.fn(), error: vi.fn(), toast: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        LearningStore,
        { provide: LearningService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    store = TestBed.inject(LearningStore);
    refresh = TestBed.inject(RefreshService);
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
  }

  it('loads cards on start with in-progress / completed counts', async () => {
    await settle();
    expect(api['listLearningCards']).toHaveBeenCalled();
    expect(store.cards().map((c) => c.id)).toEqual([3, 2, 1]);
    expect(store.inProgressCount()).toBe(1);
    expect(store.completedCount()).toBe(1);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('ignores stale list responses and shows a load error', async () => {
    await settle();
    const slow = new Subject<LearningCard[]>();
    api['listLearningCards'].mockReturnValueOnce(slow).mockReturnValueOnce(of([card(9)]));
    const first = store.load();
    const second = store.load();
    await second;
    slow.next([card(8)]);
    slow.complete();
    await first;
    expect(store.cards().map((c) => c.id)).toEqual([9]);

    api['listLearningCards'].mockReturnValueOnce(problem(500, { detail: 'down' }));
    await store.load();
    expect(store.error()).toBe('down');
  });

  it('creates a card, prepends it, reloads and bumps refresh', async () => {
    await settle();
    const before = refresh.version();
    const created = card(4, { title: 'Signals' });
    api['createLearningCard'].mockReturnValue(of(created));
    api['listLearningCards'].mockReturnValue(of([created, ...list]));
    const result = await store.create({ title: 'Signals', description: null });
    expect(result).toEqual(created);
    expect(api['createLearningCard']).toHaveBeenCalledWith({ title: 'Signals', description: null });
    expect(store.cards()[0].id).toBe(4);
    expect(refresh.version()).toBe(before + 1);
    expect(api['listLearningCards']).toHaveBeenCalledTimes(2);
  });

  it('create rejects with field errors from problem+json', async () => {
    await settle();
    api['createLearningCard'].mockReturnValue(
      problem(400, { detail: 'Validation failed', errors: [{ field: 'title', message: 'Title is required' }] }),
    );
    await expect(store.create({ title: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { title: 'Title is required' },
    });
  });

  it('update replaces the card locally (manual status) and bumps refresh', async () => {
    await settle();
    const before = refresh.version();
    const updated = card(3, { status: LearningStatus.NotStarted, milestones: list[0].milestones });
    api['updateLearningCard'].mockReturnValue(of(updated));
    await store.update(3, { title: 'Card 3', status: LearningStatus.NotStarted });
    expect(api['updateLearningCard']).toHaveBeenCalledWith(3, { title: 'Card 3', status: LearningStatus.NotStarted });
    expect(store.cards().find((c) => c.id === 3)?.status).toBe(LearningStatus.NotStarted);
    expect(refresh.version()).toBe(before + 1);
  });

  it('update rejects with ApiErrorInfo', async () => {
    await settle();
    api['updateLearningCard'].mockReturnValue(problem(404, { detail: 'Learning card 3 not found' }));
    await expect(store.update(3, { title: 'x' })).rejects.toMatchObject({ status: 404, message: 'Learning card 3 not found' });
  });

  it('toggles a milestone optimistically and then takes the server card', async () => {
    await settle();
    const server = new Subject<LearningCard>();
    api['updateMilestone'].mockReturnValue(server);
    const c3 = store.cards()[0];
    const p = store.toggleMilestone(c3, c3.milestones[1]);
    const optimistic = store.cards()[0];
    expect(optimistic).toMatchObject({ status: LearningStatus.Completed, progressPercent: 100, milestonesDone: 2 });
    expect(optimistic.milestones[1].done).toBe(true);
    expect(optimistic.milestones[1].completedAt).not.toBeNull();
    expect(store.pending().has(3)).toBe(true);
    expect(api['updateMilestone']).toHaveBeenCalledWith(3, 31, { title: 'M31', targetDate: null, done: true });

    // a second mutation on the same card while pending is ignored
    expect(await store.toggleMilestone(c3, c3.milestones[0])).toBe(false);

    const fromServer = card(3, { status: LearningStatus.Completed, milestones: [ms(30, true), ms(31, true)], title: 'srv' });
    server.next(fromServer);
    server.complete();
    expect(await p).toBe(true);
    expect(store.cards()[0].title).toBe('srv');
    expect(store.pending().has(3)).toBe(false);
  });

  it('untoggle clears completedAt and recomputes status', async () => {
    await settle();
    api['updateMilestone'].mockReturnValue(new Subject());
    const c3 = store.cards()[0];
    void store.toggleMilestone(c3, c3.milestones[0]);
    const c = store.cards()[0];
    expect(c.milestones[0]).toMatchObject({ done: false, completedAt: null });
    expect(c).toMatchObject({ status: LearningStatus.NotStarted, progressPercent: 0 });
    expect(api['updateMilestone']).toHaveBeenCalledWith(3, 30, { title: 'M30', targetDate: null, done: false });
  });

  it('rolls back a failed toggle and shows an error toast', async () => {
    await settle();
    api['updateMilestone'].mockReturnValue(problem(500, { detail: 'boom' }));
    const c3 = store.cards()[0];
    expect(await store.toggleMilestone(c3, c3.milestones[1])).toBe(false);
    expect(store.cards()[0]).toEqual(list[0]);
    expect(notify.error).toHaveBeenCalledWith('Could not update the learning card', 'boom');
  });

  it('removes a milestone optimistically with a success toast', async () => {
    await settle();
    const before = refresh.version();
    const fromServer = card(3, { status: LearningStatus.Completed, milestones: [ms(30, true)] });
    api['deleteMilestone'].mockReturnValue(of(fromServer));
    const c3 = store.cards()[0];
    expect(await store.removeMilestone(c3, c3.milestones[1])).toBe(true);
    expect(api['deleteMilestone']).toHaveBeenCalledWith(3, 31);
    expect(store.cards()[0]).toMatchObject({ milestonesTotal: 1, progressPercent: 100, status: LearningStatus.Completed });
    expect(notify.success).toHaveBeenCalledWith('Milestone removed', 'M31');
    expect(refresh.version()).toBe(before + 1);
  });

  it('a 404 on milestone removal rolls back and reloads', async () => {
    await settle();
    api['deleteMilestone'].mockReturnValue(problem(404, { detail: 'Milestone 31 not found' }));
    const c3 = store.cards()[0];
    expect(await store.removeMilestone(c3, c3.milestones[1])).toBe(false);
    expect(store.cards()[0].milestones).toHaveLength(2);
    expect(api['listLearningCards']).toHaveBeenCalledTimes(2);
  });

  it('adds a milestone (waits for the server) and replaces the card', async () => {
    await settle();
    const fromServer = card(1, { milestones: [ms(40)] });
    api['addMilestone'].mockReturnValue(of(fromServer));
    const result = await store.addMilestone(store.cards()[2], { title: 'New', targetDate: '2026-07-01' });
    expect(result).toEqual(fromServer);
    expect(api['addMilestone']).toHaveBeenCalledWith(1, { title: 'New', targetDate: '2026-07-01' });
    expect(store.cards()[2].milestonesTotal).toBe(1);
    expect(store.pending().has(1)).toBe(false);
  });

  it('addMilestone 404 notifies, reloads and rejects', async () => {
    await settle();
    api['addMilestone'].mockReturnValue(problem(404, { detail: 'Learning card 1 not found' }));
    await expect(store.addMilestone(store.cards()[2], { title: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(notify.error).toHaveBeenCalledWith('Learning card not found', 'Learning card 1 not found');
    expect(api['listLearningCards']).toHaveBeenCalledTimes(2);
  });

  it('addMilestone 400 rejects with field errors without reloading', async () => {
    await settle();
    api['addMilestone'].mockReturnValue(problem(400, { errors: [{ field: 'title', message: 'Title is required' }] }));
    await expect(store.addMilestone(store.cards()[2], { title: ' ' })).rejects.toMatchObject({
      fieldErrors: { title: 'Title is required' },
    });
    expect(api['listLearningCards']).toHaveBeenCalledTimes(1);
  });

  it('adds and removes a note', async () => {
    await settle();
    const withNote = card(2, { notes: [{ id: 11, text: 'hello', createdAt: '2026-06-17T11:00:00Z' }] });
    api['addNote'].mockReturnValue(of(withNote));
    await store.addNote(store.cards()[1], 'hello');
    expect(api['addNote']).toHaveBeenCalledWith(2, { text: 'hello' });
    expect(store.cards()[1].notes.map((n) => n.text)).toEqual(['hello']);

    api['deleteNote'].mockReturnValue(of(card(2)));
    expect(await store.removeNote(store.cards()[1], 11)).toBe(true);
    expect(api['deleteNote']).toHaveBeenCalledWith(2, 11);
    expect(store.cards()[1].notes).toEqual([]);
    expect(notify.success).toHaveBeenCalledWith('Note removed', undefined);
  });

  it('rolls back a failed note removal', async () => {
    await settle();
    api['deleteNote'].mockReturnValue(problem(500, { detail: 'nope' }));
    expect(await store.removeNote(store.cards()[2], 10)).toBe(false);
    expect(store.cards()[2].notes.map((n) => n.id)).toEqual([10]);
  });

  it('removes a card optimistically, reloads and bumps refresh', async () => {
    await settle();
    const before = refresh.version();
    api['deleteLearningCard'].mockReturnValue(of(undefined));
    api['listLearningCards'].mockReturnValue(of([list[0], list[2]]));
    expect(await store.remove(list[1])).toBe(true);
    expect(api['deleteLearningCard']).toHaveBeenCalledWith(2);
    expect(store.cards().map((c) => c.id)).toEqual([3, 1]);
    expect(notify.success).toHaveBeenCalledWith('Learning card removed', 'Card 2');
    expect(refresh.version()).toBe(before + 1);
  });

  it('restores a removed card at its old index when delete fails', async () => {
    await settle();
    api['deleteLearningCard'].mockReturnValue(problem(500, { detail: 'fail' }));
    expect(await store.remove(list[1])).toBe(false);
    expect(store.cards().map((c) => c.id)).toEqual([3, 2, 1]);
  });
});
