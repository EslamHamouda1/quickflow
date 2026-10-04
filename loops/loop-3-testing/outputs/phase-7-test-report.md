# Phase 7 — Test report (US5 See everything on a dashboard)

Mode: test · Trial: 0 · Started 2026-10-04T00:23:55+03:00 · Ended 2026-10-04T00:37:00+03:00 · Result: **passed**

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 15 | 15 | 0 | 0 |
| Frontend tests | 12 | 12 | 0 | 0 |
| Backend + Frontend tests | 8 | 8 | 0 | 0 |
| **All** | **35** | **35** | **0** | **0** |

Tasks ticked: T098, T099, T100. Bugs: none.

## Unit tests and coverage

| Suite | Command | Result | Line | Branch |
|---|---|---|---|---|
| Backend (JaCoCo) | `cd backend && ./mvnw -q verify` | 311 tests, 0 failures (new: DashboardServiceTest 11, DashboardControllerTest 4) | 97.8% (dashboard package 100%) | 96.2% (DashboardService 100%) |
| Frontend (Angular unit-test, v8) | `cd frontend && npx ng test --watch=false --coverage` | 17 files, 218 tests pass (new: dashboard.store.spec 19, dashboard-page.component.spec 13) | 65.68% (features/dashboard 98.45%) | 51.13% (features/dashboard 94.42%) |

Coverage reports: `outputs/coverage/phase-7/backend/`, `outputs/coverage/phase-7/frontend/`.

Test code added:
- `backend/src/test/java/com/quickflow/dashboard/DashboardServiceTest.java`
- `backend/src/test/java/com/quickflow/dashboard/DashboardControllerTest.java`
- `backend/src/test/java/com/quickflow/dashboard/MutableClock.java` (test clock, copy of the plan package one)
- `frontend/src/app/features/dashboard/dashboard.store.spec.ts`
- `frontend/src/app/features/dashboard/dashboard-page.component.spec.ts`
- `loops/loop-3-testing/outputs/curl/phase-7-curl.sh` (output `phase-7-curl.out`)
- `loops/loop-3-testing/outputs/curl/phase-7-ui-seed.sh` (seed + `cleanup` for the Playwright runs)

Note: one store test initially failed because the fixture used a fixed date (2026-06-17) while the optimistic habit helper compares with the browser's local today; the fixture was corrected to use `todayIso()`. Not an application defect (the server's `today` and the browser's local date agree in the running app).

## Smoke

`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200` → both 200.

## curl (script `outputs/curl/phase-7-curl.sh`, 25/25 PASS)

Requests: `curl -s -o r.json -w '%{http_code} %{content_type}' -X <M> [-H 'Content-Type: application/json' --data '<body>'] http://localhost:8080<path>`, asserted with `jq`. The function `expected()` recomputes every dashboard number from `GET /api/tasks` (non-archived), `GET /api/habits?active=true`, `GET /api/plans`, `GET /api/learning-cards`: dueToday = dueDate==today && status!=DONE; overdue = `.overdue`; completedToday = completedAt local date == today; percent = round(done×100/total); habits completedToday; plans by status (IN_PROGRESS ids in list order); learning counts and done milestones with completedAt ≥ now − 7 d.

| ID | Request | Expected | Actual |
|---|---|---|---|
| BE-001 | `GET /api/dashboard` | 200 json, all required fields | 200 |
| BE-002 | `.today` | 2026-10-04 (server local date) | 2026-10-04 |
| BE-003 | `.greetingName` vs `GET /api/settings` | Friend | Friend |
| BE-004 | dashboard vs lists (baseline) | identical | identical (9 active, 5 done, 56 %) |
| seed | `POST /api/tasks` ×4 (due today, due yesterday, due today → `POST /{id}/archive`, DONE), `POST /api/habits` ×2 (one `POST /{id}/deactivate`), `POST /api/learning-cards` + `POST /{id}/milestones` ×2, `POST /api/plans` running (priority 1) + upcoming (priority 2) | | |
| BE-005 | dueToday ids | seeded task in, archived / done not in | ✓ |
| BE-006 | overdue length | +1 → 4 | 4 |
| BE-007 | totalActive | +3 → 12 | 12 |
| BE-008 | doneCount / completedTodayCount | 6 / 2 | 6 / 2 |
| BE-009 | habits activeCount, inactive excluded | 4 | 4 |
| BE-010 | inProgress[0], restSeconds > 2900, progress 0, upcoming +1 | seeded plan | ✓ |
| BE-011 | cardsTotal / milestonesTotal | 3 / 2 | 3 / 2 |
| BE-012 | dashboard vs lists (after seed) | identical | identical |
| BE-013 | `POST /api/tasks/{id}/complete` | leaves dueToday, done +1, completedToday +1 | ✓ |
| BE-014 | `POST /api/habits/{id}/completions {}` | completedTodayCount +1 → 3 | 3 |
| BE-015 | `PUT /api/learning-cards/{id}/milestones/{mid} {"title":"m1","done":true}` | done / last7 / inProgress +1 | 1/1/1 |
| BE-016a | `PUT /api/plans/{id}/items/{item1} {"done":true}` | progressPercent 50 | 50 |
| BE-016 | `PUT /api/plans/{id}/items/{item2} {"done":true}` | plan COMPLETED, out of inProgress, completedCount +1 | ✓ |
| BE-017 | dashboard vs lists (after changes) | identical | identical |
| BE-018 | `POST /api/dashboard` | 405 problem+json | 405 |
| BE-019 | `PUT /api/dashboard {}` | 405 | 405 |
| BE-020 | `DELETE /api/dashboard` | 405 | 405 |
| BE-021 | `GET /api/dashboard/x` | 404 problem+json | 404 |
| BE-022 | `GET /v3/api-docs` | getDashboard, [200] → Dashboard; required 6/6/3/3/5 | ✓ |
| BE-023 | dashboard vs lists (after cleanup) | identical | identical |
| BE-024 | totals back to baseline | [9,5,3,2] | [9,5,3,2] |

Side observation: `priorityOrder: 0` is rejected with 400 `errors[priorityOrder] "Priority order must be at least 1"` (per contract; first script draft used 0).

## Playwright MCP (headless chromium, `browser_run_code_unsafe` unless noted)

Seed: `bash outputs/curl/phase-7-ui-seed.sh` → tasks 90, 91 (due today), 92 (overdue), habits 41 (daily), 42 (weekly), card 22 (1 of 2 milestones done), plan 33 (in progress, 3 items). Cleanup: `phase-7-ui-seed.sh cleanup '{"tasks":[90..95],"habits":[41,42],"cards":[22],"plans":[33]}'`.

| Case | Steps (tool · target · value) | Result |
|---|---|---|
| FE-004 | `page.goto('/')` → URL `/dashboard`; `h1` "Good night, Friend"; `time[datetime]` 2026-10-04 = API today | PASS — `screenshots/phase-7-tc-fe-dashboard.png` |
| FE-005 | aria-label of `[data-metric=*] a` vs strings built from `GET /api/dashboard` | PASS (4/4 identical) |
| FE-006 | `ul[aria-label="Tasks due today"] .title`, `ul[aria-label="Overdue tasks"] li[data-id]`, `[data-count]` badges, "1 completed today" | PASS |
| FE-007 | `ul[aria-label="Today's habits"] li[data-id]`, badge "2 / 5" | PASS |
| FE-008 | `li.plan` ids [33, 20], `.rest__value[data-rest-seconds]` vs API (±5 s), wait 2.1 s → decreased | PASS |
| FE-009 | `[data-stat=in-progress|cards|last7] .count-up[data-value]`, `[data-stat=milestones]` | PASS (1, 3, 1, "1 / 2") |
| FE-010 | `getByRole('group',{name:'Quick add'})` → buttons Add Task / Add Habit / Add Learning card / Add Plan; each opens dialog "Add task" / "Add habit" / "Add learning card" / "Create plan"; Cancel closes | PASS — `phase-7-tc-fe-quickadd-{task,habit,learning,plan}.png` |
| FE-011 | `page.route('**/api/dashboard')` 500 problem+json → "Could not load the dashboard" + "Simulated outage"; Retry → loaded; 1.5 s delayed route → skeleton `[aria-busy=true][aria-label="Loading dashboard"]` | PASS — `phase-7-tc-fe-error-retry.png` |
| FE-012 | `setViewportSize(375,800)` overflow 0; unnamed controls in main 0; headings: greeting, Summary, Due today, Today's habits, Plans in progress, Learning; console errors: only the mocked 500 | PASS — `phase-7-tc-fe-375.png` |
| E2E-001 | click button "Complete task: P7UI due today A" → `GET /api/tasks/90` DONE; done 5→6, completed today 1→2, 42 %→50 %; card label = API | PASS |
| E2E-002 | click "Mark done for today: P7UI daily habit" → API completedToday true, aria-pressed true, completedTodayCount 2→3, badge "3 / 5" = API; click "Undo today's completion: P7UI weekly habit" → API completedToday false, row "Not done this week yet" | PASS |
| E2E-003 | `li.plan[data-id=33]` first checkbox `.check()` → `GET /api/plans/33` itemsDone 1, 33 %; UI "1 of 3 done", bar 33 | PASS — `phase-7-tc-e2e-after-toggles.png` |
| E2E-004 | tasks / habits labels vs `GET /api/dashboard` after E2E-001..003 | PASS |
| E2E-005 | dashboard open; curl `POST /api/tasks` (due today), `POST /api/learning-cards/22/milestones {"title":"P7UI m3","done":true}`, `PUT /api/settings displayName "P7 Tester"`; `page.reload()` → new task shown, h1 "Good night, P7 Tester", learning "3 of 3 … 3 completed in the last 7 days", 4 cards = API; settings restored | PASS — `phase-7-tc-e2e-curl-reflected.png` |
| E2E-006 | nav link "Tasks" → button "Mark as done: P7UI curl task 2" → nav link "Dashboard" → task gone from Due today, 4 cards = API | PASS |
| E2E-007 | "Add Task" → Title "P7UI quick-add task", Due date today → submit → API has task (due 2026-10-04); in Due today; totalActive 14→15; card = API | PASS |
| E2E-008 | curl `POST /api/tasks/95/complete`, no reload; `waitForFunction` row gone | PASS (58 s, within the 60 s poll) |

All P7UI and P7QA test data deleted; settings back to defaults; dashboard back to baseline.

## Bugs

None.
