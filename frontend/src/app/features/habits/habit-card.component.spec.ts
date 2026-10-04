import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Habit, HabitFrequency } from '../../api';
import { HabitCardComponent } from './habit-card.component';

// T049 — traces US2 AS1 (frequency label), AS2 (toggle bound to completedToday, done state),
// AS3 ("already done" title), AS4 (toggle off / weekly "done this week" undo), AS5 (streak + unit,
// completion rate ring and window), AS6 (deactivate / reactivate / remove actions, inactive card disabled).

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: 7,
    name: 'Drink water',
    description: null,
    frequency: HabitFrequency.Daily,
    createdAt: '2026-06-15T10:00:00Z',
    active: true,
    completedToday: false,
    doneForCurrentPeriod: false,
    currentStreak: 0,
    completionRate: 0,
    lastCompletedDate: null,
    ...patch,
  };
}

describe('HabitCardComponent', () => {
  let fixture: ComponentFixture<HabitCardComponent>;
  let events: Record<string, Habit[]>;

  async function setup(h: Habit, busy = false): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [HabitCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(HabitCardComponent);
    fixture.componentRef.setInput('habit', h);
    fixture.componentRef.setInput('busy', busy);
    events = { toggleToday: [], undoPeriod: [], edit: [], deactivate: [], activate: [], remove: [] };
    const c = fixture.componentInstance;
    c.toggleToday.subscribe((x) => events['toggleToday'].push(x));
    c.undoPeriod.subscribe((x) => events['undoPeriod'].push(x));
    c.edit.subscribe((x) => events['edit'].push(x));
    c.deactivate.subscribe((x) => events['deactivate'].push(x));
    c.activate.subscribe((x) => events['activate'].push(x));
    c.remove.subscribe((x) => events['remove'].push(x));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function q<T extends Element = HTMLElement>(root: HTMLElement, sel: string): T {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`missing ${sel}`);
    return el;
  }

  function text(root: HTMLElement, sel: string): string {
    return q(root, sel).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function button(root: HTMLElement, labelStart: string): HTMLButtonElement {
    const b = Array.from(root.querySelectorAll('button')).find((x) =>
      (x.getAttribute('aria-label') ?? '').startsWith(labelStart),
    );
    if (!b) throw new Error(`missing button ${labelStart}`);
    return b;
  }

  it('shows name with full-text title, Daily chip, not-done period and zero stats', async () => {
    const root = await setup(habit({ description: 'Eight glasses' }));
    expect(q(root, '.habit__name').getAttribute('title')).toBe('Drink water');
    expect(text(root, '.freq')).toBe('Daily');
    expect(q(root, '.freq').getAttribute('data-frequency')).toBe('DAILY');
    expect(q(root, '.habit__desc').getAttribute('title')).toBe('Eight glasses');
    expect(text(root, '.habit__period')).toBe('Not done today yet');
    expect(text(root, '.streak__count')).toBe('0');
    expect(text(root, '.streak__unit')).toBe('days');
    expect(text(root, '.rate__value')).toBe('0%');
    expect(text(root, '.rate__label')).toBe('last 30 days');
    expect(text(root, '.meta-text')).toBe('Never completed');
    expect(root.querySelector('.chip.inactive')).toBeNull();
    const toggle = q<HTMLButtonElement>(root, 'button.check');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Mark done for today: Drink water');
    expect(toggle.title).toBe('Mark done for today');
    expect(toggle.disabled).toBe(false);
  });

  it('done today: pressed toggle, "Done today", streak 1 day, 100 %, already-done title', async () => {
    const root = await setup(
      habit({ completedToday: true, doneForCurrentPeriod: true, currentStreak: 1, completionRate: 100, lastCompletedDate: '2026-06-17' }),
    );
    const toggle = q<HTMLButtonElement>(root, 'button.check');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.classList.contains('is-checked')).toBe(true);
    expect(toggle.title).toBe('Already done today — click to undo');
    expect(toggle.getAttribute('aria-label')).toBe("Undo today's completion: Drink water");
    expect(text(root, '.habit__period')).toBe('Done today');
    expect(text(root, '.streak__unit')).toBe('day');
    expect(text(root, '.rate__value')).toBe('100%');
    expect(q(root, '.ring__fill').getAttribute('stroke-dashoffset')).toBe('0');
    expect(text(root, '.meta-text')).toMatch(/^Last done /);
    expect((fixture.nativeElement as HTMLElement).classList.contains('is-done')).toBe(true);
  });

  it('clicking the toggle emits toggleToday (both directions) and pops only when completing', async () => {
    const root = await setup(habit());
    const toggle = q<HTMLButtonElement>(root, 'button.check');
    toggle.click();
    fixture.detectChanges();
    expect(events['toggleToday']).toHaveLength(1);
    expect(toggle.classList.contains('is-popping')).toBe(true);

    fixture.componentRef.setInput('habit', habit({ completedToday: true, doneForCurrentPeriod: true }));
    fixture.detectChanges();
    toggle.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    toggle.click();
    fixture.detectChanges();
    expect(events['toggleToday']).toHaveLength(2);
    expect(toggle.classList.contains('is-popping')).toBe(false);
  });

  it('weekly done earlier this week: "Done this week" with Undo that emits undoPeriod', async () => {
    const root = await setup(
      habit({ frequency: HabitFrequency.Weekly, doneForCurrentPeriod: true, currentStreak: 1, completionRate: 8, lastCompletedDate: '2026-06-15' }),
    );
    expect(text(root, '.freq')).toBe('Weekly');
    expect(text(root, '.period')).toBe('Done this week');
    expect(q(root, 'button.check').getAttribute('aria-pressed')).toBe('false');
    expect(text(root, '.streak__unit')).toBe('week');
    expect(text(root, '.rate__label')).toBe('last 12 weeks');
    button(root, "Undo this week's completion").click();
    expect(events['undoPeriod']).toHaveLength(1);
    expect(events['undoPeriod'][0].lastCompletedDate).toBe('2026-06-15');
  });

  it('weekly done today and not done variants', async () => {
    const root = await setup(habit({ frequency: HabitFrequency.Weekly, completedToday: true, doneForCurrentPeriod: true, currentStreak: 3 }));
    expect(text(root, '.habit__period')).toBe('Done today · this week counted');
    expect(text(root, '.streak__unit')).toBe('weeks');
    fixture.componentRef.setInput('habit', habit({ frequency: HabitFrequency.Weekly }));
    fixture.detectChanges();
    expect(text(root, '.habit__period')).toBe('Not done this week yet');
  });

  it('active card actions emit edit, deactivate and remove', async () => {
    const root = await setup(habit());
    button(root, 'Edit habit: Drink water').click();
    button(root, 'Deactivate habit: Drink water').click();
    button(root, 'Remove habit: Drink water').click();
    expect(events['edit']).toHaveLength(1);
    expect(events['deactivate']).toHaveLength(1);
    expect(events['remove']).toHaveLength(1);
    expect(root.querySelector('[aria-label^="Reactivate"]')).toBeNull();
  });

  it('inactive card: Inactive chip, paused text, disabled toggle, Reactivate emits activate', async () => {
    const root = await setup(habit({ active: false, currentStreak: 2 }));
    expect(text(root, '.chip.inactive')).toBe('Inactive');
    expect(text(root, '.habit__period')).toBe('Paused — reactivate to track');
    const toggle = q<HTMLButtonElement>(root, 'button.check');
    expect(toggle.disabled).toBe(true);
    expect(toggle.title).toBe('Reactivate the habit to track it');
    expect(root.querySelector('[aria-label^="Edit habit"]')).toBeNull();
    button(root, 'Reactivate habit: Drink water').click();
    expect(events['activate']).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).classList.contains('is-inactive')).toBe(true);
  });

  it('busy disables all buttons and sets aria-busy', async () => {
    const root = await setup(habit(), true);
    for (const b of Array.from(root.querySelectorAll('button'))) {
      expect(b.disabled).toBe(true);
    }
    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-busy')).toBe('true');
  });

  it('clamps the rate to 0-100 and bumps the flame only when the streak grows', async () => {
    const root = await setup(habit({ currentStreak: 2, completionRate: 140 }));
    expect(text(root, '.rate__value')).toBe('100%');
    expect(q(root, '.streak').classList.contains('is-bumping')).toBe(false);
    fixture.componentRef.setInput('habit', habit({ currentStreak: 3, completionRate: -5 }));
    fixture.detectChanges();
    expect(text(root, '.rate__value')).toBe('0%');
    expect(q(root, '.streak').classList.contains('is-bumping')).toBe(true);
    expect(q(root, '.streak').getAttribute('aria-label')).toBe('Current streak: 3 days');
    q(root, '.streak').dispatchEvent(new Event('animationend'));
    fixture.componentRef.setInput('habit', habit({ currentStreak: 1 }));
    fixture.detectChanges();
    expect(q(root, '.streak').classList.contains('is-bumping')).toBe(false);
  });
});
