# Phase 5 — Testing (User Story 4 - Build and run time-boxed plans)

Mode: test · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-5-plans.md` (from `/speckit-checklist`, 31 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T079 [TEST] [P] [US4] Backend unit tests `plan/PlanStatusCalculatorTest.java` (Not Started → In Progress → Completed across start/end boundaries, all done before start, end passed with open items, rest time only In Progress, progress rounding) and `plan/PlanItemCompletionServiceTest.java` (task → DONE, habit → today's completion once, learning untouched, undo never reverts, deleted source)
- [x] T080 [TEST] [P] [US4] Backend tests `plan/PlanServiceTest.java` (service validation: no items, end ≤ start → field `endDateTime`, archived task, inactive habit, unknown source, duplicate source → 400; acknowledgeStart idempotent; status consistent after reload from repository) and `plan/PlanControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean PlanService`: request-DTO validation 400 problem+json for blank title, `items: []`, missing estimatedDurationMinutes / priorityOrder / startDateTime / endDateTime / item sourceType / item sourceId, estimatedDurationMinutes or priorityOrder = 0, and PlanItemUpdateRequest without done; 404)
- [x] T081 [TEST] [P] [US4] Frontend unit tests `features/plans/plans.store.spec.ts` (grouping, rest time from NowService), `core/plan-start-watcher.service.spec.ts` (notifies once, acknowledges), `plan-builder-dialog.component.spec.ts`
- [x] T082 [TEST] [US4] curl tests for all 6 plan operations; Playwright MCP tests of the Todo Plans page; e2e: build plan from existing task + habit + card in UI → verify via curl; mark task item done in UI → task `DONE` and plan 33% via curl; create in-progress plan via curl → UI shows start toast once, countdown decreasing over 3 s, and plan highlighted; mark all items done → Completed in history

## Backend tests

### TC-P5-BE-001 — Unit: `PlanStatusCalculatorTest` (T079)
- Story: US4  AC: AS5 / FR-021, FR-022 (status boundaries, rest time only In Progress); AS3 / FR-020 (progress rounding)
- Steps: `cd backend && ./mvnw -q verify`. 22 tests: before start → Not Started, no rest; exactly at start → In Progress, rest = end − now; exactly at end with open items → Completed; end passed with open items; all done before start → Completed; all done while in progress → Completed, no rest; undo after all done → In Progress; no items; progress rounding (0/0, 1/3=33, 2/3=67, 1/8=13, 1/6=17, 1/200=1, 1/201=0 …), clamped 0..100.
- Expected: all pass
- Result: passed

### TC-P5-BE-002 — Unit: `PlanItemCompletionServiceTest` (T079)
- Story: US4  AC: AS4 / FR-024 (task → Done, habit → today's completion once, learning untouched, undo never reverts), AS9 (deleted source)
- Steps: `@DataJpaTest` + `replace = NONE` + real `TaskService`/`HabitService`/`LearningService` + `MutableClock` 2026-06-17T10:00Z. 9 tests: task item done → DONE + completedAt = now; already DONE keeps original completedAt; habit done/undo/redo → exactly 1 completion today; habit already completed today → no duplicate (no 409); learning card unchanged; undo never reverts task or habit; undo on open task does nothing; deleted task/habit/unknown card → no side effect, item still done; null source ignored.
- Expected: all pass
- Result: passed

### TC-P5-BE-003 — Unit: `PlanServiceTest` (T080)
- Story: US4  AC: AS1 (create, snapshot titles, trimmed), AS2 (validation), AS3/AS4 (items, side effects), AS5 (status after reload across clock), AS6 (acknowledgeStart idempotent), AS7 (order + status filter), AS8 (delete), AS9 (removed source)
- Steps: `@DataJpaTest` + `replace = NONE` + `PlanService` and real source services + `MutableClock`. 23 tests: create → In Progress, rest 3600 s, snapshots "Write report"/"Stretch"/"RxJS course"; future → Not Started, past → Completed; snapshot kept after source rename; Done (non-archived) task pickable; `items` empty/null → field `items`; end = start, end < start, end < start with different offsets → field `endDateTime`; archived task, inactive habit, unknown TASK/HABIT/LEARNING_RESOURCE, duplicate (type,id) → field `items` and nothing saved; same id different type allowed; get/delete/setItemDone/acknowledgeStart 404 (incl. item of another plan); list order prio→start, filter by derived status; delete keeps sources; set items → 33/67/100 % Completed, task DONE, habit 1 completion, card untouched, undo → In Progress 67 % (persisted after reload), task stays DONE; deleted source → `sourceAvailable=false`, still counts; archived source still available; acknowledgeStart keeps first timestamp after clock advance and reload; Not Started → In Progress (rest 3600) → rest 60 → Completed after reload while advancing clock.
- Expected: all pass
- Result: passed

### TC-P5-BE-004 — Unit: `PlanControllerTest` (T080)
- Story: US4  AC: AS1, AS2 (400 problem+json), AS3, AS6, AS7, AS8 (status codes)
- Steps: `@WebMvcTest(PlanController)`, `MockMvcTester`, `@MockitoBean PlanService`. 33 tests: list 200 (order kept), `?status=COMPLETED` passed to service, `?status=BOGUS` 400; create 201 (200-char title, duration 1, request mapped exactly); 400 problem+json with field for title `""` / `"   "` / null / missing / 201 chars, `items: []`, items missing, missing estimatedDurationMinutes / priorityOrder / startDateTime / endDateTime, duration 0/−5, priority 0/−1, item without sourceType / sourceId, invalid sourceType enum, malformed JSON — service never called; service `BadRequestException` mapped to field `endDateTime` / `items`; get 200/404/400; delete 204/404 and 204 with `Accept: application/problem+json`; setItemDone 200 (true/false), 400 for `{}` and `done: null`, 404; start-notification 200/404/400.
- Expected: all pass
- Result: passed

### TC-P5-BE-005 — curl: createPlan success + derived status (BE-001..004)
- Story: US4  AC: AS1, AS5
- Steps: `bash loops/loop-3-testing/outputs/curl/phase-5-curl.sh` (sources created first). POST plans with start −10 min/end +1 h, start +1 h, end −2 h, 200-char title.
- Expected: 201; In Progress with restSeconds ≈ 3600, 3 items, 0 %, startNotifiedAt null, snapshot titles, trimmed title; Not Started rest null; Completed (end passed, open items) 0 %; 200-char title accepted
- Result: passed

### TC-P5-BE-006 — curl: listPlans / getPlan (BE-005..012)
- Story: US4  AC: AS7
- Steps: GET `/api/plans`, `?status=IN_PROGRESS|NOT_STARTED|COMPLETED|BOGUS`, GET `/{id}`, `/999999`, `/abc`.
- Expected: 200 ordered priorityOrder asc then startDateTime asc; filters return only matching derived status; 400 for BOGUS / abc; 404 problem for unknown
- Result: passed

### TC-P5-BE-007 — curl: createPlan validation (BE-013..030)
- Story: US4  AC: AS2
- Steps: POST with empty / blank / 201-char title, `items: []`, end = start, end < start, duration 0, priority 0, missing duration+priority, missing start+end, item without sourceType / sourceId, sourceType BOOK, archived task, inactive habit, unknown card, duplicate source, malformed JSON.
- Expected: 400 `application/problem+json` with `errors[].field` = title / items / endDateTime / estimatedDurationMinutes / priorityOrder / startDateTime / sourceType / sourceId as appropriate
- Result: passed

### TC-P5-BE-008 — curl: setPlanItemDone + side effects (BE-031..046)
- Story: US4  AC: AS3, AS4
- Steps: PUT task item done → GET task; habit item done → GET completions; habit undo+redo; learning item done → GET card; undo task item → GET task; undo habit; `{}`, `{"done":null}`, unknown item, unknown plan, item of another plan, `items/abc`.
- Expected: 33 % → task DONE; 67 % → 1 completion (stays 1 after undo/redo); 100 % Completed rest null → card unchanged; undo → In Progress 67 %, task stays DONE, habit completion kept; 400 field `done`; 404 problem for unknown/foreign; 400 for abc
- Result: passed

### TC-P5-BE-009 — curl: acknowledgePlanStart (BE-047..050)
- Story: US4  AC: AS6
- Steps: POST `/{id}/start-notification` twice 1 s apart, unknown id, `abc`.
- Expected: 200 with startNotifiedAt set; second call returns the same timestamp; 404; 400
- Result: passed

### TC-P5-BE-010 — curl: removed source (BE-051..052)
- Story: US4  AC: AS9
- Steps: DELETE source task, GET plan, PUT its item done.
- Expected: item kept with `sourceAvailable=false` and its title; itemsTotal 3; still counts (2/3 → 67 %)
- Result: passed

### TC-P5-BE-011 — curl: deletePlan (BE-053..059)
- Story: US4  AC: AS8
- Steps: DELETE with `Accept: application/problem+json`, GET, DELETE again, DELETE `abc`, GET habit and card, cleanup.
- Expected: 204; 404; 404; 400; sources 200 unchanged; no tagged plans left
- Result: passed

## Frontend tests

### TC-P5-FE-001 — Unit: `plans.store.spec.ts` (T081)
- Story: US4  AC: AS3, AS5, AS7, AS8
- Steps: `cd frontend && npx ng test --watch=false --coverage`. 16 tests: `derivePlanStatus` boundaries and all-done; `toPlanView` rest only In Progress; `withItems` 33/67 %; `compareActive` / `compareHistory`; no load before `start()`; grouping active [P1 upcoming, P2 in progress] / history; rest time and status re-derived from a fake `NowService` (−3 s after 3 s, upcoming flips at start, in-progress moves to history at end); reload on foreign refresh bump only; stale/failed loads; create + field errors; optimistic item toggle then server plan; last item done → Completed in history immediately; rollback on 500 and reload on 404; remove optimistic/restore/404; acknowledgeStart.
- Expected: all pass
- Result: passed

### TC-P5-FE-002 — Unit: `plan-start-watcher.service.spec.ts` (T081)
- Story: US4  AC: AS6 / FR-023
- Steps: 6 tests with fake `PlansStore.views` signal + `NotificationService`: start() idempotent; In Progress + `startNotifiedAt` null → one `notify('Plan started: …', {kind: info, browser: true, message: '3 items · … left'})`, `acknowledgeStart(id)` and highlight; re-emits do not notify again; Not Started / Completed / acknowledged plans not notified; upcoming plan notified when it flips to In Progress; singular "1 item"; highlight dropped when no longer In Progress.
- Expected: all pass
- Result: passed

### TC-P5-FE-003 — Unit: `plan-builder-dialog.component.spec.ts` (T081)
- Story: US4  AC: AS1, AS2
- Steps: 16 tests: `validatePlanForm` (items, blank title, end ≤ start, 200/201 chars, duration ≥ 1 / whole numbers, start/end required, priority ≥ 1), `durationMinutes`, `toLocalInput`/`parseLocalInput`; component: opens modal step 1, lists non-archived tasks only (open first), active habits only, all cards; search filter; Next without items blocked; chips + tab counts + remove chip; step 2 client errors and no `create`; end follows start + duration; create request (trimmed title, 90 min, ISO times, 3 items in pick order) → success toast and `closed(plan)`; server `errors[]` endDateTime shown + "Please fix the highlighted fields."; items error returns to step 1; Cancel closes with null.
- Expected: all pass
- Result: passed

### TC-P5-FE-004 — Empty state
- Story: US4  AC: AS10
- Steps: delete all plans via curl; `browser_navigate` http://localhost:4200/plans; `browser_snapshot`.
- Expected: heading "No plans yet" with guidance and a "Create Plan" button
- Screenshot: `outputs/screenshots/p5-fe-001-empty.png`
- Result: passed

### TC-P5-FE-005 — Builder step 1: pick items
- Story: US4  AC: AS1, AS2
- Steps: `browser_click` empty-state "Create Plan"; `browser_click` Next (no items); `browser_run_code_unsafe`: fill search "P5E2E", check "P5E2E Write summary", tab Habits → check "P5E2E Read 10 pages", tab Learning → check "P5E2E Angular signals".
- Expected: "Select at least one item." and stays on step 1; focus in search; search narrows to 1 match; 3 chips; tab counts "Tasks 1 / Habits 1 / Learning 1"
- Screenshot: `outputs/screenshots/p5-fe-002-builder-step1.png`
- Result: passed

### TC-P5-FE-006 — Builder lists only pickable sources
- Story: US4  AC: AS1 (active, non-archived only)
- Steps: seed archived task "P5E2E archived task" (id 64) and inactive habit "P5E2E inactive habit" (id 32) via `phase-5-ui-seed.sh`; open builder; read Tasks and Habits options.
- Expected: archived task and inactive habit absent; open tasks first, Done task last
- Screenshot: `outputs/screenshots/p5-fe-008-server-items-error.png` (Tasks tab list)
- Result: passed

### TC-P5-FE-007 — Builder step 2: client validation
- Story: US4  AC: AS2
- Steps: Next → step 2; fill hours 0, minutes 0, end = start, priority 0, empty title; click "Create plan"; count POST /api/plans.
- Expected: focus on Title; 4 messages (title required, duration ≥ 1 min, end after start, priority ≥ 1); 0 POST requests
- Screenshot: `outputs/screenshots/p5-fe-003-builder-validation.png`
- Result: passed

### TC-P5-FE-008 — Grouping, order, truncation, Not Started without rest time
- Story: US4  AC: AS5, AS7
- Steps: seed plans 18 (P1, tomorrow, 151-char title), 19 (P3, +2 h), 20 (P4, +3 h); reload /plans; read sections.
- Expected: "Active & upcoming": P1 in progress (start now) → P1 tomorrow → P3 → P4; Not Started cards without countdown; long title truncated (scrollWidth > clientWidth) with full text in `title` (151 chars); "History": completed plan with "Final 100% · 3 of 3 done"
- Screenshot: `outputs/screenshots/p5-fe-004-grouping-order.png`
- Result: passed

### TC-P5-FE-009 — Removed source label
- Story: US4  AC: AS9
- Steps: plan 20 created with temp task 63, task deleted via curl; reload /plans.
- Expected: the item shows "removed source"
- Screenshot: `outputs/screenshots/p5-fe-004-grouping-order.png` (P4 card)
- Result: passed

### TC-P5-FE-010 — Undo an item
- Story: US4  AC: AS3, AS4 (undo never reverts source)
- Steps: on completed plan "P5E2E UI focus block" uncheck the Task item.
- Expected: PUT `{"done":false}` 200; card moves to "Active & upcoming", 67 %, In Progress with countdown; task 62 still DONE
- Screenshot: `outputs/screenshots/p5-fe-005-undo.png`
- Result: passed

### TC-P5-FE-011 — Remove plan with confirm
- Story: US4  AC: AS8
- Steps: "Remove" on "P5E2E upcoming P3" → Escape (cancel) → "Remove" → confirm "Remove".
- Expected: confirm text names plan + "1 item(s)" + sources unaffected; cancel keeps the card; confirm sends DELETE /api/plans/19 → 204 and the card disappears
- Screenshot: `outputs/screenshots/p5-fe-007-remove-confirm.png`
- Result: passed

### TC-P5-FE-012 — Server `errors[]` (items) in builder
- Story: US4  AC: AS1, AS2
- Steps: open builder, check "P5E2E late archive" (task 65), archive task 65 via fetch, Next, title "P5E2E should fail", Create plan.
- Expected: POST 400 `errors:[{field:items,…}]`; builder returns to step 1 with "Task 65 does not exist or is archived" and "Please fix the highlighted fields."; Cancel closes
- Screenshot: `outputs/screenshots/p5-fe-008-server-items-error.png`
- Result: passed

### TC-P5-FE-013 — Keyboard tabs and narrow viewport
- Story: US4  AC: AS1
- Steps: resize 375×800; check horizontal overflow of page and dialog; focus Tasks tab, ArrowRight ×2, Home, Escape.
- Expected: no overflow; Learning tab selected+focused, tabpanel labelled by it, options are cards; Home → Tasks; Escape closes
- Screenshot: `outputs/screenshots/p5-fe-009-narrow.png`
- Result: passed

### TC-P5-FE-014 — Console clean
- Story: US4  AC: all (no runtime errors)
- Steps: `browser_console_messages` level warning for the session.
- Expected: no app errors/warnings (only the expected 400 of FE-012 and the 404 of the test's own fetch in FE-011)
- Result: passed

## Backend + Frontend tests

### TC-P5-E2E-001 — Build plan in UI → verify via curl
- Story: US4  AC: AS1
- Steps: builder with task 62 + habit 31 + card 17, title "P5E2E UI focus block", 1 h 0 m, start now−2 min, end now+60 min, priority 2 → Create plan; `curl -s http://localhost:8080/api/plans`.
- Expected: plan 16: IN_PROGRESS, priority 2, 60 min, 3 items with snapshot titles, done false; dialog closed; card rendered with "Just started"
- Screenshot: `outputs/screenshots/p5-e2e-002-task-item-done.png` (created card; the post-create capture timed out waiting for the 10 s toast region, data verified via curl)
- Result: passed

### TC-P5-E2E-002 — Mark task item done in UI → curl
- Story: US4  AC: AS3, AS4
- Steps: check "Task: P5E2E Write summary" on plan 16; `curl -s http://localhost:8080/api/tasks/62`; `curl -s http://localhost:8080/api/plans/16`.
- Expected: PUT /api/plans/16/items/27 `{"done":true}` 200; UI 33 %; task DONE with completedAt; plan 33 %, itemsDone 1
- Screenshot: `outputs/screenshots/p5-e2e-002-task-item-done.png`
- Result: passed

### TC-P5-E2E-003 — In-progress plan created via curl → toast, highlight, countdown
- Story: US4  AC: AS5, AS6
- Steps: `curl -X POST /api/plans` (start −1 min, end +45 min, 2 items) → plan 17; navigate to /tasks; wait for toast; navigate to Todo Plans; read `data-rest-seconds` twice 3.1 s apart.
- Expected: toast "Plan started: P5E2E curl started plan 2 items · 44m 52s left" on the Tasks page; one POST /api/plans/17/start-notification; card has `is-highlighted` and "Just started"; rest 2691 → 2688 (−3 s), "44m 51s" → "44m 48s", `aria-live="off"`
- Screenshots: `outputs/screenshots/p5-e2e-003-start-toast.png`, `p5-e2e-003-highlight-countdown.png`
- Result: passed

### TC-P5-E2E-004 — Notified once (reload)
- Story: US4  AC: AS6
- Steps: reload /plans, wait 3 s; fetch plans.
- Expected: no "Plan started" toast, no start-notification request; plans 16 and 17 keep their startNotifiedAt
- Result: passed

### TC-P5-E2E-005 — All items done → Completed in history
- Story: US4  AC: AS3, AS4, AS5, AS7
- Steps: check Habit and Learning items of plan 16 (task already done); `curl` plan 16, habit 31, completions, card 17.
- Expected: card in "History" with "100% … Completed … Final 100% · 3 of 3 done", no countdown; API COMPLETED 100 % restSeconds null; habit completedToday true with 1 completion; card 17 NOT_STARTED 0 %
- Screenshot: `outputs/screenshots/p5-e2e-004-history.png`
- Result: passed

### TC-P5-E2E-006 — Item changed via curl → UI shows new progress
- Story: US4  AC: AS3
- Steps: `curl -X PUT /api/plans/17/items/<learningItem> -d '{"done":true}'` → 50 %; reload /plans.
- Expected: card "P5E2E curl started plan" shows 50 % In Progress
- Result: passed

### TC-P5-E2E-007 — Live start boundary without reload
- Story: US4  AC: AS5, AS6
- Steps: `curl -X POST /api/plans` with start = now+45 s (plan 21); reload /plans; card shows Not Started; wait for toast.
- Expected: at the start time (17:57:20Z) the card flips to In Progress with countdown "29m 14s left", "Just started", `is-highlighted`; toast "Plan started: P5E2E starts soon"; one POST /api/plans/21/start-notification
- Screenshot: `outputs/screenshots/p5-e2e-006-live-start.png`
- Result: passed

### TC-P5-E2E-008 — Remove in UI → curl
- Story: US4  AC: AS8
- Steps: remove plan 19 in UI (TC-P5-FE-011); fetch `/api/plans/19` and `/api/learning-cards/17`.
- Expected: plan 404; card 17 still present
- Result: passed
