import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DefaultView, Settings, SettingsService } from '../api';
import { toApiError } from './api-errors';
import { NotificationService } from './notification.service';

/** Defaults used until the backend answers (mirrors the backend's first-run defaults). */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  displayName: 'Friend',
  inAppNotifications: true,
  browserNotifications: false,
  defaultView: DefaultView.Dashboard,
};

/** Route path of each landing view. */
export const DEFAULT_VIEW_PATHS: Readonly<Record<DefaultView, string>> = {
  [DefaultView.Dashboard]: '/dashboard',
  [DefaultView.Tasks]: '/tasks',
  [DefaultView.Habits]: '/habits',
  [DefaultView.Learning]: '/learning',
  [DefaultView.Plans]: '/plans',
};

/**
 * App-wide settings (US6). Loaded once at startup (`provideAppInitializer`), exposes display name,
 * notification preferences and default view as signals, and pushes the notification preferences
 * into `NotificationService` whenever they are loaded or saved.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(SettingsService);
  private readonly notifications = inject(NotificationService);

  private readonly _settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly settings = this._settings.asReadonly();
  /** True once the backend answered at least once. */
  readonly loaded = this._loaded.asReadonly();
  /** Last load error message (startup falls back to defaults). */
  readonly error = this._error.asReadonly();

  readonly displayName = computed(() => this._settings().displayName);
  readonly inAppNotifications = computed(() => this._settings().inAppNotifications);
  readonly browserNotifications = computed(() => this._settings().browserNotifications);
  readonly defaultView = computed(() => this._settings().defaultView);
  readonly defaultPath = computed(() => DEFAULT_VIEW_PATHS[this._settings().defaultView] ?? '/dashboard');

  /** Loads settings; never rejects so the app still boots (with defaults) when the backend is down. */
  async load(): Promise<void> {
    try {
      const settings = await firstValueFrom(this.api.getSettings());
      this.apply(settings);
      this._loaded.set(true);
      this._error.set(null);
    } catch (err) {
      this._error.set(toApiError(err).message);
      this.apply(this._settings());
    }
  }

  /** Saves settings; rejects with `ApiErrorInfo` (field errors from problem+json). */
  async save(settings: Settings): Promise<Settings> {
    try {
      const saved = await firstValueFrom(this.api.updateSettings(settings));
      this.apply(saved);
      this._loaded.set(true);
      this._error.set(null);
      return saved;
    } catch (err) {
      throw toApiError(err);
    }
  }

  private apply(settings: Settings): void {
    this._settings.set({ ...settings });
    this.notifications.inAppEnabled.set(settings.inAppNotifications);
    this.notifications.browserEnabled.set(settings.browserNotifications);
  }
}

/** Redirects the empty path to the configured landing page (default view). */
export const defaultViewGuard: CanActivateFn = () => {
  const store = inject(SettingsStore);
  return inject(Router).parseUrl(store.defaultPath());
};
