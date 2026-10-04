import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { HabitsService, LearningService, Plan, PlanItemSourceType, PlanRequest, TasksService, TaskStatus } from '../../api';
import { ApiErrorInfo, toApiError } from '../../core/api-errors';
import { formatMinutes } from '../../core/format';
import { NotificationService } from '../../core/notification.service';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PlansStore } from './plans.store';

export const PLAN_TITLE_MAX = 200;

export type PlanField = 'items' | 'title' | 'estimatedDurationMinutes' | 'startDateTime' | 'endDateTime' | 'priorityOrder';
const FIELDS: readonly PlanField[] = ['items', 'title', 'estimatedDurationMinutes', 'startDateTime', 'endDateTime', 'priorityOrder'];
const STEP1_FIELDS: readonly PlanField[] = ['items'];

/** One pickable source item. */
export interface PlanSourceOption {
  key: string;
  type: PlanItemSourceType;
  id: number;
  title: string;
  meta: string;
}

export interface PlanFormValue {
  itemCount: number;
  title: string;
  hours: string;
  minutes: string;
  start: string;
  end: string;
  priority: string;
}

export const SOURCE_TABS: readonly { type: PlanItemSourceType; label: string; icon: string }[] = [
  { type: PlanItemSourceType.Task, label: 'Tasks', icon: 'tasks' },
  { type: PlanItemSourceType.Habit, label: 'Habits', icon: 'habits' },
  { type: PlanItemSourceType.LearningResource, label: 'Learning', icon: 'learning' },
];

export function sourceIcon(type: PlanItemSourceType): string {
  return SOURCE_TABS.find((t) => t.type === type)?.icon ?? 'plans';
}

const pad = (n: number) => n.toString().padStart(2, '0');

/** `Date` → `datetime-local` input value (`yyyy-MM-ddTHH:mm`, local time). */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a `datetime-local` value as local time; NaN when empty/invalid. */
export function parseLocalInput(value: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? new Date(value).getTime() : NaN;
}

function wholeNumber(value: string): number | null {
  const v = value.trim();
  return /^\d+$/.test(v) ? Number(v) : v === '' ? 0 : null;
}

/** Total minutes from the hours/minutes inputs, or null when either is not a whole number ≥ 0. */
export function durationMinutes(hours: string, minutes: string): number | null {
  const h = wholeNumber(hours);
  const m = wholeNumber(minutes);
  return h === null || m === null ? null : h * 60 + m;
}

/** Client-side validation of the plan builder; one message per invalid field. */
export function validatePlanForm(v: PlanFormValue): Partial<Record<PlanField, string>> {
  const errors: Partial<Record<PlanField, string>> = {};
  if (v.itemCount < 1) {
    errors.items = 'Select at least one item.';
  }
  const title = v.title.trim();
  if (!title) {
    errors.title = 'Title is required.';
  } else if (title.length > PLAN_TITLE_MAX) {
    errors.title = `Title must be at most ${PLAN_TITLE_MAX} characters (currently ${title.length}).`;
  }
  const duration = durationMinutes(v.hours, v.minutes);
  if (duration === null) {
    errors.estimatedDurationMinutes = 'Use whole numbers for hours and minutes.';
  } else if (duration < 1) {
    errors.estimatedDurationMinutes = 'Estimated duration must be at least 1 minute.';
  }
  const start = parseLocalInput(v.start);
  const end = parseLocalInput(v.end);
  if (Number.isNaN(start)) {
    errors.startDateTime = 'Start date and time are required.';
  }
  if (Number.isNaN(end)) {
    errors.endDateTime = 'End date and time are required.';
  } else if (!Number.isNaN(start) && end <= start) {
    errors.endDateTime = 'End must be after the start.';
  }
  const priority = v.priority.trim();
  if (!/^\d+$/.test(priority) || Number(priority) < 1) {
    errors.priorityOrder = 'Priority order must be a whole number of 1 or more (1 = highest).';
  }
  return errors;
}

/**
 * Plan builder (native modal `<dialog>`): step 1 picks items (tabs Tasks / Habits / Learning with
 * search and multi-select chips; only non-archived tasks, active habits and existing cards), step 2
 * sets title, estimated duration, start/end and priority order. Validates client-side and shows
 * server `errors[]`; steps slide in the direction of travel.
 */
@Component({
  selector: 'app-plan-builder-dialog',
  imports: [FormFieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="dialog" aria-labelledby="plan-builder-title" (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      <form class="form" novalidate (submit)="submit($event)">
        <header class="form__header">
          <div>
            <h2 id="plan-builder-title" class="form__title">Create plan</h2>
            <p class="steps" aria-live="polite">
              <span class="dot" [class.is-on]="step() >= 1"></span><span class="dot" [class.is-on]="step() === 2"></span>
              Step {{ step() }} of 2 · {{ step() === 1 ? 'Pick items' : 'Details' }}
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Close" (click)="close()"><app-icon name="x" [size]="18" /></button>
        </header>

        @if (formError()) {
          <p class="form__alert" role="alert" animate.enter="qf-enter-fade"><app-icon name="alert" [size]="16" /> {{ formError() }}</p>
        }

        @if (step() === 1) {
          <div class="step" [animate.enter]="dir() === 'fwd' ? 'step-fwd' : 'step-back'">
            <div class="chips" role="list" aria-label="Selected items">
              @for (o of selectedList(); track o.key) {
                <span class="chip pick" role="listitem" animate.enter="qf-enter-scale" animate.leave="qf-leave-scale">
                  <app-icon [name]="icon(o.type)" [size]="14" />
                  <span class="truncate" [title]="o.title">{{ o.title }}</span>
                  <button type="button" class="pick__x" [attr.aria-label]="'Remove ' + o.title" (click)="toggle(o)"><app-icon name="x" [size]="12" /></button>
                </span>
              } @empty {
                <span class="hint">No items selected yet.</span>
              }
            </div>

            <div class="tabs" role="tablist" aria-label="Item source">
              @for (t of tabs; track t.type; let i = $index) {
                <button
                  type="button"
                  role="tab"
                  class="tab"
                  [id]="'plan-tab-' + i"
                  [attr.aria-selected]="tab() === t.type"
                  aria-controls="plan-tabpanel"
                  [tabIndex]="tab() === t.type ? 0 : -1"
                  (click)="selectTab(t.type)"
                  (keydown)="onTabKey($event, i)"
                >
                  <app-icon [name]="t.icon" [size]="16" /> {{ t.label }}
                  @if (countFor(t.type); as c) {
                    <span class="tab__count">{{ c }}</span>
                  }
                </button>
              }
            </div>

            <div id="plan-tabpanel" role="tabpanel" class="panel" [attr.aria-labelledby]="'plan-tab-' + tabIndex()">
              <label class="sr-only" for="plan-search">Search {{ tabLabel() }}</label>
              <div class="search">
                <app-icon name="search" [size]="16" />
                <input #search id="plan-search" class="input" type="search" autocomplete="off" [placeholder]="'Search ' + tabLabel().toLowerCase() + '…'" [value]="query()" (input)="query.set(inputValue($event))" />
              </div>
              @if (sourcesLoading()) {
                <p class="hint" role="status">Loading items…</p>
              } @else if (sourcesError()) {
                <p class="hint err" role="alert">{{ sourcesError() }} <button type="button" class="btn btn-ghost" (click)="loadSources()">Retry</button></p>
              } @else {
                <ul class="opts" [attr.aria-label]="tabLabel()">
                  @for (o of filtered(); track o.key) {
                    <li>
                      <label class="opt" [class.is-on]="selected().has(o.key)">
                        <input type="checkbox" [checked]="selected().has(o.key)" (change)="toggle(o)" />
                        <span class="opt__title truncate" [title]="o.title">{{ o.title }}</span>
                        @if (o.meta) {
                          <span class="opt__meta">{{ o.meta }}</span>
                        }
                      </label>
                    </li>
                  } @empty {
                    <li class="hint">{{ query() ? 'No matches.' : emptyText() }}</li>
                  }
                </ul>
              }
            </div>
            @if (shownError('items'); as e) {
              <p class="field-err" role="alert">{{ e }}</p>
            }
          </div>
        } @else {
          <div class="step" [animate.enter]="dir() === 'fwd' ? 'step-fwd' : 'step-back'">
            <app-form-field label="Title" forId="plan-title" [required]="true" [error]="shownError('title')">
              <span fieldCounter class="counter" [class.is-over]="titleLength() > titleMax" aria-hidden="true">{{ titleLength() }}/{{ titleMax }}</span>
              <input #titleInput id="plan-title" class="input" type="text" autocomplete="off" aria-required="true" placeholder="e.g. Morning focus block" [value]="title()" (input)="title.set(inputValue($event)); clear('title')" (blur)="touch('title')" />
            </app-form-field>

            <fieldset class="group" [attr.aria-describedby]="shownError('estimatedDurationMinutes') ? 'plan-duration-error' : null">
              <legend class="group__legend">Estimated duration <span class="req" aria-hidden="true">*</span></legend>
              <div class="row">
                <label class="unit"><input id="plan-hours" class="input" type="number" min="0" step="1" inputmode="numeric" [value]="hours()" [attr.aria-invalid]="!!shownError('estimatedDurationMinutes')" (input)="hours.set(inputValue($event)); clear('estimatedDurationMinutes'); syncEnd()" (blur)="touch('estimatedDurationMinutes')" /> hours</label>
                <label class="unit"><input id="plan-minutes" class="input" type="number" min="0" max="59" step="1" inputmode="numeric" [value]="minutes()" [attr.aria-invalid]="!!shownError('estimatedDurationMinutes')" (input)="minutes.set(inputValue($event)); clear('estimatedDurationMinutes'); syncEnd()" (blur)="touch('estimatedDurationMinutes')" /> minutes</label>
              </div>
              @if (shownError('estimatedDurationMinutes'); as e) {
                <p id="plan-duration-error" class="field-err" role="alert">{{ e }}</p>
              } @else if (durationText()) {
                <p class="hint">{{ durationText() }}</p>
              }
            </fieldset>

            <div class="row">
              <app-form-field label="Start" forId="plan-start" [required]="true" [error]="shownError('startDateTime')">
                <input id="plan-start" class="input" type="datetime-local" [value]="start()" (input)="start.set(inputValue($event)); clear('startDateTime'); syncEnd()" (blur)="touch('startDateTime')" />
              </app-form-field>
              <app-form-field label="End" forId="plan-end" [required]="true" [error]="shownError('endDateTime')">
                <input id="plan-end" class="input" type="datetime-local" [value]="end()" (input)="end.set(inputValue($event)); endTouched = true; clear('endDateTime')" (blur)="touch('endDateTime')" />
              </app-form-field>
            </div>

            <app-form-field label="Priority order" forId="plan-priority" hint="1 = highest; plans may share a number." [required]="true" [error]="shownError('priorityOrder')">
              <input id="plan-priority" class="input narrow" type="number" min="1" step="1" inputmode="numeric" [value]="priority()" (input)="priority.set(inputValue($event)); clear('priorityOrder')" (blur)="touch('priorityOrder')" />
            </app-form-field>
          </div>
        }

        <footer class="form__actions">
          @if (step() === 1) {
            <button type="button" class="btn" (click)="close()">Cancel</button>
            <button type="submit" class="btn btn-primary">Next <app-icon name="chevron" class="next-icon" [size]="16" /></button>
          } @else {
            <button type="button" class="btn" (click)="back()">Back</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner" aria-hidden="true"></span> Creating…
              } @else {
                <app-icon name="check" [size]="18" /> Create plan
              }
            </button>
          }
        </footer>
      </form>
    </dialog>
  `,
  styles: `
    .dialog { width: min(600px, calc(100vw - 2 * var(--space-4))); max-height: calc(100dvh - 2 * var(--space-4)); padding: 0; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--bg-elevated); color: var(--text); box-shadow: var(--shadow-3); overflow: auto; }
    .dialog[open] { animation: qf-scale-in var(--duration-base) var(--ease-out) both; }
    .dialog::backdrop { background: var(--scrim); animation: qf-fade-in var(--duration-base) var(--ease-out) both; }
    .form { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6); overflow-x: hidden; }
    .form__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
    .form__title { font-size: var(--text-xl); }
    .steps { display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-1); font-size: var(--text-xs); color: var(--text-muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--surface-2); transition: background-color var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-spring); }
    .dot.is-on { background: var(--primary); transform: scale(1.15); }
    .dot + .dot { margin-right: var(--space-1); }
    .form__alert { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--danger-soft); color: var(--danger); font-size: var(--text-sm); }
    .step { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
    .step-fwd { animation: qf-slide-in-right var(--duration-slow) var(--ease-out) both; }
    .step-back { animation: step-in-left var(--duration-slow) var(--ease-out) both; }
    @keyframes step-in-left { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); min-height: 28px; align-items: center; }
    .pick { max-width: 100%; background: var(--primary-soft); color: var(--primary); }
    .pick__x { display: grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
    .pick__x:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--border); }
    .tab { display: inline-flex; align-items: center; gap: var(--space-1); min-height: 40px; padding: 0 var(--space-3); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--text-muted); font: inherit; font-size: var(--text-sm); font-weight: var(--weight-medium); cursor: pointer; transition: color var(--duration-fast), border-color var(--duration-base) var(--ease-out); }
    .tab[aria-selected='true'] { color: var(--primary); border-bottom-color: var(--primary); }
    .tab__count { min-width: 18px; padding: 0 5px; border-radius: var(--radius-pill); background: var(--primary); color: var(--on-primary); font-size: var(--text-xs); }
    .panel { display: flex; flex-direction: column; gap: var(--space-2); }
    .search { position: relative; }
    .search app-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
    .search .input { padding-left: 34px; }
    .opts { display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow: auto; padding: 0; margin: 0; list-style: none; }
    .opt { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); cursor: pointer; transition: background-color var(--duration-fast); }
    .opt:hover { background: var(--surface-hover); }
    .opt.is-on { background: var(--primary-soft); }
    .opt__title { flex: 1; }
    .opt__meta { flex-shrink: 0; font-size: var(--text-xs); color: var(--text-muted); }
    .hint { font-size: var(--text-xs); color: var(--text-muted); }
    .err, .field-err { color: var(--danger); }
    .field-err { font-size: var(--text-xs); font-weight: var(--weight-medium); }
    .group { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; padding: 0; border: 0; min-width: 0; }
    .group__legend { padding: 0; margin-bottom: var(--space-1); font-size: var(--text-sm); font-weight: var(--weight-medium); }
    .req { color: var(--danger); }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--space-3); }
    .unit { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-muted); }
    .unit .input { width: 90px; }
    .narrow { max-width: 140px; }
    .form__actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .next-icon { transform: rotate(-90deg); }
    .counter { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .counter.is-over { color: var(--danger); font-weight: var(--weight-semibold); }
    .spinner { width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin var(--duration-slow) linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class PlanBuilderDialogComponent {
  /** Emits the created plan, or null when cancelled. */
  readonly closed = output<Plan | null>();

  private readonly store = inject(PlansStore);
  private readonly tasksApi = inject(TasksService);
  private readonly habitsApi = inject(HabitsService);
  private readonly learningApi = inject(LearningService);
  private readonly notify = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly tabs = SOURCE_TABS;
  protected readonly titleMax = PLAN_TITLE_MAX;

  protected readonly step = signal<1 | 2>(1);
  protected readonly dir = signal<'fwd' | 'back'>('fwd');
  protected readonly tab = signal<PlanItemSourceType>(PlanItemSourceType.Task);
  protected readonly query = signal('');
  protected readonly sources = signal<PlanSourceOption[]>([]);
  protected readonly sourcesLoading = signal(true);
  protected readonly sourcesError = signal<string | null>(null);
  /** Selected option keys in pick order. */
  protected readonly selected = signal<ReadonlyMap<string, PlanSourceOption>>(new Map());

  protected readonly title = signal('');
  protected readonly hours = signal('1');
  protected readonly minutes = signal('0');
  protected readonly start = signal('');
  protected readonly end = signal('');
  protected readonly priority = signal('1');
  protected endTouched = false;

  protected readonly saving = signal(false);
  protected readonly submitted = signal<ReadonlySet<1 | 2>>(new Set());
  protected readonly touched = signal<ReadonlySet<PlanField>>(new Set());
  protected readonly serverErrors = signal<Partial<Record<PlanField, string>>>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly selectedList = computed(() => [...this.selected().values()]);
  protected readonly tabIndex = computed(() => SOURCE_TABS.findIndex((t) => t.type === this.tab()));
  protected readonly tabLabel = computed(() => SOURCE_TABS[this.tabIndex()].label);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.sources().filter((o) => o.type === this.tab() && (!q || o.title.toLowerCase().includes(q)));
  });
  protected readonly titleLength = computed(() => this.title().trim().length);
  protected readonly durationText = computed(() => {
    const d = durationMinutes(this.hours(), this.minutes());
    return d && d > 0 ? `= ${formatMinutes(d)}` : '';
  });
  protected readonly clientErrors = computed(() =>
    validatePlanForm({
      itemCount: this.selected().size,
      title: this.title(),
      hours: this.hours(),
      minutes: this.minutes(),
      start: this.start(),
      end: this.end(),
      priority: this.priority(),
    }),
  );

  private opener: HTMLElement | null = null;

  constructor() {
    const first = new Date(Date.now() + 15 * 60_000);
    first.setMinutes(Math.ceil(first.getMinutes() / 15) * 15, 0, 0);
    this.start.set(toLocalInput(first));
    this.syncEnd();
    void this.loadSources();
    afterNextRender(() => {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.dialog().nativeElement.showModal();
      this.searchInput()?.nativeElement.focus();
    });
  }

  /** Loads pickable items: non-archived tasks (open first), active habits, all learning cards. */
  async loadSources(): Promise<void> {
    this.sourcesLoading.set(true);
    this.sourcesError.set(null);
    try {
      const [tasks, habits, cards] = await Promise.all([
        firstValueFrom(this.tasksApi.listTasks(undefined, undefined, undefined, undefined, undefined, undefined, false)),
        firstValueFrom(this.habitsApi.listHabits(true)),
        firstValueFrom(this.learningApi.listLearningCards()),
      ]);
      const options: PlanSourceOption[] = [
        ...tasks
          .filter((t) => !t.archived)
          .sort((a, b) => Number(a.status === TaskStatus.Done) - Number(b.status === TaskStatus.Done))
          .map((t) => opt(PlanItemSourceType.Task, t.id, t.title, t.status === TaskStatus.Done ? 'Done' : t.dueDate ? `Due ${t.dueDate}` : '')),
        ...habits.filter((h) => h.active).map((h) => opt(PlanItemSourceType.Habit, h.id, h.name, h.frequency === 'DAILY' ? 'Daily' : 'Weekly')),
        ...cards.map((c) => opt(PlanItemSourceType.LearningResource, c.id, c.title, `${c.progressPercent}%`)),
      ];
      this.sources.set(options);
    } catch (err) {
      this.sourcesError.set(`Could not load items: ${toApiError(err).message}`);
    } finally {
      this.sourcesLoading.set(false);
    }
  }

  protected icon(type: PlanItemSourceType): string {
    return sourceIcon(type);
  }

  protected countFor(type: PlanItemSourceType): number {
    return this.selectedList().filter((o) => o.type === type).length;
  }

  protected emptyText(): string {
    switch (this.tab()) {
      case PlanItemSourceType.Task:
        return 'No open tasks. Create tasks on the Tasks page.';
      case PlanItemSourceType.Habit:
        return 'No active habits. Create habits on the Habits page.';
      default:
        return 'No learning cards. Add cards on the Learning Resources page.';
    }
  }

  protected selectTab(type: PlanItemSourceType): void {
    this.tab.set(type);
    this.query.set('');
  }

  /** Roving tabindex: arrow keys / Home / End move between tabs. */
  protected onTabKey(event: KeyboardEvent, index: number): void {
    const n = SOURCE_TABS.length;
    const next =
      event.key === 'ArrowRight' ? (index + 1) % n : event.key === 'ArrowLeft' ? (index + n - 1) % n : event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : -1;
    if (next < 0) {
      return;
    }
    event.preventDefault();
    this.selectTab(SOURCE_TABS[next].type);
    (this.dialog().nativeElement.querySelector(`#plan-tab-${next}`) as HTMLElement | null)?.focus();
  }

  protected toggle(o: PlanSourceOption): void {
    this.selected.update((map) => {
      const next = new Map(map);
      if (next.has(o.key)) {
        next.delete(o.key);
      } else {
        next.set(o.key, o);
      }
      return next;
    });
    this.clear('items');
  }

  /** Server error first, then the client error once the field was touched or its step submitted. */
  protected shownError(field: PlanField): string {
    const server = this.serverErrors()[field];
    if (server) {
      return server;
    }
    const client = this.clientErrors()[field];
    if (!client) {
      return '';
    }
    const stepOf = STEP1_FIELDS.includes(field) ? 1 : 2;
    const live = field === 'title' && this.titleLength() > PLAN_TITLE_MAX;
    return live || this.submitted().has(stepOf) || this.touched().has(field) ? client : '';
  }

  protected touch(field: PlanField): void {
    this.touched.update((s) => new Set(s).add(field));
  }

  protected clear(field: PlanField): void {
    if (this.serverErrors()[field]) {
      this.serverErrors.update(({ [field]: _removed, ...rest }) => rest);
    }
    this.formError.set(null);
  }

  /** Keeps end = start + duration until the user edits the end themselves. */
  protected syncEnd(): void {
    if (this.endTouched) {
      return;
    }
    const start = parseLocalInput(this.start());
    const duration = durationMinutes(this.hours(), this.minutes());
    if (!Number.isNaN(start) && duration && duration > 0) {
      this.end.set(toLocalInput(new Date(start + duration * 60_000)));
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected back(): void {
    this.dir.set('back');
    this.step.set(1);
    this.focusLater(() => this.searchInput()?.nativeElement);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.step() === 1) {
      this.submitted.update((s) => new Set(s).add(1));
      if (this.shownError('items')) {
        return;
      }
      this.dir.set('fwd');
      this.step.set(2);
      this.focusLater(() => this.titleInput()?.nativeElement);
      return;
    }
    this.submitted.update((s) => new Set(s).add(2));
    if (this.saving()) {
      return;
    }
    const errors = this.clientErrors();
    if (errors.items) {
      this.back();
      return;
    }
    if (Object.keys(errors).length > 0) {
      this.focusFirstInvalid();
      return;
    }
    const request: PlanRequest = {
      title: this.title().trim(),
      estimatedDurationMinutes: durationMinutes(this.hours(), this.minutes())!,
      startDateTime: new Date(parseLocalInput(this.start())).toISOString(),
      endDateTime: new Date(parseLocalInput(this.end())).toISOString(),
      priorityOrder: Number(this.priority().trim()),
      items: this.selectedList().map((o) => ({ sourceType: o.type, sourceId: o.id })),
    };
    this.saving.set(true);
    this.formError.set(null);
    try {
      const plan = await this.store.create(request);
      this.notify.success('Plan created', plan.title);
      this.finish(plan);
    } catch (err) {
      this.applyServerErrors(err as ApiErrorInfo);
      this.saving.set(false);
    }
  }

  private applyServerErrors(info: ApiErrorInfo): void {
    const known: Partial<Record<PlanField, string>> = {};
    const other: string[] = [];
    for (const [rawField, message] of Object.entries(info.fieldErrors ?? {})) {
      const field = (rawField.startsWith('items') ? 'items' : rawField) as PlanField;
      if (FIELDS.includes(field)) {
        known[field] ??= message;
      } else {
        other.push(`${rawField}: ${message}`);
      }
    }
    this.serverErrors.set(known);
    const hasFieldErrors = Object.keys(known).length > 0;
    this.formError.set(other.length ? other.join(' ') : hasFieldErrors ? 'Please fix the highlighted fields.' : info.message);
    if (known.items) {
      this.back();
    } else if (hasFieldErrors) {
      this.focusFirstInvalid();
    }
  }

  protected close(): void {
    this.finish(null);
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    const el = this.dialog().nativeElement;
    if (event.target !== el) {
      return;
    }
    const r = el.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {
      this.close();
    }
  }

  private finish(result: Plan | null): void {
    const el = this.dialog().nativeElement;
    if (el.open) {
      el.close();
    }
    this.opener?.focus();
    this.closed.emit(result);
  }

  private focusLater(target: () => HTMLElement | undefined): void {
    afterNextRender(() => target()?.focus(), { injector: this.injector });
  }

  private focusFirstInvalid(): void {
    this.focusLater(
      () =>
        this.dialog().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]') ?? this.titleInput()?.nativeElement,
    );
  }
}

function opt(type: PlanItemSourceType, id: number, title: string, meta: string): PlanSourceOption {
  return { key: `${type}:${id}`, type, id, title, meta };
}
