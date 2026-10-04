# Phase 8 — Test report (Polish & Cross-Cutting Concerns)

Mode: test · Trial: 0 · Started 2026-10-04T00:47:45+03:00 · Ended 2026-10-04T01:22:17+03:00 · Result: **failed**

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 8 | 8 | 0 | 0 |
| Frontend tests | 12 | 11 | 1 | 0 |
| Backend + Frontend tests | 8 | 7 | 1 | 0 |
| **All** | **28** | **26** | **2** | **0** |

Tasks ticked: T107. Not ticked: T105 (BUG-P8-002), T106 (BUG-P8-001).

Open bugs:
- [BUG-P8-001](bugs/BUG-P8-001.md) — frontend-dev — T106 — TC-P8-E2E-001: the Tasks page takes 3.5–12 s (up to 37.6 s with reduced motion) to show a search/filter result with 1,010 tasks; the API answers in ≤ 33 ms. SC-009 requires < 500 ms.
- [BUG-P8-002](bugs/BUG-P8-002.md) — frontend-dev — T105 — TC-P8-FE-011: after keyboard toggles, archive or deactivate actions, focus moves to `<body>` (8 of 9 in-place actions), so keyboard users start again at the top of the page.

## Unit tests and coverage (T107)

| Suite | Command | Result | Line | Branch |
|---|---|---|---|---|
| Backend (JaCoCo) | `cd backend && ./mvnw -q verify` | exit 0; 311 tests, 0 failures, 0 errors, 0 skipped | 97.8% | 96.2% |
| Frontend (Angular unit-test, v8) | `cd frontend && npx ng test --watch=false --coverage` | exit 0; 17 files, 218 tests pass | 65.78% (statements 68.13%) | 51.2% |

Coverage reports: `outputs/coverage/phase-8/backend/`, `outputs/coverage/phase-8/frontend/`. No new unit tests were added: phase 8 has no new application code (backend: no source change; frontend: style/announcer changes covered by the Playwright checks).

## Smoke

`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200` → both 200.

## Backend tests (curl)

### Performance (T106) — `outputs/curl/phase-8-perf.sh` (output `phase-8-perf.out`), 34/34 PASS
- Seed: `bash phase-8-perf.sh seed` → 1,000 × `curl -s -X POST -H 'Content-Type: application/json' http://localhost:8080/api/tasks --data '{"title":"PERF8T <i> alpha|beta","description":"perf seed","status":"TODO|IN_PROGRESS|DONE","priority":"LOW|MEDIUM|HIGH","dueDate":"<today −30..+59 d>"}'` (7 s; 1,010 tasks in total).
- Timing: `curl -s -o r.json -w '%{http_code} %{time_total}' <URL>`; list/search/filter rows use the worst of 3 runs. Limit 500 ms.
- Cleanup: `bash phase-8-perf.sh cleanup` → `DELETE /api/tasks/{id}` for every `PERF8T` task (back to 10 tasks).

| ID | Request | Expected | Actual |
|---|---|---|---|
| P-01 | `GET /api/tasks` (1,010 rows) | 200 < 500 ms | 200, 7.9 ms |
| P-02 | `GET /api/tasks?q=alpha` (500 rows) | 200 < 500 ms | 200, 5.7 ms |
| P-03 | `GET /api/tasks?q=PERF8T%20555` (1 row) | 200 < 500 ms | 200, 2.5 ms |
| P-04 | `GET /api/tasks?status=TODO` (338) | 200 < 500 ms | 200, 3.5 ms |
| P-05 | `GET /api/tasks?priority=HIGH` (337) | 200 < 500 ms | 200, 4.0 ms |
| P-06 | `GET /api/tasks?dueFrom=2026-10-04&dueTo=2026-11-02` (344) | 200 < 500 ms | 200, 3.9 ms |
| P-07 | `GET /api/tasks?overdue=true` (230) | 200 < 500 ms | 200, 3.1 ms |
| P-08 | `GET /api/tasks?archived=true` | 200 < 500 ms | 200, 1.1 ms |
| P-09 | `GET /api/tasks?sort=DUE_DATE&direction=ASC` (1,010) | 200 < 500 ms | 200, 10.3 ms |
| P-10 | `GET /api/tasks?q=perf8t&status=IN_PROGRESS&priority=MEDIUM&dueFrom=…&dueTo=…&sort=CREATED_AT&direction=DESC` | 200 < 500 ms | 200, 4.3 ms |
| P-11 | `GET /api/dashboard` (1,010 tasks) | 200 < 500 ms | 200, 13.9 ms |
| P-12..P-15 | tasks `POST` / `PUT /{id}` / `POST /{id}/complete` / `DELETE /{id}` | 201/200/200/204 < 500 ms | all, 0.9–1.7 ms |
| P-16..P-20 | habits `POST` / `PUT /{id}` / `POST /{id}/completions {"date":today}` / `DELETE /{id}/completions/{today}` / `DELETE /{id}` | 201/200/201/200/204 | all, 1.2–1.9 ms |
| P-21..P-26 | learning-cards `POST` / `PUT /{id}` / `POST /{id}/milestones` / `PUT /{id}/milestones/{mid} {"done":true}` / `DELETE …/milestones/{mid}` / `DELETE /{id}` | 201/200/201/200/200/204 | all, 1.0–2.0 ms |
| P-27..P-31 | `POST /api/tasks` item, `POST /api/plans` (1 TASK item), `PUT /api/plans/{id}/items/{itemId}` true / false, `DELETE /api/plans/{id}` | 201/201/200/200/204 | all, 0.9–2.7 ms |
| P-32..P-34 | `GET /api/settings`, `PUT /api/settings` (name changed), `PUT` (restore) | 200 | all, 0.7–1.5 ms |

Note: a first run of P-10 used `sort=PRIORITY`, which is not in the `TaskSort` enum (`DUE_DATE`, `CREATED_AT`); the 400 was correct, and the test was fixed to `CREATED_AT`.

### Validation / not found — `outputs/curl/phase-8-validation.sh` (output `phase-8-validation.out`), 10/10 PASS (with 1,010 tasks stored)

| ID | Request | Expected | Actual |
|---|---|---|---|
| V-01 | `POST /api/tasks {"title":""}` | 400 problem+json | 400, errors `title` |
| V-02 | `POST /api/habits {"name":"x"}` | 400 | 400, errors `frequency` |
| V-03 | `POST /api/learning-cards {"title":""}` | 400 | 400, errors `title` |
| V-04 | `POST /api/plans {"title":"p","items":[]}` | 400 | 400, errors `startDateTime, endDateTime, estimatedDurationMinutes, items, priorityOrder` |
| V-05 | `PUT /api/settings {"displayName":""}` | 400 | 400, errors `browserNotifications, defaultView, inAppNotifications, displayName` |
| V-06 | `GET /api/tasks?sort=bogus` | 400 | 400, errors `sort` |
| N-01..N-04 | `GET /api/{tasks,habits,learning-cards,plans}/999999` | 404 problem+json | 404 ×4 |

## Frontend tests (Playwright MCP)

All scripts run with `browser_run_code_unsafe` (`filename` = the script), headless chromium, UI http://localhost:4200 (`ng serve`, development mode), real backend.

### Accessibility / motion / responsive audit — `outputs/playwright/p8-a11y-audit.js` (TC-P8-FE-002..006)
Steps per combination (6 pages × light/dark × 1440×900 / 375×812 = 24): `page.emulateMedia({colorScheme})` → `page.setViewportSize` → `page.goto('/<page>')` → `waitForLoadState('networkidle')` + 700 ms → `page.evaluate` (contrast of every visible text node with alpha/opacity blending; max computed `animationDuration`/`transitionDuration` and `document.getAnimations()` durations; `scrollWidth − clientWidth`; counts of `main`, `h1`, banner, navigation; nav links visible in the viewport) → `locator('body').ariaSnapshot()` (controls without a name). Then `emulateMedia({reducedMotion:'reduce'})` on all six pages.

| Check | Result |
|---|---|
| Unnamed controls (accessibility tree) | 0 on all 24 combinations |
| Landmarks / headings | 1 `main`, 1 `h1`, banner + navigation on every page; 4–12 headings per page |
| Contrast (rendered text) | all ≥ 4.5:1; lowest light 4.79 (habits), dark 6.38; 24–81 text elements checked per page |
| Max animation/transition duration | 0.25 s on every page |
| Reduced motion | max 0.00001 s (0.01 ms) on every page |
| Overflow at 375 / 1440 | 0 px on every page and theme |
| Navigation usable at 375 / 1440 | 6/6 nav links visible |
Screenshots: `screenshots/phase-8-a11y-{dashboard,tasks}-{light,dark}-{1440,375}.png`.

### Keyboard, dialogs and validation — `outputs/playwright/p8-keyboard-coverage.js` (TC-P8-FE-007..009)
- Tab reachability: dashboard 30/30, tasks 58/58, habits 27/27, learning 18/18, plans 26/26, settings 13/13 focusable elements reached by `keyboard.press('Tab')`; each showed an outline/box-shadow focus indicator.
- Dialogs (Add Task, Add Habit, Add Learning Card, Create Plan, dashboard quick-add Task) opened with Tab + Enter: labelled, focus inside (first field), modal (Tab cycles only inside the dialog and the browser chrome), empty submit with Enter → `role="alert"` "Title is required." / "Name is required." / "Select at least one item." and `aria-invalid="true"` + `aria-describedby="<field>-error"`; Esc closes; focus returns to the opener.
- Controls clickable during animations: right after Enter, while the dialog open animations (140–250 ms) run, the Close button is the `elementFromPoint` hit target and a click closes the dialog (≈ 230–260 ms).

### Keyboard-only walkthrough — `outputs/playwright/p8-keyboard-actions.js` (TC-P8-FE-010, TC-P8-FE-011)
Dark theme, 1440 px, only `Tab`, `Enter`, `Space`, arrow keys, `Ctrl+A`, `Ctrl+Enter` and typing; each step checked through the API. 31/31 actions PASS:
tasks create (priority High with ArrowUp), mark done / not done, edit (Enter submits), search, status filter (ArrowDown), archive, Show archived + restore, delete + confirm; habits create weekly (ArrowRight), complete, undo, edit, deactivate, reactivate, remove + confirm; learning create, expand, add 2 milestones (Enter), toggle milestone, add note (Ctrl+Enter), edit; plans create from an existing task (Space + Next + Create plan), toggle item (→ 100 %, Completed), remove + confirm; settings name + landing page + Save, In-app switch + Save (restored afterwards); dashboard quick-add habit, habit checklist, complete due-today task, "All tasks" link, skip link.
**Focus after in-place actions (TC-P8-FE-011, failed):** `<body>` after Mark as done (tasks), Archive (tasks), Mark done for today (habits), Deactivate (habits), milestone toggle (learning), plan item toggle (plans), dashboard habit checklist and dashboard Complete task; only "add milestone" kept focus → BUG-P8-002.

### Console (TC-P8-FE-012)
`.playwright-mcp/console-2026-10-03T21-49-55-906Z.log` (248 entries over all runs): only "Angular is running in development mode" logs; 0 errors, 0 warnings.

## Backend + Frontend tests

### TC-P8-E2E-001 — UI filter response with 1,010 tasks (T106) — FAILED (BUG-P8-001)
`browser_run_code_unsafe`: `goto('/tasks')`, wait for 1,010 `app-task-item`; `PerformanceObserver({type:'longtask'})`; `t0 = Date.now()`; action; `waitForFunction(count === expected, {polling:16})`.

| Action | API time (resource timing) | UI time | Long tasks (ms) |
|---|---|---|---|
| search "PERF8T 555" → 1 row | 3 ms | 7,144 ms (24,581 ms in another run) | 907, 704, 5,105 |
| clear search → 1,010 | 10 ms | 12,053 ms | 1,237, 10,587 |
| status Todo → 338 | 30 ms | 3,469 ms | 728, 2,674 |
| status All → 1,010 | 9 ms | 6,526 ms | 1,191, 5,303 |
| priority High → 337 | 31 ms | 3,914 ms | 911, 2,938 |
| priority All → 1,010 | 33 ms | 8,564 ms | 1,107, 7,411 |
| reduced motion: search / clear / status | – | 37,556 / 14,835 / 4,857 ms | – |
Screenshots: `screenshots/phase-8-perf-filter-400ms.png` (still 1,010 rows 400 ms after typing), `phase-8-perf-filter-done.png`.

### PRD §11 flow (TC-P8-E2E-002..006) — `outputs/playwright/p8-e2e-prd11.js` (+ `p8-e2e-prd11-part2.js` for steps 6b–8 after a locator fix) and `outputs/curl/phase-8-e2e-verify.sh verify 2118 55 34 2119 41 phase-8-dash-before.json` (output `phase-8-e2e-verify.out`, 11/11 PASS)
1. Tasks → Add Task, Title "P8E2E task", Due date today, Add task → row visible. curl E-01: `GET /api/tasks/2118` title, dueDate 2026-10-04.
2. Mark as done → toggle shows "Mark as not done". E-02: status DONE, completedAt set.
3. Habits → Add Habit "P8E2E habit" (Daily). E-03: `GET /api/habits/55` daily, active.
4. Mark done for today → "Undo today's completion". E-04: `GET /api/habits/55/completions` → `["2026-10-04"]`.
5. Learning → Add card "P8E2E card", expand, add milestones A and B. E-05: `GET /api/learning-cards/34` has both milestones.
6. Plans → Create Plan: tick "P8E2E plan task" (task 2119, created with curl), Habits tab "P8E2E habit", Learning tab "P8E2E card", Next, Title "P8E2E plan", Start now−5 min, End now+55 min, Create plan → In Progress, "53m 22s left". E-06: items TASK 2119, HABIT 55, LEARNING_RESOURCE 34.
7. Tick the three plan item checkboxes → card shows "Completed", "Final 100% · 3 of 3 done". E-07: status COMPLETED, progressPercent 100, itemsDone 3, restSeconds null; E-08: task 2119 DONE.
8. Dashboard: "50%", "6 of 12 done · 3 completed today", habits "3 / 5", "1 upcoming · 6 completed", milestones "0 / 2" = `GET /api/dashboard`; E-09..E-11 deltas vs baseline: tasks done +2 / total +2, habits active +1 / completed today +1, plans completed +1, cards +1, milestones +2.
Screenshots: `screenshots/phase-8-e2e-1-task-done.png` … `phase-8-e2e-6-dashboard.png`.

### TC-P8-E2E-007 — curl → UI (output `outputs/curl/phase-8-e2e-curl-to-ui.out`)
`POST /api/tasks {"title":"P8E2E curl task due today","dueDate":"2026-10-04","priority":"HIGH"}` (id 2120); `PUT /api/learning-cards/34/milestones/43 {"title":"P8E2E milestone A","done":true}`; `POST /api/plans` "P8E2E running plan" (start −10 min, end +3 h, HABIT 55 → IN_PROGRESS, restSeconds 10799) and "P8E2E upcoming plan" (start +1 day → NOT_STARTED). Playwright: dashboard shows the curl task under Due today, "46%", "6 of 13 done", the running plan, "2 upcoming · 6 completed", milestones "1 / 2" and "1 completed in the last 7 days"; Plans page shows In Progress / Not Started / Completed; Tasks page lists the curl task. Screenshot `phase-8-e2e-7-dashboard-after-curl.png`.

### TC-P8-E2E-008 — Persistence across a backend restart (SC-005)
1. `bash phase-8-e2e-verify.sh snapshot phase-8-persist-before.json` (13 tasks, 6 habits + completions, 4 cards, 9 plans with statuses COMPLETED ×6 / IN_PROGRESS ×1 / NOT_STARTED ×2, settings, dashboard; time-dependent `restSeconds` removed).
2. `kill 154955 154777` (Spring Boot JVM + Maven); `curl http://localhost:8080/api/tasks` → 000.
3. `cd backend && nohup ./mvnw spring-boot:run > loops/loop-3-testing/state/backend-restart.log 2>&1 &` → started in 2.5 s; wrapper pid 214646 in `loops/loop-3-testing/state/backend.pid`.
4. Snapshot after → `diff` of both snapshots (without `dashboard.today`): identical; habit completion lists identical.
5. Playwright after restart: P8E2E running plan In Progress with a ticking "2h 58m 02s left", upcoming plan Not Started, P8E2E plan Completed / Final 100 %; task done, habit done today, card "In Progress 50 % 1 of 2 milestones", dashboard numbers unchanged. Screenshot `phase-8-e2e-8-plans-after-restart.png`.

## Observations (not filed)
- Dialog reopen race: if the opener receives Enter less than ~20 ms after Cancel/Close was clicked (only reproducible by automation, not by a person), the dialog does not open again until the page is reloaded. Pressing Enter 20 ms or more later, Esc then Enter immediately, or clicking the opener during the close animation all work. Not reachable by a person, so no bug was filed. It is recorded here in case it shows up in automated tests.
- The backend was restarted by this loop for TC-P8-E2E-008. The running server's pid is now in `loops/loop-3-testing/state/backend.pid` (log `state/backend-restart.log`). `loops/loop-1-backend-dev/state/backend.pid` (154777) is stale.
- Test data left on purpose (PRD flow and persistence evidence): tasks 2118–2120, habit 55, learning card 34, plans 41–43 (all titled "P8E2E …"). All PERF8T and P8KB data was deleted, and the settings were restored to Friend / in-app on / browser off / Dashboard.

## Trial 1
Mode: retest · Started 2026-10-04T01:33:52+03:00 · Failed cases re-run: TC-P8-E2E-001, TC-P8-FE-011 · Regression: all unit tests + all end-to-end flows of the phase.

### Totals (trial 1)
| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 8 | 8 | 0 | 0 |
| Frontend tests | 12 | 12 | 0 | 0 |
| Backend + Frontend tests | 8 | 8 | 0 | 0 |
| **All** | **28** | **28** | **0** | **0** |

Bugs: BUG-P8-001 closed (trial 1), BUG-P8-002 closed (trial 1). No new bugs. T105, T106 ticked (T107 already ticked).

### Smoke
`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200` → both 200.

### Unit tests and coverage (regression)
- Backend `cd backend && ./mvnw -q verify`: exit 0, 311 tests, 0 failures/errors/skipped. JaCoCo line **97.8 %**, branch **96.2 %** → `coverage/phase-8/backend/`.
- Frontend `cd frontend && npx ng test --watch=false --coverage`: 17 files, 218 tests passed. Lines **65.51 %**, branches **50.99 %**, statements 67.89 %, functions 70.11 % → `coverage/phase-8/frontend/`.

### TC-P8-E2E-001 (BUG-P8-001) — passed
- `bash curl/phase-8-perf.sh seed` (1,013 tasks), `bash curl/phase-8-perf.sh run` → `curl/phase-8-perf-t1.out` (P-01..P-34: 34 pass, 0 fail), `bash curl/phase-8-perf.sh cleanup`.
- Playwright MCP `browser_run_code_unsafe` filename `outputs/playwright/p8-perf-ui.js`: viewport 1440×900; per run `goto /tasks`, wait ≥ 1,000 `app-task-item`; `getByRole('searchbox',{name:'Search tasks by title'}).fill('PERF8T 555')` → 1 row; `.fill('')` → all; `#filter-status` TODO / ''; `#filter-priority` HIGH / ''; time until expected row count (rAF polling); long-task observer; 2 runs normal + 2 runs `reducedMotion: 'reduce'`.

| Action | normal (run 1 / 2) | reduced motion (run 1 / 2) |
|---|---|---|
| search `PERF8T 555` (→ 1) | 317 / 321 ms | 318 / 320 ms |
| clear search (→ 1,013) | 346 / 306 ms | 281 / 286 ms |
| status = Todo (→ 340) | 78 / 93 ms | 88 / 127 ms |
| status = All | 184 / 178 ms | 188 / 195 ms |
| priority = High (→ 338) | 106 / 77 ms | 80 / 78 ms |
| priority = All | 212 / 217 ms | 183 / 193 ms |

Max 346 ms (< 500 ms), longest long task 327 ms. Screenshot `screenshots/phase-8-t1-perf-filter-400ms.png` (1 row after 400 ms).

### TC-P8-FE-011 (BUG-P8-002) — passed; TC-P8-FE-010 regression — passed
Playwright MCP `browser_run_code_unsafe` filename `outputs/playwright/p8-keyboard-actions.js`: 31/31 keyboard-only actions PASS (each verified via API). Focus 800 ms after in-place actions: Tasks toggle → "Mark as not done: P8KB task"; Tasks archive (only row) → `<main>`; Habits complete → "Undo today's completion: P8KB habit"; Habits deactivate → next row "Deactivate habit: P8E2E habit"; Learning add milestone → milestone input; Learning toggle milestone → milestone checkbox; Plans toggle item → item checkbox; Dashboard habit checklist → "Undo today's completion: P8KB dash habit"; Dashboard complete due-today → next row "Complete task: P8E2E curl task due today". 9/9 not `<body>`.

### End-to-end regression (TC-P8-E2E-002..008) — passed
- UI → curl: `outputs/playwright/p8-e2e-prd11-t1.js` (copy of `p8-e2e-prd11.js` with names `P8R1E*`): 9/9 steps PASS (task 4134, habit 63, card 39, plan task 4135, plan 48; plan In Progress with "54m 52s left", then Completed 100 %; dashboard UI = API: 53 %, "8 of 15", habits 4/6, 7 completed, milestones 1/4). Screenshots `screenshots/phase-8-t1-e2e-{1..6}-*.png`. Then `bash curl/phase-8-e2e-verify-t1.sh verify 4134 63 39 4135 48 phase-8-t1-dash-before.json` → E-01..E-11 11/11 PASS (`curl/phase-8-e2e-verify-t1.out`).
- curl → UI: `curl/phase-8-t1-e2e-curl-to-ui.out` (POST task "P8R1C curl task due today" 201; PUT milestone 52 done 200; POST running plan 49 IN_PROGRESS; POST upcoming plan 50 NOT_STARTED). Playwright: dashboard shows the curl task, 47 %, "8 of 17", running plan, "3 upcoming · 7 completed", milestones 2 / 4; plans page In Progress (countdown) / Not Started / Completed; tasks and learning pages show the data. Screenshots `screenshots/phase-8-t1-e2e-7-curl-to-ui-{dashboard,plans}.png`.
- Persistence: `phase-8-e2e-verify-t1.sh snapshot curl/phase-8-t1-persist-before.json` (17 tasks, 7 habits, 5 cards, 12 plans); stopped backend (pids 214646/214647/214826), `nohup ./mvnw spring-boot:run` (new pid in `state/backend.pid`, up in 5 s); snapshot `phase-8-t1-persist-after.json`; `diff` of both JSON files and completion lists → identical. Playwright after restart: running plan countdown 49m 16s → 49m 14s, upcoming / completed statuses unchanged, tasks / habits / learning / dashboard show the same data. Screenshot `screenshots/phase-8-t1-e2e-8-persist-plans.png`.

### Console
0 errors, 0 warnings in all trial-1 runs (`.playwright-mcp/console-2026-10-03T21-49-55-906Z.log` L302 onward).

Ended 2026-10-04T01:39:14+03:00 · Result: **passed**.
