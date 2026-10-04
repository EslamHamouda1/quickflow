import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { LearningCard, Note } from '../../api';
import { ApiErrorInfo } from '../../core/api-errors';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatDateTime } from '../tasks/task-labels';
import { LearningStore } from './learning.store';

export const NOTE_MAX = 5000;

/** Client validation of a new note: non-blank, ≤ 5,000 characters. */
export function validateNote(text: string): string {
  if (!text.trim()) {
    return 'Note text is required.';
  }
  return text.length > NOTE_MAX
    ? `Note must be at most 5,000 characters (currently ${text.length.toLocaleString('en-US')}).`
    : '';
}

/** Notes of an expanded learning card (newest first): add textarea, timestamp, remove. */
@Component({
  selector: 'app-learning-notes',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h4 class="sub-title" [id]="headingId()">
      Notes <span class="sub-count">{{ card().notes.length }}</span>
    </h4>

    <form class="add" novalidate (submit)="add($event)">
      <textarea
        class="textarea add__text"
        name="noteText"
        rows="2"
        placeholder="Write a note…"
        [attr.aria-label]="'New note for ' + card().title"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="errorId()"
        [value]="text()"
        (input)="text.set(value($event)); error.set('')"
        (keydown.control.enter)="add($event)"
        (keydown.meta.enter)="add($event)"
      ></textarea>
      <div class="add__foot">
        <span class="add__hint" [class.is-over]="text().length > max" [id]="errorId()" [attr.role]="error() ? 'alert' : null">
          {{ error() || text().length.toLocaleString('en-US') + ' / 5,000 · Ctrl+Enter to add' }}
        </span>
        <button type="submit" class="btn btn-sm" [disabled]="saving()">
          <app-icon name="plus" [size]="16" /> Add note
        </button>
      </div>
    </form>

    @if (card().notes.length === 0) {
      <p class="empty">No notes yet.</p>
    } @else {
      <ul class="note-list" [attr.aria-labelledby]="headingId()">
        @for (n of card().notes; track n.id) {
          <li class="note" animate.enter="qf-enter-slide" animate.leave="qf-leave-fade">
            <p class="note__text">{{ n.text }}</p>
            <div class="note__foot">
              <time class="note__time" [attr.datetime]="n.createdAt">{{ fmt(n.createdAt) }}</time>
              <button
                type="button"
                class="btn btn-ghost btn-icon note__remove"
                [disabled]="busy()"
                aria-label="Remove note"
                [title]="'Remove note from ' + fmt(n.createdAt)"
                (click)="remove(n)"
              >
                <app-icon name="trash" [size]="14" />
              </button>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .sub-title { display: flex; align-items: baseline; gap: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
    .sub-count { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .empty { font-size: var(--text-sm); color: var(--text-muted); }
    .add { display: flex; flex-direction: column; gap: var(--space-1); }
    .add__text { min-height: 64px; }
    .add__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .add__hint { font-size: var(--text-xs); color: var(--text-muted); min-width: 0; }
    .add__hint.is-over, .add__text[aria-invalid='true'] + .add__foot .add__hint { color: var(--danger); }
    .note-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .note { padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); border-left: 3px solid var(--accent); }
    .note__text { font-size: var(--text-sm); white-space: pre-wrap; overflow-wrap: anywhere; }
    .note__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-1); }
    .note__time { font-size: var(--text-xs); color: var(--text-muted); }
    .note__remove { width: 28px; min-height: 28px; }
    .note__remove:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
  `,
})
export class LearningNotesComponent {
  readonly card = input.required<LearningCard>();
  readonly busy = input(false);

  private readonly store = inject(LearningStore);

  protected readonly max = NOTE_MAX;
  protected readonly text = signal('');
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly headingId = computed(() => `lc-${this.card().id}-notes`);
  protected readonly errorId = computed(() => `lc-${this.card().id}-note-hint`);

  protected fmt(iso: string): string {
    return formatDateTime(iso);
  }

  protected value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected remove(n: Note): void {
    void this.store.removeNote(this.card(), n.id);
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) {
      return;
    }
    const message = validateNote(this.text());
    if (message) {
      this.error.set(message);
      return;
    }
    this.saving.set(true);
    try {
      await this.store.addNote(this.card(), this.text());
      this.text.set('');
      this.error.set('');
    } catch (err) {
      const info = err as ApiErrorInfo;
      this.error.set(Object.values(info.fieldErrors ?? {})[0] ?? info.message);
    } finally {
      this.saving.set(false);
    }
  }
}
