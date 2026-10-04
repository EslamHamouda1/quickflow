import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DashboardLearning } from '../../api';
import { ProgressBarComponent } from '../../shared/ui/progress-bar.component';
import { CountUpComponent } from './count-up.component';

/** Learning snapshot: cards in progress, total and completed milestones, milestones done in the last 7 days. */
@Component({
  selector: 'app-dashboard-learning',
  imports: [CountUpComponent, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="stats">
      <div class="stat" data-stat="in-progress"><dt>Cards in progress</dt><dd><app-count-up [value]="learning().inProgressCount" /></dd></div>
      <div class="stat" data-stat="cards"><dt>Cards total</dt><dd><app-count-up [value]="learning().cardsTotal" /></dd></div>
      <div class="stat" data-stat="last7"><dt>Milestones · last 7 days</dt><dd><app-count-up [value]="learning().milestonesCompletedLast7Days" /></dd></div>
    </dl>
    <div class="milestones">
      <p class="milestones__label">
        <span>Milestones completed</span>
        <span class="milestones__value" data-stat="milestones">{{ learning().milestonesDone }} / {{ learning().milestonesTotal }}</span>
      </p>
      <app-progress-bar [value]="percent()" label="Learning milestones completed" [showValue]="false" />
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-4); }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin: 0; }
    .stat { padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); min-width: 0; }
    .stat dt { color: var(--text-muted); font-size: var(--text-xs); }
    .stat dd { margin: 0; font-size: var(--text-xl); font-weight: var(--weight-bold); }
    .milestones { display: flex; flex-direction: column; gap: var(--space-2); }
    .milestones__label { display: flex; justify-content: space-between; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-muted); }
    .milestones__value { color: var(--text); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; }
    @media (max-width: 420px) { .stats { grid-template-columns: 1fr 1fr; } }
  `,
})
export class DashboardLearningComponent {
  readonly learning = input.required<DashboardLearning>();

  protected readonly percent = computed(() => {
    const l = this.learning();
    return l.milestonesTotal ? Math.round((l.milestonesDone * 100) / l.milestonesTotal) : 0;
  });
}
