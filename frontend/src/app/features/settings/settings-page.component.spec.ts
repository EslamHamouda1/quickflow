import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { DefaultView, Settings, SettingsService } from '../../api';
import { NotificationService } from '../../core/notification.service';
import { SettingsStore } from '../../core/settings.store';
import { DEFAULT_VIEW_OPTIONS, SettingsPageComponent, validateSettings } from './settings-page.component';

// T090 — traces US6 AS2 (change display name, in-app / browser notifications, default view → saved with
// toast; validation 1-80 chars; server field errors shown) and AS3 (enabling browser notifications asks for
// permission; denied state shown, switch stays on and in-app still works).

describe('validateSettings', () => {
  it('requires a non-blank display name of at most 80 characters after trim', () => {
    expect(validateSettings({ displayName: 'Sara' })).toEqual({});
    expect(validateSettings({ displayName: '   ' }).displayName).toBe('Display name is required.');
    expect(validateSettings({ displayName: '' }).displayName).toBe('Display name is required.');
    expect(validateSettings({ displayName: ` ${'a'.repeat(80)} ` })).toEqual({});
    expect(validateSettings({ displayName: 'a'.repeat(81) }).displayName).toBe(
      'Display name must be at most 80 characters (currently 81).',
    );
  });

  it('offers all five landing pages', () => {
    expect(DEFAULT_VIEW_OPTIONS.map((o) => o.value)).toEqual(Object.values(DefaultView));
    expect(DEFAULT_VIEW_OPTIONS.map((o) => o.label)).toEqual([
      'Dashboard',
      'Tasks',
      'Habits',
      'Learning Resources',
      'Todo Plans',
    ]);
  });
});

const initial: Settings = {
  displayName: 'Friend',
  inAppNotifications: true,
  browserNotifications: false,
  defaultView: DefaultView.Dashboard,
};

function problem(status: number, body: object): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, error: body, statusText: 'Err' }));
}

describe('SettingsPageComponent', () => {
  let fixture: ComponentFixture<SettingsPageComponent>;
  let el: HTMLElement;
  let api: { getSettings: ReturnType<typeof vi.fn>; updateSettings: ReturnType<typeof vi.fn> };
  let notify: {
    inAppEnabled: ReturnType<typeof signal<boolean>>;
    browserEnabled: ReturnType<typeof signal<boolean>>;
    success: ReturnType<typeof vi.fn>;
    browserPermission: ReturnType<typeof vi.fn>;
    requestBrowserPermission: ReturnType<typeof vi.fn>;
  };
  let permission: NotificationPermission | 'unsupported';

  async function setup(settings: Settings = initial, perm: NotificationPermission | 'unsupported' = 'default') {
    permission = perm;
    api = { getSettings: vi.fn(() => of(settings)), updateSettings: vi.fn((s: Settings) => of({ ...s })) };
    notify = {
      inAppEnabled: signal(true),
      browserEnabled: signal(false),
      success: vi.fn(),
      browserPermission: vi.fn(() => permission),
      requestBrowserPermission: vi.fn(async () => {
        permission = 'denied';
        return permission;
      }),
    };
    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        { provide: SettingsService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    await TestBed.inject(SettingsStore).load();
    fixture = TestBed.createComponent(SettingsPageComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const q = <T extends Element>(sel: string) => el.querySelector(sel) as T;
  const nameInput = () => q<HTMLInputElement>('#settings-display-name');
  const inAppSwitch = () => q<HTMLInputElement>('input[name="inAppNotifications"]');
  const browserSwitch = () => q<HTMLInputElement>('input[name="browserNotifications"]');
  const viewSelect = () => q<HTMLSelectElement>('#settings-default-view');
  const saveBtn = () => q<HTMLButtonElement>('button[type="submit"]');
  const resetBtn = () => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reset')!;

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(value: string) {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input'));
    await render();
  }

  async function toggle(input: HTMLInputElement) {
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
    await render();
  }

  async function select(view: DefaultView) {
    viewSelect().value = view;
    viewSelect().dispatchEvent(new Event('change'));
    await render();
  }

  async function submit() {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await render();
    await render();
  }

  it('renders three sections with the loaded settings', async () => {
    await setup({ displayName: 'Omar', inAppNotifications: false, browserNotifications: true, defaultView: DefaultView.Habits }, 'granted');
    expect([...el.querySelectorAll('h2')].map((h) => h.textContent?.trim())).toEqual(['Profile', 'Notifications', 'Default view']);
    expect(nameInput().value).toBe('Omar');
    expect(inAppSwitch().checked).toBe(false);
    expect(inAppSwitch().getAttribute('role')).toBe('switch');
    expect(browserSwitch().checked).toBe(true);
    expect(viewSelect().value).toBe(DefaultView.Habits);
    expect(viewSelect().options.length).toBe(5);
    expect(el.textContent).toContain('4/80');
    expect(q('#settings-permission').textContent).toContain('Browser permission granted.');
    expect(el.textContent).not.toContain('Unsaved changes');
    expect(resetBtn().disabled).toBe(true);
  });

  it('saves changed name, notifications and default view with a success toast', async () => {
    await setup();
    await type('  Eslam  ');
    await toggle(inAppSwitch());
    await select(DefaultView.Tasks);
    expect(el.textContent).toContain('Unsaved changes');
    expect(resetBtn().disabled).toBe(false);
    await submit();
    expect(api.updateSettings).toHaveBeenCalledWith({
      displayName: 'Eslam',
      inAppNotifications: false,
      browserNotifications: false,
      defaultView: DefaultView.Tasks,
    });
    expect(notify.success).toHaveBeenCalledWith('Settings saved', expect.stringContaining('Eslam'));
    expect(TestBed.inject(SettingsStore).defaultPath()).toBe('/tasks');
    expect(notify.inAppEnabled()).toBe(false);
    expect(el.textContent).not.toContain('Unsaved changes');
  });

  it('blocks save with an empty display name and shows the required message', async () => {
    await setup();
    await type('   ');
    await submit();
    expect(api.updateSettings).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Display name is required.');
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the 81-character message live and blocks save', async () => {
    await setup();
    await type('a'.repeat(81));
    expect(el.textContent).toContain('Display name must be at most 80 characters (currently 81).');
    expect(q('.counter').classList.contains('is-over')).toBe(true);
    await submit();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('accepts exactly 80 characters', async () => {
    await setup();
    await type('a'.repeat(80));
    await submit();
    expect(api.updateSettings).toHaveBeenCalledTimes(1);
  });

  it('maps server field errors to the field and a form message', async () => {
    await setup();
    api.updateSettings.mockReturnValue(
      problem(400, { status: 400, errors: [{ field: 'displayName', message: 'Display name must be 1-80 characters' }] }),
    );
    await type('Bad');
    await submit();
    expect(el.textContent).toContain('Display name must be 1-80 characters');
    expect(el.textContent).toContain('Please fix the highlighted fields.');
    expect(notify.success).not.toHaveBeenCalled();
    await type('Bade');
    expect(el.textContent).not.toContain('Display name must be 1-80 characters');
  });

  it('shows the API message for non-field errors', async () => {
    await setup();
    api.updateSettings.mockReturnValue(problem(500, { status: 500, title: 'Internal Server Error', detail: 'DB down' }));
    await type('X');
    await submit();
    expect(q('[role="alert"]').textContent).toContain('DB down');
  });

  it('turning browser notifications on requests permission and shows the denied state', async () => {
    await setup();
    expect(q('#settings-permission').textContent).toContain('not requested yet');
    await toggle(browserSwitch());
    await render();
    expect(notify.requestBrowserPermission).toHaveBeenCalledTimes(1);
    expect(q('#settings-permission').getAttribute('data-state')).toBe('denied');
    expect(q('#settings-permission').textContent).toContain('in-app notifications still work');
    expect(browserSwitch().checked).toBe(true);
    await submit();
    expect(api.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ browserNotifications: true, inAppNotifications: true }));
  });

  it('does not request permission again when already decided or when turning off', async () => {
    await setup(initial, 'denied');
    await toggle(browserSwitch());
    await toggle(browserSwitch());
    expect(notify.requestBrowserPermission).not.toHaveBeenCalled();
  });

  it('shows the unsupported state', async () => {
    await setup(initial, 'unsupported');
    expect(q('#settings-permission').textContent).toContain('does not support notifications');
  });

  it('reset restores the saved values', async () => {
    await setup();
    await type('Changed');
    await select(DefaultView.Plans);
    resetBtn().click();
    await render();
    expect(nameInput().value).toBe('Friend');
    expect(viewSelect().value).toBe(DefaultView.Dashboard);
    expect(el.textContent).not.toContain('Unsaved changes');
  });

  it('shows the load error banner when settings could not be loaded', async () => {
    permission = 'default';
    api = { getSettings: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 0 }))), updateSettings: vi.fn() };
    notify = {
      inAppEnabled: signal(true),
      browserEnabled: signal(false),
      success: vi.fn(),
      browserPermission: vi.fn(() => 'default'),
      requestBrowserPermission: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        { provide: SettingsService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    await TestBed.inject(SettingsStore).load();
    fixture = TestBed.createComponent(SettingsPageComponent);
    el = fixture.nativeElement;
    await render();
    expect(q('[role="alert"]').textContent).toContain('Could not load settings');
    expect(nameInput().value).toBe('Friend');
  });
});
