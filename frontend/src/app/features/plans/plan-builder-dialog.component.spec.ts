import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  Habit,
  HabitFrequency,
  HabitsService,
  LearningCard,
  LearningService,
  LearningStatus,
  Plan,
  PlanItemSourceType,
  PlanStatus,
  Task,
  TaskPriority,
  TaskStatus,
  TasksService,
} from '../../api';
import { toApiError } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import {
  PlanBuilderDialogComponent,
  PlanFormValue,
  durationMinutes,
  parseLocalInput,
  toLocalInput,
  validatePlanForm,
} from './plan-builder-dialog.component';
import { PlansStore } from './plans.store';

// T081 — traces US4 AS1 (pick non-archived tasks / active habits / cards, enter title, duration, start, end,
// priority) and AS2 (no items, empty title, end not after start → not saved, message shown), plus server
// `errors[]` mapped to fields (items error returns to step 1).

const valid: PlanFormValue = {
  itemCount: 1,
  title: 'Focus',
  hours: '1',
  minutes: '30',
  start: '2026-06-17T10:00',
  end: '2026-06-17T11:30',
  priority: '1',
};

describe('plan builder helpers', () => {
  it('accepts a valid form', () => {
    expect(validatePlanForm(valid)).toEqual({});
  });

  it('requires at least one item, a title, and end after start', () => {
    const e = validatePlanForm({ ...valid, itemCount: 0, title: '   ', end: valid.start });
    expect(e.items).toBe('Select at least one item.');
    expect(e.title).toBe('Title is required.');
    expect(e.endDateTime).toBe('End must be after the start.');
    expect(validatePlanForm({ ...valid, end: '2026-06-17T09:59' }).endDateTime).toBe('End must be after the start.');
  });

  it('limits the title to 200 characters after trim', () => {
    expect(validatePlanForm({ ...valid, title: ` ${'a'.repeat(200)} ` }).title).toBeUndefined();
    expect(validatePlanForm({ ...valid, title: 'a'.repeat(201) }).title).toBe('Title must be at most 200 characters (currently 201).');
  });

  it('requires duration ≥ 1 minute in whole numbers', () => {
    expect(validatePlanForm({ ...valid, hours: '0', minutes: '0' }).estimatedDurationMinutes).toBe(
      'Estimated duration must be at least 1 minute.',
    );
    expect(validatePlanForm({ ...valid, hours: '', minutes: '' }).estimatedDurationMinutes).toBe(
      'Estimated duration must be at least 1 minute.',
    );
    expect(validatePlanForm({ ...valid, hours: '1.5' }).estimatedDurationMinutes).toBe('Use whole numbers for hours and minutes.');
    expect(validatePlanForm({ ...valid, hours: '0', minutes: '1' }).estimatedDurationMinutes).toBeUndefined();
    expect(durationMinutes('2', '15')).toBe(135);
    expect(durationMinutes('', '5')).toBe(5);
    expect(durationMinutes('x', '5')).toBeNull();
  });

  it('requires start / end and a priority order ≥ 1', () => {
    const e = validatePlanForm({ ...valid, start: '', end: '', priority: '0' });
    expect(e.startDateTime).toBe('Start date and time are required.');
    expect(e.endDateTime).toBe('End date and time are required.');
    expect(e.priorityOrder).toContain('1 or more');
    expect(validatePlanForm({ ...valid, priority: '-1' }).priorityOrder).toBeDefined();
    expect(validatePlanForm({ ...valid, priority: '2.5' }).priorityOrder).toBeDefined();
  });

  it('round-trips datetime-local values', () => {
    const d = new Date(2026, 5, 17, 9, 5);
    expect(toLocalInput(d)).toBe('2026-06-17T09:05');
    expect(parseLocalInput('2026-06-17T09:05')).toBe(d.getTime());
    expect(parseLocalInput('')).toBeNaN();
  });
});

function task(id: number, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status: TaskStatus.Todo,
    priority: TaskPriority.Medium,
    dueDate: null,
    createdAt: '2026-06-17T10:00:00Z',
    updatedAt: '2026-06-17T10:00:00Z',
    completedAt: null,
    archived: false,
    overdue: false,
    ...patch,
  };
}

function habit(id: number, patch: Partial<Habit> = {}): Habit {
  return {
    id,
    name: `Habit ${id}`,
    description: null,
    frequency: HabitFrequency.Daily,
    createdAt: '2026-06-17T10:00:00Z',
    active: true,
    completedToday: false,
    doneForCurrentPeriod: false,
    currentStreak: 0,
    completionRate: 0,
    lastCompletedDate: null,
    ...patch,
  };
}

function card(id: number): LearningCard {
  return {
    id,
    title: `Card ${id}`,
    description: null,
    status: LearningStatus.NotStarted,
    createdAt: '2026-06-17T10:00:00Z',
    milestones: [],
    notes: [],
    milestonesTotal: 0,
    milestonesDone: 0,
    progressPercent: 0,
  };
}

describe('PlanBuilderDialogComponent', () => {
  let fixture: ComponentFixture<PlanBuilderDialogComponent>;
  let el: HTMLElement;
  let store: { create: ReturnType<typeof vi.fn> };
  let notify: { success: ReturnType<typeof vi.fn> };
  let closed: (Plan | null)[];
  let listTasks: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
    if (!proto.showModal) {
      proto.showModal = function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
    }
    if (!proto.close) {
      proto.close = function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      };
    }
  });

  beforeEach(async () => {
    store = { create: vi.fn() };
    notify = { success: vi.fn() };
    listTasks = vi.fn(() =>
      of([task(1, { title: 'Write report' }), task(2, { archived: true, title: 'Archived task' }), task(3, { status: TaskStatus.Done, title: 'Done task' })]),
    );
    await TestBed.configureTestingModule({
      imports: [PlanBuilderDialogComponent],
      providers: [
        { provide: PlansStore, useValue: store },
        { provide: NotificationService, useValue: notify },
        { provide: TasksService, useValue: { listTasks } },
        { provide: HabitsService, useValue: { listHabits: vi.fn(() => of([habit(5, { name: 'Stretch' }), habit(6, { active: false, name: 'Inactive habit' })])) } },
        { provide: LearningService, useValue: { listLearningCards: vi.fn(() => of([card(7)])) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlanBuilderDialogComponent);
    closed = [];
    fixture.componentInstance.closed.subscribe((p) => closed.push(p));
    fixture.detectChanges();
    await render();
    el = fixture.nativeElement as HTMLElement;
  });

  async function render(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as T | null;
  const text = () => el.textContent ?? '';
  const optionTitles = () => Array.from(el.querySelectorAll('.opt__title')).map((n) => n.textContent?.trim());

  async function submit(): Promise<void> {
    q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await render();
  }

  async function type(sel: string, value: string): Promise<void> {
    const input = q<HTMLInputElement>(sel)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await render();
  }

  async function tab(i: number): Promise<void> {
    q<HTMLButtonElement>(`#plan-tab-${i}`)!.click();
    await render();
  }

  async function pick(title: string): Promise<void> {
    const label = Array.from(el.querySelectorAll('.opt')).find((n) => n.textContent?.includes(title))!;
    (label.querySelector('input[type=checkbox]') as HTMLInputElement).dispatchEvent(new Event('change'));
    await render();
  }

  it('opens as modal on step 1 and lists only non-archived tasks (open first)', () => {
    expect(q<HTMLDialogElement>('dialog')!.hasAttribute('open')).toBe(true);
    expect(text()).toContain('Step 1 of 2');
    expect(listTasks).toHaveBeenCalled();
    expect(optionTitles()).toEqual(['Write report', 'Done task']);
  });

  it('lists only active habits and all learning cards', async () => {
    await tab(1);
    expect(optionTitles()).toEqual(['Stretch']);
    await tab(2);
    expect(optionTitles()).toEqual(['Card 7']);
  });

  it('filters by search', async () => {
    await type('#plan-search', 'report');
    expect(optionTitles()).toEqual(['Write report']);
    await type('#plan-search', 'zzz');
    expect(text()).toContain('No matches.');
  });

  it('blocks step 2 with no items selected', async () => {
    await submit();
    expect(text()).toContain('Select at least one item.');
    expect(text()).toContain('Step 1 of 2');
  });

  it('selects items as chips with per-tab counts and removes them', async () => {
    await pick('Write report');
    await tab(1);
    await pick('Stretch');
    const chips = Array.from(el.querySelectorAll('.chips .pick')).map((n) => n.textContent?.trim());
    expect(chips).toEqual(['Write report', 'Stretch']);
    expect(q('#plan-tab-0 .tab__count')?.textContent?.trim()).toBe('1');
    q<HTMLButtonElement>('.pick__x[aria-label="Remove Stretch"]')!.click();
    await render();
    expect(el.querySelectorAll('.chips .pick').length).toBe(1);
  });

  it('validates step 2 client-side and sends nothing', async () => {
    await pick('Write report');
    await submit();
    expect(text()).toContain('Step 2 of 2');
    await type('#plan-hours', '0');
    await type('#plan-minutes', '0');
    await type('#plan-end', q<HTMLInputElement>('#plan-start')!.value);
    await type('#plan-priority', '0');
    await submit();
    expect(text()).toContain('Title is required.');
    expect(text()).toContain('Estimated duration must be at least 1 minute.');
    expect(text()).toContain('End must be after the start.');
    expect(text()).toContain('Priority order must be a whole number');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('end follows start + duration until edited', async () => {
    await pick('Write report');
    await submit();
    await type('#plan-start', '2026-06-17T10:00');
    await type('#plan-hours', '2');
    await type('#plan-minutes', '15');
    expect(q<HTMLInputElement>('#plan-end')!.value).toBe('2026-06-17T12:15');
  });

  it('creates the plan with ISO times and the selected items', async () => {
    const created = { id: 9, title: 'Focus', status: PlanStatus.NotStarted } as Plan;
    store.create.mockResolvedValue(created);
    await pick('Write report');
    await tab(1);
    await pick('Stretch');
    await tab(2);
    await pick('Card 7');
    await submit();
    await type('#plan-title', '  Focus  ');
    await type('#plan-start', '2026-06-17T10:00');
    await type('#plan-hours', '1');
    await type('#plan-minutes', '30');
    await type('#plan-priority', '2');
    await submit();
    expect(store.create).toHaveBeenCalledWith({
      title: 'Focus',
      estimatedDurationMinutes: 90,
      startDateTime: new Date(2026, 5, 17, 10, 0).toISOString(),
      endDateTime: new Date(2026, 5, 17, 11, 30).toISOString(),
      priorityOrder: 2,
      items: [
        { sourceType: PlanItemSourceType.Task, sourceId: 1 },
        { sourceType: PlanItemSourceType.Habit, sourceId: 5 },
        { sourceType: PlanItemSourceType.LearningResource, sourceId: 7 },
      ],
    });
    expect(notify.success).toHaveBeenCalledWith('Plan created', 'Focus');
    expect(closed).toEqual([created]);
  });

  it('maps server errors[] to fields; an items error returns to step 1', async () => {
    const err = (errors: object[]) =>
      toApiError(new HttpErrorResponse({ status: 400, error: { detail: 'Validation failed', errors }, statusText: 'Bad' }));
    store.create.mockRejectedValueOnce(err([{ field: 'endDateTime', message: 'End date-time must be after start date-time' }]));
    await pick('Write report');
    await submit();
    await type('#plan-title', 'Focus');
    await submit();
    expect(text()).toContain('End date-time must be after start date-time');
    expect(text()).toContain('Please fix the highlighted fields.');
    expect(closed).toEqual([]);

    store.create.mockRejectedValueOnce(err([{ field: 'items', message: 'Task 1 does not exist or is archived' }]));
    await submit();
    expect(text()).toContain('Step 1 of 2');
    expect(text()).toContain('Task 1 does not exist or is archived');
  });

  it('cancel closes with null', async () => {
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel')!.click();
    await render();
    expect(closed).toEqual([null]);
    expect(q<HTMLDialogElement>('dialog')!.hasAttribute('open')).toBe(false);
  });
});
