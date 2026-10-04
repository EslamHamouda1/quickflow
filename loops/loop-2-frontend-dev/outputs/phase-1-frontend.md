# Phase 1 — Setup & Foundation (frontend-dev)

Source: `specs/001-quickflow-productivity/tasks.md` (Phase 1, [FE] tasks). Ticks mirror tasks.md.

- [x] T009 [FE] Generate the Angular 22.2.0 workspace in `frontend/` (`npx -y @angular/cli@22.2.0 new quickflow --directory frontend --zoneless --routing --style=scss --ssr=false --skip-git`); confirm `node -v` is 24.x ≥ 24.15; confirm the unit-test builder's coverage provider is installed with the workspace — packages the Angular CLI 22.2.0 itself requires (versions chosen by the CLI) count as part of the pinned Angular toolchain (research R14); never add other libraries
- [x] T010 [FE] Add `@openapitools/openapi-generator-cli` 2.41.0 as devDependency, `frontend/openapitools.json`, and script `"api:gen": "openapi-generator-cli generate -i ../backend/openapi/openapi.json -g typescript-angular -o src/app/api --additional-properties=ngVersion=22.2.0,providedIn=root,supportsES6=true"` in `frontend/package.json`; run it to create `frontend/src/app/api/` (generated, never edited)
- [x] T011 [FE] [P] Create `frontend/src/environments/environment.ts` / `environment.development.ts` (`apiUrl: 'http://localhost:8080'`) and `frontend/src/app/app.config.ts` with `provideZonelessChangeDetection()`, `provideRouter(routes, withViewTransitions(), withComponentInputBinding())`, `provideHttpClient(withFetch())`, `{provide: BASE_PATH, useValue: environment.apiUrl}`
- [x] T012 [FE] [P] Create the design system in `frontend/src/styles/`: `tokens.scss` (color tokens for light and dark via `prefers-color-scheme`, text contrast ≥ 4.5:1, spacing, radius, elevation, typography), `motion.scss` (durations ≤ 250 ms, easing tokens, keyframes fade/slide/scale/pop, `@media (prefers-reduced-motion: reduce)` disables animations and transitions), `base.scss` (reset, focus-visible ring, form controls, `.truncate` / line-clamp utilities); import them in `frontend/src/styles.scss`
- [x] T013 [FE] Create `frontend/src/app/layout/shell.component.ts` (persistent navigation: Dashboard, Tasks, Habits, Learning Resources, Todo Plans, Settings with icons, `routerLinkActive` highlight + `aria-current="page"`, skip-to-content link, sidebar on wide screens / top bar on narrow screens, animated active indicator) and lazy routes `/dashboard`, `/tasks`, `/habits`, `/learning`, `/plans`, `/settings` (placeholder page components under `frontend/src/app/features/*/`) in `frontend/src/app/app.routes.ts`, `''` → `/dashboard`
- [x] T014 [FE] [P] Create shared UI in `frontend/src/app/shared/ui/`: `empty-state.component.ts` (icon, message, primary action), `confirm-dialog.service.ts` + component (native `<dialog>`, focus trap, Esc to cancel), `progress-bar.component.ts` (animated width, `role="progressbar"` with aria values), `toast-host.component.ts` (animated enter/leave via `animate.enter`/`animate.leave`, `aria-live="polite"`), `form-field.component.ts` (label, hint, error text linked by `aria-describedby`)
- [x] T015 [FE] [P] Create core services in `frontend/src/app/core/`: `now.service.ts` (signal updated every 1 s), `notification.service.ts` (in-app toasts; browser `Notification` when enabled and permitted), `refresh.service.ts` (version signal bumped after every mutation), `api-errors.ts` (maps problem+json `errors[]` to field messages), `format.ts` (duration `h m s` formatter for rest time)
- [x] T016 [FE] Create `frontend/src/app/core/reduced-motion.ts` (signal from `matchMedia('(prefers-reduced-motion: reduce)')`) used to skip script-driven motion (count-up numbers, countdown pulse, highlight pulse); CSS motion is already disabled by `motion.scss`
- [x] T017 [FE] Verify `npx ng build` passes and `npx ng serve --port 4200` shows the shell; navigation reaches all six placeholder pages

## Pages / features

- **App shell** (`src/app/layout/shell.component.ts`): skip link → `#main-content`; `<nav aria-label="Main navigation">` with 6 icon links (Dashboard, Tasks, Habits, Learning Resources, Todo Plans, Settings), `routerLinkActive` + `aria-current="page"`, an animated sliding active indicator (re-measured on resize); sidebar at ≥ 900 px, top bar with a compact nav row below that (all 6 links fit at 375 px; the row scrolls if narrower). Hosts `<app-toast-host>` and `<app-confirm-dialog>`.
- **Routes** (`src/app/app.routes.ts`): lazy `/dashboard`, `/tasks`, `/habits`, `/learning`, `/plans`, `/settings` with page titles; `''` and `**` → `/dashboard`. Placeholder pages in `features/*/<name>-page.component.ts` (the same file names later phases implement).
- **Config** (T011): `app.config.ts` uses zoneless change detection, router with view transitions and component input binding, `provideHttpClient(withFetch())`, and `BASE_PATH` (from the generated client) taken from `environment.apiUrl`. `angular.json` development config swaps in `environment.development.ts`.
- **Design system** (T012): `src/styles/tokens.scss` (light/dark through `prefers-color-scheme`, with a `[data-theme]` override; all text/background pairs checked ≥ 4.5:1, worst is 4.78), `motion.scss` (80/140/200/250 ms tokens, easing tokens, fade/slide/scale/pop/pulse keyframes, view-transition route animation, reduced-motion kill switch), `base.scss` (reset, focus-visible ring, `.btn*`, `.input/.select/.textarea`, `.card`, `.chip`, `.truncate`, `.line-clamp-2/3`, `.sr-only`, `.skeleton`).
- **Shared UI** (T014, `src/app/shared/ui/`): `icon`, `page-header`, `empty-state`, `confirm-dialog.service` + `confirm-dialog.component` (native `<dialog>`, Tab focus trap, Esc/backdrop cancel, focus goes back to the opener), `progress-bar` (`role=progressbar` + aria values, animated scaleX), `toast-host` (`animate.enter`/`animate.leave`, `aria-live="polite"`), `form-field` (label, hint and error linked to the control with `aria-describedby`, `aria-invalid`).
- **Core** (T015/T016, `src/app/core/`): `NowService` (1 s `now` signal), `NotificationService` (toasts; `inAppEnabled`/`browserEnabled` signals ready for Settings, browser `Notification` only when enabled and granted), `RefreshService` (`version` + `bump()`), `api-errors.ts` (`toApiError()` → `{status, message, fieldErrors}` from problem+json `errors[]`), `format.ts` (`formatDuration` "1h 02m 05s", `formatMinutes`, `secondsUntil`, `todayIso`), `reduced-motion.ts` (`ReducedMotion.reduced` signal + `injectReducedMotion()`).

## Playwright checks

Run against `ng serve` at http://localhost:4200 with the backend at :8080 (headless chromium).

| # | Check | Steps | Result |
|---|---|---|---|
| 1 | Shell loads | Open `/`, take a snapshot | PASS. Redirects to `/dashboard`. Snapshot shows a banner, `navigation "Main navigation"` with 6 labelled links, `main`, and an h1 "Dashboard". 0 console errors or warnings. |
| 2 | All six links navigate and highlight | Click each nav link in turn (Tasks → Habits → Learning → Plans → Settings → Dashboard) | PASS. URL, document title and h1 match each time. Exactly one link has `aria-current="page"`. The indicator moves to the active item. |
| 3 | Skip link and keyboard | Load `/tasks`, press Tab, then Enter | PASS. The first Tab focuses "Skip to main content", which becomes visible at the top. Enter moves focus to `#main-content`. The fix described in the notes was needed for this. |
| 4 | Narrow layout (375 px) | Resize to 375×780, click Settings | PASS. Top bar shows all 6 links inside the viewport, with no horizontal page overflow. The indicator moves under Settings. |
| 5 | Dark theme | Emulate `prefers-color-scheme: dark` | PASS. Dark tokens are applied (see screenshot). |
| 6 | Reduced motion | Emulate `prefers-reduced-motion: reduce`, read computed styles | PASS. Indicator transition and empty-state animation are both 1e-05 s. |
| 7 | Backend reachable with CORS | `OPTIONS /api/tasks` with `Origin: http://localhost:4200` | PASS. 200 with `Access-Control-Allow-Origin: http://localhost:4200`. No backend API calls exist yet in Phase 1 because the swagger has no paths. |

Screenshots: `outputs/screenshots/phase-1-shell-wide-light.png`, `phase-1-shell-wide-dark.png`, `phase-1-shell-narrow.png`.

## Notes

- Node v24.18.0 (matches 24.x ≥ 24.15).
- Angular packages pinned to exactly 22.2.0 (the CLI's default caret range resolved 22.2.1; reinstalled with exact pins).
- Coverage provider `@vitest/coverage-v8` 5.0.3 installed to match the CLI-chosen `vitest` 5.0.3 (required by `ng test --coverage`, research R14).
- openapi-generator-cli 2.41.0 selected generator jar 7.25.0 (`frontend/openapitools.json`).
- Backend swagger currently has no paths (Phase 1 is foundation only), so the generated client contains only base files (`BASE_PATH`, `Configuration`, `provideApi`).
- Fixed during the Playwright check: `scrollIntoView` on the active nav link moved Chromium's sequential-focus starting point, so the first Tab skipped the skip link. It now adjusts the nav row's `scrollLeft` directly.
- Renamed the `title` inputs of `page-header` and `empty-state` to `heading`, because a static `title` attribute leaked onto the host element as a tooltip.
- `app.spec.ts` (CLI scaffold) was updated to match the new root template so `ng test` stays green: 2/2 pass. T019 [TEST] owns the real specs.
- CORS covers only `/api/**` (T005). Browser fetches of `/v3/api-docs` from :4200 are blocked, which is expected and not used by the app.
- Toast host and confirm dialog are mounted in the shell. Phase 1 has no UI that triggers them; feature phases exercise them.
