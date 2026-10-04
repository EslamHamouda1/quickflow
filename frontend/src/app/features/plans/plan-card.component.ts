import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PlanItem, PlanStatus } from '../../api';
import { formatDuration, formatMinutes } from '../../core/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatDateTime } from '../tasks/task-labels';
import { sourceIcon } from './plan-builder-dialog.component';
import { PlanView } from './plans.store';

const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  [PlanStatus.NotStarted]: 'Not Started',
  [PlanStatus.InProgress]: 'In Progress',
  [PlanStatus.Completed]: 'Completed',
};

const SOURCE_LABELS: Record<string, string> = { TASK: 'Task', HABIT: 'Habit', LEARNING_RESOURCE: 'Learning' };

/** Screen-reader rest time, coarse (5-minute steps above 10 minutes) so it is not re-announced every second. */
export function srRestText(restSeconds: number | null): string {
  if (restSeconds === null) {
    return '';
  }
  const mins = Math.ceil(restSeconds / 60);
  const rounded = mins > 10 ? Math.ceil(mins / 5) * 5 : mins;
  return rounded <= 1 ? 'Less than a minute left' : `About ${formatMinutes(rounded)} left`;
}

export interface PlanItemToggle {
  item: PlanItem;
  done: boolean;
}

/**
 * Plan card: status chip, animated progress ring, live rest-time countdown (In Progress only;
 * visual text `aria-live="off"`, coarse sr-only text), estimated duration, start/end, per-item done
 * toggles with source-type icons and "removed source" label, remove action; pulse highlight on start.
 */
@Component({
  selector: 'app-plan-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    class: 'pcard',
    '[class.is-highlighted]': 'highlighted()',
    '[class.is-busy]': 'busy()',
    '[attr.data-id]': 'plan().id',
    '[attr.data-status]': 'plan().status',
    '[attr.aria-busy]': 'busy() || null',
  },
  template: `
    <div class="head">
      <div class="ring" role="progressbar" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="plan().progressPercent" [attr.aria-label]="'Progress of ' + plan().title">
        <svg viewBox="0 0 56 56" aria-hidden="true">
          <circle class="ring__track" cx="28" cy="28" [attr.r]="r" />
          <circle class="ring__fill" cx="28" cy="28" [attr.r]="r" [attr.stroke-dasharray]="c" [attr.stroke-dashoffset]="dashOffset()" />
        </svg>
        <span class="ring__value" aria-hidden="true">{{ plan().progressPercent }}%</span>
      </div>
      <div class="titles">
        <h3 class="title truncate" [title]="plan().title">{{ plan().title }}</h3>
        <div class="badges">
          <span class="chip status" [attr.data-status]="plan().status">{{ statusLabel() }}</span>
          <span class="chip" [title]="'Priority order ' + plan().priorityOrder + ' (1 = highest)'">P{{ plan().priorityOrder }}</span>
          @if (highlighted()) {
            <span class="chip started" animate.enter="qf-enter-scale"><app-icon name="bolt" [size]="12" /> Just started</span>
          }
        </div>
      </div>
      <button type="button" class="btn btn-ghost btn-icon danger" [disabled]="busy()" [attr.aria-label]="'Remove plan: ' + plan().title" title="Remove plan" (click)="remove.emit(plan())">
        <app-icon name="trash" [size]="18" />
      </button>
    </div>

    @if (plan().restSeconds !== null) {
      <div class="rest">
        <app-icon name="clock" [size]="16" />
        <span class="rest__value" aria-live="off" [attr.data-rest-seconds]="plan().restSeconds">{{ restText() }}</span>
        <span class="rest__label">left</span>
        <span class="sr-only" aria-live="polite" aria-atomic="true">{{ plan().title }}: {{ srRest() }}</span>
      </div>
    } @else if (plan().status === completed) {
      <p class="final">Final {{ plan().progressPercent }}% · {{ plan().itemsDone }} of {{ plan().itemsTotal }} done</p>
    }

    <dl class="meta">
      <div><dt>Estimated</dt><dd>{{ duration() }}</dd></div>
      <div><dt>Start</dt><dd><time [attr.datetime]="plan().startDateTime">{{ fmt(plan().startDateTime) }}</time></dd></div>
      <div><dt>End</dt><dd><time [attr.datetime]="plan().endDateTime">{{ fmt(plan().endDateTime) }}</time></dd></div>
    </dl>

    <ul class="items" [attr.aria-label]="'Items of ' + plan().title">
      @for (item of plan().items; track item.id) {
        <li class="item" [class.is-done]="item.done">
          <label class="item__label">
            <input type="checkbox" [checked]="item.done" [disabled]="busy()" (change)="toggle(item, $event)" />
            <app-icon class="item__icon" [name]="icon(item)" [size]="16" [title]="sourceLabel(item)" />
            <span class="sr-only">{{ sourceLabel(item) }}:</span>
            <span class="item__title truncate" [title]="item.sourceTitle">{{ item.sourceTitle }}</span>
          </label>
          @if (!item.sourceAvailable) {
            <span class="chip removed" title="The source item was deleted; the plan item still counts toward progress.">removed source</span>
          }
        </li>
      }
    </ul>
    <p class="count">{{ plan().itemsDone }} of {{ plan().itemsTotal }} item{{ plan().itemsTotal === 1 ? '' : 's' }} done</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; padding: var(--space-4); border: 1px solid var(--border); border-left: 4px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-1); transition: border-color var(--duration-base) var(--ease-standard), opacity var(--duration-base); }
    :host([data-status='IN_PROGRESS']) { border-left-color: var(--info); }
    :host([data-status='COMPLETED']) { border-left-color: var(--success); }
    :host(.is-busy) { opacity: 0.75; }
    :host(.is-highlighted) { border-color: var(--primary); animation: qf-pulse var(--duration-slow) var(--ease-out) 3; }
    .head { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
    .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .title { font-size: var(--text-md); font-weight: var(--weight-semibold); }
    .badges { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .status[data-status='NOT_STARTED'] { background: var(--surface-hover); }
    .status[data-status='IN_PROGRESS'] { background: var(--info-soft); color: var(--info); }
    .status[data-status='COMPLETED'] { background: var(--success-soft); color: var(--success); }
    .started { background: var(--primary-soft); color: var(--primary); }
    .ring { position: relative; flex-shrink: 0; width: 56px; height: 56px; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 6; }
    .ring__track { stroke: var(--surface-2); }
    .ring__fill { stroke: var(--primary); stroke-linecap: round; transition: stroke-dashoffset var(--duration-slow) var(--ease-out), stroke var(--duration-base); }
    :host([data-status='COMPLETED']) .ring__fill { stroke: var(--success); }
    .ring__value { position: absolute; inset: 0; display: grid; place-items: center; font-size: var(--text-xs); font-weight: var(--weight-bold); font-variant-numeric: tabular-nums; }
    .danger { color: var(--text-muted); }
    .danger:hover { color: var(--danger); }
    .rest { display: flex; align-items: baseline; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--info-soft); color: var(--info); }
    .rest app-icon { align-self: center; }
    .rest__value { font-size: var(--text-lg); font-weight: var(--weight-bold); font-variant-numeric: tabular-nums; }
    .rest__label, .final, .count { font-size: var(--text-sm); }
    .final { color: var(--success); font-weight: var(--weight-semibold); }
    .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin: 0; font-size: var(--text-xs); }
    .meta dt { color: var(--text-muted); }
    .meta dd { margin: 0; font-weight: var(--weight-medium); }
    .items { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
    .item { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
    .item__label { flex: 1; display: flex; align-items: center; gap: var(--space-2); min-width: 0; min-height: 36px; cursor: pointer; }
    .item__icon { flex-shrink: 0; color: var(--text-muted); }
    .item__title { background: linear-gradient(currentColor, currentColor) left 55% / 0 1px no-repeat; transition: background-size var(--duration-slow) var(--ease-out), color var(--duration-base); }
    .is-done .item__title { background-size: 100% 1px; color: var(--text-muted); }
    .removed { flex-shrink: 0; background: var(--warning-soft); color: var(--warning); }
    .count { color: var(--text-muted); }
    @media (max-width: 480px) { .meta { grid-template-columns: 1fr 1fr; } }
  `,
})
export class PlanCardComponent {
  readonly plan = input.required<PlanView>();
  readonly busy = input(false);
  readonly highlighted = input(false);
  readonly toggleItem = output<PlanItemToggle>();
  readonly remove = output<PlanView>();

  protected readonly r = RING_R;
  protected readonly c = RING_C;
  protected readonly completed = PlanStatus.Completed;
  protected readonly fmt = formatDateTime;

  protected readonly statusLabel = computed(() => PLAN_STATUS_LABELS[this.plan().status]);
  protected readonly dashOffset = computed(() => RING_C * (1 - Math.min(100, Math.max(0, this.plan().progressPercent)) / 100));
  protected readonly restText = computed(() => formatDuration(this.plan().restSeconds));
  protected readonly srRest = computed(() => srRestText(this.plan().restSeconds));
  protected readonly duration = computed(() => formatMinutes(this.plan().estimatedDurationMinutes));

  protected icon(item: PlanItem): string {
    return sourceIcon(item.sourceType);
  }

  protected sourceLabel(item: PlanItem): string {
    return SOURCE_LABELS[item.sourceType] ?? item.sourceType;
  }

  protected toggle(item: PlanItem, event: Event): void {
    this.toggleItem.emit({ item, done: (event.target as HTMLInputElement).checked });
  }
}
