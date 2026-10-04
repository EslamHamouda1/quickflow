import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';

import { injectReducedMotion } from '../../core/reduced-motion';

/** Count-up duration; kept at the motion budget (≤ 250 ms) so numbers settle quickly. */
export const COUNT_UP_MS = 250;

/**
 * Animated number: counts from the previously shown value to `value` (ease-out, 250 ms). The animated
 * text is hidden from assistive tech; the final value is exposed via a visually hidden span so screen
 * readers never read intermediate numbers. Under reduced motion the value is shown immediately.
 */
@Component({
  selector: 'app-count-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'count-up', '[attr.data-value]': 'value()' },
  template: `<span aria-hidden="true">{{ shown() }}{{ suffix() }}</span><span class="sr-only">{{ value() }}{{ suffix() }}</span>`,
  styles: `:host { font-variant-numeric: tabular-nums; }`,
})
export class CountUpComponent {
  readonly value = input.required<number>();
  readonly suffix = input('');

  protected readonly shown = signal(0);
  private readonly reduced = injectReducedMotion();
  private frame: number | null = null;

  constructor() {
    effect(() => {
      const target = this.value();
      untracked(() => this.animateTo(target));
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  private animateTo(target: number): void {
    this.cancel();
    const from = this.shown();
    if (from === target || this.reduced() || typeof requestAnimationFrame !== 'function') {
      this.shown.set(target);
      return;
    }
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      this.shown.set(Math.round(from + (target - from) * eased));
      this.frame = p < 1 ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private cancel(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }
}
