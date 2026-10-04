import {
  AnimationCallbackEvent,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { Task, TaskStatus } from '../../api';
import { injectReducedMotion } from '../../core/reduced-motion';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { TaskFormDialogComponent } from './task-form-dialog.component';
import { TaskItemComponent } from './task-item.component';
import { TaskToolbarComponent } from './task-toolbar.component';
import { TaskFilters, TasksStore } from './tasks.store';

interface FormState {
  task: Task | null;
}

/** Tasks page (US1): list with search/filter/sort, CRUD, complete, archive/restore, overdue. */
@Component({
  selector: 'app-tasks-page',
  imports: [
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    TaskFormDialogComponent,
    TaskItemComponent,
    TaskToolbarComponent,
  ],
  providers: [TasksStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header heading="Tasks" subtitle="Create, complete and organise your tasks">
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <app-icon name="plus" [size]="18" /> Add Task
      </button>
    </app-page-header>

    <app-task-toolbar [filters]="store.filters()" (filtersChange)="onFilters($event)" (clear)="store.resetFilters()" />

    <div class="list-head">
      <h2 class="list-head__title">{{ store.filters().archived ? 'Archived tasks' : 'Tasks' }}</h2>
      <p class="list-head__count" aria-live="polite" aria-atomic="true">
        @if (store.loaded() && !store.error()) {
          {{ countText() }}
        }
      </p>
      @if (store.loading() && store.loaded()) {
        <span class="list-head__loading" role="status" aria-label="Updating list"></span>
      }
    </div>

    @if (!store.loaded()) {
      <div class="skeletons" aria-busy="true" aria-label="Loading tasks">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton skeleton-row"></div>
        }
      </div>
    } @else if (store.error() && store.tasks().length === 0) {
      <app-empty-state icon="error" heading="Could not load tasks" [message]="store.error()!" actionLabel="" >
        <button type="button" class="btn" (click)="store.load()"><app-icon name="restore" [size]="16" /> Retry</button>
      </app-empty-state>
    } @else if (store.tasks().length === 0) {
      @if (store.isFiltered()) {
        <app-empty-state icon="search" heading="No matching tasks" message="No tasks match your search or filters. Try changing or clearing them.">
          <button type="button" class="btn" (click)="store.resetFilters()"><app-icon name="x" [size]="16" /> Clear filters</button>
        </app-empty-state>
      } @else if (store.filters().archived) {
        <app-empty-state icon="archive" heading="No archived tasks" message="Tasks you archive appear here and can be restored at any time." >
          <button type="button" class="btn" (click)="onFilters({ archived: false })">Back to tasks</button>
        </app-empty-state>
      } @else {
        <app-empty-state
          icon="tasks"
          heading="No tasks yet"
          message="Add your first task to start organising your work."
          actionLabel="Add Task"
          (action)="openCreate()"
        />
      }
    } @else {
      <div #list class="list" role="list" aria-label="Tasks">
        @for (task of store.tasks(); track task.id) {
          <app-task-item
            (animate.enter)="onRowEnter($event)"
            (animate.leave)="onRowLeave($event)"
            [task]="task"
            [busy]="store.pending().has(task.id)"
            (toggleDone)="toggleDone($event)"
            (edit)="openEdit($event)"
            (archive)="store.archive($event)"
            (restore)="store.restore($event)"
            (remove)="confirmDelete($event)"
          />
        }
      </div>
    }

    @if (form(); as f) {
      <app-task-form-dialog [task]="f.task" (closed)="form.set(null)" />
    }
  `,
  styles: `
    :host { display: block; }
    .list-head {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }
    .list-head__title { font-size: var(--text-lg); }
    .list-head__count { color: var(--text-muted); font-size: var(--text-sm); }
    .list-head__loading {
      width: 14px;
      height: 14px;
      align-self: center;
      border: 2px solid var(--primary);
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin var(--duration-slow) linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .list { display: flex; flex-direction: column; gap: var(--space-3); }
    .skeletons { display: flex; flex-direction: column; gap: var(--space-3); }
    .skeleton-row { height: 84px; border-radius: var(--radius-lg); }

    .list ::ng-deep .task-enter { animation: qf-slide-up var(--duration-base) var(--ease-out) both; }
    .list ::ng-deep .task-leave { animation: task-collapse var(--duration-base) var(--ease-in) both; }
    @keyframes task-collapse {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(24px); }
    }
  `,
})
export class TasksPageComponent {
  protected readonly store = inject(TasksStore);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly reducedMotion = injectReducedMotion();

  /** `?new=1` (e.g. dashboard quick-add) opens the create form. */
  readonly newParam = input<string | undefined>(undefined, { alias: 'new' });

  protected readonly form = signal<FormState | null>(null);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly countText = computed(() => {
    const n = this.store.count();
    const noun = n === 1 ? 'task' : 'tasks';
    return this.store.filters().archived ? `${n} archived ${noun}` : `${n} ${noun}`;
  });

  /**
   * Whether the last list change is small enough to animate (e.g. one task added, archived or
   * moved). Bulk changes — search/filter results, first load — render without row animations so
   * that 1,000-row updates stay well under 500 ms (SC-009) and never block input (FR-032).
   */
  private readonly animateRows = linkedSignal<readonly Task[], boolean>({
    source: this.store.tasks,
    computation: (next, prev) => {
      if (this.reducedMotion()) {
        return false;
      }
      const before = new Set((prev?.source ?? []).map((t) => t.id));
      let changes = 0;
      for (const t of next) {
        if (!before.delete(t.id) && ++changes > MAX_ANIMATED_CHANGES) {
          return false;
        }
      }
      return changes + before.size <= MAX_ANIMATED_CHANGES;
    },
  });

  /** Last known offsetTop per task id, for FLIP reorder animation. */
  private positions = new Map<string, number>();

  constructor() {
    effect(() => {
      if (this.newParam()) {
        untracked(() => {
          this.openCreate();
          void this.router.navigate([], { queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
        });
      }
    });

    // Animate rows that moved because of re-sorting/filtering (FLIP).
    // Reads all positions first, then starts animations (no layout thrashing), and only for rows
    // near the viewport.
    afterRenderEffect(() => {
      this.store.tasks();
      const animate = this.animateRows() && typeof Element.prototype.animate === 'function';
      const container = this.list()?.nativeElement;
      if (!container) {
        this.positions.clear();
        return;
      }
      const rows = container.querySelectorAll<HTMLElement>(':scope > [data-id]:not(.task-leave)');
      const next = new Map<string, number>();
      const moved: [HTMLElement, number][] = [];
      // Rows share the container's offsetParent, so offsetTop + base = viewport y.
      const base = animate ? container.getBoundingClientRect().top - container.offsetTop : 0;
      const margin = window.innerHeight;
      rows.forEach((el) => {
        const top = el.offsetTop;
        const id = el.dataset['id']!;
        next.set(id, top);
        const prev = this.positions.get(id);
        if (animate && prev !== undefined && prev !== top) {
          const y = base + Math.min(prev, top);
          if (y < margin * 2 && base + Math.max(prev, top) > -margin) {
            moved.push([el, prev - top]);
          }
        }
      });
      for (const [el, delta] of moved) {
        el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
          duration: 220,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
        });
      }
      this.positions = next;
    });
  }

  /** Row enter: slide in for small changes; bulk results appear without animation. */
  protected onRowEnter(event: AnimationCallbackEvent): void {
    if (this.animateRows()) {
      const el = event.target as HTMLElement;
      el.classList.add('task-enter');
      el.addEventListener('animationend', () => el.classList.remove('task-enter'), { once: true });
    }
    event.animationComplete();
  }

  /** Row leave: collapse for small changes; bulk removals are immediate. */
  protected onRowLeave(event: AnimationCallbackEvent): void {
    if (this.animateRows()) {
      // Angular removes the row on `animationend` (or after its max timeout).
      (event.target as HTMLElement).classList.add('task-leave');
    } else {
      event.animationComplete();
    }
  }

  protected openCreate(): void {
    this.form.set({ task: null });
  }

  protected openEdit(task: Task): void {
    this.form.set({ task });
  }

  protected onFilters(patch: Partial<TaskFilters>): void {
    this.store.setFilters(patch);
  }

  protected toggleDone(task: Task): void {
    void this.store.setStatus(task, task.status === TaskStatus.Done ? TaskStatus.Todo : TaskStatus.Done);
  }

  protected async confirmDelete(task: Task): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete task?',
      message: `"${truncate(task.title, 80)}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      await this.store.remove(task);
    }
  }
}

/** Above this many added + removed rows a list update is rendered without row animations. */
const MAX_ANIMATED_CHANGES = 20;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
