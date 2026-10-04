import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { DefaultView, Settings, SettingsService } from '../api';
import { NotificationService } from './notification.service';
import { DEFAULT_SETTINGS, DEFAULT_VIEW_PATHS, SettingsStore, defaultViewGuard } from './settings.store';

// T090 — traces US6 AS2 (preferences loaded, saved and applied: display name, notification prefs pushed
// into NotificationService, default view → landing page guard) and AS3 (browser pref independent of in-app).

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

const saved: Settings = {
  displayName: 'Sara',
  inAppNotifications: false,
  browserNotifications: true,
  defaultView: DefaultView.Tasks,
};

describe('SettingsStore', () => {
  let api: { getSettings: ReturnType<typeof vi.fn>; updateSettings: ReturnType<typeof vi.fn> };
  let notify: { inAppEnabled: ReturnType<typeof signal<boolean>>; browserEnabled: ReturnType<typeof signal<boolean>> };
  let store: SettingsStore;

  beforeEach(() => {
    api = { getSettings: vi.fn(() => of(saved)), updateSettings: vi.fn((s: Settings) => of({ ...s })) };
    notify = { inAppEnabled: signal(true), browserEnabled: signal(false) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SettingsService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    store = TestBed.inject(SettingsStore);
  });

  it('starts with defaults before load', () => {
    expect(store.settings()).toEqual(DEFAULT_SETTINGS);
    expect(store.displayName()).toBe('Friend');
    expect(store.inAppNotifications()).toBe(true);
    expect(store.browserNotifications()).toBe(false);
    expect(store.defaultView()).toBe(DefaultView.Dashboard);
    expect(store.defaultPath()).toBe('/dashboard');
    expect(store.loaded()).toBe(false);
  });

  it('load() exposes backend values and pushes notification prefs', async () => {
    await store.load();
    expect(api.getSettings).toHaveBeenCalledTimes(1);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
    expect(store.displayName()).toBe('Sara');
    expect(store.defaultView()).toBe(DefaultView.Tasks);
    expect(store.defaultPath()).toBe('/tasks');
    expect(notify.inAppEnabled()).toBe(false);
    expect(notify.browserEnabled()).toBe(true);
  });

  it('load() never rejects and keeps defaults when the backend is down', async () => {
    api.getSettings.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await expect(store.load()).resolves.toBeUndefined();
    expect(store.loaded()).toBe(false);
    expect(store.error()).toContain('Cannot reach the server');
    expect(store.settings()).toEqual(DEFAULT_SETTINGS);
    expect(notify.inAppEnabled()).toBe(true);
    expect(notify.browserEnabled()).toBe(false);
  });

  it('a later successful load clears the error', async () => {
    api.getSettings.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Boom' })));
    await store.load();
    expect(store.error()).toBeTruthy();
    await store.load();
    expect(store.error()).toBeNull();
    expect(store.loaded()).toBe(true);
  });

  it('save() sends the full body, applies the response and pushes prefs', async () => {
    api.updateSettings.mockReturnValue(of({ ...saved, displayName: 'Sara' }));
    const result = await store.save({ ...saved, displayName: 'Sara' });
    expect(api.updateSettings).toHaveBeenCalledWith({ ...saved, displayName: 'Sara' });
    expect(result).toEqual(saved);
    expect(store.settings()).toEqual(saved);
    expect(store.loaded()).toBe(true);
    expect(notify.inAppEnabled()).toBe(false);
    expect(notify.browserEnabled()).toBe(true);
  });

  it('save() rejects with field errors from problem+json and keeps the previous settings', async () => {
    await store.load();
    api.updateSettings.mockReturnValue(
      problem(400, {
        status: 400,
        title: 'Bad Request',
        errors: [{ field: 'displayName', message: 'Display name must be 1-80 characters' }],
      }),
    );
    await expect(store.save({ ...saved, displayName: 'x'.repeat(81) })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { displayName: 'Display name must be 1-80 characters' },
    });
    expect(store.displayName()).toBe('Sara');
  });

  it('maps every default view to its route', async () => {
    for (const view of Object.values(DefaultView)) {
      api.getSettings.mockReturnValue(of({ ...saved, defaultView: view }));
      await store.load();
      expect(store.defaultPath()).toBe(DEFAULT_VIEW_PATHS[view]);
    }
    expect(DEFAULT_VIEW_PATHS).toEqual({
      DASHBOARD: '/dashboard',
      TASKS: '/tasks',
      HABITS: '/habits',
      LEARNING: '/learning',
      PLANS: '/plans',
    });
  });

  it('defaultViewGuard redirects "" to the configured landing page', async () => {
    const run = () =>
      TestBed.runInInjectionContext(() =>
        defaultViewGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ) as UrlTree;
    expect(run().toString()).toBe('/dashboard');
    api.getSettings.mockReturnValue(of({ ...saved, defaultView: DefaultView.Plans }));
    await store.load();
    expect(run()).toBeInstanceOf(UrlTree);
    expect(run().toString()).toBe('/plans');
    await store.save({ ...saved, defaultView: DefaultView.Habits });
    expect(run().toString()).toBe('/habits');
  });
});
