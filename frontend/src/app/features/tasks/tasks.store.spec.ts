import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { SortDirection, Task, TaskPriority, TaskSort, TaskStatus, TasksService } from '../../api';
import { NotificationService } from '../../core/notification.service';
import { RefreshService } from '../../core/refresh.service';
import { DEFAULT_TASK_FILTERS, TasksStore, hasNarrowingFilters, toTaskRequest } from './tasks.store';

// T034 — traces US1 AS1 (create), AS3 (edit), AS4 (complete / reopen), AS5 (archive / restore),
// AS6 (delete), AS7 (search / filter / sort params), AS2 (server field errors passed to the form).

function task(id: number, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status: TaskStatus.Todo,
    priority: TaskPriority.Medium,
    dueDate: null,
    createdAt: '2026-06-15T10:00:00Z',
    updatedAt: '2026-06-15T10:00:00Z',
    completedAt: null,
    archived: false,
    overdue: false,
    ...patch,
  };
}

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('TasksStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let store: TasksStore;
  let refresh: RefreshService;
  let list: Task[];

  beforeEach(() => {
    list = [task(1), task(2, { dueDate: '2026-06-10', overdue: true })];
    api = {
      listTasks: vi.fn(() => of(list)),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      completeTask: vi.fn(),
      archiveTask: vi.fn(),
      restoreTask: vi.fn(),
      deleteTask: vi.fn(),
    };
    notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        TasksStore,
        { provide: TasksService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    store = TestBed.inject(TasksStore);
    refresh = TestBed.inject(RefreshService);
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
  }

  it('loads the list on start with default filters (non-archived, created desc)', async () => {
    await settle();
    expect(api['listTasks']).toHaveBeenCalledWith(
      undefined, undefined, undefined, undefined, undefined, undefined, false, TaskSort.CreatedAt, SortDirection.Desc,
    );
    expect(store.tasks().map((t) => t.id)).toEqual([1, 2]);
    expect(store.count()).toBe(2);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('maps filters to listTasks query params and reloads when they change', async () => {
    await settle();
    api['listTasks'].mockClear();
    store.setFilters({
      q: '  groc ',
      status: TaskStatus.InProgress,
      priority: TaskPriority.High,
      dueFrom: '2026-06-01',
      dueTo: '2026-06-30',
      overdue: true,
      archived: true,
      sort: TaskSort.DueDate,
      direction: SortDirection.Asc,
    });
    await settle();
    expect(api['listTasks']).toHaveBeenCalledTimes(1);
    expect(api['listTasks']).toHaveBeenCalledWith(
      'groc', 'IN_PROGRESS', 'HIGH', '2026-06-01', '2026-06-30', true, true, 'DUE_DATE', 'ASC',
    );
    expect(store.isFiltered()).toBe(true);
  });

  it('skips a filter update that changes nothing', async () => {
    await settle();
    api['listTasks'].mockClear();
    store.setFilters({ q: '', archived: false });
    await settle();
    expect(api['listTasks']).not.toHaveBeenCalled();
  });

  it('resetFilters clears narrowing filters but keeps archived view and sort', async () => {
    store.setFilters({ q: 'x', overdue: true, archived: true, sort: TaskSort.DueDate });
    store.resetFilters();
    expect(store.filters()).toEqual({ ...DEFAULT_TASK_FILTERS, archived: true, sort: TaskSort.DueDate });
    expect(store.isFiltered()).toBe(false);
  });

  it('sets an error message when loading fails', async () => {
    api['listTasks'].mockReturnValue(problem(500, { detail: 'boom' }));
    await settle();
    expect(store.error()).toBe('boom');
    expect(store.loaded()).toBe(true);
  });

  it('create calls createTask, bumps refresh and reloads', async () => {
    await settle();
    const created = task(3, { title: 'New' });
    api['createTask'].mockReturnValue(of(created));
    api['listTasks'].mockClear();
    const v = refresh.version();
    const result = await store.create({ title: 'New' });
    expect(result).toEqual(created);
    expect(api['createTask']).toHaveBeenCalledWith({ title: 'New' });
    expect(refresh.version()).toBe(v + 1);
    expect(api['listTasks']).toHaveBeenCalled();
  });

  it('create rejects with field errors from problem+json', async () => {
    api['createTask'].mockReturnValue(
      problem(400, { detail: 'Validation failed', errors: [{ field: 'title', message: 'Title is required' }] }),
    );
    await expect(store.create({ title: '' })).rejects.toEqual({
      status: 400,
      message: 'Validation failed',
      fieldErrors: { title: 'Title is required' },
    });
  });

  it('update replaces the task locally', async () => {
    await settle();
    const updated = task(1, { title: 'Edited', updatedAt: '2026-06-15T11:00:00Z' });
    api['updateTask'].mockReturnValue(of(updated));
    api['listTasks'].mockReturnValue(new Subject<Task[]>()); // keep reload pending
    await store.update(1, toTaskRequest(task(1), { title: 'Edited' }));
    expect(store.tasks()[0].title).toBe('Edited');
  });

  it('complete is optimistic: row shows Done while pending, then uses the server value', async () => {
    await settle();
    const pending = new Subject<Task>();
    api['completeTask'].mockReturnValue(pending);
    const p = store.complete(store.tasks()[1]);
    expect(store.tasks()[1].status).toBe(TaskStatus.Done);
    expect(store.tasks()[1].overdue).toBe(false);
    expect(store.pending().has(2)).toBe(true);
    pending.next(task(2, { status: TaskStatus.Done, completedAt: '2026-06-15T12:00:00Z' }));
    pending.complete();
    await expect(p).resolves.toBe(true);
    expect(store.pending().has(2)).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Task completed');
  });

  it('complete rolls back on error and shows an error toast', async () => {
    await settle();
    api['completeTask'].mockReturnValue(problem(500, { detail: 'boom' }));
    const ok = await store.complete(store.tasks()[0]);
    expect(ok).toBe(false);
    expect(store.tasks()[0].status).toBe(TaskStatus.Todo);
    expect(notify.error).toHaveBeenCalledWith('Could not update the task', 'boom');
  });

  it('ignores a second action on a task that is already pending', async () => {
    await settle();
    api['completeTask'].mockReturnValue(new Subject<Task>());
    void store.complete(store.tasks()[0]);
    await expect(store.archive(store.tasks()[0])).resolves.toBe(false);
    expect(api['archiveTask']).not.toHaveBeenCalled();
  });

  it('setStatus reopens a Done task via a full update and clears completedAt', async () => {
    list = [task(1, { status: TaskStatus.Done, completedAt: '2026-06-15T10:00:00Z' })];
    api['listTasks'].mockReturnValue(of(list));
    await settle();
    api['updateTask'].mockReturnValue(new Subject<Task>());
    void store.setStatus(store.tasks()[0], TaskStatus.Todo);
    expect(store.tasks()[0].status).toBe(TaskStatus.Todo);
    expect(store.tasks()[0].completedAt).toBeNull();
    expect(api['updateTask']).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'TODO', title: 'Task 1' }));
  });

  it('setStatus(Done) delegates to complete', async () => {
    await settle();
    api['completeTask'].mockReturnValue(of(task(1, { status: TaskStatus.Done })));
    await store.setStatus(store.tasks()[0], TaskStatus.Done);
    expect(api['completeTask']).toHaveBeenCalledWith(1);
  });

  it('archive, restore and remove take the task out of the list immediately', async () => {
    await settle();
    api['listTasks'].mockReturnValue(new Subject<Task[]>());
    api['archiveTask'].mockReturnValue(of(task(1, { archived: true })));
    await store.archive(store.tasks()[0]);
    expect(store.tasks().map((t) => t.id)).toEqual([2]);
    expect(notify.success).toHaveBeenCalledWith('Task archived');

    api['deleteTask'].mockReturnValue(of(undefined));
    await store.remove(store.tasks()[0]);
    expect(store.tasks()).toEqual([]);
    expect(notify.success).toHaveBeenCalledWith('Task deleted');
    expect(api['deleteTask']).toHaveBeenCalledWith(2);
  });

  it('restore calls restoreTask', async () => {
    await settle();
    api['restoreTask'].mockReturnValue(of(task(1)));
    await expect(store.restore(store.tasks()[0])).resolves.toBe(true);
    expect(api['restoreTask']).toHaveBeenCalledWith(1);
  });

  it('remove rolls back to the original position on error and reloads on 404', async () => {
    await settle();
    api['deleteTask'].mockReturnValue(problem(404, { detail: 'Task 1 not found' }));
    api['listTasks'].mockClear();
    const ok = await store.remove(store.tasks()[0]);
    expect(ok).toBe(false);
    expect(store.tasks().map((t) => t.id)).toEqual([1, 2]);
    expect(api['listTasks']).toHaveBeenCalled();
  });

  it('drops stale list responses', async () => {
    const first = new Subject<Task[]>();
    const second = new Subject<Task[]>();
    api['listTasks'].mockReturnValueOnce(first).mockReturnValueOnce(second);
    await settle();
    store.setFilters({ q: 'b' });
    await settle();
    second.next([task(9)]);
    second.complete();
    await settle();
    first.next([task(8)]);
    first.complete();
    await settle();
    expect(store.tasks().map((t) => t.id)).toEqual([9]);
  });
});

describe('task store helpers', () => {
  it('hasNarrowingFilters ignores sort and archived view', () => {
    expect(hasNarrowingFilters(DEFAULT_TASK_FILTERS)).toBe(false);
    expect(hasNarrowingFilters({ ...DEFAULT_TASK_FILTERS, archived: true, sort: TaskSort.DueDate })).toBe(false);
    expect(hasNarrowingFilters({ ...DEFAULT_TASK_FILTERS, q: '   ' })).toBe(false);
    expect(hasNarrowingFilters({ ...DEFAULT_TASK_FILTERS, dueTo: '2026-01-01' })).toBe(true);
  });

  it('toTaskRequest copies the editable fields with overrides', () => {
    expect(toTaskRequest(task(1, { description: 'd', dueDate: '2026-07-01' }), { status: TaskStatus.Done })).toEqual({
      title: 'Task 1',
      description: 'd',
      status: 'DONE',
      priority: 'MEDIUM',
      dueDate: '2026-07-01',
    });
  });
});
