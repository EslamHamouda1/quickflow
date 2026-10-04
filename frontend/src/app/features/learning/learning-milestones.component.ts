import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { LearningCard, Milestone } from '../../api';
import { ApiErrorInfo } from '../../core/api-errors';
import { todayIso } from '../../core/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatDate } from '../tasks/task-labels';
import { LearningStore } from './learning.store';

export const MILESTONE_TITLE_MAX = 200;

/** Client validation of the inline milestone form. */
export function validateMilestoneTitle(title: string): string {
  const t = title.trim();
  if (!t) {
    return 'Milestone title is required.';
  }
  return t.length > MILESTONE_TITLE_MAX
    ? `Milestone title must be at most ${MILESTONE_TITLE_MAX} characters (currently ${t.length}).`
    : '';
}

/** Milestone list of an expanded learning card: done checkbox (strike-through), target date, remove, inline add. */
@Component({
  selector: 'app-learning-milestones',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h4 class="sub-title" [id]="headingId()">
      Milestones <span class="sub-count">{{ card().milestonesDone }}/{{ card().milestonesTotal }}</span>
    </h4>
    @if (card().milestones.length === 0) {
      <p class="empty">No milestones yet — add steps to track progress.</p>
    } @else {
      <ul class="ms-list" [attr.aria-labelledby]="headingId()">
        @for (m of card().milestones; track m.id) {
          <li class="ms" [class.is-done]="m.done" animate.enter="qf-enter-slide" animate.leave="qf-leave-fade">
            <label class="ms__main">
              <input
                type="checkbox"
                class="ms__check"
                [checked]="m.done"
                [disabled]="busy()"
                (change)="toggle(m)"
              />
              <span class="ms__title" [title]="m.title">{{ m.title }}</span>
            </label>
            @if (m.targetDate) {
              <span class="ms__date" [class.is-overdue]="!m.done && m.targetDate < today" [title]="'Target date ' + fmt(m.targetDate)">
                <app-icon name="clock" [size]="12" /> {{ fmt(m.targetDate) }}
              </span>
            }
            <button
              type="button"
              class="btn btn-ghost btn-icon ms__remove"
              [disabled]="busy()"
              [attr.aria-label]="'Remove milestone: ' + m.title"
              title="Remove milestone"
              (click)="remove(m)"
            >
              <app-icon name="x" [size]="16" />
            </button>
          </li>
        }
      </ul>
    }

    <form class="add" novalidate (submit)="add($event)">
      <div class="add__row">
        <input
          class="input add__title"
          type="text"
          name="milestoneTitle"
          autocomplete="off"
          placeholder="Add a milestone…"
          [attr.aria-label]="'New milestone title for ' + card().title"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="error() ? errorId() : null"
          [value]="title()"
          (input)="title.set(value($event)); error.set('')"
        />
        <input
          class="input add__date"
          type="date"
          name="milestoneTargetDate"
          aria-label="Target date (optional)"
          title="Target date (optional)"
          [value]="targetDate()"
          (input)="targetDate.set(value($event))"
        />
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
          <app-icon name="plus" [size]="16" /> Add
        </button>
      </div>
      @if (error()) {
        <p class="add__error" role="alert" [id]="errorId()">{{ error() }}</p>
      } @else if (titleLength() > maxTitle) {
        <p class="add__error" [id]="errorId()">{{ titleLength() }}/{{ maxTitle }} characters</p>
      }
    </form>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .sub-title { display: flex; align-items: baseline; gap: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
    .sub-count { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .empty { font-size: var(--text-sm); color: var(--text-muted); }
    .ms-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    .ms { display: flex; align-items: center; gap: var(--space-2); min-width: 0; padding: 2px var(--space-1); border-radius: var(--radius-md); }
    .ms:hover { background: var(--surface-hover); }
    .ms__main { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-2); cursor: pointer; min-height: 36px; }
    .ms__check { width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--success); cursor: pointer; }
    .ms__title {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: var(--text-sm);
      background: linear-gradient(currentColor, currentColor) no-repeat 0 55% / 0% 1.5px;
      transition: background-size var(--duration-slow) var(--ease-out), color var(--duration-base) var(--ease-standard);
    }
    .ms.is-done .ms__title { background-size: 100% 1.5px; color: var(--text-muted); }
    .ms__date { display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; font-size: var(--text-xs); color: var(--text-muted); }
    .ms__date.is-overdue { color: var(--danger); }
    .ms__remove { width: 32px; min-height: 32px; flex-shrink: 0; }
    .ms__remove:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
    .add { display: flex; flex-direction: column; gap: var(--space-1); }
    .add__row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .add__title { flex: 1 1 160px; min-width: 0; }
    .add__date { flex: 0 1 150px; min-width: 0; }
    .add__error { font-size: var(--text-xs); color: var(--danger); }
  `,
})
export class LearningMilestonesComponent {
  readonly card = input.required<LearningCard>();
  readonly busy = input(false);

  private readonly store = inject(LearningStore);

  protected readonly maxTitle = MILESTONE_TITLE_MAX;
  protected readonly today = todayIso();
  protected readonly title = signal('');
  protected readonly targetDate = signal('');
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly titleLength = computed(() => this.title().trim().length);
  protected readonly headingId = computed(() => `lc-${this.card().id}-ms`);
  protected readonly errorId = computed(() => `lc-${this.card().id}-ms-error`);

  protected fmt(date: string): string {
    return formatDate(date);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected toggle(m: Milestone): void {
    void this.store.toggleMilestone(this.card(), m);
  }

  protected remove(m: Milestone): void {
    void this.store.removeMilestone(this.card(), m);
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) {
      return;
    }
    const message = validateMilestoneTitle(this.title());
    if (message) {
      this.error.set(message);
      return;
    }
    this.saving.set(true);
    try {
      await this.store.addMilestone(this.card(), {
        title: this.title().trim(),
        targetDate: this.targetDate() || null,
      });
      this.title.set('');
      this.targetDate.set('');
      this.error.set('');
    } catch (err) {
      const info = err as ApiErrorInfo;
      this.error.set(Object.values(info.fieldErrors ?? {})[0] ?? info.message);
    } finally {
      this.saving.set(false);
    }
  }
}
