# Phase 6 — frontend-dev (US6 Navigate and set preferences)

Mirrors the [FE] tasks of Phase 6 in `specs/001-quickflow-productivity/tasks.md`.

- [x] T086 [FE] [US6] Run `npm run api:gen`; create `core/settings.store.ts` (loads once at startup via `provideAppInitializer`; exposes displayName, notification prefs, defaultView) and a `defaultViewGuard` redirecting `''` to the configured landing page in `app.routes.ts`
- [x] T087 [FE] [US6] Create `features/settings/settings-page.component.ts`: profile section (display name), notifications (in-app on/off, browser on/off — requests `Notification.requestPermission()` and shows denied state), default view select; save with success toast; validation messages
- [x] T088 [FE] [US6] Make NotificationService respect settings (in-app off → no toasts for plan start; browser on + granted → system notification); Playwright MCP check of Settings and navigation; screenshots

## Pages / features

- **Generated client**: `npm run api:gen` from `backend/openapi/openapi.json` → new `SettingsService` (`getSettings`, `updateSettings`) and models `Settings`, `DefaultView`.
- **`core/settings.store.ts`**: `SettingsStore` (root) — signals `settings`, `loaded`, `error`, computed `displayName`, `inAppNotifications`, `browserNotifications`, `defaultView`, `defaultPath`; `load()` never rejects (falls back to defaults `Friend` / in-app on / browser off / Dashboard when the backend is down); `save()` rejects with `ApiErrorInfo` (problem+json `errors[]`). Every load/save pushes the notification preferences into `NotificationService.inAppEnabled` / `browserEnabled`.
- **`defaultViewGuard`** (same file) + route `{ path: '', pathMatch: 'full', canActivate: [defaultViewGuard], children: [] }` → redirects to `/dashboard|/tasks|/habits|/learning|/plans` per `defaultView`.
- **`app.config.ts`**: `provideAppInitializer(() => inject(SettingsStore).load())`.
- **Settings page** (`features/settings/settings-page.component.ts`): three card sections (Profile, Notifications, Default view) with slide-up entrance; display name with live counter (1–80, required; client + server field errors via `app-form-field`, `aria-invalid`, focus first invalid); in-app and browser `role="switch"` toggles (animated thumb, keyboard Space, visible focus ring); turning browser on while permission is `default` calls `Notification.requestPermission()`; permission line (`aria-live="polite"`) shows granted / denied (warning: in-app still works) / not requested / unsupported; landing-page select; "Unsaved changes" indicator, Reset, Save with spinner and success toast "Settings saved".
- **NotificationService (T088)**: `notify()` (used by plan start watcher) shows a toast only when in-app is on and raises a system notification only when browser is on and permission granted; action feedback toasts (`toast`/`success`/`error`) are always shown.

## Playwright checks

Run against http://localhost:4200 + backend http://localhost:8080 (headless chromium).

| # | Check | Result |
|---|---|---|
| 1 | `/settings` loads with backend values (Friend, in-app on, browser off, Dashboard); accessibility snapshot: form "Settings", 3 regions with h2, textbox "Display name", switches "In-app notifications"/"Browser notifications", combobox "Landing page" | pass |
| 2 | Empty display name + Save → "Display name is required.", `aria-invalid=true`; 81 chars → "…at most 80 characters (currently 81)." live | pass |
| 3 | Name "Eslam" + landing Tasks → "Unsaved changes" shown → Save → toast "Settings saved"; `GET /api/settings` = `{Eslam, true, false, TASKS}` | pass |
| 4 | Navigate to `/` → lands on `/tasks`; reload `/settings` keeps Eslam / TASKS (persisted) | pass |
| 5 | Permission `default` → toggle browser on → `requestPermission()` → `denied` → denied warning shown, switch stays on; Space key toggles switch | pass |
| 6 | Permission granted (context grant) → "Browser permission granted." | pass |
| 7 | In-app off + browser on saved; in-progress plan created via curl → system notification "Plan started: …" raised, no in-app toast, plan acknowledged (`startNotifiedAt` set) | pass |
| 8 | In-app on + browser off; in-progress plan created via curl → toast "Plan started: …" appears, no system notification | pass |
| 9 | Settings restored to defaults (Friend / in-app on / browser off / Dashboard); `/` → `/dashboard` | pass |
| 10 | All six nav links from the shell: one click each, URL correct, `aria-current="page"` on the active link | pass |
| 11 | 375 px width: no horizontal overflow on Settings | pass |
| 12 | Console: no errors/warnings on fresh load | pass |

Screenshots: `outputs/screenshots/phase-6-settings.png`, `phase-6-settings-saved.png`, `phase-6-settings-permission.png`, `phase-6-settings-375.png`, `phase-6-notifications-inapp-off.png`, `phase-6-notifications-inapp-on.png`.

Build: `npx ng build` pass (only pre-existing component-style budget warnings for habit-card / plan-builder). Unit tests: `npx ng test --watch=false` 13 files / 164 tests pass.

## Notes

- Test data created during checks (task 66, three "P6 …" plans) was deleted; settings left at defaults.
- With browser permission denied the browser switch can still be saved on; system notifications are simply not raised (`browserNotify` checks permission) and in-app notifications keep working (US6 scenario 3).
- Unit specs for `settings.store` / settings page are [TEST] task T090 (not written here).
