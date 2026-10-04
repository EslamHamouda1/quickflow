import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PlanItem } from '../../api';
import { formatDuration } from '../../core/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProgressBarComponent } from '../../shared/ui/progress-bar.component';
import { srRestText } from '../plans/plan-card.component';
import { sourceIcon } from '../plans/plan-builder-dialog.component';
import { PlanView } from '../plans/plans.store';

export interface DashboardPlanToggle {
  plan: PlanView;
  item: PlanItem;
  done: boolean;
}

/** In-progress plans: live rest-time countdown, animated progress, item toggles in place. */
@Component({
  selector: 'app-dashboard-plans',
  imports: [IconComponent, ProgressBarComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plans().length === 0) {
      <p class="empty">
        <app-icon name="plans" [size]="18" />
        <span>No plan in progress{{ upcoming() ? ' · ' + upcoming() + ' upcoming' : '' }}. <a routerLink="/plans">Open Todo Plans</a></span>
      </p>
    } @else {
      <ul class="list" role="list" aria-label="Plans in progress">
        @for (plan of plans(); track plan.id) {
          <li class="plan" [attr.data-id]="plan.id" [class.is-busy]="busy(plan)" animate.enter="row-enter" animate.leave="row-leave">
            <div class="head">
              <h3 class="title truncate" [title]="plan.title">{{ plan.title }}</h3>
              <span class="rest" [title]="'Time left until ' + plan.endDateTime">
                <app-icon name="clock" [size]="14" />
                <span class="rest__value" aria-live="off" [attr.data-rest-seconds]="plan.restSeconds">{{ rest(plan.restSeconds) }}</span>
                <span class="sr-only">{{ srRest(plan.restSeconds) }}</span>
              </span>
            </div>
            <app-progress-bar [value]="plan.progressPercent" [label]="'Progress of ' + plan.title" [showValue]="true" />
            <ul class="items" role="list" [attr.aria-label]="'Items of ' + plan.title">
              @for (item of plan.items; track item.id) {
                <li class="item" [class.is-done]="item.done">
                  <label class="item__label">
                    <input type="checkbox" [checked]="item.done" [disabled]="busy(plan)" (change)="onToggle(plan, item, $event)" />
                    <app-icon class="item__icon" [name]="icon(item)" [size]="14" />
                    <span class="item__title truncate" [title]="item.sourceTitle">{{ item.sourceTitle }}</span>
                  </label>
                </li>
              }
            </ul>
            <p class="count">{{ plan.itemsDone }} of {{ plan.itemsTotal }} done · priority {{ plan.priorityOrder }}</p>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .list { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
    .plan { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; padding: var(--space-3); border: 1px solid var(--border); border-left: 3px solid var(--info); border-radius: var(--radius-md); background: var(--surface); transition: opacity var(--duration-base); }
    .plan.is-busy { opacity: 0.7; }
    .head { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
    .title { flex: 1; font-size: var(--text-md); font-weight: var(--weight-semibold); }
    .rest { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; padding: 2px var(--space-2); border-radius: var(--radius-pill); background: var(--info-soft); color: var(--info); font-size: var(--text-sm); font-weight: var(--weight-bold); }
    .rest__value { font-variant-numeric: tabular-nums; }
    .items { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    .item__label { display: flex; align-items: center; gap: var(--space-2); min-width: 0; min-height: 32px; cursor: pointer; font-size: var(--text-sm); }
    .item__icon { color: var(--text-muted); }
    .item__title { background: linear-gradient(currentColor, currentColor) left 55% / 0 1px no-repeat; transition: background-size var(--duration-slow) var(--ease-out), color var(--duration-base); }
    .is-done .item__title { background-size: 100% 1px; color: var(--text-muted); }
    .count { color: var(--text-muted); font-size: var(--text-xs); }
    .empty { display: flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-2) 0; }
    .empty a { color: var(--primary); }
    .row-enter { animation: qf-slide-up var(--duration-base) var(--ease-out) both; }
    .row-leave { animation: qf-fade-out var(--duration-fast) var(--ease-in) both; }
  `,
})
export class DashboardPlansComponent {
  readonly plans = input.required<PlanView[]>();
  readonly upcoming = input(0);
  readonly pending = input<ReadonlySet<string>>(new Set());
  readonly toggleItem = output<DashboardPlanToggle>();

  protected readonly rest = formatDuration;
  protected readonly srRest = srRestText;

  protected busy(plan: PlanView): boolean {
    return this.pending().has(`plan:${plan.id}`);
  }

  protected icon(item: PlanItem): string {
    return sourceIcon(item.sourceType);
  }

  protected onToggle(plan: PlanView, item: PlanItem, event: Event): void {
    this.toggleItem.emit({ plan, item, done: (event.target as HTMLInputElement).checked });
  }
}
