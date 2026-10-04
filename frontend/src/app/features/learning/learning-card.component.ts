import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { LearningCard } from '../../api';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProgressBarComponent } from '../../shared/ui/progress-bar.component';
import { formatDateTime } from '../tasks/task-labels';
import { learningStatusLabel } from './learning-card-form-dialog.component';
import { LearningMilestonesComponent } from './learning-milestones.component';
import { LearningNotesComponent } from './learning-notes.component';

/**
 * Learning card: status chip, progress bar, expand/collapse (height animation, `aria-expanded`)
 * revealing the full title/description, milestones and notes; edit and remove actions.
 */
@Component({
  selector: 'app-learning-card',
  imports: [IconComponent, ProgressBarComponent, LearningMilestonesComponent, LearningNotesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    class: 'lcard',
    '[class.is-expanded]': 'expanded()',
    '[class.is-busy]': 'busy()',
    '[attr.data-id]': 'card().id',
    '[attr.data-status]': 'card().status',
    '[attr.aria-busy]': 'busy() || null',
  },
  template: `
    <div class="lcard__head">
      <div class="lcard__title-block">
        <h3 class="lcard__title truncate" [title]="card().title" [id]="titleId()">{{ card().title }}</h3>
        <span class="chip status" [attr.data-status]="card().status">{{ statusLabel() }}</span>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-icon expand"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="bodyId()"
        [attr.aria-label]="(expanded() ? 'Collapse ' : 'Expand ') + card().title"
        [title]="expanded() ? 'Collapse' : 'Show milestones and notes'"
        (click)="toggle()"
      >
        <app-icon name="chevron" [size]="20" />
      </button>
    </div>

    @if (card().description && !expanded()) {
      <p class="lcard__desc line-clamp-2" [title]="card().description">{{ card().description }}</p>
    }

    <div class="lcard__progress">
      <app-progress-bar [value]="card().progressPercent" [label]="'Progress of ' + card().title" />
      <span class="meta-text">
        {{ card().milestonesDone }} of {{ card().milestonesTotal }} milestone{{ card().milestonesTotal === 1 ? '' : 's' }}
        · {{ card().notes.length }} note{{ card().notes.length === 1 ? '' : 's' }}
      </span>
    </div>

    <div class="lcard__body" [id]="bodyId()" role="region" [attr.aria-labelledby]="titleId()" [inert]="!expanded()">
      <div class="lcard__body-inner">
        @if (rendered()) {
          @if (card().title.length > 40 || card().description) {
            <div class="lcard__full">
              @if (card().title.length > 40) {
                <p class="lcard__full-title">{{ card().title }}</p>
              }
              @if (card().description) {
                <p class="lcard__full-desc">{{ card().description }}</p>
              }
            </div>
          }
          <app-learning-milestones [card]="card()" [busy]="busy()" />
          <app-learning-notes [card]="card()" [busy]="busy()" />
        }
      </div>
    </div>

    <footer class="lcard__foot">
      <span class="meta-text">Added {{ created() }}</span>
      <div class="lcard__actions">
        <button type="button" class="btn btn-ghost btn-icon" [disabled]="busy()" [attr.aria-label]="'Edit learning card: ' + card().title" title="Edit" (click)="edit.emit(card())">
          <app-icon name="edit" [size]="18" />
        </button>
        <button type="button" class="btn btn-ghost btn-icon danger" [disabled]="busy()" [attr.aria-label]="'Remove learning card: ' + card().title" title="Remove" (click)="remove.emit(card())">
          <app-icon name="trash" [size]="18" />
        </button>
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-width: 0;
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-top: 4px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-1);
      transition: border-color var(--duration-base) var(--ease-standard), opacity var(--duration-base) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard);
    }
    :host(:hover) { box-shadow: var(--shadow-2); }
    :host([data-status='IN_PROGRESS']) { border-top-color: var(--info); }
    :host([data-status='COMPLETED']) { border-top-color: var(--success); }
    :host(.is-busy) { opacity: 0.75; }
    .lcard__head { display: flex; align-items: flex-start; gap: var(--space-2); min-width: 0; }
    .lcard__title-block { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); }
    .lcard__title { max-width: 100%; font-size: var(--text-md); font-weight: var(--weight-semibold); }
    .status { transition: background-color var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard); }
    .status[data-status='NOT_STARTED'] { background: var(--surface-hover); color: var(--text-muted); }
    .status[data-status='IN_PROGRESS'] { background: var(--info-soft); color: var(--info); }
    .status[data-status='COMPLETED'] { background: var(--success-soft); color: var(--success); }
    .expand app-icon { transition: transform var(--duration-base) var(--ease-out); }
    :host(.is-expanded) .expand app-icon { transform: rotate(180deg); }
    .lcard__desc { color: var(--text-muted); font-size: var(--text-sm); }
    .lcard__progress { display: flex; flex-direction: column; gap: var(--space-1); }
    .lcard__body {
      display: grid;
      grid-template-rows: 0fr;
      margin-top: calc(-1 * var(--space-3));
      transition: grid-template-rows var(--duration-slow) var(--ease-out), margin-top var(--duration-slow) var(--ease-out);
    }
    :host(.is-expanded) .lcard__body { grid-template-rows: 1fr; margin-top: 0; }
    .lcard__body-inner { min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: var(--space-4); }
    .lcard__full { display: flex; flex-direction: column; gap: var(--space-1); }
    .lcard__full-title { font-weight: var(--weight-medium); overflow-wrap: anywhere; }
    .lcard__full-desc { font-size: var(--text-sm); color: var(--text-muted); white-space: pre-wrap; overflow-wrap: anywhere; }
    .lcard__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--border);
    }
    .meta-text { font-size: var(--text-xs); color: var(--text-muted); min-width: 0; }
    .lcard__actions { display: flex; flex-shrink: 0; gap: var(--space-1); }
    .lcard__actions .btn-icon { width: 36px; min-height: 36px; }
    .lcard__actions .danger:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
  `,
})
export class LearningCardComponent {
  readonly card = input.required<LearningCard>();
  readonly busy = input(false);

  readonly edit = output<LearningCard>();
  readonly remove = output<LearningCard>();

  readonly expanded = signal(false);
  /** Body content is created on first expand and kept so collapsing can animate. */
  protected readonly rendered = signal(false);

  protected readonly statusLabel = computed(() => learningStatusLabel(this.card().status));
  protected readonly created = computed(() => formatDateTime(this.card().createdAt));
  protected readonly bodyId = computed(() => `lc-${this.card().id}-body`);
  protected readonly titleId = computed(() => `lc-${this.card().id}-title`);

  toggle(): void {
    this.rendered.set(true);
    this.expanded.update((v) => !v);
  }
}
