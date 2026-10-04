import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { IconComponent } from '../../shared/ui/icon.component';
import { DIRECTION_OPTIONS, PRIORITY_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS } from './task-labels';
import { TaskFilters, hasNarrowingFilters } from './tasks.store';

export const SEARCH_DEBOUNCE_MS = 200;

/** Search (debounced 200 ms), filters, archived view and sort controls for the task list. */
@Component({
  selector: 'app-task-toolbar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" role="search" aria-label="Search and filter tasks">
      <div class="toolbar__search">
        <label class="sr-only" for="task-search">Search tasks by title</label>
        <app-icon name="search" [size]="18" class="toolbar__search-icon" />
        <input
          id="task-search"
          class="input"
          type="search"
          placeholder="Search tasks…"
          autocomplete="off"
          [value]="searchText()"
          (input)="onSearch($event)"
          (keydown.escape)="clearSearch()"
        />
      </div>

      <div class="toolbar__group">
        <div class="ctl">
          <label for="filter-status">Status</label>
          <select id="filter-status" class="select" (change)="emit({ status: $any(value($event)) })">
            <option value="" [selected]="!filters().status">All</option>
            @for (o of statusOptions; track o.value) {
              <option [value]="o.value" [selected]="o.value === filters().status">{{ o.label }}</option>
            }
          </select>
        </div>
        <div class="ctl">
          <label for="filter-priority">Priority</label>
          <select id="filter-priority" class="select" (change)="emit({ priority: $any(value($event)) })">
            <option value="" [selected]="!filters().priority">All</option>
            @for (o of priorityOptions; track o.value) {
              <option [value]="o.value" [selected]="o.value === filters().priority">{{ o.label }}</option>
            }
          </select>
        </div>
        <div class="ctl">
          <label for="filter-due-from">Due from</label>
          <input
            id="filter-due-from"
            class="input"
            type="date"
            [value]="filters().dueFrom"
            [attr.max]="filters().dueTo || null"
            (change)="emit({ dueFrom: value($event) })"
          />
        </div>
        <div class="ctl">
          <label for="filter-due-to">Due to</label>
          <input
            id="filter-due-to"
            class="input"
            type="date"
            [value]="filters().dueTo"
            [attr.min]="filters().dueFrom || null"
            (change)="emit({ dueTo: value($event) })"
          />
        </div>
        <div class="ctl">
          <label for="sort-field">Sort by</label>
          <select id="sort-field" class="select" (change)="emit({ sort: $any(value($event)) })">
            @for (o of sortOptions; track o.value) {
              <option [value]="o.value" [selected]="o.value === filters().sort">{{ o.label }}</option>
            }
          </select>
        </div>
        <div class="ctl">
          <label for="sort-direction">Order</label>
          <select id="sort-direction" class="select" (change)="emit({ direction: $any(value($event)) })">
            @for (o of directionOptions; track o.value) {
              <option [value]="o.value" [selected]="o.value === filters().direction">{{ o.label }}</option>
            }
          </select>
        </div>
      </div>

      <div class="toolbar__toggles">
        <label class="toggle" [class.is-on]="filters().overdue">
          <input type="checkbox" [checked]="filters().overdue" (change)="emit({ overdue: checked($event) })" />
          <app-icon name="alert" [size]="16" /> Overdue only
        </label>
        <label class="toggle" [class.is-on]="filters().archived">
          <input type="checkbox" [checked]="filters().archived" (change)="emit({ archived: checked($event) })" />
          <app-icon name="archive" [size]="16" /> Show archived
        </label>
        @if (narrowed()) {
          <button type="button" class="btn btn-ghost toolbar__clear" (click)="clearAll()" animate.enter="qf-enter-fade">
            <app-icon name="x" [size]="16" /> Clear filters
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: var(--space-5); }
    .toolbar {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-1);
    }
    .toolbar__search { position: relative; }
    .toolbar__search .input { padding-left: calc(var(--space-3) + 26px); }
    .toolbar__search-icon {
      position: absolute;
      left: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }
    .toolbar__group {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--space-3);
    }
    .ctl { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
    .ctl label { font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--text-muted); }
    .toolbar__toggles { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 36px;
      padding: 0 var(--space-3);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-pill);
      font-size: var(--text-sm);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard);
    }
    .toggle:hover { background: var(--surface-hover); }
    .toggle.is-on { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
    .toggle:has(input:focus-visible) { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .toolbar__clear { min-height: 36px; margin-left: auto; }
  `,
})
export class TaskToolbarComponent {
  readonly filters = input.required<TaskFilters>();
  readonly filtersChange = output<Partial<TaskFilters>>();
  /** Clears search + narrowing filters (keeps the archived view and sort). */
  readonly clear = output<void>();

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly directionOptions = DIRECTION_OPTIONS;

  /** What the user typed (shown immediately); emitted after the debounce. */
  protected readonly searchText = signal('');
  protected readonly narrowed = computed(() => hasNarrowingFilters(this.filters()) || !!this.searchText().trim());

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Keep the box in sync when filters are changed from outside (e.g. "Clear filters").
    effect(() => {
      const q = this.filters().q;
      untracked(() => {
        if (this.debounce === undefined && q !== this.searchText()) {
          this.searchText.set(q);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.debounce));
  }

  protected onSearch(event: Event): void {
    const text = this.value(event);
    this.searchText.set(text);
    clearTimeout(this.debounce);
    if (!text.trim()) {
      // Emptying the box is a definite action: show the full list without waiting (SC-009).
      this.debounce = undefined;
      if (this.filters().q) {
        this.filtersChange.emit({ q: '' });
      }
      return;
    }
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      if (text !== this.filters().q) {
        this.filtersChange.emit({ q: text });
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.searchText.set('');
    if (this.filters().q) {
      this.filtersChange.emit({ q: '' });
    }
  }

  protected clearAll(): void {
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.searchText.set('');
    this.clear.emit();
  }

  protected emit(patch: Partial<TaskFilters>): void {
    this.filtersChange.emit(patch);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
