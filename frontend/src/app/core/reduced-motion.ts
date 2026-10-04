import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Signal of the user's `prefers-reduced-motion` preference. Used to skip script-driven
 * motion (count-up numbers, countdown pulse, highlight pulse); CSS motion is already
 * disabled by styles/motion.scss.
 */
@Injectable({ providedIn: 'root' })
export class ReducedMotion {
  private readonly _reduced = signal(false);
  readonly reduced = this._reduced.asReadonly();

  constructor() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(QUERY);
    this._reduced.set(mql.matches);
    const listener = (e: MediaQueryListEvent) => this._reduced.set(e.matches);
    mql.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
  }
}

/** Convenience accessor: `const reduced = injectReducedMotion(); if (reduced()) ...` */
export function injectReducedMotion() {
  return inject(ReducedMotion).reduced;
}
