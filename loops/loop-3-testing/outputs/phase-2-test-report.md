# Phase 2 — Test report (User Story 1 - Manage tasks)

Mode: test · Trial: 0 · Started 2026-10-03T19:21:14+03:00 · Ended 2026-10-03T19:32:09+03:00
Phase file: `loops/loop-3-testing/outputs/phase-2-testing.md` · Checklist: `specs/001-quickflow-productivity/checklists/phase-2-tasks.md`
Result (trial 0): **failed** (1 failed case) · Tasks ticked: T032, T033, T034 · Not ticked: T035 (TC-P2-BE-012)
**Result (trial 1, retest): passed**, 27/27 · BUG-P2-001 closed · T035 ticked (see `## Trial 1` at the end)

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 12 | 11 | 1 | 0 |
| Frontend tests | 9 | 9 | 0 | 0 |
| Backend + Frontend tests | 6 | 6 | 0 | 0 |
| **All** | **27** | **26** | **1** | **0** |

Smoke (`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200`): both OK (200).

## Bugs

| Bug | Owner | Task | Test case | Summary |
|---|---|---|---|---|
| [BUG-P2-001](bugs/BUG-P2-001.md) | backend-dev | T025 | TC-P2-BE-012 | `DELETE /api/tasks/{id}` with `Accept: application/problem+json` (what the generated `deleteTask` sends) returns 406 without CORS headers and does not delete. The UI works only because of the frontend Accept interceptor workaround. |

## Coverage

| Area | Tests | Line % | Branch % | Report |
|---|---|---|---|---|
| Backend (JaCoCo, whole app) | 49 (TaskServiceTest 11, TaskRepositoryTest 8, TaskControllerTest 15, ApiExceptionHandlerTest 12, ProblemJsonSmokeTest 2, QuickFlowApplicationTests 1) | 97.8 (223/228) | 90.5 (67/74) | `outputs/coverage/phase-2/backend/index.html` |
| Backend `com.quickflow.task` | — | 98.6 (137/139) | 96.2 (50/52) | same |
| Frontend (vitest v8, whole app) | 62 in 6 files (31 new) | 61.61 (stmts 62.75) | 55.25 | `outputs/coverage/phase-2/frontend/quickflow/index.html` |
| Frontend `tasks.store.ts` | 19 | 97.14 | 95.52 | same |
| Frontend `task-form-dialog.component.ts` | 12 | 97.46 | 84.52 | same |

The overall frontend line % is lower than in phase 1 (68.95). The new generated `api/api/tasks.service.ts` (16 % lines; its tests mock it) and the phase-2 page/toolbar/item components count toward it. Those components are covered by the Playwright cases rather than by unit specs, because T034 scopes the specs to the store and the form dialog.

## Test code added

- `backend/src/test/java/com/quickflow/task/TaskServiceTest.java`, `TaskRepositoryTest.java`, `MutableClock.java` (T032)
- `backend/src/test/java/com/quickflow/task/TaskControllerTest.java` (T033)
- `frontend/src/app/features/tasks/tasks.store.spec.ts`, `task-form-dialog.component.spec.ts` (T034)
- `loops/loop-3-testing/outputs/curl/phase-2-curl.sh` (T035 curl script; output in `phase-2-curl.out`)

Commands: `cd backend && ./mvnw -q verify` (exit 0, 49 tests, 0 failures) · `cd frontend && npx ng test --watch=false --coverage` (62/62 passed).

## curl commands

`$B=http://localhost:8080/api/tasks`. Each request is `curl -s -o <file> -w '%{http_code} %{content_type}' -X <M> [-H 'Content-Type: application/json' --data <body>] <url>`. `Y`/`T`/`TM` = yesterday/today/tomorrow (2026-10-02/03/04). `$TAG` is a random prefix (`p2qa29407`). Validation rows also check `Content-Type: application/problem+json` and that `errors[].field` contains the named field.

| # | Command | Expected | Actual |
|---|---|---|---|
| BE-001 | `POST $B {"title":"  $TAG alpha  ","description":"d","dueDate":"Y"}` | 201, trimmed, TODO/MEDIUM, overdue true, completedAt null, createdAt=updatedAt | 201 ✓ |
| BE-002 | `POST $B {"title":"$TAG beta","priority":"HIGH","status":"DONE","dueDate":"TM"}` | 201, completedAt set | 201 ✓ |
| BE-003 | `POST $B {"title":"$TAG gamma","status":"IN_PROGRESS","priority":"LOW","dueDate":"T"}` | 201, overdue false (due today) | 201 ✓ |
| BE-004 | `POST $B {"title":"$TAG delta"}` | 201, overdue false | 201 ✓ |
| BE-005 | `POST $B {"title":<200×a>,"description":<2000×d>}` | 201 | 201 ✓ |
| BE-006 | `POST $B {"title":""}` | 400 title | 400 ✓ ("Title is required; Title must be 1-200 characters") |
| BE-007 | `POST $B {"title":"   "}` | 400 title | 400 ✓ |
| BE-008 | `POST $B {}` | 400 title | 400 ✓ |
| BE-009 | `POST $B {"title":<201×a>}` | 400 title | 400 ✓ |
| BE-010 | `POST $B {"title":"t","description":<2001×d>}` | 400 description | 400 ✓ |
| BE-011 | `POST $B {"title":"t","status":"NOPE"}` | 400 status | 400 ✓ |
| BE-012 | `POST $B {"title":"t","priority":"URGENT"}` | 400 priority | 400 ✓ |
| BE-013 | `POST $B {"title":"t","dueDate":"2026-13-40"}` | 400 dueDate | 400 ✓ |
| BE-014 | `POST $B '{bad'` | 400 problem+json | 400 ✓ (field `body`) |
| BE-015 | `GET $B/{alpha}` | 200, overdue true | 200 ✓ |
| BE-016 | `GET $B/999999` | 404 "Task 999999 not found" | 404 ✓ |
| BE-017 | `GET $B/abc` | 400 id | 400 ✓ |
| BE-018 | `PUT $B/{gamma} {"title":"$TAG gamma2","dueDate":"T"}` | 200, keeps IN_PROGRESS/LOW, updatedAt changes | 200 ✓ |
| BE-019 | `PUT $B/{gamma} {…,"status":"DONE","dueDate":"Y"}` | 200, completedAt set, overdue false | 200 ✓ |
| BE-020 | `PUT $B/{gamma} {…,"status":"TODO","dueDate":"Y"}` | 200, completedAt null, overdue true | 200 ✓ |
| BE-021 | `PUT $B/{gamma} {"title":""}` | 400 title | 400 ✓ |
| BE-022 | `PUT $B/{gamma} {"title":<201×a>}` | 400 title | 400 ✓ |
| BE-023 | `PUT $B/{gamma} {"title":"t","description":<2001×d>}` | 400 description | 400 ✓ |
| BE-024 | `PUT $B/999999 {"title":"x"}` | 404 | 404 ✓ |
| BE-025 | `PUT $B/abc {"title":"x"}` | 400 id | 400 ✓ |
| BE-026 | `POST $B/{delta}/complete` | 200 DONE, completedAt set | 200 ✓ |
| BE-027 | `POST $B/{delta}/complete` (again, 1 s later) | 200, same completedAt | 200 ✓ |
| BE-028 | `POST $B/999999/complete` | 404 | 404 ✓ |
| BE-029 | `POST $B/abc/complete` | 400 id | 400 ✓ |
| BE-030 | `PUT $B/{delta} {"title":"$TAG delta","status":"IN_PROGRESS"}` | 200, completedAt null | 200 ✓ |
| BE-031 | `GET $B?q=<TAG upper-case>` | 4 matches | 200 ✓ delta,gamma2,beta,alpha |
| BE-032 | `GET $B?q=$TAG&status=DONE` | [beta] | 200 ✓ |
| BE-033 | `GET $B?q=$TAG&priority=LOW` | [gamma2] | 200 ✓ |
| BE-034 | `GET $B?q=$TAG&dueFrom=T&dueTo=TM` | [gamma2, beta] | 200 ✓ |
| BE-035 | `GET $B?q=$TAG&overdue=true` | [alpha] | 200 ✓ |
| BE-036 | `GET $B?q=$TAG&sort=DUE_DATE&direction=ASC` | alpha,gamma2,beta,delta | 200 ✓ |
| BE-037 | `GET $B?q=$TAG&sort=DUE_DATE&direction=DESC` | beta,gamma2,alpha,delta | 200 ✓ |
| BE-038 | `GET $B?q=$TAG&sort=CREATED_AT&direction=ASC` | alpha,beta,gamma2,delta | 200 ✓ |
| BE-039 | `GET $B?q=$TAG` | delta,gamma2,beta,alpha | 200 ✓ |
| BE-040 | `GET $B?status=NOPE` | 400 status | 400 ✓ |
| BE-041 | `GET $B?sort=BOGUS` | 400 sort | 400 ✓ |
| BE-042 | `GET $B?dueFrom=notadate` | 400 dueFrom | 400 ✓ |
| BE-043 | `POST $B/{beta}/archive` | 200 archived true | 200 ✓ |
| BE-044 | `GET $B?q=$TAG` | beta excluded | 200 ✓ |
| BE-045 | `GET $B?q=$TAG&archived=true` | [beta] | 200 ✓ |
| BE-046 | `POST $B/{beta}/restore` | 200 archived false | 200 ✓ |
| BE-047 | `GET $B?q=$TAG` | beta back | 200 ✓ |
| BE-048 | `POST $B/999999/archive` | 404 | 404 ✓ |
| BE-049 | `POST $B/999999/restore` | 404 | 404 ✓ |
| BE-050 | `POST $B/abc/archive` | 400 id | 400 ✓ |
| BE-051 | `DELETE $B/{delta}` | 204, empty body | 204 ✓ |
| BE-052 | `GET $B/{delta}` | 404 | 404 ✓ |
| BE-053 | `GET $B?q=$TAG` | delta absent | 200 ✓ |
| BE-054 | `DELETE $B/{delta}` again | 404 | 404 ✓ |
| BE-055 | `DELETE $B/abc` | 400 id | 400 ✓ |
| BE-056 | `curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' $B/{200-char task}` | 204 | **406 ✗** (BUG-P2-001) |
| BE-057 | `curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' $B/999999` | 404 | **406 ✗** (BUG-P2-001) |

Mapping to test cases: BE-001…005 → TC-P2-BE-004; 006…014 → BE-005; 015…017 → BE-006; 018…025 → BE-007; 026…030 → BE-008; 031…042 → BE-009; 043…050 → BE-010; 051…055 → BE-011; 056…057 → BE-012.

E2E curl: `curl -s http://localhost:8080/api/tasks | jq -c '.[]|{id,title,status,priority,dueDate,overdue,completedAt}'`; `curl -s -X POST -H 'Content-Type: application/json' --data '{"title":"QA curl-created task","priority":"LOW","status":"IN_PROGRESS","dueDate":"2026-12-01"}' http://localhost:8080/api/tasks`; `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/tasks/22` (404 after the UI delete); `curl -s http://localhost:8080/api/tasks/21 | jq '{status,completedAt,overdue}'`; `curl -s http://localhost:8080/api/tasks/23 | jq .archived`. All test data was deleted afterwards, so the list is empty again.

## Playwright steps (MCP, headless chromium, http://localhost:4200)

| Case | Steps (tool → target → value) | Outcome |
|---|---|---|
| FE-003 | `browser_navigate` /tasks → `browser_snapshot` | heading, Add Task, labelled search region, 6 filter controls + 2 toggles, "0 tasks", "No tasks yet" + Add Task ✓ |
| FE-004 | `run_code`: click main "Add Task" → submit empty → fill `#task-title` 201×a, `#task-description` 2001×d → submit → Escape | Required / over-length messages, `aria-invalid`, `aria-describedby`, `role=alert`, counter 201/200 red, 0 POSTs, Esc closes ✓ |
| FE-005 | `page.route('**/api/tasks')` POST → 400 problem+json `errors[title,dueDate]` → submit "QA stubbed" | Field messages + "Please fix the highlighted fields.", focus on title ✓ |
| FE-006 | create 3 tasks via the dialog (High + due 2026-10-01; plain; 198-char title) | chips, Overdue badge, truncated `h3` with full `title`, "3 tasks", "Task added" toast ✓ |
| FE-007 | `pressSequentially('PLAIN', 40 ms)` → Esc; `selectOption` Status/Priority; check Overdue only; fill Due from; Sort by/Order; fill "nomatchxyz" → click "Clear filters" | 1 debounced request `q=PLAIN`; filtered lists correct; due sort with undated tasks last; "No matching tasks"; clear restores 4 ✓ |
| FE-008 | `goto /tasks?new=1` → keyboard type/Tab/Enter; Tab through the toolbar; focus a row toggle → Enter | focus on Title, URL cleaned, Tab order correct, Enter submits, focus ring visible ✓ |
| FE-009 | `setViewportSize(375,800)`; console listener for the whole run | no horizontal overflow; only the stubbed 400 logged ✓ |
| E2E-001 | Add Task → fill title/description, `selectOption #task-priority HIGH`, fill `#task-due 2026-10-01` → Enter → curl list | API row matches ✓ |
| E2E-002 | curl POST → `goto /tasks` → row "QA curl-created task" | In Progress / Low / Due Dec 1, 2026 ✓ |
| E2E-003 | focus "Mark as done: QA e2e ui-created task" → Enter → curl; click "Mark as not done: …" → curl | DONE + completedAt, then TODO + null ✓ |
| E2E-004 | click "Edit task: QA plain task" → fill title, Status In Progress, Priority Low → "Save changes" → curl | updated ✓ |
| E2E-005 | click "Archive task: QA long…" → check "Show archived" → click "Restore task: …" → uncheck → curl | archived view, then restored ✓ |
| E2E-006 | click "Delete task: QA plain task edited" → Escape → again → click "Delete" → curl GET 404 | DELETE 204 (Accept widened by the interceptor), "Task deleted" ✓ |

Screenshots (`outputs/screenshots/`): `p2-fe-001-empty.png`, `p2-fe-002-required.png`, `p2-fe-003-overlength.png`, `p2-fe-003b-server-errors.png`, `p2-fe-004-list.png`, `p2-fe-008-overdue-filter.png`, `p2-fe-009-filtered-empty.png`, `p2-fe-010-archived.png`, `p2-fe-011-delete-confirm.png`, `p2-fe-012-keyboard.png`, `p2-fe-012-search-focus.png`, `p2-fe-013-narrow.png`, `p2-e2e-001-ui-create.png`, `p2-e2e-002-curl-in-ui.png`, `p2-e2e-003-ui-complete.png`.

## Notes

- After the dialog is closed, focus goes back to the opener. When the dialog was opened from `?new=1` there is no opener, so focus lands on `body`. Not filed as a bug: there is no opener to return to.
- The date inputs take several Tab stops (Chromium's month/day/year segments). This is native browser behaviour.
- Once BUG-P2-001 is fixed, `frontend/src/app/core/accept-header.interceptor.ts` can stay in place (it does no harm), or frontend-dev can remove it.

## Trial 1

Mode: retest · Started 2026-10-03T19:34:50+03:00 · Ended 2026-10-03T19:38:06+03:00 · Retested: TC-P2-BE-012 (BUG-P2-001, fixed by backend-dev in trial 1)
Smoke: `scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200`. Both returned OK (200).
Result: **passed**

### Totals (trial 1)

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 12 | 12 | 0 | 0 |
| Frontend tests | 9 | 9 | 0 | 0 |
| Backend + Frontend tests | 6 | 6 | 0 | 0 |
| **All** | **27** | **27** | **0** | **0** |

Re-run in trial 1:
- The failed case TC-P2-BE-012.
- All unit tests: TC-P2-BE-001…003 and TC-P2-FE-001…002.
- The full curl suite, BE-001…BE-057, which covers TC-P2-BE-004…012.
- All E2E flows, TC-P2-E2E-001…006.

The Playwright UI-only cases TC-P2-FE-003…009 were not re-run on their own. Their results carry over from trial 0, because the fix changed backend code only. The E2E flows used the same Tasks page, dialogs and confirm dialog again.

### Unit tests + coverage
- Backend: `cd backend && ./mvnw -q verify` → rc 0. TaskControllerTest 16 (includes the new `deleteAcceptsProblemJsonOnly`), TaskServiceTest 11, TaskRepositoryTest 8, ApiExceptionHandlerTest 12, ProblemJsonSmokeTest 2, QuickFlowApplicationTests 1: **50/50 passed**. JaCoCo: **line 97.8%, branch 90.5%**. Copied to `outputs/coverage/phase-2/backend/`.
- Frontend: `cd frontend && npx ng test --watch=false --coverage` → 6 files, **62/62 passed**. **Lines 61.61%, branches 55.25%**, statements 62.75%. Copied to `outputs/coverage/phase-2/frontend/`.

### TC-P2-BE-012 (BUG-P2-001)
| ID | Command | Expected | Actual |
|---|---|---|---|
| BE-056 | `curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' $B/{id}` | 204 | 204 ✓ |
| BE-057 | `curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' $B/999999` | 404 | 404 ✓ |
| browser | Playwright `fetch(':8080/api/tasks/{id}', {method:'DELETE', headers:{Accept:'application/problem+json'}})` from origin :4200 (no Angular interceptor) | 204, then GET 404; missing → 404 problem+json, no CORS block | 204, GET 404; missing 404 `{"detail":"Task 999999 not found",...}`, no CORS error ✓ |

Full curl suite: `bash loops/loop-3-testing/outputs/curl/phase-2-curl.sh` (tag `p2qa167`) → **pass=57 fail=0**.

### E2E flows (Playwright MCP `browser_run_code_unsafe` on http://localhost:4200/tasks + API checks)
| Case | Steps | Actual | Result |
|---|---|---|---|
| E2E-001 | Add Task → `#task-title` "QA t1 ui-created task", `#task-description`, `#task-priority`=HIGH, `#task-due`=2026-10-01 → Enter | "Task added" toast. API id 37: TODO, HIGH, the description, due 2026-10-01, overdue true, completedAt null | passed (`p2-t1-e2e-001-ui-create.png`) |
| E2E-002 | `curl -X POST … '{"title":"QA t1 curl-created task","priority":"LOW","status":"IN_PROGRESS","dueDate":"2026-12-01"}'` (id 36) → goto /tasks | Row: In Progress, Low priority, Due Dec 1, 2026 | passed (`p2-t1-e2e-002-curl-in-ui.png`) |
| E2E-003 | Focus "Mark as done: QA t1 ui-created task" + Enter → API; then "Mark as not done" | UI: Done + Completed, no overdue badge. API: DONE, completedAt set, overdue false. After reopen: TODO, completedAt null, overdue true | passed (`p2-t1-e2e-003-ui-complete.png`) |
| E2E-004 | Edit on the curl task (pre-filled "QA t1 curl-created task") → title "… edited", `#task-status`=TODO, `#task-priority`=MEDIUM → Save changes | API: new title, TODO, MEDIUM, updatedAt > createdAt | passed |
| E2E-005 | "Archive task: …" → Show archived → "Restore task: …" → uncheck | API archived=true, then false. The row is back in the default list | passed (`p2-t1-e2e-005-restored.png`) |
| E2E-006 | "Delete task: …" → confirm `<dialog>` text names the task → Esc (row stays) → Delete again → "Delete" | DELETE sent with Accept `application/json, application/problem+json` → 204. "Task deleted" toast. GET /api/tasks/36 → 404, search `q=QA t1 curl` → 0 | passed (`p2-t1-e2e-006-delete-confirm.png`) |

Console errors during trial 1: only the 3 intentional 404s from the verification fetches (`/api/tasks/36` after delete, `/api/tasks/999999`, `/api/tasks/38` after delete).

### Bugs (trial 1)
| Bug | Status |
|---|---|
| [BUG-P2-001](bugs/BUG-P2-001.md) | closed (trial 1) |

New bugs: none.
Note: `frontend/src/app/core/accept-header.interceptor.ts` is no longer needed for task delete. Keeping it or removing it is frontend-dev's choice, and neither choice causes a failure.
