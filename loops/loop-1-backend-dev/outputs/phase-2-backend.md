# Phase 2 — Backend (User Story 1 - Manage tasks)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T021 [BE] [P] [US1] Create `task/TaskStatus.java` (`TODO`, `IN_PROGRESS`, `DONE`), `task/TaskPriority.java` (`LOW`, `MEDIUM`, `HIGH`) and entity `task/Task.java` (id, title "required, trimmed, 1–200 chars", description "≤ 2,000 chars", status default `TODO`, priority default `MEDIUM`, dueDate `LocalDate?`, createdAt, updatedAt, completedAt `OffsetDateTime?`, archived default false)
- [x] T022 [BE] [P] [US1] Create `task/TaskRepository.java` (`JpaRepository` + `JpaSpecificationExecutor`) and `task/TaskSpecifications.java` (title contains case-insensitive, status, priority, dueFrom/dueTo, overdue = dueDate < today AND status ≠ DONE, archived flag)
- [x] T023 [BE] [P] [US1] Create DTOs `task/dto/TaskRequest.java` (`@NotBlank @Size(max=200) title`, `@Size(max=2000) description`, status, priority, dueDate) and `task/dto/TaskResponse.java` (all Task fields + `overdue`, `@Schema(name = "Task")`; mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)`) per contract schemas `TaskRequest`/`Task`; create enums `task/TaskSort.java` (`DUE_DATE`, `CREATED_AT`) and `task/SortDirection.java` (`ASC`, `DESC`) for the list query; annotate every enum with `@Schema(enumAsRef = true)` so swagger uses `$ref` enums like the contract
- [x] T024 [BE] [US1] Create `task/TaskService.java` (injects `Clock`): create (trim title, defaults TODO/MEDIUM, timestamps; completedAt set if created DONE), update (keeps current status/priority when omitted; sets updatedAt; completedAt set when status becomes DONE, cleared when it leaves DONE), complete (idempotent: if already DONE, completedAt is kept), archive, restore, delete (404 if missing), list with filters and sort `DUE_DATE`/`CREATED_AT` + `ASC`/`DESC` (tasks without dueDate last for DUE_DATE), default excludes archived; `isOverdue(task, today)` rule
- [x] T025 [BE] [US1] Create `task/TaskController.java` implementing `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/{id}`, `POST /api/tasks/{id}/complete|archive|restore` exactly as `contracts/openapi.yaml` (operationIds, query params, 200/201/204/400/404), with springdoc `@Tag(name="Tasks")`, `@Operation(operationId=…)`, `@ApiResponse` annotations
- [x] T026 [BE] [US1] Regenerate `backend/openapi/openapi.json`, check Tasks paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify all task endpoints (success, 400, 404)

## Endpoints

| Method | Path | operationId | Success | Errors |
|---|---|---|---|---|
| GET | `/api/tasks?q&status&priority&dueFrom&dueTo&overdue&archived&sort&direction` | listTasks | 200 `Task[]` | 400 |
| POST | `/api/tasks` (body `TaskRequest`) | createTask | 201 `Task` | 400 |
| GET | `/api/tasks/{id}` | getTask | 200 `Task` | 400, 404 |
| PUT | `/api/tasks/{id}` (body `TaskRequest`) | updateTask | 200 `Task` | 400, 404 |
| DELETE | `/api/tasks/{id}` | deleteTask | 204 | 400, 404 |
| POST | `/api/tasks/{id}/complete` | completeTask | 200 `Task` | 400, 404 |
| POST | `/api/tasks/{id}/archive` | archiveTask | 200 `Task` | 400, 404 |
| POST | `/api/tasks/{id}/restore` | restoreTask | 200 `Task` | 400, 404 |

Errors are `application/problem+json` (`Problem` with `errors: FieldError[]` on 400).

## curl checks

All commands are `curl -s -o /dev/stderr -w '%{http_code}' …` against `http://localhost:8080/api/tasks` (`$B`). The script is run after the final restart. Result: **47/47 pass**.

| # | Command | Expected | Actual |
|---|---|---|---|
| 1 | `POST $B {"title":"  X alpha  ","description":"d","dueDate":<yesterday>}` | 201, title trimmed, TODO/MEDIUM, overdue=true, completedAt null | 201 ✓ |
| 2 | `POST $B {"title":"X beta","priority":"HIGH","status":"DONE","dueDate":<tomorrow>}` | 201, completedAt set | 201 ✓ |
| 3 | `POST $B {"title":"X gamma"}` | 201 | 201 ✓ |
| 4 | `POST $B {"title":"   "}` | 400 errors[title] | 400 ✓ |
| 5 | `POST $B` title 201 chars | 400 errors[title] | 400 ✓ |
| 6 | `POST $B` title 200 chars | 201 | 201 ✓ |
| 7 | `POST $B` description 2,001 chars | 400 errors[description] | 400 ✓ |
| 8 | `POST $B {"title":"t","status":"NOPE"}` | 400 errors[status] | 400 ✓ |
| 9 | `POST $B {"title":"t","dueDate":"2026-13-40"}` | 400 errors[dueDate] | 400 ✓ |
| 10 | `POST $B '{bad'` | 400 errors[body] | 400 ✓ |
| 11 | `POST $B {}` | 400 | 400 ✓ |
| 12 | `GET $B/{id}` | 200, overdue=true | 200 ✓ |
| 13 | `GET $B/999999` | 404 "Task 999999 not found" | 404 ✓ |
| 14 | `GET $B/abc` | 400 | 400 ✓ |
| 15 | `PUT $B/{id} {"title":…}` (no status/priority) | 200, keeps TODO/MEDIUM, updatedAt changed | 200 ✓ |
| 16 | `PUT $B/{id} {"title":"x","status":"DONE"}` | 200, completedAt set, dueDate cleared, overdue false | 200 ✓ |
| 17 | `PUT $B/{id} {…,"status":"TODO","dueDate":<yesterday>}` | 200, completedAt null, overdue true | 200 ✓ |
| 18 | `PUT $B/{id} {"title":""}` | 400 | 400 ✓ |
| 19 | `PUT $B/999999` | 404 | 404 ✓ |
| 20 | `POST $B/{id}/complete` | 200, DONE, completedAt set, overdue false | 200 ✓ |
| 21 | `POST $B/{id}/complete` again | 200, same completedAt | 200 ✓ |
| 22 | `POST $B/999999/complete` | 404 | 404 ✓ |
| 23 | `PUT $B/{id} {…,"status":"IN_PROGRESS"}` | 200, completedAt cleared | 200 ✓ |
| 24 | `GET $B?q=<TAG upper-case>` | 200, 3 matches (case-insensitive) | 200 ✓ |
| 25 | `GET $B?q=…&status=DONE` | 200, [beta] | 200 ✓ |
| 26 | `GET $B?q=…&priority=HIGH` | 200, [beta] | 200 ✓ |
| 27 | `GET $B?q=…&dueFrom=<today>&dueTo=<tomorrow>` | 200, [beta] | 200 ✓ |
| 28 | `GET $B?q=…&overdue=true` | 200, [alpha] | 200 ✓ |
| 29 | `GET $B?q=…&sort=DUE_DATE&direction=ASC` | [alpha, beta, gamma(no due)] | 200 ✓ |
| 30 | `GET $B?q=…&sort=DUE_DATE&direction=DESC` | [beta, alpha, gamma(no due last)] | 200 ✓ |
| 31 | `GET $B?q=…&sort=CREATED_AT&direction=ASC` | [alpha, beta, gamma] | 200 ✓ |
| 32 | `GET $B?q=…` (default CREATED_AT DESC) | [gamma, beta, alpha] | 200 ✓ |
| 33 | `GET $B?sort=BOGUS` | 400 errors[sort] | 400 ✓ |
| 34 | `GET $B?status=NOPE` | 400 | 400 ✓ |
| 35 | `GET $B?dueFrom=notadate` | 400 | 400 ✓ |
| 36 | `GET $B?q=100%25` | 200 (`%` matched literally) | 200 ✓ |
| 37 | `POST $B/{gamma}/archive` | 200, archived=true | 200 ✓ |
| 38 | `GET $B?q=…` | 200, gamma excluded | 200 ✓ |
| 39 | `GET $B?q=…&archived=true` | 200, [gamma] | 200 ✓ |
| 40 | `POST $B/{gamma}/restore` | 200, archived=false | 200 ✓ |
| 41 | `POST $B/999999/archive` | 404 | 404 ✓ |
| 42 | `POST $B/999999/restore` | 404 | 404 ✓ |
| 43 | `DELETE $B/{gamma}` | 204 | 204 ✓ |
| 44 | `GET $B/{gamma}` | 404 | 404 ✓ |
| 45 | `DELETE $B/{gamma}` again | 404 | 404 ✓ |
| 46 | `DELETE $B/abc` | 400 | 400 ✓ |
| 47 | `OPTIONS $B/1` with Origin http://localhost:4200, method PUT | 200 + CORS headers | 200 ✓ |

The test tasks are deleted after the run.

Build checks: `./mvnw -q verify` exits 0 (15 existing tests, 0 failures, JaCoCo report). `./mvnw -q -Popenapi verify -DskipTests` exits 0. A script compared `backend/openapi/openapi.json` with `contracts/openapi.yaml`. For all 8 Tasks operations it checked paths, methods, operationIds, response codes and content, parameter names/in/required/schema, and request bodies. For `Problem`, `FieldError`, `TaskStatus`, `TaskPriority`, `TaskSort`, `SortDirection`, `TaskRequest` and `Task` it checked property sets, `required` lists and enums. **Result: OK.**

## Notes

- Package `com.quickflow.task`: `Task`, `TaskStatus`, `TaskPriority`, `TaskSort`, `SortDirection`, `TaskRepository`, `TaskSpecifications`, `TaskService` (incl. `TaskQuery` record and static `isOverdue(task, today)`), `TaskController`, `dto/TaskRequest`, `dto/TaskResponse` (`@Schema(name="Task")`).
- Defaults: `sort=CREATED_AT`, `direction=DESC` (contract enum defaults). Ties are broken by createdAt and then id. With `DUE_DATE`, tasks without a due date always come last in both directions. `archived` defaults to false and only `archived=true` returns archived tasks. `overdue=false` returns non-overdue tasks.
- Sorting happens in memory after the Specification query. That is fine for the single-user scale (SC-009 with 1,000 tasks is checked in T101). An index `idx_task_archived_status_due (archived, status, due_date)` is already declared on `Task`.
- `q` is trimmed and lower-cased. `%`, `_` and `\` are escaped so they match literally.
- PUT replaces title, description and dueDate. Omitting dueDate or description clears them. status and priority keep their current values when omitted (data-model). `updatedAt` changes on every PUT, complete (when not already DONE), archive and restore.
- Timestamps are truncated to microseconds so the value stored in H2 equals the value returned.
- The `TaskRequest.title` swagger shows `minLength: 1, maxLength: 200` (`@NotBlank` + `@Size(min=1,max=200)`). An empty string therefore gets two messages on field `title`.
- Cosmetic swagger differences (not structural): `TaskRequest.description` has an extra `minLength: 0`, and `Problem.status` has `format: int32`.
- Shared code change: `common/ApiExceptionHandler.handleUnreadable` now walks the whole cause chain to find the Jackson exception. Before, an invalid `dueDate` reported field `body`; now it reports `dueDate`. `ApiExceptionHandlerTest` still passes.
- No unit tests were added for task code (T032/T033 are [TEST] tasks owned by loop-3).
- `checklists/phase-1-foundation.md` has 19 unchecked reviewer items. Loop rules forbid asking the user, so implementation went ahead without them.
- Backend is running. `state/backend.pid` holds the Maven JVM pid (71554); killing it also stops the forked app JVM.
- Fix trial 1 (BUG-P2-001, T025): `deleteTask` now declares `produces = {application/json, application/problem+json}`, so `Accept: application/problem+json` gives 204/404 instead of 406. Regression test `TaskControllerTest.deleteAcceptsProblemJsonOnly` added. Swagger is unchanged. Bug repro and phase regression curl checks pass. Backend restarted (pid 85852).

### curl checks — fix trial 1 (BUG-P2-001)
| Command | Expected | Actual |
|---|---|---|
| `curl -X DELETE -H 'Accept: application/problem+json' -H 'Origin: http://localhost:4200' /api/tasks/<id>` | 204 + Allow-Origin | 204 + Allow-Origin |
| same, `/api/tasks/999999` | 404 problem+json + Allow-Origin | 404 problem+json + Allow-Origin |
| same, `/api/tasks/abc` | 400 | 400 |
| DELETE with Accept `application/json`, `*/*`, `application/json, application/problem+json` | 204 / 404 | 204 / 404 |
