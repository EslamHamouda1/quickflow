# Phase 8 — Backend (Polish & Cross-Cutting Concerns)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T101 [BE] [P] Performance check: seed 1,000 tasks via a curl loop, confirm `GET /api/tasks` with search/filters responds < 500 ms; add indexes on `task(archived, status, due_date)` in `task/Task.java` if needed
- [x] T102 [BE] [P] Final swagger audit: `backend/openapi/openapi.json` matches `contracts/openapi.yaml` (all paths, methods, operationIds, status codes, schema names, schema properties and required lists); fix mismatches

## Endpoints

No new endpoints. The phase covers `GET /api/tasks` (listTasks) performance and an audit of all 37 contract operations.

## curl checks

1,000 tasks seeded with `POST /api/tasks` in a curl loop (titles `PERF8 task <i> alpha`, mixed status, priority and due dates over 90 days); total 1,009 tasks. Each timing is the second, warm call (`-w '%{http_code} %{time_total}'`).

| # | Command | Expected | Actual |
|---|---|---|---|
| 1 | `curl -s http://localhost:8080/api/tasks` (1,009 rows, 290 KB) | 200, < 500 ms | 200, 7.7 ms |
| 2 | `GET /api/tasks?q=alpha` | 200, < 500 ms | 200, 7.9 ms |
| 3 | `GET /api/tasks?q=task%2055` | 200, < 500 ms | 200, 2.4 ms |
| 4 | `GET /api/tasks?status=TODO` | 200, < 500 ms | 200, 3.7 ms |
| 5 | `GET /api/tasks?priority=HIGH` | 200, < 500 ms | 200, 3.8 ms |
| 6 | `GET /api/tasks?dueFrom=2026-09-10&dueTo=2026-10-10` | 200, < 500 ms | 200, 3.8 ms |
| 7 | `GET /api/tasks?overdue=true` | 200, < 500 ms | 200, 2.9 ms |
| 8 | `GET /api/tasks?archived=true` | 200, < 500 ms | 200, 1.4 ms |
| 9 | `GET /api/tasks?status=IN_PROGRESS&priority=LOW&sort=DUE_DATE&direction=ASC` | 200, < 500 ms | 200, 1.7 ms |
| 10 | `GET /api/tasks?q=perf&status=DONE&priority=HIGH&dueFrom=2026-09-01&dueTo=2026-11-30&sort=CREATED_AT&direction=DESC` | 200, < 500 ms | 200, 4.8 ms |
| 11 | `GET /api/tasks?q=ALPHA&overdue=true&sort=DUE_DATE` | 200, < 500 ms | 200, 3.6 ms |
| 12 | `GET /api/dashboard` with 1,009 tasks | 200, < 500 ms | 200, 14 ms |
| 13 | `GET /api/tasks?sort=bogus` (also lowercase `sort=dueDate`) | 400 problem+json | 400 |
| 14 | `POST /api/tasks` `{"title":""}` | 400 | 400 |
| 15 | `GET /api/tasks/999999` | 404 | 404 |
| 16 | Cleanup: `DELETE /api/tasks/{id}` for the 1,000 seeded ids | 204 ×1000; back to 9 tasks | 204 ×1000; 9 tasks |

## Notes

- T101: the composite index `idx_task_archived_status_due` on `task(archived, status, due_date)` already exists in `task/Task.java` from Phase 2. Every list, search and filter query stays under 15 ms with 1,009 tasks, so no code change was needed. The seed data was deleted afterwards; loop-3 (T106) seeds its own data.
- T102: regenerated `backend/openapi/openapi.json` (`./mvnw -q -Popenapi verify -DskipTests`) and compared it with `contracts/openapi.yaml` using a script. The script checks paths, methods, operationIds, status codes, query/path parameters, request-body schema refs, per-status response schema refs (shared `$ref` responses resolved), schema names, property sets, `required` lists and enums. Result: 37/37 operations, 34/34 schemas, 0 mismatches, no extra paths or schemas. The live `/v3/api-docs` also gives 0 mismatches.
- `./mvnw -q verify` passes (exit 0). No source files changed in this phase. The backend left running from Phase 7 is still up (pid in `state/backend.pid`).
