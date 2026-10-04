import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { PlanStartWatcher } from '../../core/plan-start-watcher.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PlanBuilderDialogComponent } from './plan-builder-dialog.component';
import { PlanCardComponent, PlanItemToggle } from './plan-card.component';
import { PlanView, PlansStore } from './plans.store';

/** Todo Plans page (US4): "Active & upcoming" (priority, then start) and "History" groups, plan builder, remove. */
@Component({
  selector: 'app-plans-page',
  imports: [EmptyStateComponent, IconComponent, PageHeaderComponent, PlanBuilderDialogComponent, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header heading="Todo Plans" subtitle="Time-boxed plans built from your tasks, habits and learning">
      <button type="button" class="btn btn-primary" (click)="builderOpen.set(true)"><app-icon name="plus" [size]="18" /> Create Plan</button>
    </app-page-header>

    @if (!store.loaded()) {
      <div class="grid" aria-busy="true" aria-label="Loading plans">
        @for (i of [1, 2]; track i) {
          <div class="skeleton skeleton-card"></div>
        }
      </div>
    } @else if (store.error() && store.plans().length === 0) {
      <app-empty-state icon="error" heading="Could not load plans" [message]="store.error()!">
        <button type="button" class="btn" (click)="store.load()"><app-icon name="restore" [size]="16" /> Retry</button>
      </app-empty-state>
    } @else if (store.plans().length === 0) {
      <app-empty-state
        icon="plans"
        heading="No plans yet"
        message="Build a time-boxed plan from your existing tasks, habits and learning cards, then watch the clock."
        actionLabel="Create Plan"
        (action)="builderOpen.set(true)"
      />
    } @else {
      <section class="section" aria-labelledby="plans-active-heading">
        <div class="section__head">
          <h2 id="plans-active-heading" class="section__title">Active &amp; upcoming</h2>
          <span class="section__count">{{ activeSummary() }}</span>
          @if (store.loading()) {
            <span class="section__loading" role="status" aria-label="Updating plans"></span>
          }
        </div>
        @if (store.active().length === 0) {
          <p class="section__empty">Nothing scheduled. Create a plan to start a new time box.</p>
        } @else {
          <div class="grid" role="list" aria-label="Active and upcoming plans">
            @for (plan of store.active(); track plan.id) {
              <app-plan-card
                animate.enter="pcard-enter"
                animate.leave="pcard-leave"
                [plan]="plan"
                [busy]="store.pending().has(plan.id)"
                [highlighted]="watcher.highlighted().has(plan.id)"
                (toggleItem)="toggle(plan, $event)"
                (remove)="confirmRemove($event)"
              />
            }
          </div>
        }
      </section>

      @if (store.history().length > 0) {
        <section class="section" aria-labelledby="plans-history-heading">
          <div class="section__head">
            <h2 id="plans-history-heading" class="section__title">History</h2>
            <span class="section__count">{{ store.history().length }} completed</span>
          </div>
          <div class="grid" role="list" aria-label="Completed plans">
            @for (plan of store.history(); track plan.id) {
              <app-plan-card
                animate.enter="pcard-enter"
                animate.leave="pcard-leave"
                [plan]="plan"
                [busy]="store.pending().has(plan.id)"
                (toggleItem)="toggle(plan, $event)"
                (remove)="confirmRemove($event)"
              />
            }
          </div>
        </section>
      }
    }

    @if (builderOpen()) {
      <app-plan-builder-dialog (closed)="builderOpen.set(false)" />
    }
  `,
  styles: `
    :host { display: block; }
    .section + .section { margin-top: var(--space-8); }
    .section__head { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-3); }
    .section__title { font-size: var(--text-lg); }
    .section__count, .section__empty { color: var(--text-muted); font-size: var(--text-sm); }
    .section__loading { width: 14px; height: 14px; align-self: center; border: 2px solid var(--primary); border-right-color: transparent; border-radius: 50%; animation: spin var(--duration-slow) linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); align-items: start; gap: var(--space-4); }
    .skeleton-card { height: 220px; border-radius: var(--radius-lg); }
    .grid ::ng-deep .pcard-enter { animation: qf-scale-in var(--duration-base) var(--ease-out) both; }
    .grid ::ng-deep .pcard-leave { animation: qf-scale-out var(--duration-base) var(--ease-in) both; }
  `,
})
export class PlansPageComponent {
  protected readonly store = inject(PlansStore);
  protected readonly watcher = inject(PlanStartWatcher);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  /** `?new=1` (dashboard quick-add) opens the plan builder. */
  readonly newParam = input<string | undefined>(undefined, { alias: 'new' });

  protected readonly builderOpen = signal(false);

  protected readonly activeSummary = computed(() => {
    const total = this.store.active().length;
    return `${total} plan${total === 1 ? '' : 's'} · ${this.store.inProgressCount()} in progress`;
  });

  constructor() {
    this.watcher.start();
    // Fresh data whenever the page is opened (polling continues in the background).
    if (this.store.loaded()) {
      void this.store.load();
    }
    effect(() => {
      if (this.newParam()) {
        untracked(() => {
          this.builderOpen.set(true);
          void this.router.navigate([], { queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
        });
      }
    });
  }

  protected toggle(plan: PlanView, event: PlanItemToggle): void {
    void this.store.setItemDone(plan, event.item, event.done);
  }

  protected async confirmRemove(plan: PlanView): Promise<void> {
    const title = plan.title.length > 80 ? `${plan.title.slice(0, 79)}…` : plan.title;
    const ok = await this.confirm.confirm({
      title: 'Remove plan?',
      message: `"${title}" and its ${plan.itemsTotal} item(s) will be permanently deleted. The source tasks, habits and learning cards are not affected.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) {
      await this.store.remove(plan);
    }
  }
}
