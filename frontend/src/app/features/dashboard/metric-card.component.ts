import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/ui/icon.component';
import { CountUpComponent } from './count-up.component';

/**
 * Summary metric card: icon, label, count-up value (optionally "value / total" or "value%"),
 * caption and an animated progress bar. The whole card links to the feature page.
 */
@Component({
  selector: 'app-metric-card',
  imports: [CountUpComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem', class: 'metric', '[attr.data-metric]': 'key()' },
  template: `
    <a class="link" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
      <span class="icon" aria-hidden="true"><app-icon [name]="icon()" [size]="20" /></span>
      <span class="label">{{ label() }}</span>
      <span class="value" aria-hidden="true">
        <app-count-up [value]="value()" [suffix]="percent() ? '%' : ''" />
        @if (total() !== null) {
          <span class="total">/ <app-count-up [value]="total()!" /></span>
        }
      </span>
      <span class="caption" aria-hidden="true">{{ caption() }}</span>
      @if (progress() !== null) {
        <span class="bar" aria-hidden="true"><span class="fill" [style.transform]="'scaleX(' + ratio() + ')'"></span></span>
      }
    </a>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .link {
      position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: var(--space-1) var(--space-3);
      height: 100%; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg);
      background: var(--surface); box-shadow: var(--shadow-1); color: inherit; text-decoration: none;
      transition: transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base), border-color var(--duration-base);
    }
    .link:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); border-color: var(--border-strong); }
    .link:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .icon { grid-row: span 2; display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--primary-soft); color: var(--primary); }
    :host([data-metric='habits']) .icon { background: var(--success-soft); color: var(--success); }
    :host([data-metric='plans']) .icon { background: var(--info-soft); color: var(--info); }
    :host([data-metric='learning']) .icon { background: var(--warning-soft); color: var(--warning); }
    .label { color: var(--text-muted); font-size: var(--text-sm); font-weight: var(--weight-medium); }
    .value { display: flex; align-items: baseline; gap: var(--space-1); font-size: var(--text-2xl); font-weight: var(--weight-bold); line-height: 1.1; }
    .total { color: var(--text-muted); font-size: var(--text-lg); font-weight: var(--weight-semibold); }
    .caption { grid-column: 1 / -1; color: var(--text-muted); font-size: var(--text-xs); margin-top: var(--space-1); }
    .bar { grid-column: 1 / -1; height: 6px; border-radius: var(--radius-pill); background: var(--surface-2); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--primary); transform-origin: left center; transition: transform var(--duration-slow) var(--ease-out); }
    :host([data-metric='habits']) .fill { background: var(--success); }
    :host([data-metric='plans']) .fill { background: var(--info); }
    :host([data-metric='learning']) .fill { background: var(--warning); }
  `,
})
export class MetricCardComponent {
  readonly key = input.required<string>();
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly link = input.required<string>();
  readonly value = input.required<number>();
  readonly total = input<number | null>(null);
  readonly percent = input(false);
  readonly caption = input('');
  /** 0–100 for the bar, or null for no bar. */
  readonly progress = input<number | null>(null);

  protected readonly ratio = computed(() => Math.min(100, Math.max(0, this.progress() ?? 0)) / 100);
  protected readonly ariaLabel = computed(() => {
    const value = this.percent() ? `${this.value()}%` : `${this.value()}`;
    const total = this.total() !== null ? ` of ${this.total()}` : '';
    return `${this.label()}: ${value}${total}. ${this.caption()}`;
  });
}
