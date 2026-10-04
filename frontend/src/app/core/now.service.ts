import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Wall clock as a signal, ticking every second (drives live rest-time displays). */
@Injectable({ providedIn: 'root' })
export class NowService {
  static readonly TICK_MS = 1000;

  private readonly _now = signal(Date.now());
  /** Current time in epoch milliseconds, updated every second. */
  readonly now = this._now.asReadonly();

  constructor() {
    const id = setInterval(() => this._now.set(Date.now()), NowService.TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Current time as a Date (reads the signal, so it is reactive inside computed/effect). */
  date(): Date {
    return new Date(this._now());
  }
}
