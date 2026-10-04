# Phase 8 — Testing (Polish & Cross-Cutting Concerns)

Mode: retest · Trial: 1 (trial 0: test) · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-8-polish.md` (from `/speckit-checklist`, 23 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T105 [TEST] Accessibility tests via Playwright MCP on all six pages in light and dark mode (`browser_snapshot` accessibility tree: every control has an accessible name, landmarks and headings present, validation messages announced; `browser_evaluate` computing contrast ratios of rendered text ≥ 4.5:1; emulated reduced motion disables animations; `browser_resize` to 375 px and 1440 px on all six pages (no horizontal overflow, navigation usable); `browser_evaluate` reading computed animation/transition durations ≤ 250 ms and confirming controls stay clickable during animations); keyboard-only walkthrough of every page action (traces US1–US6, SC-010, FR-032)
- [x] T106 [TEST] Performance tests: with 1,000 seeded tasks, curl timing for list/search/filter < 500 ms and Playwright-measured UI filter response < 500 ms; and curl timing < 500 ms for create/update/delete on tasks, habits (incl. completion), learning cards (incl. milestone), plans (incl. item toggle) and settings (traces US1–US4, US6, SC-002, SC-009)
- [x] T107 [TEST] Full regression: backend `./mvnw verify` + JaCoCo report, frontend `npx ng test --watch=false --coverage`, and the PRD §11 end-to-end flow (create task, complete task, create habit, complete habit, add learning card with milestones, build a plan from existing items, mark plan items done, verify plan achievement and dashboard update) via Playwright MCP + curl; persistence check: restart backend and confirm data and plan statuses unchanged (traces US1–US5, SC-005, SC-008)

Trial 0: T105 open (BUG-P8-002, TC-P8-FE-011), T106 open (BUG-P8-001, TC-P8-E2E-001). Trial 1 retest: both bugs closed, all tasks ticked. Results below are from trial 1 (failed cases re-run; unit tests and all end-to-end flows re-run as regression; other cases carry their trial-0 result).

## Backend tests

### TC-P8-BE-001 — Unit regression + JaCoCo (T107)
- Story: US1–US6  AC: SC-008 (all automated tests pass)
- Steps: `cd backend && ./mvnw -q verify`; read `target/surefire-reports`, `target/site/jacoco/jacoco.csv`; copy the report to `outputs/coverage/phase-8/backend/`
- Expected: exit 0, 0 failures, coverage report produced
- Result: passed (re-run in trial 1: 311 tests, 0 failures)

### TC-P8-BE-002 — curl: task list / search / filter with 1,010 tasks < 500 ms (T106; perf P-01..P-11)
- Story: US1  AC: SC-009, FR-035 (full list, no paging)
- Steps: `bash outputs/curl/phase-8-perf.sh seed` (1,000 `PERF8T` tasks), then `run`: worst of 3 `curl -w '%{http_code} %{time_total}'` for `GET /api/tasks` with no filter, `q`, `status`, `priority`, `dueFrom/dueTo`, `overdue`, `archived`, `sort/direction`, all filters combined, and `GET /api/dashboard`
- Expected: 200 and < 500 ms each; full result returned (1,010 rows)
- Result: passed (re-run in trial 1: `phase-8-perf-t1.out`)

### TC-P8-BE-003 — curl: task create / update / complete / delete < 500 ms (T106; P-12..P-15)
- Story: US1  AC: SC-002
- Steps: `POST /api/tasks`, `PUT /api/tasks/{id}`, `POST /api/tasks/{id}/complete`, `DELETE /api/tasks/{id}` with 1,010 tasks stored
- Expected: 201 / 200 / 200 / 204, each < 500 ms
- Result: passed (re-run in trial 1: `phase-8-perf-t1.out`)

### TC-P8-BE-004 — curl: habit create / update / complete / uncomplete / delete < 500 ms (T106; P-16..P-20)
- Story: US2  AC: SC-002
- Steps: `POST /api/habits`, `PUT /api/habits/{id}`, `POST /api/habits/{id}/completions`, `DELETE /api/habits/{id}/completions/{today}`, `DELETE /api/habits/{id}`
- Expected: 201 / 200 / 201 / 200 / 204, each < 500 ms
- Result: passed (re-run in trial 1: `phase-8-perf-t1.out`)

### TC-P8-BE-005 — curl: learning card + milestone CRUD < 500 ms (T106; P-21..P-26)
- Story: US3  AC: SC-002
- Steps: `POST /api/learning-cards`, `PUT …/{id}`, `POST …/{id}/milestones`, `PUT …/milestones/{mid}` (done), `DELETE …/milestones/{mid}`, `DELETE …/{id}`
- Expected: 201 / 200 / 201 / 200 / 200 / 204, each < 500 ms
- Result: passed (re-run in trial 1: `phase-8-perf-t1.out`)

### TC-P8-BE-006 — curl: plan create / item toggle / delete < 500 ms (T106; P-27..P-31)
- Story: US4  AC: SC-002
- Steps: `POST /api/plans` (one task item), `PUT /api/plans/{id}/items/{itemId}` done true then false, `DELETE /api/plans/{id}` (the contract has no plan update operation)
- Expected: 201 / 200 / 200 / 204, each < 500 ms
- Result: passed (re-run in trial 1: `phase-8-perf-t1.out`)

### TC-P8-BE-007 — curl: settings get / update < 500 ms (T106; P-32..P-34)
- Story: US6  AC: SC-002
- Steps: `GET /api/settings`, `PUT /api/settings` (changed name), `PUT /api/settings` (restore)
- Expected: 200, each < 500 ms
- Result: passed (re-run in trial 1: `phase-8-perf-t1.out`)

### TC-P8-BE-008 — curl: validation and not-found under load (V-01..V-06, N-01..N-04)
- Story: US1–US4, US6  AC: documented 400 / 404 problem responses still returned with 1,010 tasks stored
- Steps: `bash outputs/curl/phase-8-validation.sh` — empty task title, habit without frequency, empty card title, plan with empty items, empty settings body, `sort=bogus`; `GET` of id 999999 on tasks, habits, learning cards, plans
- Expected: 400 / 404 `application/problem+json` with `status` and field `errors`
- Result: passed

## Frontend tests

### TC-P8-FE-001 — Unit regression + coverage (T107)
- Story: US1–US6  AC: SC-008
- Steps: `cd frontend && npx ng test --watch=false --coverage`; copy `coverage/` to `outputs/coverage/phase-8/frontend/`
- Expected: all spec files pass
- Result: passed (re-run in trial 1: 17 files / 218 tests)

### TC-P8-FE-002 — Accessible names, landmarks, headings on 6 pages × light/dark × 1440/375 (T105)
- Story: US1–US6  AC: SC-010, FR-034
- Steps: `browser_run_code_unsafe` file `outputs/playwright/p8-a11y-audit.js`: `emulateMedia({colorScheme})`, `setViewportSize`, `goto` each page; `locator('body').ariaSnapshot()` → no `button|link|textbox|searchbox|combobox|checkbox|switch|radio|…` without a name; count `main` (=1), `h1` (=1), banner, navigation
- Expected: 0 unnamed controls; 1 main, 1 h1, banner + navigation on all 24 combinations
- Result: passed

### TC-P8-FE-003 — Rendered text contrast ≥ 4.5:1 in light and dark (T105)
- Story: US1–US6  AC: SC-010, FR-034
- Steps: same script; `page.evaluate` walks every visible text node, blends color/opacity over the composed background, computes the WCAG ratio
- Expected: every ratio ≥ 4.5
- Result: passed

### TC-P8-FE-004 — Animation/transition durations ≤ 250 ms; controls clickable during animations (T105)
- Story: US1–US6  AC: FR-032
- Steps: same script reads `animationDuration` / `transitionDuration` of every element and `document.getAnimations()`; dialog open: while the open animation runs (`getAnimations()` 140–250 ms), hit-test the Close button with `elementFromPoint` and click it
- Expected: max ≤ 250 ms; Close is hit-testable and closes the dialog during the animation
- Result: passed

### TC-P8-FE-005 — Reduced motion disables animations (T105)
- Story: US1–US6  AC: FR-032, FR-034
- Steps: `emulateMedia({reducedMotion:'reduce'})`, each page, read max duration
- Expected: ≈ 0 ms
- Result: passed

### TC-P8-FE-006 — Responsive 375 px and 1440 px: no horizontal overflow, navigation usable (T105)
- Story: US6  AC: FR-032
- Steps: `setViewportSize` 375×812 and 1440×900 on all six pages in both themes; `scrollWidth - clientWidth`; all 6 nav links visible within the viewport
- Expected: overflow 0; 6 nav links visible
- Result: passed

### TC-P8-FE-007 — Validation messages announced (T105)
- Story: US1–US4  AC: FR-034, SC-010
- Steps: `outputs/playwright/p8-keyboard-coverage.js`: open Add Task / Add Habit / Add Learning Card / Create Plan / dashboard quick-add by keyboard, Tab to the submit button, Enter with empty fields
- Expected: `role="alert"` message, field `aria-invalid="true"` + `aria-describedby` pointing at the message
- Result: passed

### TC-P8-FE-008 — Dialog keyboard behaviour: labelled, focus inside, modal, Esc closes, focus returns (T105)
- Story: US1–US5  AC: FR-034
- Steps: same script + check script: open each create dialog with Enter, read focus, Tab 25× (focus only cycles inside the modal `<dialog>` and the browser chrome, never to page controls behind), Esc
- Expected: labelled dialog, focus inside, no page control reachable behind the modal, Esc closes, focus back on the opener
- Result: passed

### TC-P8-FE-009 — Tab reachability and visible focus indicator on all six pages (T105)
- Story: US1–US6  AC: SC-010, FR-034
- Steps: `p8-keyboard-coverage.js`: mark all visible focusable elements, press Tab until each is reached, check outline / box-shadow on each focused element
- Expected: every focusable element reached by Tab and showing a focus indicator
- Result: passed

### TC-P8-FE-010 — Keyboard-only walkthrough of every page action (T105)
- Story: US1–US6  AC: SC-010 ("every page action can be done with the keyboard alone")
- Steps: `outputs/playwright/p8-keyboard-actions.js` (dark theme, only Tab/Enter/Space/arrows/typing; each result verified through the API): tasks create/complete/uncomplete/edit/search/status filter/archive/show archived/restore/delete+confirm; habits create weekly/complete/undo/edit/deactivate/reactivate/remove+confirm; learning create/expand/2 milestones/toggle milestone/note (Ctrl+Enter)/edit; plans create from existing item/toggle item/remove+confirm; settings name+landing page+save, switch+save; dashboard quick-add habit, habit checklist, complete due-today task, section link, skip link
- Expected: all 31 actions succeed
- Result: passed (re-run in trial 1: 31/31)

### TC-P8-FE-011 — Focus kept after in-place keyboard actions (T105)
- Story: US1–US5  AC: FR-034 (focus order), SC-010
- Steps: same script records `document.activeElement` 800 ms after each in-place action
- Expected: focus stays on the used control (or a logical neighbour), not `<body>`
- Result: passed (trial 1; trial 0 failed — BUG-P8-002, now closed: focus kept on the control or moved to the next row / `<main>` in 9 of 9 actions)

### TC-P8-FE-012 — No console errors during phase 8 runs
- Story: US1–US6  AC: FR-034 (no errors while using every page)
- Steps: `browser_console_messages` / console log `.playwright-mcp/console-2026-10-03T21-49-55-906Z.log` over all runs
- Expected: 0 errors, 0 warnings
- Result: passed (re-run in trial 1: 0 errors / 0 warnings in trial 1)

## Backend + Frontend tests

### TC-P8-E2E-001 — UI search/filter response < 500 ms with 1,000 tasks (T106)
- Story: US1  AC: SC-009, SC-002
- Steps: seed 1,000 tasks; `browser_run_code_unsafe`: goto `/tasks`, wait for 1,010 rows; `searchbox "Search tasks by title"`.fill('PERF8T 555') → wait until 1 row; clear; `#filter-status` = TODO / All; `#filter-priority` = HIGH / All; measure time to the expected row count; long-task observer; repeat with reduced motion
- Expected: < 500 ms for each action
- Result: passed (trial 1; `outputs/playwright/p8-perf-ui.js`, 24/24 actions < 500 ms, max 346 ms; trial 0 failed — BUG-P8-001, now closed)

### TC-P8-E2E-002 — PRD §11: create task and complete task in UI → curl (T107)
- Story: US1  AC: US1 AS1, AS3 / SC-008
- Steps: `p8-e2e-prd11.js` steps 1–2 (Add Task "P8E2E task" due today, Mark as done); `phase-8-e2e-verify.sh verify` E-01, E-02
- Expected: task stored with due date; status DONE, completedAt set
- Result: passed (re-run in trial 1: `p8-e2e-prd11-t1.js` + `phase-8-e2e-verify-t1.out`)

### TC-P8-E2E-003 — PRD §11: create habit and complete habit in UI → curl (T107)
- Story: US2  AC: US2 AS1, AS2
- Steps: steps 3–4 (Add Habit "P8E2E habit", Mark done for today); E-03, E-04
- Expected: daily active habit stored; completion for today stored
- Result: passed (re-run in trial 1: same)

### TC-P8-E2E-004 — PRD §11: learning card with milestones in UI → curl (T107)
- Story: US3  AC: US3 AS1, AS3
- Steps: step 5 (Add card "P8E2E card", expand, add 2 milestones); E-05
- Expected: card with milestones A and B stored
- Result: passed (re-run in trial 1: same)

### TC-P8-E2E-005 — PRD §11: build plan from existing items, mark items done, plan achieved → curl (T107)
- Story: US4  AC: US4 AS1, AS3, AS5 / FR-021
- Steps: steps 6–7 (Create Plan with task + habit + learning card, start now−5 min; In Progress with live rest time; tick all 3 items); E-06, E-07, E-08
- Expected: 3 items with the right sources; IN_PROGRESS with rest time, then COMPLETED, 100 %, restSeconds null, source task DONE
- Result: passed (re-run in trial 1: same)

### TC-P8-E2E-006 — PRD §11: dashboard updates accordingly (UI = curl) (T107)
- Story: US5  AC: US5 AS1–AS6, SC-004
- Steps: step 8 (dashboard text) + E-09..E-11 (deltas vs `phase-8-dash-before.json`)
- Expected: tasks done +2 / total +2 (50 %, "6 of 12 done"), habits 3 / 5, plans completed +1, cards +1, milestones +2; UI shows the same numbers
- Result: passed (re-run in trial 1: same)

### TC-P8-E2E-007 — Data changed via curl shows in the UI (T107)
- Story: US1, US3, US4, US5  AC: SC-004
- Steps: curl creates task due today, marks milestone A done, creates running plan and upcoming plan (`phase-8-e2e-curl-to-ui.out`); Playwright: dashboard, plans, tasks pages
- Expected: dashboard due-today list has the curl task, 46 %, "6 of 13 done", running plan listed, "2 upcoming · 6 completed", milestones 1 / 2; plans page shows In Progress / Not Started / Completed
- Result: passed (re-run in trial 1: `phase-8-t1-e2e-curl-to-ui.out`)

### TC-P8-E2E-008 — Persistence: restart backend, data and plan statuses unchanged (T107)
- Story: US1–US5  AC: SC-005, FR-033
- Steps: `phase-8-e2e-verify.sh snapshot phase-8-persist-before.json`; stop backend (kill pids 154777/154955); `nohup ./mvnw spring-boot:run` (new pid in `loops/loop-3-testing/state/backend.pid`); snapshot after; `diff`; Playwright plans/tasks/habits/learning/dashboard pages
- Expected: all tasks, habits (+ completions), cards, plans, plan statuses, settings and dashboard identical; UI shows the same statuses and the rest-time countdown keeps running
- Result: passed (re-run in trial 1: snapshots `phase-8-t1-persist-{before,after}.json` identical)
