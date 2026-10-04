import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Accessible animated progress bar (0–100). */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'clamped()',
    '[attr.aria-valuetext]': 'clamped() + "%"',
    '[attr.aria-label]': 'label()',
    '[class.is-complete]': 'clamped() >= 100',
    '[style.--qf-progress-height]': 'height() + "px"',
  },
  template: `
    <div class="track"><div class="fill" [style.transform]="'scaleX(' + clamped() / 100 + ')'"></div></div>
    @if (showValue()) {
      <span class="value" aria-hidden="true">{{ clamped() }}%</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
    }
    .track {
      position: relative;
      flex: 1;
      height: var(--qf-progress-height, 8px);
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      overflow: hidden;
    }
    .fill {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--primary), var(--accent));
      transform-origin: left center;
      transition: transform var(--duration-slow) var(--ease-out);
    }
    :host(.is-complete) .fill {
      background: var(--success);
    }
    .value {
      min-width: 3.5ch;
      text-align: right;
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class ProgressBarComponent {
  readonly value = input(0);
  readonly label = input('Progress');
  readonly showValue = input(true);
  readonly height = input(8);

  protected readonly clamped = computed(() => {
    const v = Math.round(Number(this.value()) || 0);
    return Math.min(100, Math.max(0, v));
  });
}
