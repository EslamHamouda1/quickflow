# Phase 5 — Test report (User Story 4 - Build and run time-boxed plans)

Mode: test · Trial: 0 · Started 2026-10-03T20:44:55+03:00 · Ended 2026-10-03T20:59:30+03:00
Phase file: `loops/loop-3-testing/outputs/phase-5-testing.md` · Checklist: `specs/001-quickflow-productivity/checklists/phase-5-plans.md`
**Result: passed**, 33/33 · Tasks ticked: T079, T080, T081, T082 · Bugs: none

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 11 | 11 | 0 | 0 |
| Frontend tests | 14 | 14 | 0 | 0 |
| Backend + Frontend tests | 8 | 8 | 0 | 0 |
| **All** | **33** | **33** | **0** | **0** |

Smoke (`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200`): both OK (200).
All 6 Plans operations exercised: `listPlans`, `createPlan`, `getPlan`, `deletePlan`, `setPlanItemDone`, `acknowledgePlanStart`.

## Bugs

None.

## Coverage

| Area | Tests | Line % | Branch % | Report |
|---|---|---|---|---|
| Backend (JaCoCo, whole app) | 271 (new: PlanStatusCalculatorTest 22, PlanItemCompletionServiceTest 9, PlanServiceTest 23, PlanControllerTest 33) | 97.8 (728/744) | 95.9 (185/193) | `outputs/coverage/phase-5/backend/index.html` |
| Backend `com.quickflow.plan*` | — | 98.3 (178/181) | 100 (51/51) | same |
| Frontend (vitest v8, whole app) | 164 in 13 files (38 new) | 55.34 (stmts 57.23) | 43.37 | `outputs/coverage/phase-5/frontend/quickflow/index.html` |
| Frontend `plans.store.ts` | 16 | stmts 98.0 | 86.7 | same |
| Frontend `core/plan-start-watcher.service.ts` | 6 | stmts 97.4 | 94.4 | same |
| Frontend `plan-builder-dialog.component.ts` | 16 | stmts 89.3 | 75.0 | same |

The whole-app frontend line % is slightly lower than phase 4 (56.09). The generated `api/api/plans.service.ts` is mocked in the specs, and `plans-page` / `plan-card` were tested with Playwright, not unit specs. T081 only covers the store, watcher and builder specs.

## Test code added

- `backend/src/test/java/com/quickflow/plan/PlanStatusCalculatorTest.java`, `PlanItemCompletionServiceTest.java`, `MutableClock.java` (T079)
- `backend/src/test/java/com/quickflow/plan/PlanServiceTest.java`, `PlanControllerTest.java` (T080)
- `frontend/src/app/features/plans/plans.store.spec.ts`, `frontend/src/app/core/plan-start-watcher.service.spec.ts`, `frontend/src/app/features/plans/plan-builder-dialog.component.spec.ts` (T081)
- `loops/loop-3-testing/outputs/curl/phase-5-curl.sh` (T082 curl script; output in `phase-5-curl.out`, 59/59 PASS) and `phase-5-ui-seed.sh` (seed data for the UI cases)

## curl commands (TC-P5-BE-005..011)

The script uses `curl -s -o $OUT -w '%{http_code} %{content_type}' -X <method> [-H 'Accept: …'] -H 'Content-Type: application/json' --data <body> <url>` and checks each body with jq. It first creates its own sources (2 tasks, 1 archived task, 1 active habit, 1 inactive habit, 1 card) with a random tag, and deletes everything at the end.

| # | Request | Expected | Actual | Key body check |
|---|---|---|---|---|
| BE-001 | `POST /api/plans` title "  tag in progress  ", start −10 min, end +1 h, P50, 3 items | 201 | 201 | IN_PROGRESS, restSeconds 3599, 3 items, 0 %, startNotifiedAt null, title trimmed, snapshot titles |
| BE-002 | `POST /api/plans` start +1 h | 201 | 201 | NOT_STARTED, restSeconds null |
| BE-003 | `POST /api/plans` end −2 h | 201 | 201 | COMPLETED, 0 %, restSeconds null |
| BE-004 | `POST /api/plans` 200-char title | 201 | 201 | title length 200 |
| BE-005 | `GET /api/plans` | 200 | 200 | order 13,14,12,15 = priority asc, start asc |
| BE-006..008 | `GET /api/plans?status=IN_PROGRESS|NOT_STARTED|COMPLETED` | 200 | 200 | only the matching derived status |
| BE-009 | `GET /api/plans?status=BOGUS` | 400 | 400 | problem+json |
| BE-010 | `GET /api/plans/{P}` | 200 | 200 | id, IN_PROGRESS |
| BE-011 | `GET /api/plans/999999` | 404 | 404 | "Plan 999999 not found" |
| BE-012 | `GET /api/plans/abc` | 400 | 400 | problem+json |
| BE-013..015 | `POST` title "" / "   " / 201 chars | 400 | 400 | field `title` ("Title must be 1-200 characters") |
| BE-016 | `POST` `items: []` | 400 | 400 | field `items` ("Select at least one item") |
| BE-017/018 | `POST` end = start / end < start | 400 | 400 | field `endDateTime` ("End date-time must be after start date-time") |
| BE-019/020 | `POST` duration 0 / priority 0 | 400 | 400 | fields `estimatedDurationMinutes` / `priorityOrder` |
| BE-021 | `POST` without duration + priority | 400 | 400 | both fields |
| BE-022 | `POST` without start + end | 400 | 400 | `startDateTime`, `endDateTime` |
| BE-023/024 | `POST` item without sourceType / sourceId | 400 | 400 | field `items[0].sourceType` / `items[0].sourceId` |
| BE-025 | `POST` sourceType BOOK | 400 | 400 | problem+json |
| BE-026 | `POST` archived task | 400 | 400 | `items`: "Task 61 does not exist or is archived" |
| BE-027 | `POST` inactive habit | 400 | 400 | `items`: "Habit 30 does not exist or is inactive" |
| BE-028 | `POST` unknown card 999999 | 400 | 400 | `items` |
| BE-029 | `POST` duplicate source | 400 | 400 | `items`: "Duplicate item TASK 59" |
| BE-030 | `POST` `{bad` | 400 | 400 | problem+json |
| BE-031 | `PUT /api/plans/{P}/items/{task} {"done":true}` | 200 | 200 | itemsDone 1, 33 %, IN_PROGRESS |
| BE-032 | `GET /api/tasks/{T}` | 200 | 200 | DONE, completedAt set |
| BE-033 | `PUT …/items/{habit} {"done":true}` | 200 | 200 | 67 % |
| BE-034/035 | `GET /api/habits/{H}/completions` (after done; after undo + redo) | 200 | 200 | length 1 |
| BE-036 | `PUT …/items/{card} {"done":true}` | 200 | 200 | COMPLETED, 100 %, restSeconds null |
| BE-037 | `GET /api/learning-cards/{C}` | 200 | 200 | NOT_STARTED, no milestones |
| BE-038 | `PUT …/items/{task} {"done":false}` | 200 | 200 | IN_PROGRESS, 67 %, restSeconds > 0 |
| BE-039/040 | `GET` task / habit completions after undo | 200 | 200 | task DONE; 1 completion |
| BE-041/042 | `PUT …/items/{task}` `{}` / `{"done":null}` | 400 | 400 | field `done` |
| BE-043/044/045 | `PUT` unknown item / unknown plan / item of another plan | 404 | 404 | problem+json 404 |
| BE-046 | `PUT /api/plans/{P}/items/abc` | 400 | 400 | problem+json |
| BE-047 | `POST /api/plans/{P}/start-notification` | 200 | 200 | startNotifiedAt 2026-10-03T20:52:57.859849+03:00 |
| BE-048 | same, 1 s later | 200 | 200 | same timestamp (idempotent) |
| BE-049/050 | unknown id / `abc` | 404 / 400 | 404 / 400 | problem+json |
| BE-051 | `DELETE /api/tasks/{T}`, then `GET /api/plans/{P}` | 200 | 200 | task item sourceAvailable false, itemsTotal 3 |
| BE-052 | `PUT …/items/{task} {"done":true}` | 200 | 200 | 2/3 (removed source still counts) |
| BE-053 | `DELETE /api/plans/{P}` with `Accept: application/problem+json` | 204 | 204 | — |
| BE-054/055 | `GET` / `DELETE` again | 404 | 404 | problem+json |
| BE-056 | `DELETE /api/plans/abc` | 400 | 400 | problem+json |
| BE-057/058 | `GET` habit / card | 200 | 200 | sources unaffected |
| BE-059 | `GET /api/plans` after cleanup | 200 | 200 | no tagged plans left |

E2E curl commands:
- `curl -s http://localhost:8080/api/plans | jq '.[]|{id,title,status,priorityOrder,estimatedDurationMinutes,startNotifiedAt,itemsTotal,progressPercent,items}'` (E2E-001)
- `curl -s http://localhost:8080/api/tasks/62`, `curl -s http://localhost:8080/api/plans/16` (E2E-002 → DONE; 33 %)
- `curl -X POST http://localhost:8080/api/plans -H 'Content-Type: application/json' -d '{"title":"P5E2E curl started plan","estimatedDurationMinutes":45,"startDateTime":"<now−1m>","endDateTime":"<now+45m>","priorityOrder":1,"items":[{"sourceType":"LEARNING_RESOURCE","sourceId":17},{"sourceType":"HABIT","sourceId":31}]}'` (E2E-003 → id 17, startNotifiedAt null)
- `curl -s http://localhost:8080/api/plans/16`, `/api/habits/31`, `/api/habits/31/completions`, `/api/learning-cards/17` (E2E-005 → COMPLETED 100 % null; completedToday true; 1; NOT_STARTED 0 %)
- `curl -X PUT http://localhost:8080/api/plans/17/items/<learningItem> -d '{"done":true}'` (E2E-006 → 50 %)
- `curl -X POST http://localhost:8080/api/plans … "startDateTime":"<now+45s>" …` (E2E-007 → id 21 NOT_STARTED)
- `bash loops/loop-3-testing/outputs/curl/phase-5-ui-seed.sh 17` (plans 18/19/20, temp task 63 deleted, archived task 64, inactive habit 32, task 65)

## Playwright steps (headless chromium, http://localhost:4200)

| Case | Steps (tool → target → value) | Observed |
|---|---|---|
| FE-004 | `browser_navigate` /plans → `browser_snapshot` | "No plans yet" + guidance + "Create Plan" |
| FE-005 | `browser_click` empty-state "Create Plan" → `browser_click` Next → `browser_evaluate` errors → `browser_run_code_unsafe`: search fill "P5E2E", check task, tab Habits, check habit, tab Learning, check card | "Select at least one item."; filtered to 1; 3 chips; tabs "Tasks 1/Habits 1/Learning 1" |
| FE-007 | Next → fill `#plan-hours` 0, `#plan-minutes` 0, `#plan-end` = start, `#plan-priority` 0 → click "Create plan" | focus `plan-title`; 4 field messages; 0 POST |
| E2E-001 | fill `#plan-title` "P5E2E UI focus block", hours 1, minutes 0, start now−2 min, end now+60 min, priority 2 → "Create plan" | POST 201, dialog closed, card "In Progress P2 Just started", ack POST sent |
| E2E-002 | card "P5E2E UI focus block" → check "Task: P5E2E Write summary" | PUT /plans/16/items/27 `{"done":true}` 200, card 33 % |
| E2E-003 | `page.goto` /tasks → wait toast → click "Todo Plans" → read `[data-rest-seconds]`, wait 3.1 s, read again | toast "Plan started: P5E2E curl started plan 2 items · 44m 52s left"; 1 ack; `is-highlighted` + "Just started"; 2691 → 2688; aria-live off |
| E2E-004 | `page.reload` → wait 3 s | 0 toasts, 0 ack requests |
| E2E-005 | check Habit, then Learning items of plan 16 | card in History "100% … Completed … Final 100% · 3 of 3 done", no countdown |
| FE-008/009 | reload after seed → evaluate sections | order [P1 now, P1 tomorrow, P3, P4]; Not Started without countdown; long title truncated, `title` 151 chars; "removed source" on plan 20 |
| FE-010 | uncheck "Task" on plan 16 | PUT `{"done":false}` 200; moves to Active, 67 %, task 62 still DONE |
| FE-006/012 | "Create Plan" → read Tasks/Habits options → check "P5E2E late archive" → archive task 65 via fetch → Next → title → "Create plan" | archived/inactive sources not listed; POST 400 items → back to step 1 with server message + "Please fix the highlighted fields." |
| FE-011/E2E-008 | "Remove" on "P5E2E upcoming P3" → Escape → "Remove" → confirm "Remove" | confirm text with item count; cancel keeps it; DELETE /plans/19 204; card gone; GET 404; card 17 present |
| E2E-006 | curl item done → `page.reload` | plan 17 card shows 50 % |
| E2E-007 | curl plan start now+45 s → `page.reload` → wait for toast (≤ 70 s) | Not Started → In Progress at 17:57:20Z without reload, "29m 14s left", highlighted, toast, 1 ack |
| FE-013 | `setViewportSize` 375×800 → overflow check → builder → focus Tasks tab, ArrowRight ×2, Home, Escape | no overflow; Learning selected + focused; Home → Tasks; Esc closes |
| FE-014 | `browser_console_messages` level warning | 0 app errors/warnings in this session |

Screenshots: `outputs/screenshots/p5-fe-001-empty.png`, `p5-fe-002-builder-step1.png`, `p5-fe-003-builder-validation.png`, `p5-fe-004-grouping-order.png`, `p5-fe-005-undo.png`, `p5-fe-007-remove-confirm.png`, `p5-fe-008-server-items-error.png`, `p5-fe-009-narrow.png`, `p5-e2e-002-task-item-done.png`, `p5-e2e-003-start-toast.png`, `p5-e2e-003-highlight-countdown.png`, `p5-e2e-004-history.png`, `p5-e2e-006-live-start.png`.

## Notes (no bug filed)

- **Duplicate initial plan list request.** Each page load sends 2 `GET /api/plans` requests (network log #24/25, #70/71, #112/113, #123/124). `PlansStore.start()` loads once. The `RefreshService` effect then runs for the first time with `version (0) !== ownVersion (-1)` and loads again. This has no visible effect and breaks no acceptance criterion. The unit spec checks reload counts relative to a baseline. frontend-dev could set `ownVersion` to the current version in `start()`.
- In the Playwright console log, the only errors are the 400 that FE-012 provokes on purpose and the 404 from the test's own `fetch` in FE-011/E2E-008. The 2 "400 /api/plans" entries in `browser_console_messages(all)` come from the earlier frontend-dev session, which used stubbed responses.
- Data left for later phases: plans 16 (In Progress 67 %), 17 (In Progress 50 %), 18 (upcoming P1), 20 (upcoming, removed source) and 21 (In Progress). Sources: task 62 (DONE), habit 31 (completed today), card 17, archived tasks 64 and 65, and inactive habit 32. The plans the frontend-dev loop left behind (7, 8 and 9) were deleted so the empty state could be tested.
