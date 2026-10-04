import { Injectable, signal } from '@angular/core';

/** Global data version: bumped after every successful mutation so dependent views reload. */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly _version = signal(0);
  readonly version = this._version.asReadonly();

  bump(): void {
    this._version.update((v) => v + 1);
  }
}
