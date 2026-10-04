import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Task, TaskPriority, TaskStatus } from '../../api';
import { NotificationService } from '../../core/notification.service';
import { TaskFormDialogComponent, validateTaskForm } from './task-form-dialog.component';
import { TasksStore } from './tasks.store';

// T034 — traces US1 AS1 (create with defaults Todo / Medium), AS2 (empty title, > 200-char title,
// > 2,000-char description rejected with a message, nothing saved), AS3 (edit pre-filled, saved),
// and server problem+json `errors[]` mapped to the matching field.

describe('validateTaskForm', () => {
  it('requires a non-blank title', () => {
    expect(validateTaskForm({ title: '', description: '' }).title).toBe('Title is required.');
    expect(validateTaskForm({ title: '   ', description: '' }).title).toBe('Title is required.');
  });

  it('accepts 200 chars (after trim) and rejects 201', () => {
    expect(validateTaskForm({ title: ` ${'a'.repeat(200)} `, description: '' })).toEqual({});
    expect(validateTaskForm({ title: 'a'.repeat(201), description: '' }).title).toBe(
      'Title must be at most 200 characters (currently 201).',
    );
  });

  it('accepts a 2,000-char description and rejects 2,001', () => {
    expect(validateTaskForm({ title: 't', description: 'd'.repeat(2000) })).toEqual({});
    expect(validateTaskForm({ title: 't', description: 'd'.repeat(2001) }).description).toBe(
      'Description must be at most 2,000 characters (currently 2,001).',
    );
  });
});

describe('TaskFormDialogComponent', () => {
  let fixture: ComponentFixture<TaskFormDialogComponent>;
  let store: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let notify: { success: ReturnType<typeof vi.fn> };
  let closed: (Task | null)[];

  const saved: Task = {
    id: 7,
    title: 'Saved',
    description: null,
    status: TaskStatus.Todo,
    priority: TaskPriority.Medium,
    dueDate: null,
    createdAt: '2026-06-15T10:00:00Z',
    updatedAt: '2026-06-15T10:00:00Z',
    completedAt: null,
    archived: false,
    overdue: false,
  };

  beforeAll(() => {
    // jsdom may lack the modal dialog API.
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

  async function setup(task: Task | null = null): Promise<HTMLElement> {
    store = { create: vi.fn(), update: vi.fn() };
    notify = { success: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaskFormDialogComponent],
      providers: [
        { provide: TasksStore, useValue: store },
        { provide: NotificationService, useValue: notify },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskFormDialogComponent);
    fixture.componentRef.setInput('task', task);
    closed = [];
    fixture.componentInstance.closed.subscribe((t) => closed.push(t));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function q<T extends Element>(root: HTMLElement, sel: string): T {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`missing ${sel}`);
    return el;
  }

  function type(root: HTMLElement, sel: string, value: string): void {
    const el = q<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(root, sel);
    el.value = value;
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  }

  async function submit(root: HTMLElement): Promise<void> {
    q<HTMLFormElement>(root, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }

  function errorText(root: HTMLElement, id: string): string | null {
    return root.querySelector(`#${id}-error`)?.textContent?.trim() ?? null;
  }

  it('opens in create mode with labelled controls and defaults Todo / Medium', async () => {
    const root = await setup();
    expect(q(root, '#task-form-title').textContent).toContain('Add task');
    expect(q<HTMLDialogElement>(root, 'dialog').hasAttribute('open')).toBe(true);
    for (const id of ['task-title', 'task-description', 'task-status', 'task-priority', 'task-due']) {
      expect(root.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(q<HTMLSelectElement>(root, '#task-status').value).toBe('TODO');
    expect(q<HTMLSelectElement>(root, '#task-priority').value).toBe('MEDIUM');
    expect(q(root, '.counter').textContent?.trim()).toBe('0/200');
  });

  it('shows "Title is required." on empty submit and does not save', async () => {
    const root = await setup();
    await submit(root);
    expect(errorText(root, 'task-title')).toBe('Title is required.');
    expect(q(root, '#task-title').getAttribute('aria-invalid')).toBe('true');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('shows the over-length title error live with a red counter and blocks saving', async () => {
    const root = await setup();
    type(root, '#task-title', 'a'.repeat(201));
    expect(q(root, '.counter').textContent?.trim()).toBe('201/200');
    expect(q(root, '.counter').classList.contains('is-over')).toBe(true);
    expect(errorText(root, 'task-title')).toContain('at most 200 characters');
    await submit(root);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('shows the over-length description error and blocks saving', async () => {
    const root = await setup();
    type(root, '#task-title', 'ok');
    type(root, '#task-description', 'd'.repeat(2001));
    expect(errorText(root, 'task-description')).toContain('at most 2,000 characters');
    await submit(root);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('creates a task with a trimmed title and emits the saved task', async () => {
    const root = await setup();
    store.create.mockResolvedValue(saved);
    type(root, '#task-title', '  Buy milk  ');
    type(root, '#task-description', '   ');
    type(root, '#task-priority', 'HIGH');
    type(root, '#task-due', '2026-07-01');
    await submit(root);
    expect(store.create).toHaveBeenCalledWith({
      title: 'Buy milk',
      description: null,
      status: 'TODO',
      priority: 'HIGH',
      dueDate: '2026-07-01',
    });
    expect(notify.success).toHaveBeenCalledWith('Task added', 'Saved');
    expect(closed).toEqual([saved]);
  });

  it('maps server errors[] to fields and shows a form alert', async () => {
    const root = await setup();
    store.create.mockRejectedValue({
      status: 400,
      message: 'Validation failed',
      fieldErrors: { title: 'Title must be 1-200 characters', dueDate: 'Invalid date' },
    });
    type(root, '#task-title', 'x');
    await submit(root);
    expect(errorText(root, 'task-title')).toBe('Title must be 1-200 characters');
    expect(errorText(root, 'task-due')).toBe('Invalid date');
    expect(q(root, '.form__alert').textContent).toContain('Please fix the highlighted fields.');
    expect(closed).toEqual([]);

    // Editing a field clears its server error.
    type(root, '#task-title', 'xy');
    expect(errorText(root, 'task-title')).toBeNull();
    expect(errorText(root, 'task-due')).toBe('Invalid date');
  });

  it('shows unknown-field and general server errors in the form alert', async () => {
    const root = await setup();
    store.create.mockRejectedValueOnce({ status: 400, message: 'Bad', fieldErrors: { body: 'Malformed JSON' } });
    type(root, '#task-title', 'x');
    await submit(root);
    expect(q(root, '.form__alert').textContent).toContain('body: Malformed JSON');

    store.create.mockRejectedValueOnce({ status: 0, message: 'Cannot reach the server.', fieldErrors: {} });
    await submit(root);
    expect(q(root, '.form__alert').textContent).toContain('Cannot reach the server.');
  });

  it('opens in edit mode pre-filled and calls update', async () => {
    const existing: Task = {
      ...saved,
      id: 3,
      title: 'Old',
      description: 'desc',
      status: TaskStatus.InProgress,
      priority: TaskPriority.Low,
      dueDate: '2026-06-20',
    };
    const root = await setup(existing);
    expect(q(root, '#task-form-title').textContent).toContain('Edit task');
    expect(q<HTMLInputElement>(root, '#task-title').value).toBe('Old');
    expect(q<HTMLTextAreaElement>(root, '#task-description').value).toBe('desc');
    expect(q<HTMLSelectElement>(root, '#task-status').value).toBe('IN_PROGRESS');
    expect(q<HTMLSelectElement>(root, '#task-priority').value).toBe('LOW');
    expect(q<HTMLInputElement>(root, '#task-due').value).toBe('2026-06-20');

    store.update.mockResolvedValue({ ...existing, title: 'New' });
    type(root, '#task-title', 'New');
    type(root, '#task-status', 'DONE');
    await submit(root);
    expect(store.update).toHaveBeenCalledWith(3, {
      title: 'New',
      description: 'desc',
      status: 'DONE',
      priority: 'LOW',
      dueDate: '2026-06-20',
    });
    expect(notify.success).toHaveBeenCalledWith('Task updated', 'New');
  });

  it('Cancel and Esc close the dialog with null', async () => {
    const root = await setup();
    const cancel = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel')!;
    cancel.click();
    expect(closed).toEqual([null]);
    q(root, 'dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(closed).toEqual([null, null]);
  });
});
