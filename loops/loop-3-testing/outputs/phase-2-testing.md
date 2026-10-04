# Phase 2 — Testing (User Story 1 - Manage tasks)

Mode: retest · Trial: 1 (trial 0: test) · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-2-tasks.md` (from `/speckit-checklist`, 24 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T032 [TEST] [P] [US1] Backend unit tests `task/TaskServiceTest.java` (fixed `Clock`: defaults, trim, completedAt set/cleared, complete on an already-DONE task keeps completedAt, overdue rule incl. due today/no due date/DONE, archive excluded by default, sort with null due dates) and `task/TaskRepositoryTest.java` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` so the `test` profile H2 file is used: each filter)
- [x] T033 [TEST] [P] [US1] Backend controller test `task/TaskControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean TaskService`: status codes, validation 400 for empty / 201-char title / 2,001-char description / invalid enum, 404)
- [x] T034 [TEST] [P] [US1] Frontend unit tests `features/tasks/tasks.store.spec.ts`, `task-form-dialog.component.spec.ts` (validation, server errors mapping)
- [x] T035 [TEST] [US1] curl tests for all 8 task operations (success, validation errors, not found, filters/sort/overdue/archived); Playwright MCP tests of the Tasks page (elements, forms, validation messages, empty state, keyboard use); e2e: create task in UI → verify via `GET /api/tasks`; create via curl → appears in UI; complete task in UI → `status=DONE` via curl

T035 was not ticked in trial 0 because TC-P2-BE-012 failed (BUG-P2-001). In trial 1, TC-P2-BE-012 passed and the regression passed (all unit tests, the full curl suite and all E2E flows). BUG-P2-001 is closed and T035 is ticked.

## Backend tests

### TC-P2-BE-001 — Unit: `TaskServiceTest` (T032)
- Story: US1  AC: AS1 (defaults Todo/Medium, trimmed title), AS3 (edit keeps status/priority, updatedAt changes), AS4 (completedAt set/cleared, complete is idempotent), AS5 (archived excluded by default, restore), AS6 (delete, 404), AS7 (filters combined, sort with null due dates last), AS8 (overdue rule: due today / no due date / DONE)
- Steps: `cd backend && ./mvnw -q verify`. `@DataJpaTest` + `replace = NONE` + `TaskService` with a `MutableClock` fixed at 2026-06-15T10:00Z. 11 tests.
- Expected: all pass
- Result: passed

### TC-P2-BE-002 — Unit: `TaskRepositoryTest` (T032)
- Story: US1  AC: AS5 (archived flag), AS7 (title contains case-insensitive, status, priority, due range inclusive; `%`/`_` matched literally), AS8 (overdue true/false)
- Steps: `./mvnw -q verify`. `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` against the test-profile H2 file. 8 tests: one per filter, plus entity defaults.
- Expected: all pass
- Result: passed

### TC-P2-BE-003 — Unit: `TaskControllerTest` (T033)
- Story: US1  AC: AS2 (400 for empty/blank/missing title, 201-char title, 2,001-char description, invalid status/priority/dueDate, malformed JSON), 200/201/204/404 for all 8 operations, query parameters bound to `TaskQuery`, `archived` defaults to false
- Steps: `./mvnw -q verify`. `@WebMvcTest(TaskController)`, `MockMvcTester`, `@MockitoBean TaskService`. 15 tests.
- Expected: all pass. Every error is `application/problem+json` with `errors[].field`.
- Result: passed

### TC-P2-BE-004 — createTask success, defaults and boundaries
- Story: US1  AC: AS1 (Todo / Medium defaults), FR-003 boundaries, AS8 (overdue flag)
- Steps: curl BE-001…BE-005 (see report): POST with a padded title and due yesterday; POST with status DONE and priority HIGH; POST due today; POST with no due date; POST with a 200-char title and a 2,000-char description
- Expected: 201. Title trimmed, TODO/MEDIUM, `overdue=true` only for due yesterday, `completedAt` set only when created DONE, 200/2,000 accepted.
- Result: passed

### TC-P2-BE-005 — createTask validation errors
- Story: US1  AC: AS2
- Steps: curl BE-006…BE-014: `title` "", "   ", missing, 201 chars; description 2,001 chars; status NOPE; priority URGENT; dueDate 2026-13-40; body `{bad`
- Expected: 400 `application/problem+json`, `errors[]` naming the field (`body` for malformed JSON)
- Result: passed

### TC-P2-BE-006 — getTask
- Story: US1  AC: AS8 (overdue in response), 404 / 400 format
- Steps: curl BE-015…BE-017: `GET /api/tasks/{id}`, `/999999`, `/abc`
- Expected: 200 with `overdue=true`; 404 with detail "Task 999999 not found"; 400 with field `id`
- Result: passed

### TC-P2-BE-007 — updateTask
- Story: US1  AC: AS3 (saved and updatedAt changes), AS4 (DONE sets completedAt, back to TODO clears it), AS2 (validation on edit)
- Steps: curl BE-018…BE-025
- Expected: 200 keeps IN_PROGRESS/LOW when they are omitted and changes updatedAt. DONE → completedAt set and overdue false. TODO → completedAt null and overdue true. 400 for an empty or 201-char title or a 2,001-char description. 404 for a missing id, 400 for a bad id.
- Result: passed

### TC-P2-BE-008 — completeTask
- Story: US1  AC: AS4
- Steps: curl BE-026…BE-030: complete, complete again, missing, bad id, then PUT IN_PROGRESS
- Expected: 200 DONE with completedAt set. The second call keeps the same completedAt. 404 and 400 for the bad requests. Leaving DONE clears completedAt.
- Result: passed

### TC-P2-BE-009 — listTasks search, filters and sort
- Story: US1  AC: AS7, AS8
- Steps: curl BE-031…BE-042: upper-case `q`; `status=DONE`; `priority=LOW`; `dueFrom`/`dueTo`; `overdue=true`; `DUE_DATE` ASC/DESC; `CREATED_AT` ASC; default; invalid `status`/`sort`/`dueFrom`
- Expected: only the matching tasks, in the chosen order. Undated tasks come last for DUE_DATE in both directions. The default order is CREATED_AT DESC. 400 with the field for invalid params.
- Result: passed

### TC-P2-BE-010 — archiveTask / restoreTask
- Story: US1  AC: AS5
- Steps: curl BE-043…BE-050
- Expected: archive → `archived=true`, the task leaves the default list and shows with `archived=true`. Restore → back in the default list. 404 and 400 for the bad requests.
- Result: passed

### TC-P2-BE-011 — deleteTask
- Story: US1  AC: AS6 (gone everywhere, including searches)
- Steps: curl BE-051…BE-055
- Expected: 204 with an empty body. GET then returns 404 and search no longer returns the task. A second delete returns 404, and `abc` returns 400.
- Result: passed

### TC-P2-BE-012 — deleteTask with the Accept header the generated client sends
- Story: US1  AC: AS6 (delete via the contract-generated client); contract `deleteTask` responses 204/400/404
- Steps: curl BE-056/BE-057: `curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' http://localhost:8080/api/tasks/{id}` and `/999999`
- Expected: 204 / 404
- Result: passed (trial 1). curl BE-056 returned 204 and BE-057 returned 404. From the browser at origin :4200 with `Accept: application/problem+json` only: 204, then GET returned 404; the missing id returned 404 problem+json with CORS. Trial 0 failed with BUG-P2-001, now closed.

## Frontend tests

### TC-P2-FE-001 — Unit: `tasks.store.spec.ts` (T034)
- Story: US1  AC: AS1, AS3, AS4, AS5, AS6, AS7 (store actions, query params, optimistic update + rollback, stale responses dropped), AS2 (server field errors passed to the form)
- Steps: `cd frontend && npx ng test --watch=false --coverage` (19 tests)
- Expected: all pass
- Result: passed

### TC-P2-FE-002 — Unit: `task-form-dialog.component.spec.ts` (T034)
- Story: US1  AC: AS1 (defaults, trimmed title), AS2 (required / 201 / 2,001 rejected with messages, nothing saved), AS3 (edit pre-filled), server `errors[]` mapped to fields, general errors shown in the alert, Cancel/Esc
- Steps: same run (12 tests)
- Expected: all pass
- Result: passed

### TC-P2-FE-003 — Tasks page elements and empty state
- Story: US1  AC: AS9, FR-030
- Steps: `browser_navigate` http://localhost:4200/tasks (no tasks) → `browser_snapshot`
- Expected: h1 "Tasks", an "Add Task" button, a search region "Search and filter tasks" with a searchbox, Status/Priority/Due from/Due to/Sort by/Order controls and Overdue only/Show archived checkboxes, "0 tasks", and the "No tasks yet" empty state with an Add Task button
- Result: passed (screenshot `p2-fe-001-empty.png`)

### TC-P2-FE-004 — Client validation messages
- Story: US1  AC: AS2, FR-034 (announced validation)
- Steps: click the empty-state "Add Task" → dialog. Focus starts on `#task-title`. Click "Add task" with an empty title. Fill `#task-title` with 201 × "a" and `#task-description` with 2,001 × "d", then click "Add task". Press Escape.
- Expected: "Title is required." with `aria-invalid=true`, `aria-describedby=task-title-error` and `role=alert`. Counter shows `201/200` in red (`is-over`). "Title must be at most 200 characters (currently 201)." and "Description must be at most 2,000 characters (currently 2,001)." appear. 0 POST requests. Esc closes the dialog. Every control has a label.
- Result: passed (`p2-fe-002-required.png`, `p2-fe-003-overlength.png`)

### TC-P2-FE-005 — Server validation errors shown per field
- Story: US1  AC: AS2
- Steps: `page.route('**/api/tasks')` stubs POST with a 400 problem+json `errors:[title, dueDate]` → Add Task, title "QA stubbed", submit
- Expected: the message appears under Title and under Due date, the alert says "Please fix the highlighted fields.", and focus moves to the title
- Result: passed (`p2-fe-003b-server-errors.png`)

### TC-P2-FE-006 — List rows: chips, overdue badge, long title
- Story: US1  AC: AS1, AS8, Edge case "very long titles"
- Steps: create "QA e2e ui-created task" (High, due 2026-10-01), "QA plain task", and a 198-char title via the dialog
- Expected: rows show Todo + priority chips and an "Overdue" badge with the due date. The long title `h3` is truncated (`scrollWidth > clientWidth`) and its `title` attribute has the full 198 chars. The count shows "3 tasks" and the "Task added" toast appears.
- Result: passed (`p2-fe-004-list.png`)

### TC-P2-FE-007 — Search, filters, sort and filtered-empty state
- Story: US1  AC: AS7, AS8, AS9
- Steps: type "PLAIN" slowly (40 ms/key) into the searchbox, then Esc. Status = In Progress; Priority = High; check Overdue only; Due from = 2026-11-01; Sort by Due date Asc/Desc, then Created date. Search "nomatchxyz", then "Clear filters".
- Expected: exactly 1 request `q=PLAIN` (debounced) and a case-insensitive match. Each filter shows only matching tasks. Due Asc order is Oct 1, Dec 1, then undated; Desc is Dec 1, Oct 1, then undated. "No matching tasks" appears, and Clear filters restores 4 tasks and empties the search.
- Result: passed (`p2-fe-008-overdue-filter.png`, `p2-fe-009-filtered-empty.png`)

### TC-P2-FE-008 — Keyboard use
- Story: US1  AC: FR-034 (every action reachable by keyboard, visible focus)
- Steps: open `/tasks?new=1` → type the title, Tab to description, Tab through status / priority / due, Tab to the submit button, press Enter. Then from "Add Task", Tab through the toolbar. Focus "Mark as done: …" and press Enter. Esc closes the dialogs.
- Expected: the dialog opens with focus on Title and `?new=1` is removed. Tab order is title → description → status → priority → due → Cancel → Add task, and Enter creates the task. Toolbar order is search → Status → Priority → Due from → Due to → Sort by. The focus ring is visible (2 px outline on buttons, 3 px box-shadow ring on inputs). Row actions have aria-labels that include the title.
- Result: passed (`p2-fe-012-keyboard.png`, `p2-fe-012-search-focus.png`)

### TC-P2-FE-009 — Narrow layout and console
- Story: US1  AC: FR-032 (375 px), no console errors
- Steps: `page.setViewportSize(375×800)` on `/tasks` with tasks; collect console errors during the whole run
- Expected: no horizontal overflow, and no console errors except the intentionally stubbed 400 in FE-005
- Result: passed (`p2-fe-013-narrow.png`)

## Backend + Frontend tests

### TC-P2-E2E-001 — Create task in UI → verify via `GET /api/tasks`
- Story: US1  AC: AS1
- Steps: Playwright: Add Task → title "QA e2e ui-created task", description, priority High, due 2026-10-01 → Enter. Then `curl -s http://localhost:8080/api/tasks | jq`
- Expected: the API returns the task with TODO, HIGH, the description, dueDate 2026-10-01, overdue true and completedAt null
- Result: passed (`p2-e2e-001-ui-create.png`)

### TC-P2-E2E-002 — Create via curl → appears in UI
- Story: US1  AC: AS1, AS7
- Steps: `curl -s -X POST -H 'Content-Type: application/json' --data '{"title":"QA curl-created task","priority":"LOW","status":"IN_PROGRESS","dueDate":"2026-12-01"}' http://localhost:8080/api/tasks` → Playwright `goto /tasks`
- Expected: the row "QA curl-created task" shows In Progress, Low priority and Due Dec 1, 2026
- Result: passed (`p2-e2e-002-curl-in-ui.png`)

### TC-P2-E2E-003 — Complete task in UI → `status=DONE` via curl; reopen → TODO
- Story: US1  AC: AS4
- Steps: focus "Mark as done: QA e2e ui-created task" and press Enter → `curl -s http://localhost:8080/api/tasks/21`. Then click "Mark as not done: …" → curl again.
- Expected: the UI shows Done + "Completed …" with no overdue badge, and the API returns DONE with completedAt set and overdue false. After reopening, the UI shows Todo + Overdue and the API returns TODO with completedAt null.
- Result: passed (`p2-e2e-003-ui-complete.png`)

### TC-P2-E2E-004 — Edit in UI → verify via curl
- Story: US1  AC: AS3
- Steps: Edit "QA plain task" (pre-filled) → title "QA plain task edited", status In Progress, priority Low → Save changes → curl list
- Expected: the row is updated and its Updated time changes. The API returns the new title, IN_PROGRESS and LOW, with an updatedAt later than createdAt.
- Result: passed

### TC-P2-E2E-005 — Archive / restore in UI → verify via curl
- Story: US1  AC: AS5
- Steps: click "Archive task: QA long…" → check Show archived → click "Restore task: …" → uncheck Show archived → `curl /api/tasks/23`
- Expected: the task leaves the default list and appears under "Archived tasks · 1 archived task". After Restore, "No archived tasks" shows, the task is back in the default list, and the API returns `archived=false`.
- Result: passed (`p2-fe-010-archived.png`)

### TC-P2-E2E-006 — Delete in UI with confirm → gone via curl
- Story: US1  AC: AS6, FR-031
- Steps: click "Delete task: QA plain task edited" → confirm dialog → Esc (cancel) → Delete again → click "Delete" → `curl -w '%{http_code}' /api/tasks/22` and `?q=QA%20plain`
- Expected: the confirm text names the task. Cancel keeps it. Confirm removes it and shows a "Task deleted" toast. The DELETE returns 204 (the browser sends `Accept: application/json, application/problem+json` because of the frontend interceptor). The API returns 404, and the search returns 0 results.
- Result: passed (`p2-fe-011-delete-confirm.png`)
