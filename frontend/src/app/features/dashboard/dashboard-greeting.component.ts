import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { NowService } from '../../core/now.service';

/** Time-of-day greeting for a local hour (0–23). */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  if (hour >= 17 && hour < 22) {
    return 'Good evening';
  }
  return 'Good night';
}

/** Long local date for an ISO `yyyy-MM-dd` day (no time-zone shift), e.g. "Saturday, October 3, 2026". */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** Dashboard header: the page's h1 with a time-of-day greeting + display name, and today's date. */
@Component({
  selector: 'app-dashboard-greeting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text">
      <p class="eyebrow">
        <time [attr.datetime]="today()">{{ dateText() }}</time>
      </p>
      <h1 class="title">{{ greeting() }}, <span class="name truncate" [title]="name()">{{ name() }}</span></h1>
      <p class="subtitle">Here is your day at a glance.</p>
    </div>
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-6); }
    .text { min-width: 0; max-width: 100%; }
    .eyebrow { color: var(--text-muted); font-size: var(--text-sm); font-weight: var(--weight-medium); }
    .title { display: flex; flex-wrap: wrap; gap: 0 0.3em; font-size: var(--text-2xl); font-weight: var(--weight-bold); letter-spacing: -0.01em; }
    .name { max-width: 100%; color: var(--primary); }
    .subtitle { color: var(--text-muted); margin-top: var(--space-1); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .actions:empty { display: none; }
  `,
})
export class DashboardGreetingComponent {
  readonly name = input.required<string>();
  /** Server's "today" (`yyyy-MM-dd`); falls back to the local date. */
  readonly today = input<string | null>(null);

  private readonly clock = inject(NowService);

  protected readonly greeting = computed(() => greetingFor(this.clock.date().getHours()));
  protected readonly dateText = computed(() => {
    const iso = this.today();
    return iso ? formatLongDate(iso) : this.clock.date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  });
}
