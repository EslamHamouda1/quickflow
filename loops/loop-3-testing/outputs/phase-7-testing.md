# Phase 7 — Testing (User Story 5 - See everything on a dashboard)

Mode: test · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-7-dashboard.md` (from `/speckit-checklist`, 32 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T098 [TEST] [P] [US5] Backend tests `dashboard/DashboardServiceTest.java` (fixed Clock, seeded data: every metric equals expected counts; archived excluded; zero-division cases) and `dashboard/DashboardControllerTest.java` (`@WebMvcTest`)
- [x] T099 [TEST] [P] [US5] Frontend unit tests `features/dashboard/dashboard.store.spec.ts`, `dashboard-page.component.spec.ts`
- [x] T100 [TEST] [US5] curl: `GET /api/dashboard` numbers equal counts computed from `/api/tasks`, `/api/habits`, `/api/plans`, `/api/learning-cards`; Playwright MCP tests of the Dashboard (all sections, quick-add); e2e: complete a task and a habit and a plan item in the UI → dashboard metrics change accordingly and match curl; change data via curl → dashboard reflects after refresh

## Backend tests

### TC-P7-BE-001 — Unit: `DashboardServiceTest` (T098)
- Story: US5  AC: AS1-AS6 / FR-026, SC-004 (every metric equals expected counts; archived excluded; zero division)
- Steps: `cd backend && ./mvnw -q verify`. `@DataJpaTest` + `replace = NONE`, real services/repositories, `MutableClock` fixed at 2026-06-17T10:00Z. 11 tests: empty data → all zeros, percent 0; only archived tasks → percent 0; greeting = Settings name, today from Clock; seeded 11 tasks (due today TODO/IN_PROGRESS/DONE, overdue, overdue-but-done, future, no date, 3 archived, done yesterday) → dueToday 2, overdue 1, totalActive 8, done 3, completedToday 2, 38 % (37.5 rounded); complete → percent 33; 67 % / 100 % rounding; day rollover moves due-today to overdue; habits: inactive excluded, weekly done-this-week not completedToday, complete/uncomplete counts; plans: in-progress order (priority, start), upcoming 2, completed 2 (by time and all items done); item toggle → 50 % and task side effect; learning: 7-day window (8 days out, exactly 7 days in), in-progress count, milestone update.
- Expected: all pass
- Result: passed

### TC-P7-BE-002 — Unit: `DashboardControllerTest` (T098)
- Story: US5  AC: AS1-AS5 / FR-026
- Steps: `@WebMvcTest(DashboardController)`, `MockMvcTester`, `@MockitoBean DashboardService`. 4 tests: GET 200 JSON with every contract field (nested tasks); empty lists and zeros serialized; POST 405 problem+json; PUT / DELETE 405; service untouched on 405.
- Expected: all pass
- Result: passed

### TC-P7-BE-003 — curl: shape, today, greeting (curl BE-001..BE-003)
- Story: US5  AC: AS1
- Steps: `GET /api/dashboard`; `GET /api/settings`
- Expected: 200 `application/json` with all required fields; `today` = server local date; `greetingName` = Settings displayName
- Result: passed

### TC-P7-BE-004 — curl: baseline dashboard equals list endpoints (curl BE-004)
- Story: US5  AC: AS6 / SC-004
- Steps: compute every dashboard number with `jq` from `/api/tasks`, `/api/habits?active=true`, `/api/plans`, `/api/learning-cards`; compare with `/api/dashboard`
- Expected: identical
- Result: passed

### TC-P7-BE-005 — curl: dueToday excludes archived and done; totals (curl BE-005, BE-007, BE-008)
- Story: US5  AC: AS2
- Steps: seed due-today task, archived due-today task, DONE task
- Expected: dueToday contains only the active not-done task; totalActive +3 (archived excluded); doneCount +1, completedTodayCount +1
- Result: passed

### TC-P7-BE-006 — curl: overdue list (curl BE-006)
- Story: US5  AC: AS2
- Steps: seed task due yesterday
- Expected: overdue +1
- Result: passed

### TC-P7-BE-007 — curl: habits, inactive excluded (curl BE-009)
- Story: US5  AC: AS3
- Steps: seed active and deactivated habit
- Expected: activeCount +1; inactive habit not in `habits.today`
- Result: passed

### TC-P7-BE-008 — curl: in-progress plans order, rest time, upcoming (curl BE-010)
- Story: US5  AC: AS4
- Steps: seed in-progress plan (priority 1) and future plan
- Expected: seeded plan first in `inProgress`, restSeconds ≈ 3000, progress 0, upcomingCount +1
- Result: passed

### TC-P7-BE-009 — curl: learning snapshot (curl BE-011, BE-015)
- Story: US5  AC: AS5
- Steps: card + 2 milestones; mark one done via `PUT .../milestones/{id}`
- Expected: cardsTotal +1, milestonesTotal +2; then milestonesDone +1, last7Days +1, inProgressCount +1
- Result: passed

### TC-P7-BE-010 — curl: task and habit changes (curl BE-013, BE-014)
- Story: US5  AC: AS2, AS3, AS6
- Steps: `POST /api/tasks/{id}/complete`; `POST /api/habits/{id}/completions`
- Expected: task leaves dueToday, done +1, completedToday +1; habits completedTodayCount +1
- Result: passed

### TC-P7-BE-011 — curl: plan item toggles (curl BE-016a, BE-016)
- Story: US5  AC: AS4, AS6
- Steps: `PUT /api/plans/{id}/items/{itemId}` done for item 1, then item 2
- Expected: progressPercent 50 on the dashboard; then plan COMPLETED, leaves inProgress, completedCount +1
- Result: passed

### TC-P7-BE-012 — curl: dashboard equals lists after seed, changes and cleanup (curl BE-012, BE-017, BE-023, BE-024)
- Story: US5  AC: AS6 / SC-004
- Expected: identical at every step; back to baseline after cleanup
- Result: passed

### TC-P7-BE-013 — curl: unsupported methods / unknown path (curl BE-018..BE-021)
- Story: US5  AC: FR-026
- Steps: POST / PUT / DELETE `/api/dashboard`; GET `/api/dashboard/x`
- Expected: 405 (problem+json), 405, 405, 404 problem+json
- Result: passed

### TC-P7-BE-014 — Swagger matches contract (curl BE-022)
- Story: US5  AC: FR-026
- Steps: `curl -s http://localhost:8080/v3/api-docs | jq` on `/api/dashboard` and Dashboard* schemas
- Expected: only GET, operationId getDashboard, responses [200] → `Dashboard`; required lists 6 / 6 / 3 / 3 / 5
- Result: passed

### TC-P7-BE-015 — Backend regression
- Story: US5  AC: AS6
- Steps: `cd backend && ./mvnw -q verify` (all suites)
- Expected: 0 failures
- Result: passed — 311 tests

## Frontend tests

### TC-P7-FE-001 — Unit: `dashboard.store.spec.ts` (T099)
- Story: US5  AC: AS2-AS6 / FR-027
- Steps: `cd frontend && npx ng test --watch=false --coverage`. 19 tests: `toMetrics` maps every number (habits done = doneForCurrentPeriod count) and live plan count; loads once, lists + metrics; empty before data; plans ordered by priority/start with live rest from NowService, ended plan drops out; reload on every RefreshService bump; 60 s poll and stop on destroy; reload on app-wide plan start/end; error kept with last data, stale responses ignored; complete task optimistic (list, done, completed today, %), double click ignored, success toast, re-sync; overdue task complete; failure → error toast and rollback; habit toggle/untoggle/default date/weekly undo; 409 → info toast; plan item done/reopened with progress; a load in flight does not overwrite an optimistic change.
- Expected: all pass
- Result: passed

### TC-P7-FE-002 — Unit: `dashboard-page.component.spec.ts` (T099)
- Story: US5  AC: AS1-AS7
- Steps: 13 tests: `greetingFor` hour boundaries; skeleton while loading; greeting with name and date; 4 metric cards with exact aria-labels and links; due today / overdue / completed-today; complete task in place + re-sync; habit checklist states (not done / done today / done this week + Undo); habit toggles; plan with rest time, progress, item toggle; learning snapshot; empty states; error + Retry; 4 quick-add buttons open Add task / Add habit / Add learning card / Create plan.
- Expected: all pass
- Result: passed

### TC-P7-FE-003 — Frontend regression
- Story: US5  AC: AS6
- Steps: `npx ng test --watch=false --coverage` (all specs)
- Expected: 0 failures
- Result: passed — 17 files, 218 tests

### TC-P7-FE-004 — Landing page and greeting (Playwright)
- Story: US5  AC: AS1
- Steps: `browser_run_code_unsafe`: `goto http://localhost:4200/`; read `h1`, `time[datetime]`; compare with `GET /api/dashboard`
- Expected: redirected to `/dashboard`; h1 "Good <time of day>, Friend"; date = `today`
- Result: passed — screenshot `outputs/screenshots/phase-7-tc-fe-dashboard.png`

### TC-P7-FE-005 — Summary metric cards match the API (Playwright)
- Story: US5  AC: AS2-AS6 / SC-004
- Steps: read aria-label of `[data-metric=tasks|habits|plans|learning] a`; build expected strings from `GET /api/dashboard`
- Expected: identical (e.g. "Tasks done: 42%. 5 of 12 done · 1 completed today", "Habits this period: 2 of 5…", "Plans in progress: 2. 1 upcoming · 4 completed", "Learning milestones: 1 of 2. 1 completed in the last 7 days")
- Result: passed

### TC-P7-FE-006 — Due today / overdue / completed today (Playwright)
- Story: US5  AC: AS2
- Steps: titles of `ul[aria-label="Tasks due today"]`, ids of `ul[aria-label="Overdue tasks"]`, badges, "N completed today" note vs API
- Expected: same tasks and counts as API (3 due today, 4 overdue)
- Result: passed

### TC-P7-FE-007 — Today's habit checklist (Playwright)
- Story: US5  AC: AS3
- Steps: ids of `ul[aria-label="Today's habits"]` and badge vs API
- Expected: all 5 active habits; badge "2 / 5" = doneForCurrentPeriod / activeCount
- Result: passed

### TC-P7-FE-008 — Plans in progress with live rest time (Playwright)
- Story: US5  AC: AS4
- Steps: `li.plan` ids, `data-rest-seconds`, progress bar, "N of M done"; wait 2.1 s and re-read rest
- Expected: same order as API (priority 1 before 4), rest within 5 s of API, rest decreases live
- Result: passed

### TC-P7-FE-009 — Learning snapshot (Playwright)
- Story: US5  AC: AS5
- Steps: `[data-stat]` values vs API
- Expected: in progress 1, cards 3, last 7 days 1, milestones "1 / 2"
- Result: passed

### TC-P7-FE-010 — Quick-add opens matching create forms (Playwright)
- Story: US5  AC: AS7
- Steps: group "Quick add" → click "Add Task", "Add Habit", "Add Learning card", "Add Plan"; each: dialog visible, Cancel closes
- Expected: dialogs "Add task", "Add habit", "Add learning card", "Create plan"
- Result: passed — screenshots `phase-7-tc-fe-quickadd-{task,habit,learning,plan}.png`

### TC-P7-FE-011 — Error with Retry, skeleton loading (Playwright)
- Story: US5  AC: FR-026
- Steps: `page.route('**/api/dashboard')` → 500 problem+json "Simulated outage"; reload; click Retry with route continuing; then delay route 1.5 s, reload
- Expected: "Could not load the dashboard" + detail; Retry loads dashboard; skeleton `aria-busy` shown while slow
- Result: passed — screenshot `phase-7-tc-fe-error-retry.png`

### TC-P7-FE-012 — 375 px layout, accessible names, console (Playwright)
- Story: US5  AC: FR-026, FR-032
- Steps: `setViewportSize(375,800)`; scrollWidth − clientWidth; every `main` button/link/input has a name; h1/h2 list; console errors over all runs
- Expected: no horizontal overflow; 0 unnamed controls; headings greeting, Summary, Due today, Today's habits, Plans in progress, Learning; no console errors except the intentionally mocked 500
- Result: passed — screenshot `phase-7-tc-fe-375.png`

## Backend + Frontend tests

### TC-P7-E2E-001 — Complete a task in the UI → verify via curl
- Story: US5  AC: AS2, AS6
- Steps: seed `outputs/curl/phase-7-ui-seed.sh`; on `/dashboard` click "Complete task: P7UI due today A"; `GET /api/tasks/90`, `GET /api/dashboard`
- Expected: task DONE; row leaves Due today; done 5→6, completed today 1→2, 42 %→50 %; tasks card label equals API
- Result: passed

### TC-P7-E2E-002 — Toggle a habit in the UI → verify via curl
- Story: US5  AC: AS3, AS6
- Steps: click "Mark done for today: P7UI daily habit"; `GET /api/habits?active=true`; later "Undo today's completion: P7UI weekly habit"
- Expected: habit completedToday true, button aria-pressed true, completedTodayCount 2→3, badge "3 / 5" = API; weekly undo → API completedToday false and row "Not done this week yet"
- Result: passed

### TC-P7-E2E-003 — Tick a plan item in the UI → verify via curl
- Story: US5  AC: AS4, AS6
- Steps: in `li.plan[data-id=33]` check the first item; `GET /api/plans/33`
- Expected: API itemsDone 1, progress 33 %; UI "1 of 3 done", progress bar 33
- Result: passed — screenshot `phase-7-tc-e2e-after-toggles.png`

### TC-P7-E2E-004 — All metric cards equal curl after UI changes
- Story: US5  AC: AS6 / SC-004
- Steps: after E2E-001..003 compare tasks / habits labels with `GET /api/dashboard`
- Expected: identical
- Result: passed

### TC-P7-E2E-005 — Change via curl → dashboard reflects after refresh
- Story: US5  AC: AS1, AS6
- Steps: with dashboard open, `POST /api/tasks` due today, `POST .../milestones` done, `PUT /api/settings` displayName "P7 Tester"; reload
- Expected: new task in Due today; h1 "Good night, P7 Tester"; learning card "2 of 2"→"3 of 3"; all 4 cards = API (settings restored afterwards)
- Result: passed — screenshot `phase-7-tc-e2e-curl-reflected.png`

### TC-P7-E2E-006 — Change on another page → dashboard on return
- Story: US5  AC: AS6 / FR-027
- Steps: nav "Tasks" → "Mark as done: P7UI curl task 2" → nav "Dashboard"
- Expected: task DONE via curl; gone from Due today; all 4 cards = API
- Result: passed

### TC-P7-E2E-007 — Quick-add task in the UI → verify via curl
- Story: US5  AC: AS7, AS6
- Steps: "Add Task" → Title "P7UI quick-add task", due today → submit; `GET /api/tasks?q=P7UI quick-add`
- Expected: task created with due date today; shown in Due today; totalActive 14→15; tasks card = API
- Result: passed

### TC-P7-E2E-008 — Change via curl → dashboard updates without reload (60 s poll)
- Story: US5  AC: AS6 / FR-027
- Steps: `POST /api/tasks/95/complete` while dashboard open; wait for row to leave Due today
- Expected: updated within 60 s, no reload
- Result: passed — updated after 58 s (test data deleted with `phase-7-ui-seed.sh cleanup`; dashboard back to baseline 9 / 5 / 3 / 2)
