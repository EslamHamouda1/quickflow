import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import {
  SortDirection,
  Task,
  TaskPriority,
  TaskRequest,
  TaskSort,
  TaskStatus,
  TasksService,
} from '../../api';
import { ApiErrorInfo, toApiError } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { RefreshService } from '../../core/refresh.service';

/** Filter / sort state of the task list (maps 1:1 onto `listTasks` query params). */
export interface TaskFilters {
  q: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  dueFrom: string;
  dueTo: string;
  overdue: boolean;
  /** true = show only archived tasks (backend semantics of `archived=true`). */
  archived: boolean;
  sort: TaskSort;
  direction: SortDirection;
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  q: '',
  status: '',
  priority: '',
  dueFrom: '',
  dueTo: '',
  overdue: false,
  archived: false,
  sort: TaskSort.CreatedAt,
  direction: SortDirection.Desc,
};

/** True when any filter that narrows the list (not sort, not the archived view) is set. */
export function hasNarrowingFilters(f: TaskFilters): boolean {
  return !!(f.q.trim() || f.status || f.priority || f.dueFrom || f.dueTo || f.overdue);
}

/** Builds a full update request from a task with optional overrides. */
export function toTaskRequest(task: Task, patch: Partial<TaskRequest> = {}): TaskRequest {
  return {
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    ...patch,
  };
}

/**
 * Signal store for the Tasks page. All backend calls go through the generated `TasksService`.
 * Mutations are applied optimistically where the outcome is predictable and rolled back on error;
 * after every successful mutation the list is re-fetched (filters/sort are server-side) and the
 * global `RefreshService` is bumped so other views reload.
 */
@Injectable()
export class TasksStore {
  private readonly api = inject(TasksService);
  private readonly refresh = inject(RefreshService);
  private readonly notify = inject(NotificationService);

  private readonly _tasks = signal<Task[]>([]);
  private readonly _filters = signal<TaskFilters>({ ...DEFAULT_TASK_FILTERS });
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  /** Ids of tasks with a mutation in flight (disables their actions). */
  private readonly _pending = signal<ReadonlySet<number>>(new Set());

  readonly tasks = this._tasks.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** True once the first load finished (success or error). */
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pending = this._pending.asReadonly();
  readonly isFiltered = computed(() => hasNarrowingFilters(this._filters()));
  readonly count = computed(() => this._tasks().length);

  private requestSeq = 0;

  constructor() {
    // Reload whenever the filters change (initial load included).
    effect(() => {
      const filters = this._filters();
      untracked(() => void this.load(filters));
    });
  }

  setFilters(patch: Partial<TaskFilters>): void {
    const current = this._filters();
    const changed = (Object.keys(patch) as (keyof TaskFilters)[]).some((k) => patch[k] !== current[k]);
    if (changed) {
      this._filters.set({ ...current, ...patch });
    }
  }

  resetFilters(): void {
    const { archived, sort, direction } = this._filters();
    this._filters.set({ ...DEFAULT_TASK_FILTERS, archived, sort, direction });
  }

  /** Fetches the list for the current (or given) filters; stale responses are ignored. */
  async load(filters: TaskFilters = this._filters()): Promise<void> {
    const seq = ++this.requestSeq;
    this._loading.set(true);
    try {
      const list = await firstValueFrom(
        this.api.listTasks(
          filters.q.trim() || undefined,
          filters.status || undefined,
          filters.priority || undefined,
          filters.dueFrom || undefined,
          filters.dueTo || undefined,
          filters.overdue || undefined,
          filters.archived,
          filters.sort,
          filters.direction,
        ),
      );
      if (seq !== this.requestSeq) {
        return;
      }
      this._tasks.set(list);
      this._error.set(null);
    } catch (err) {
      if (seq !== this.requestSeq) {
        return;
      }
      this._error.set(toApiError(err).message);
    } finally {
      if (seq === this.requestSeq) {
        this._loading.set(false);
        this._loaded.set(true);
      }
    }
  }

  /** Creates a task; rejects with `ApiErrorInfo` (field errors for the form). */
  async create(request: TaskRequest): Promise<Task> {
    try {
      const created = await firstValueFrom(this.api.createTask(request));
      this.afterMutation();
      return created;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Full update from the edit form; rejects with `ApiErrorInfo`. */
  async update(id: number, request: TaskRequest): Promise<Task> {
    try {
      const updated = await firstValueFrom(this.api.updateTask(id, request));
      this.replaceLocal(updated);
      this.afterMutation();
      return updated;
    } catch (err) {
      throw toApiError(err);
    }
  }

  /** Marks a task Done (optimistic). */
  complete(task: Task): Promise<boolean> {
    return this.optimistic(
      task.id,
      (t) => ({ ...t, status: TaskStatus.Done, overdue: false, completedAt: t.completedAt ?? new Date().toISOString() }),
      () => this.api.completeTask(task.id),
      'Task completed',
    );
  }

  /** Moves a task to another status (e.g. reopen a Done task) via a full update (optimistic). */
  setStatus(task: Task, status: TaskStatus): Promise<boolean> {
    if (status === TaskStatus.Done) {
      return this.complete(task);
    }
    return this.optimistic(
      task.id,
      (t) => ({ ...t, status, completedAt: null }),
      () => this.api.updateTask(task.id, toTaskRequest(task, { status })),
      status === TaskStatus.Todo ? 'Task moved to Todo' : 'Task moved to In Progress',
    );
  }

  /** Archives a task: it leaves the default list immediately (optimistic). */
  archive(task: Task): Promise<boolean> {
    return this.optimistic(task.id, null, () => this.api.archiveTask(task.id), 'Task archived');
  }

  /** Restores an archived task: it leaves the archived list immediately (optimistic). */
  restore(task: Task): Promise<boolean> {
    return this.optimistic(task.id, null, () => this.api.restoreTask(task.id), 'Task restored');
  }

  /** Deletes a task permanently (optimistic). */
  remove(task: Task): Promise<boolean> {
    return this.optimistic(task.id, null, () => this.api.deleteTask(task.id), 'Task deleted');
  }

  /**
   * Applies `change` locally (null = remove the item), runs the request, and on error restores the
   * previous list and shows an error toast. Resolves true on success.
   */
  private async optimistic(
    id: number,
    change: ((t: Task) => Task) | null,
    request: () => Observable<unknown>,
    successMessage: string,
  ): Promise<boolean> {
    if (this._pending().has(id)) {
      return false;
    }
    const snapshot = this._tasks();
    this.setPending(id, true);
    this._tasks.update((list) =>
      change ? list.map((t) => (t.id === id ? change(t) : t)) : list.filter((t) => t.id !== id),
    );
    try {
      const result = await firstValueFrom(request(), { defaultValue: undefined });
      if (change && result && typeof result === 'object' && 'id' in result) {
        this.replaceLocal(result as Task);
      }
      this.notify.success(successMessage);
      this.afterMutation();
      return true;
    } catch (err) {
      // Roll back only this task's change, keeping other concurrent updates.
      this._tasks.update((list) => rollback(list, snapshot, id));
      const info: ApiErrorInfo = toApiError(err);
      this.notify.error('Could not update the task', info.message);
      if (info.status === 404) {
        void this.load();
      }
      return false;
    } finally {
      this.setPending(id, false);
    }
  }

  private replaceLocal(task: Task): void {
    this._tasks.update((list) => list.map((t) => (t.id === task.id ? task : t)));
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

/** Puts back the snapshot version of task `id` (re-inserting it at its old index if removed). */
function rollback(current: Task[], snapshot: Task[], id: number): Task[] {
  const original = snapshot.find((t) => t.id === id);
  if (!original) {
    return current;
  }
  if (current.some((t) => t.id === id)) {
    return current.map((t) => (t.id === id ? original : t));
  }
  const index = snapshot.indexOf(original);
  const next = [...current];
  next.splice(Math.min(index, next.length), 0, original);
  return next;
}
