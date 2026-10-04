import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';

import { DefaultView, Settings } from '../../api';
import { ApiErrorInfo } from '../../core/api-errors';
import { NotificationService } from '../../core/notification.service';
import { SettingsStore } from '../../core/settings.store';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

export const DISPLAY_NAME_MAX = 80;

type FieldName = 'displayName' | 'inAppNotifications' | 'browserNotifications' | 'defaultView';
const FIELDS: readonly FieldName[] = ['displayName', 'inAppNotifications', 'browserNotifications', 'defaultView'];

export const DEFAULT_VIEW_OPTIONS: readonly { value: DefaultView; label: string }[] = [
  { value: DefaultView.Dashboard, label: 'Dashboard' },
  { value: DefaultView.Tasks, label: 'Tasks' },
  { value: DefaultView.Habits, label: 'Habits' },
  { value: DefaultView.Learning, label: 'Learning Resources' },
  { value: DefaultView.Plans, label: 'Todo Plans' },
];

type Permission = NotificationPermission | 'unsupported';

/** Client-side validation of the settings form. */
export function validateSettings(value: { displayName: string }): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const name = value.displayName.trim();
  if (!name) {
    errors.displayName = 'Display name is required.';
  } else if (name.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Display name must be at most ${DISPLAY_NAME_MAX} characters (currently ${name.length}).`;
  }
  return errors;
}

/**
 * Settings page (US6): profile (display name 1–80), notifications (in-app on/off, browser on/off
 * with permission request and denied state) and default landing view. Saves via the generated
 * `SettingsService` (through `SettingsStore`) and confirms with a toast.
 */
@Component({
  selector: 'app-settings-page',
  imports: [FormFieldComponent, IconComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header heading="Settings" subtitle="Profile and application preferences" />

    @if (store.error() && !store.loaded()) {
      <p class="alert" role="alert">
        <app-icon name="alert" [size]="16" /> Could not load settings: {{ store.error() }} Showing defaults.
      </p>
    }

    <form class="settings" novalidate (submit)="submit($event)" aria-label="Settings">
      @if (formError()) {
        <p class="alert" role="alert" animate.enter="qf-enter-fade">
          <app-icon name="alert" [size]="16" /> {{ formError() }}
        </p>
      }

      <section class="card section" aria-labelledby="settings-profile">
        <h2 id="settings-profile" class="section__title">Profile</h2>
        <p class="section__desc">How QuickFlow greets you on the dashboard.</p>
        <app-form-field label="Display name" forId="settings-display-name" [required]="true" [error]="shownError('displayName')">
          <span fieldCounter class="counter" [class.is-over]="nameLength() > nameMax" aria-hidden="true">
            {{ nameLength() }}/{{ nameMax }}
          </span>
          <input
            id="settings-display-name"
            name="displayName"
            class="input"
            type="text"
            autocomplete="nickname"
            aria-required="true"
            [value]="displayName()"
            (input)="displayName.set(inputValue($event)); clearServerError('displayName')"
            (blur)="touch('displayName')"
          />
        </app-form-field>
      </section>

      <section class="card section" aria-labelledby="settings-notifications">
        <h2 id="settings-notifications" class="section__title">Notifications</h2>
        <p class="section__desc">Used when a Todo Plan starts.</p>

        <label class="toggle">
          <span class="toggle__text">
            <span class="toggle__label" id="settings-inapp-label">In-app notifications</span>
            <span class="toggle__hint" id="settings-inapp-hint">Show a toast inside QuickFlow.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            class="toggle__input"
            name="inAppNotifications"
            aria-labelledby="settings-inapp-label"
            aria-describedby="settings-inapp-hint"
            [checked]="inApp()"
            (change)="inApp.set(checked($event)); clearServerError('inAppNotifications')"
          />
          <span class="toggle__track" aria-hidden="true"><span class="toggle__thumb"></span></span>
        </label>

        <label class="toggle">
          <span class="toggle__text">
            <span class="toggle__label" id="settings-browser-label">Browser notifications</span>
            <span class="toggle__hint" id="settings-browser-hint">System notifications; your browser asks for permission.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            class="toggle__input"
            name="browserNotifications"
            aria-labelledby="settings-browser-label"
            aria-describedby="settings-browser-hint settings-permission"
            [checked]="browser()"
            [disabled]="requesting()"
            (change)="onBrowserToggle($event)"
          />
          <span class="toggle__track" aria-hidden="true"><span class="toggle__thumb"></span></span>
        </label>
        <p id="settings-permission" class="permission" [attr.data-state]="permissionState()" aria-live="polite">
          @switch (permissionState()) {
            @case ('granted') { <app-icon name="success" [size]="14" /> Browser permission granted. }
            @case ('denied') {
              <app-icon name="alert" [size]="14" />
              Browser permission denied — system notifications are blocked; in-app notifications still work.
              Allow notifications for this site in your browser settings to enable them.
            }
            @case ('unsupported') { <app-icon name="info" [size]="14" /> This browser does not support notifications. }
            @default { <app-icon name="info" [size]="14" /> Browser permission not requested yet. }
          }
        </p>
      </section>

      <section class="card section" aria-labelledby="settings-view">
        <h2 id="settings-view" class="section__title">Default view</h2>
        <p class="section__desc">The page QuickFlow opens on.</p>
        <app-form-field label="Landing page" forId="settings-default-view" [error]="shownError('defaultView')">
          <select
            id="settings-default-view"
            name="defaultView"
            class="select"
            [value]="defaultView()"
            (change)="defaultView.set(selectValue($event)); clearServerError('defaultView')"
          >
            @for (o of viewOptions; track o.value) {
              <option [value]="o.value" [selected]="o.value === defaultView()">{{ o.label }}</option>
            }
          </select>
        </app-form-field>
      </section>

      <footer class="actions">
        @if (dirty()) {
          <span class="actions__status" animate.enter="qf-enter-fade">Unsaved changes</span>
        }
        <button type="button" class="btn" [disabled]="!dirty() || saving()" (click)="reset()">Reset</button>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner" aria-hidden="true"></span> Saving…
          } @else {
            <app-icon name="check" [size]="18" /> Save settings
          }
        </button>
      </footer>
    </form>
  `,
  styles: `
    :host { display: block; }
    .settings { display: flex; flex-direction: column; gap: var(--space-4); max-width: 640px; }
    .section { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); animation: qf-slide-up var(--duration-base) var(--ease-out) both; }
    .section__title { font-size: var(--text-lg); font-weight: var(--weight-semibold); }
    .section__desc { margin-top: calc(-1 * var(--space-2)); font-size: var(--text-sm); color: var(--text-muted); }
    .alert {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      margin-bottom: var(--space-4);
      border-radius: var(--radius-md);
      background: var(--danger-soft);
      color: var(--danger);
      font-size: var(--text-sm);
    }
    .settings .alert { margin-bottom: 0; }
    .counter { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .counter.is-over { color: var(--danger); font-weight: var(--weight-semibold); }

    .toggle {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-2) 0;
      cursor: pointer;
    }
    .toggle__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .toggle__label { font-size: var(--text-sm); font-weight: var(--weight-medium); }
    .toggle__hint { font-size: var(--text-xs); color: var(--text-muted); }
    .toggle__input { position: absolute; z-index: 1; opacity: 0; width: 44px; height: 24px; right: 0; margin: 0; cursor: pointer; }
    .toggle__input:disabled { cursor: progress; }
    .toggle__track {
      flex: none;
      position: relative;
      width: 44px;
      height: 24px;
      border-radius: var(--radius-pill);
      background: var(--border-strong);
      pointer-events: none;
      transition: background-color var(--duration-base) var(--ease-standard);
    }
    .toggle__thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--bg-elevated);
      box-shadow: var(--shadow-1);
      transition: transform var(--duration-base) var(--ease-spring);
    }
    .toggle__input:checked + .toggle__track { background: var(--primary); }
    .toggle__input:checked + .toggle__track .toggle__thumb { transform: translateX(20px); }
    .toggle__input:focus-visible + .toggle__track { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .toggle__input:disabled + .toggle__track { opacity: 0.6; }

    .permission { display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted); }
    .permission[data-state='granted'] { color: var(--success); }
    .permission[data-state='denied'] {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      background: var(--warning-soft);
      color: var(--text);
    }
    .permission .app-icon { flex: none; margin-top: 1px; }

    .actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
    .actions__status { margin-right: auto; font-size: var(--text-sm); color: var(--text-muted); }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin var(--duration-slow) linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class SettingsPageComponent {
  protected readonly store = inject(SettingsStore);
  private readonly notify = inject(NotificationService);
  private readonly injector = inject(Injector);

  protected readonly nameMax = DISPLAY_NAME_MAX;
  protected readonly viewOptions = DEFAULT_VIEW_OPTIONS;

  protected readonly displayName = signal(this.store.displayName());
  protected readonly inApp = signal(this.store.inAppNotifications());
  protected readonly browser = signal(this.store.browserNotifications());
  protected readonly defaultView = signal<DefaultView>(this.store.defaultView());

  protected readonly permission = signal<Permission>(this.notify.browserPermission());
  protected readonly requesting = signal(false);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<ReadonlySet<FieldName>>(new Set());
  protected readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly nameLength = computed(() => this.displayName().trim().length);
  protected readonly clientErrors = computed(() => validateSettings({ displayName: this.displayName() }));
  protected readonly permissionState = computed(() => this.permission());

  protected readonly value = computed<Settings>(() => ({
    displayName: this.displayName().trim(),
    inAppNotifications: this.inApp(),
    browserNotifications: this.browser(),
    defaultView: this.defaultView(),
  }));

  protected readonly dirty = computed(() => {
    const saved = this.store.settings();
    const v = this.value();
    return (
      v.displayName !== saved.displayName ||
      v.inAppNotifications !== saved.inAppNotifications ||
      v.browserNotifications !== saved.browserNotifications ||
      v.defaultView !== saved.defaultView
    );
  });

  protected shownError(field: FieldName): string {
    const server = this.serverErrors()[field];
    if (server) {
      return server;
    }
    const client = this.clientErrors()[field];
    if (!client) {
      return '';
    }
    const live = field === 'displayName' && this.nameLength() > DISPLAY_NAME_MAX;
    return live || this.submitted() || this.touched().has(field) ? client : '';
  }

  protected touch(field: FieldName): void {
    this.touched.update((s) => new Set(s).add(field));
  }

  protected clearServerError(field: FieldName): void {
    if (this.serverErrors()[field]) {
      this.serverErrors.update(({ [field]: _removed, ...rest }) => rest);
    }
    this.formError.set(null);
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected selectValue(event: Event): DefaultView {
    return (event.target as HTMLSelectElement).value as DefaultView;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /** Turning browser notifications on asks the browser for permission (US6 scenario 3). */
  protected async onBrowserToggle(event: Event): Promise<void> {
    const on = this.checked(event);
    this.browser.set(on);
    this.clearServerError('browserNotifications');
    if (!on || this.permission() !== 'default') {
      return;
    }
    this.requesting.set(true);
    try {
      this.permission.set(await this.notify.requestBrowserPermission());
    } catch {
      this.permission.set(this.notify.browserPermission());
    } finally {
      this.requesting.set(false);
    }
  }

  protected reset(): void {
    const s = this.store.settings();
    this.displayName.set(s.displayName);
    this.inApp.set(s.inAppNotifications);
    this.browser.set(s.browserNotifications);
    this.defaultView.set(s.defaultView);
    this.serverErrors.set({});
    this.formError.set(null);
    this.submitted.set(false);
    this.touched.set(new Set());
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (this.saving()) {
      return;
    }
    if (Object.keys(this.clientErrors()).length > 0) {
      this.focusFirstInvalid();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const saved = await this.store.save(this.value());
      this.displayName.set(saved.displayName);
      this.submitted.set(false);
      this.touched.set(new Set());
      this.notify.success('Settings saved', `Hi ${saved.displayName}, your preferences are updated.`);
    } catch (err) {
      const info = err as ApiErrorInfo;
      const known: Partial<Record<FieldName, string>> = {};
      const other: string[] = [];
      for (const [field, message] of Object.entries(info.fieldErrors ?? {})) {
        if ((FIELDS as readonly string[]).includes(field)) {
          known[field as FieldName] = message;
        } else {
          other.push(`${field}: ${message}`);
        }
      }
      this.serverErrors.set(known);
      const hasFieldErrors = Object.keys(known).length > 0;
      this.formError.set(
        other.length ? other.join(' ') : hasFieldErrors ? 'Please fix the highlighted fields.' : info.message,
      );
      if (hasFieldErrors) {
        this.focusFirstInvalid();
      }
    } finally {
      this.saving.set(false);
    }
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () => document.querySelector<HTMLElement>('app-settings-page [aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }
}
