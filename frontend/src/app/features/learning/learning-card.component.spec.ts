import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LearningCard, LearningStatus, Milestone } from '../../api';
import { validateLearningCardForm, learningStatusLabel } from './learning-card-form-dialog.component';
import { LearningCardComponent } from './learning-card.component';
import { validateMilestoneTitle } from './learning-milestones.component';
import { validateNote } from './learning-notes.component';
import { LearningStore } from './learning.store';

// T064 — traces US3 AS1 (title, Not Started chip, validation limits), AS2 (expand shows milestones with
// done flag + target date and notes with timestamp, aria-expanded), AS3 (add / toggle / remove milestone),
// AS4 (add / remove note, non-empty ≤ 5,000), AS5 (status chip + progress), AS6 (edit / remove outputs),
// edge case "long titles truncated with full text".

function ms(id: number, done = false, patch: Partial<Milestone> = {}): Milestone {
  return { id, title: `Milestone ${id}`, done, targetDate: null, completedAt: null, ...patch };
}

function card(patch: Partial<LearningCard> = {}): LearningCard {
  return {
    id: 5,
    title: 'Angular Signals',
    description: 'Official docs',
    status: LearningStatus.InProgress,
    createdAt: '2026-06-17T10:00:00Z',
    milestones: [ms(1, true, { targetDate: '2026-07-01' }), ms(2, false, { targetDate: '2000-01-01' })],
    notes: [
      { id: 9, text: 'second\nline', createdAt: '2026-06-17T12:00:00Z' },
      { id: 8, text: 'first', createdAt: '2026-06-17T11:00:00Z' },
    ],
    milestonesTotal: 2,
    milestonesDone: 1,
    progressPercent: 50,
    ...patch,
  };
}

describe('learning validators', () => {
  it('card form: title required / ≤ 200 after trim, description ≤ 2,000', () => {
    expect(validateLearningCardForm({ title: '   ', description: '' }).title).toBe('Title is required.');
    expect(validateLearningCardForm({ title: ` ${'a'.repeat(200)} `, description: 'd'.repeat(2000) })).toEqual({});
    expect(validateLearningCardForm({ title: 'a'.repeat(201), description: '' }).title).toContain('at most 200');
    expect(validateLearningCardForm({ title: 'x', description: 'd'.repeat(2001) }).description).toContain('2,000');
  });

  it('milestone title required / ≤ 200', () => {
    expect(validateMilestoneTitle('  ')).toBe('Milestone title is required.');
    expect(validateMilestoneTitle('a'.repeat(200))).toBe('');
    expect(validateMilestoneTitle('a'.repeat(201))).toContain('at most 200');
  });

  it('note non-blank / ≤ 5,000', () => {
    expect(validateNote(' \n ')).toBe('Note text is required.');
    expect(validateNote('n'.repeat(5000))).toBe('');
    expect(validateNote('n'.repeat(5001))).toContain('5,001');
  });

  it('status labels', () => {
    expect(learningStatusLabel(LearningStatus.NotStarted)).toBe('Not Started');
    expect(learningStatusLabel(LearningStatus.InProgress)).toBe('In Progress');
    expect(learningStatusLabel(LearningStatus.Completed)).toBe('Completed');
  });
});

describe('LearningCardComponent', () => {
  let fixture: ComponentFixture<LearningCardComponent>;
  let events: { edit: LearningCard[]; remove: LearningCard[] };
  let store: Record<string, ReturnType<typeof vi.fn>>;

  async function setup(c: LearningCard, busy = false): Promise<HTMLElement> {
    store = {
      toggleMilestone: vi.fn(() => Promise.resolve(true)),
      removeMilestone: vi.fn(() => Promise.resolve(true)),
      addMilestone: vi.fn(() => Promise.resolve(c)),
      addNote: vi.fn(() => Promise.resolve(c)),
      removeNote: vi.fn(() => Promise.resolve(true)),
    };
    await TestBed.configureTestingModule({
      imports: [LearningCardComponent],
      providers: [{ provide: LearningStore, useValue: store }],
    }).compileComponents();
    fixture = TestBed.createComponent(LearningCardComponent);
    fixture.componentRef.setInput('card', c);
    fixture.componentRef.setInput('busy', busy);
    events = { edit: [], remove: [] };
    fixture.componentInstance.edit.subscribe((x) => events.edit.push(x));
    fixture.componentInstance.remove.subscribe((x) => events.remove.push(x));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function q<T extends Element = HTMLElement>(root: HTMLElement, sel: string): T {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`missing ${sel}`);
    return el;
  }

  // jsdom does not reflect the `inert` property to an attribute; read whichever is set.
  function isInert(el: HTMLElement): boolean {
    return el.hasAttribute('inert') || (el as HTMLElement & { inert?: boolean }).inert === true;
  }

  function text(root: HTMLElement, sel: string): string {
    return q(root, sel).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function button(root: HTMLElement, labelStart: string): HTMLButtonElement {
    const b = Array.from(root.querySelectorAll('button')).find((x) =>
      (x.getAttribute('aria-label') ?? x.textContent ?? '').trim().startsWith(labelStart),
    );
    if (!b) throw new Error(`missing button ${labelStart}`);
    return b as HTMLButtonElement;
  }

  async function expand(root: HTMLElement): Promise<void> {
    q<HTMLButtonElement>(root, 'button.expand').click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function type(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(form: HTMLFormElement): Promise<void> {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows title (full text in title attr), status chip, progress and counts', async () => {
    const root = await setup(card());
    expect(text(root, '.lcard__title')).toBe('Angular Signals');
    expect(q(root, '.lcard__title').getAttribute('title')).toBe('Angular Signals');
    expect(text(root, '.chip.status')).toBe('In Progress');
    expect(q(root, '.chip.status').getAttribute('data-status')).toBe('IN_PROGRESS');
    expect(root.getAttribute('data-status')).toBe('IN_PROGRESS');
    expect(text(root, '.lcard__progress .meta-text')).toBe('1 of 2 milestones · 2 notes');
    expect(text(root, '.lcard__desc')).toBe('Official docs');
    expect(text(root, '.lcard__foot .meta-text')).toMatch(/^Added /);
  });

  it('new card shows Not Started, 0 of 0 and singular labels', async () => {
    const root = await setup(card({ status: LearningStatus.NotStarted, milestones: [], notes: [], milestonesTotal: 0, milestonesDone: 0, progressPercent: 0, description: null }));
    expect(text(root, '.chip.status')).toBe('Not Started');
    expect(text(root, '.lcard__progress .meta-text')).toBe('0 of 0 milestones · 0 notes');
    expect(root.querySelector('.lcard__desc')).toBeNull();
    const one = card({ milestones: [ms(1)], milestonesTotal: 1, notes: [{ id: 1, text: 'x', createdAt: '2026-06-17T10:00:00Z' }] });
    fixture.componentRef.setInput('card', one);
    fixture.detectChanges();
    expect(text(root, '.lcard__progress .meta-text')).toBe('1 of 1 milestone · 1 note');
  });

  it('collapsed by default: aria-expanded=false, body inert and not rendered', async () => {
    const root = await setup(card());
    const btn = q<HTMLButtonElement>(root, 'button.expand');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe('lc-5-body');
    expect(isInert(q(root, '#lc-5-body'))).toBe(true);
    expect(root.querySelector('app-learning-milestones')).toBeNull();
  });

  it('expand shows milestones (done flag, target date, overdue) and notes newest first with timestamps', async () => {
    const root = await setup(card());
    await expand(root);
    expect(q(root, 'button.expand').getAttribute('aria-expanded')).toBe('true');
    expect(isInert(q(root, '#lc-5-body'))).toBe(false);
    expect(root.classList.contains('is-expanded')).toBe(true);
    expect(text(root, '.lcard__full-desc')).toBe('Official docs');
    const items = root.querySelectorAll('.ms');
    expect(items).toHaveLength(2);
    expect(items[0].classList.contains('is-done')).toBe(true);
    expect((items[0].querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(true);
    expect((items[1].querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(false);
    expect(items[0].querySelector('.ms__date')?.classList.contains('is-overdue')).toBe(false);
    expect(items[1].querySelector('.ms__date')?.classList.contains('is-overdue')).toBe(true);
    const notes = root.querySelectorAll('.note');
    expect(Array.from(notes).map((n) => n.querySelector('.note__text')?.textContent)).toEqual(['second\nline', 'first']);
    expect(notes[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-06-17T12:00:00Z');
    expect(notes[0].querySelector('time')?.textContent?.trim()).not.toBe('');
  });

  it('collapse sets aria-expanded back and keeps the body rendered (animated)', async () => {
    const root = await setup(card());
    await expand(root);
    await expand(root);
    expect(q(root, 'button.expand').getAttribute('aria-expanded')).toBe('false');
    expect(isInert(q(root, '#lc-5-body'))).toBe(true);
    expect(root.querySelector('app-learning-milestones')).not.toBeNull();
  });

  it('long title shows full text in the expanded view', async () => {
    const long = 'L'.repeat(160);
    const root = await setup(card({ title: long }));
    expect(q(root, '.lcard__title').getAttribute('title')).toBe(long);
    await expand(root);
    expect(text(root, '.lcard__full-title')).toBe(long);
  });

  it('toggling a checkbox and removing a milestone call the store', async () => {
    const c = card();
    const root = await setup(c);
    await expand(root);
    const box = root.querySelectorAll<HTMLInputElement>('.ms input[type=checkbox]')[1];
    box.click();
    expect(store['toggleMilestone']).toHaveBeenCalledWith(c, c.milestones[1]);
    button(root, 'Remove milestone: Milestone 1').click();
    expect(store['removeMilestone']).toHaveBeenCalledWith(c, c.milestones[0]);
  });

  it('add milestone: empty shows an error; valid title + date calls the store and clears', async () => {
    const c = card();
    const root = await setup(c);
    await expand(root);
    const form = q<HTMLFormElement>(root, 'app-learning-milestones form');
    await submit(form);
    expect(text(root, 'app-learning-milestones .add__error')).toBe('Milestone title is required.');
    expect(store['addMilestone']).not.toHaveBeenCalled();

    const title = q<HTMLInputElement>(root, 'input[name=milestoneTitle]');
    type(title, '  Read chapter 1  ');
    expect(title.hasAttribute('aria-invalid')).toBe(false);
    type(q<HTMLInputElement>(root, 'input[name=milestoneTargetDate]'), '2026-07-15');
    await submit(form);
    expect(store['addMilestone']).toHaveBeenCalledWith(c, { title: 'Read chapter 1', targetDate: '2026-07-15' });
    expect(q<HTMLInputElement>(root, 'input[name=milestoneTitle]').value).toBe('');
  });

  it('add milestone shows the server field error', async () => {
    const root = await setup(card());
    store['addMilestone'].mockRejectedValue({ status: 400, message: 'Validation failed', fieldErrors: { title: 'Title must be 1-200 characters' } });
    await expand(root);
    type(q<HTMLInputElement>(root, 'input[name=milestoneTitle]'), 'x');
    await submit(q<HTMLFormElement>(root, 'app-learning-milestones form'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(root, 'app-learning-milestones .add__error')).toBe('Title must be 1-200 characters');
  });

  it('notes: blank shows an error, valid text calls the store, remove calls the store', async () => {
    const c = card();
    const root = await setup(c);
    await expand(root);
    const form = q<HTMLFormElement>(root, 'app-learning-notes form');
    type(q<HTMLTextAreaElement>(root, 'textarea[name=noteText]'), '   ');
    await submit(form);
    expect(text(root, 'app-learning-notes .add__hint')).toBe('Note text is required.');
    expect(store['addNote']).not.toHaveBeenCalled();

    type(q<HTMLTextAreaElement>(root, 'textarea[name=noteText]'), 'Great talk');
    expect(text(root, 'app-learning-notes .add__hint')).toContain('10 / 5,000');
    await submit(form);
    expect(store['addNote']).toHaveBeenCalledWith(c, 'Great talk');
    expect(q<HTMLTextAreaElement>(root, 'textarea[name=noteText]').value).toBe('');

    button(root, 'Remove note').click();
    expect(store['removeNote']).toHaveBeenCalledWith(c, 9);
  });

  it('note over 5,000 chars is rejected client-side', async () => {
    const root = await setup(card());
    await expand(root);
    type(q<HTMLTextAreaElement>(root, 'textarea[name=noteText]'), 'n'.repeat(5001));
    await submit(q<HTMLFormElement>(root, 'app-learning-notes form'));
    expect(text(root, 'app-learning-notes .add__hint')).toContain('at most 5,000');
    expect(store['addNote']).not.toHaveBeenCalled();
  });

  it('edit and remove emit the card; busy disables actions and checkboxes', async () => {
    const c = card();
    const root = await setup(c);
    button(root, 'Edit learning card').click();
    button(root, 'Remove learning card').click();
    expect(events.edit).toEqual([c]);
    expect(events.remove).toEqual([c]);

    fixture.componentRef.setInput('busy', true);
    await expand(root);
    expect(button(root, 'Edit learning card').disabled).toBe(true);
    expect(button(root, 'Remove learning card').disabled).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    root.querySelectorAll<HTMLInputElement>('.ms input[type=checkbox]').forEach((b) => expect(b.disabled).toBe(true));
  });

  it('completed card shows the Completed chip', async () => {
    const root = await setup(card({ status: LearningStatus.Completed, progressPercent: 100, milestonesDone: 2 }));
    expect(text(root, '.chip.status')).toBe('Completed');
    expect(text(root, '.lcard__progress .meta-text')).toBe('2 of 2 milestones · 2 notes');
  });
});
