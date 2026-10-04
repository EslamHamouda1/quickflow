# Phase 1 — Test report (Setup & Foundation)

Mode: test · Trial: 0 · Started 2026-10-03T18:55:57+03:00 · Ended 2026-10-03T19:03:07+03:00
Phase file: `loops/loop-3-testing/outputs/phase-1-testing.md` · Checklist: `specs/001-quickflow-productivity/checklists/phase-1-foundation.md`
Result: **passed** · Tasks ticked: T018, T019, T020

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 9 | 9 | 0 | 0 |
| Frontend tests | 9 | 9 | 0 | 0 |
| Backend + Frontend tests | 3 | 3 | 0 | 0 |
| **All** | **21** | **21** | **0** | **0** |

Smoke (`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200`): both OK (200).

## Coverage

| Area | Tests | Line % | Branch % | Report |
|---|---|---|---|---|
| Backend (JaCoCo) | 15 (ApiExceptionHandlerTest 12, ProblemJsonSmokeTest 2, QuickFlowApplicationTests 1) | 96.3 | 68.8 | `outputs/coverage/phase-1/backend/index.html` |
| Frontend (vitest v8) | 31 in 4 files | 68.95 (stmts 72.46) | 77.6 | `outputs/coverage/phase-1/frontend/quickflow/index.html` |

Per class/file: `ApiExceptionHandler` line 100 % / branch 68.8 %; `now.service.ts` 100 / 100; `notification.service.ts` 100 / 100; `shell.component.ts` stmts 84.2 / branch 72.4. Uncovered frontend code is mostly shared UI not used until later phases (`confirm-dialog`, `form-field`).

## Test code added

- `backend/src/test/java/com/quickflow/common/ApiExceptionHandlerTest.java` (T018)
- `frontend/src/app/core/now.service.spec.ts`, `frontend/src/app/core/notification.service.spec.ts`, `frontend/src/app/layout/shell.component.spec.ts` (T019)

## curl commands

| Case | Command | Expected | Actual |
|---|---|---|---|
| BE-001 | `curl -s -w '%{http_code} %{content_type}' http://localhost:8080/v3/api-docs` | 200 json, 3.1.0, QuickFlow API 1.0.0 | 200 `application/json`, openapi 3.1.0, title/version/server match, 6 tags, `paths: {}` |
| BE-002 | `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/swagger-ui/index.html` | 200 | 200 text/html; `/swagger-ui.html` → 302 to index |
| BE-003 | `curl -s -o /dev/null -D - -X OPTIONS -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' http://localhost:8080/api/tasks` | 200 + ACAO | 200, `Access-Control-Allow-Origin: http://localhost:4200`, `Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`, `Allow-Headers: content-type` |
| BE-004 | same with `Access-Control-Request-Method: GET` / `PUT` / `DELETE` | 200 + ACAO | 200 + ACAO ×3 |
| BE-005 | `curl -s -D - -X OPTIONS -H 'Origin: http://evil.test' -H 'Access-Control-Request-Method: POST' http://localhost:8080/api/tasks` | 403 | 403 "Invalid CORS request", no ACAO |
| BE-006 | `curl -s -i http://localhost:8080/api/nope` | 404 problem+json | 404 `application/problem+json` `{"status":404,"title":"Not Found","instance":"/api/nope",...}` |
| BE-007 | `jq -c '{openapi, title:.info.title, version:.info.version, servers}' backend/openapi/openapi.json` | = contract | 3.1.0, QuickFlow API, 1.0.0, http://localhost:8080 |
| BE-008/009 | `cd backend && ./mvnw -q verify` | exit 0 | exit 0, 15/15 |
| E2E-002 | `curl -s http://localhost:8080/v3/api-docs \| jq -r '.servers[0].url'` | http://localhost:8080 | http://localhost:8080 (= `environment.apiUrl`, generated `basePath`) |

## Playwright MCP steps

| Case | Tool | Target / value | Outcome |
|---|---|---|---|
| FE-001 | `browser_resize` → `browser_navigate` → `browser_snapshot` → `browser_console_messages(warning)` | 1280×800, http://localhost:4200/ | `/dashboard`; `navigation "Main navigation"` with 6 labelled links, banner, main, h1; 0 errors/warnings |
| FE-002 | `browser_run_code_unsafe` | click `getByRole('link', {name})` in the nav for Tasks, Habits, Learning Resources, Todo Plans, Settings, Dashboard | URL/h1/title match; exactly 1 `aria-current="page"`; indicator aligned; 0 errors |
| FE-002 | `browser_take_screenshot` | `phase-1-TC-FE-002-nav-dashboard.png` | saved |
| FE-003 | `browser_run_code_unsafe` | `/tasks`, Tab ×8, then reload, Tab, screenshot, Enter | order Skip → Home → 6 nav links; 2 px outline; skip link visible; focus → `main#main-content` |
| FE-004 | `browser_run_code_unsafe` | `/dashboard`, Tab ×4, Enter | `/tasks` |
| FE-005 | `browser_emulate_media(reducedMotion=reduce)` + `browser_run_code_unsafe` | `/habits`, computed durations of all elements; then `no-preference` | reduce: max 1e-05 s; normal: max 0.25 s |
| FE-006 | `browser_run_code_unsafe` | 375×800 and 1440×800, `/plans` → click Settings | no overflow, 6/6 links visible, Settings current, ARIA names = full labels |
| FE-007 | `browser_run_code_unsafe` | `emulateMedia colorScheme dark/light`, `/dashboard` | dark and light tokens applied |
| FE-008 | `browser_run_code_unsafe` | goto `/habits`, goto `/unknown-xyz` | Habits current; unknown → `/dashboard` |
| E2E-001 | `browser_run_code_unsafe` | on :4200 `fetch` POST `/api/tasks` (preflighted) and GET `/api/nope` on :8080 | both readable: 404 `application/problem+json` (no CORS block) |
| E2E-003 | `browser_run_code_unsafe` | listen to `request` + `console`, open all 6 pages | 0 external requests, 0 errors |

Screenshots (`loops/loop-3-testing/outputs/screenshots/`): `phase-1-TC-FE-002-nav-dashboard.png`, `phase-1-TC-FE-003-skip-link-focused.png`, `phase-1-TC-FE-005-reduced-motion.png`, `phase-1-TC-FE-006-width-375.png`, `phase-1-TC-FE-006-width-1440.png`, `phase-1-TC-FE-007-dark.png`.

## Bugs

None.

## Notes

- `browser_console_messages(all=true)` also listed a CORS error for `fetch('http://localhost:8080/v3/api-docs')` from `/settings`. That came from an earlier browser session (frontend-dev noted the same probe). A fresh pass over all six pages (E2E-003) shows the app makes no such request and logs no errors. `/v3/api-docs` is outside the `/api/**` CORS scope by design (T005).
- The 404 console entries for `/api/tasks` and `/api/nope` were caused by the E2E-001 probe fetches, not by the app.
- `main#main-content` has no focus outline after the skip link moves focus there. This is acceptable because `main` is a programmatic focus target (`tabindex="-1"`), not an interactive control.
