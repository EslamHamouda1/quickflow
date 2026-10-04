# Phase 1 — Testing (Setup & Foundation)

Mode: test · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-1-foundation.md` (from `/speckit-checklist`, 19 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T018 [TEST] [P] Backend unit test `common/ApiExceptionHandlerTest.java` (`@WebMvcTest` with a test-only controller, `MockMvcTester`): validation error → 400 problem+json with `errors[]`, `BadRequestException` → 400 with its field in `errors[]`, `NotFoundException` → 404, `ConflictException` → 409; run `./mvnw verify` and record JaCoCo coverage (traces US1, US2, US3, US4, US6: 400/404/409 error format)
- [x] T019 [TEST] [P] Frontend unit tests `core/now.service.spec.ts`, `core/notification.service.spec.ts`, `layout/shell.component.spec.ts`; run `npx ng test --watch=false --coverage` (traces US4 for now/notification services, US6 for the shell)
- [x] T020 [TEST] curl smoke: `/v3/api-docs` 200, `/swagger-ui/index.html` 200, CORS preflight `OPTIONS /api/tasks` with `Origin: http://localhost:4200` returns `Access-Control-Allow-Origin`; Playwright MCP: shell loads, all six links navigate and highlight, skip link and keyboard Tab order work, accessibility snapshot (`browser_snapshot`) shows a named navigation landmark with labelled links, and emulated reduced motion disables animations (traces US6)

## Backend tests

### TC-P1-BE-001 — Swagger JSON served
- Story: US6 (foundation for every story)  AC: API documentation available for the client generator (T020; contract `info`/`servers`)
- Steps: `curl -s -w '%{http_code} %{content_type}' http://localhost:8080/v3/api-docs`
- Expected: 200 `application/json`, openapi 3.1.0, title "QuickFlow API", version 1.0.0, server http://localhost:8080
- Result: passed

### TC-P1-BE-002 — Swagger UI served
- Story: US6  AC: T020 `/swagger-ui/index.html` 200
- Steps: `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/swagger-ui/index.html`; `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:8080/swagger-ui.html`
- Expected: 200 text/html; `/swagger-ui.html` 302 → `/swagger-ui/index.html`
- Result: passed

### TC-P1-BE-003 — CORS preflight for the UI origin
- Story: US6  AC: T020 CORS preflight `OPTIONS /api/tasks` with `Origin: http://localhost:4200` returns `Access-Control-Allow-Origin`
- Steps: `curl -s -o /dev/null -D - -X OPTIONS -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' http://localhost:8080/api/tasks`
- Expected: 200, `Access-Control-Allow-Origin: http://localhost:4200`, methods GET,POST,PUT,DELETE,OPTIONS, header content-type allowed
- Result: passed

### TC-P1-BE-004 — CORS preflight for GET / PUT / DELETE
- Story: US6  AC: T005 allowed methods
- Steps: same as BE-003 with `Access-Control-Request-Method: GET|PUT|DELETE`
- Expected: 200 + `Access-Control-Allow-Origin: http://localhost:4200` for each
- Result: passed

### TC-P1-BE-005 — Foreign origin rejected
- Story: US6  AC: T005 only `http://localhost:4200` is allowed
- Steps: `curl -s -D - -X OPTIONS -H 'Origin: http://evil.test' -H 'Access-Control-Request-Method: POST' http://localhost:8080/api/tasks`
- Expected: 403 "Invalid CORS request", no `Access-Control-Allow-Origin`
- Result: passed

### TC-P1-BE-006 — Unknown API path returns 404 problem+json
- Story: US1 (404 error format shared by all stories)  AC: errors use RFC 9457 application/problem+json
- Steps: `curl -s -i http://localhost:8080/api/nope`
- Expected: 404, `Content-Type: application/problem+json`, body `status: 404`, `title: "Not Found"`, `instance: "/api/nope"`
- Result: passed

### TC-P1-BE-007 — Generated `openapi.json` matches the contract info
- Story: US6  AC: T006/T008 `backend/openapi/openapi.json` info/servers = contract
- Steps: `jq -c '{openapi, title:.info.title, version:.info.version, servers}' backend/openapi/openapi.json`; compare with `contracts/openapi.yaml`
- Expected: 3.1.0, "QuickFlow API", 1.0.0, `http://localhost:8080`; tags Tasks, Habits, Learning, Plans, Dashboard, Settings
- Result: passed

### TC-P1-BE-008 — Unit: `ApiExceptionHandlerTest` (T018)
- Story: US1, US2, US3, US4, US6  AC: 400 (validation, with `errors[{field,message}]`), 404, 409 problem+json format (US1 AS2, US2 duplicate 409, US4 AS2)
- Steps: `cd backend && ./mvnw -q verify` (12 tests: body validation 400 with 2 field errors, valid body 200, malformed JSON 400 `body`, wrong body type 400 `count`, path type mismatch 400 `id`, `@RequestParam @Max` 400 `limit`, `ConstraintViolationException` 400 `title`, `BadRequestException` 400 with its field `endDateTime`, `IllegalArgumentException` 400 `request` (+ default message), `NotFoundException` 404, `ConflictException` 409)
- Expected: all pass; every response `application/problem+json`
- Result: passed

### TC-P1-BE-009 — Unit: full backend suite + JaCoCo
- Story: US6  AC: T018 run `./mvnw verify` and record JaCoCo coverage
- Steps: `cd backend && ./mvnw -q verify`; copy `target/site/jacoco/` → `outputs/coverage/phase-1/backend/`
- Expected: exit 0; 15 tests (ApiExceptionHandlerTest 12, ProblemJsonSmokeTest 2, QuickFlowApplicationTests 1), 0 failures
- Result: passed (line 96.3 %, branch 68.8 %)

## Frontend tests

### TC-P1-FE-001 — Shell loads with named navigation landmark
- Story: US6  AC: US6 AS1 persistent navigation; FR-034 labelled landmarks
- Steps: `browser_navigate` http://localhost:4200/ → `browser_snapshot` → `browser_console_messages(level=warning)`
- Expected: redirect to `/dashboard`; snapshot shows skip link, banner, `navigation "Main navigation"` with 6 labelled links (Dashboard, Tasks, Habits, Learning Resources, Todo Plans, Settings), `main`, h1 "Dashboard", `region "Notifications"`; 0 console errors/warnings
- Screenshot: `outputs/screenshots/phase-1-TC-FE-002-nav-dashboard.png`
- Result: passed

### TC-P1-FE-002 — All six links navigate and highlight
- Story: US6  AC: US6 AS1 "highlights the current page, and each link opens its page"
- Steps: `browser_run_code_unsafe`: click nav link by role/name Tasks → Habits → Learning Resources → Todo Plans → Settings → Dashboard; after each read URL, h1, document title, links with `aria-current="page"`, `.is-active`, indicator box vs. active item box
- Expected: URL = link path, h1 = label, title "<Label> · QuickFlow", exactly one `aria-current="page"` on the clicked link, indicator aligned; no console errors
- Screenshot: `outputs/screenshots/phase-1-TC-FE-002-nav-dashboard.png`
- Result: passed

### TC-P1-FE-003 — Skip link and Tab order
- Story: US6  AC: FR-034 every action reachable by keyboard, visible focus indicator
- Steps: `browser_run_code_unsafe`: open `/tasks`, press Tab ×8 reading `document.activeElement`; reload, Tab, screenshot, Enter
- Expected: order = Skip link → QuickFlow home → Dashboard → Tasks → Habits → Learning Resources → Todo Plans → Settings; each with 2 px solid focus outline; skip link visible when focused; Enter moves focus to `main#main-content`
- Screenshot: `outputs/screenshots/phase-1-TC-FE-003-skip-link-focused.png`
- Result: passed

### TC-P1-FE-004 — Keyboard activation of a nav link
- Story: US6  AC: US6 AS1 + FR-034
- Steps: open `/dashboard`, Tab ×4 (focus "Tasks"), Enter
- Expected: URL `/tasks`
- Result: passed

### TC-P1-FE-005 — Reduced motion disables animations
- Story: US6  AC: FR-032 animations ≤ 250 ms and disabled when the user prefers reduced motion
- Steps: `browser_emulate_media(reducedMotion=reduce)`; open `/habits`; read computed `transition-duration`/`animation-duration` on every element; repeat with `no-preference`
- Expected: reduce → max transition and animation 1e-05 s; no-preference → max transition 0.25 s (≤ 250 ms)
- Screenshot: `outputs/screenshots/phase-1-TC-FE-005-reduced-motion.png`
- Result: passed

### TC-P1-FE-006 — Layout at 375 px and 1440 px
- Story: US6  AC: FR-032 layout works from 375 px to 1440 px; US6 AS1 navigation persistent on every width
- Steps: `setViewportSize` 375×800 and 1440×800; open `/plans`, click "Settings" by role; read `scrollWidth`, link boxes, `aria-current`; ARIA snapshot of the nav at 375 px
- Expected: no horizontal overflow; all 6 links inside the viewport; Settings current; accessible names are the full labels at 375 px
- Screenshots: `outputs/screenshots/phase-1-TC-FE-006-width-375.png`, `phase-1-TC-FE-006-width-1440.png`
- Result: passed

### TC-P1-FE-007 — Light and dark themes
- Story: US6  AC: FR-032 consistent color; FR-034 contrast tokens for both schemes
- Steps: `emulateMedia colorScheme=dark` → open `/dashboard`, read body colors, screenshot; repeat with `light`
- Expected: dark body bg rgb(14,16,22) / text rgb(236,238,245); light bg rgb(245,246,250) / text rgb(27,29,41)
- Screenshot: `outputs/screenshots/phase-1-TC-FE-007-dark.png`
- Result: passed

### TC-P1-FE-008 — Deep link and unknown route
- Story: US6  AC: US6 AS1 each page opens; T013 `''` → `/dashboard`
- Steps: `page.goto('/habits')` → read h1 + current link; `page.goto('/unknown-xyz')`
- Expected: Habits h1 with `/habits` current; unknown route → `/dashboard`
- Result: passed

### TC-P1-FE-009 — Unit: `now.service`, `notification.service`, `shell.component` specs (T019)
- Story: US4 (now/notification), US6 (shell; AS3 denied browser permission keeps in-app notifications)
- Steps: `cd frontend && npx ng test --watch=false --coverage`; copy `coverage/` → `outputs/coverage/phase-1/frontend/`
- Expected: all pass (4 files, 31 tests)
- Result: passed (overall lines 68.95 %, branches 77.6 %; now.service 100 %/100 %, notification.service 100 %/100 %, shell.component 84.2 % stmts / 72.4 % branches)

## Backend + Frontend tests

### TC-P1-E2E-001 — UI origin can call the backend (CORS end to end)
- Story: US6  AC: T005/T020 CORS for http://localhost:4200
- Steps: on http://localhost:4200/tasks `browser_run_code_unsafe` → `fetch('http://localhost:8080/api/tasks', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'})` (preflighted) and `fetch('http://localhost:8080/api/nope')`; then compare with curl BE-003/BE-006
- Expected: no CORS block; both responses readable by the page: 404, `application/problem+json`, `status: 404` (phase 1 has no `/api/**` operations yet)
- Result: passed

### TC-P1-E2E-002 — Frontend API base = swagger server
- Story: US6  AC: T010/T011 generated client and `BASE_PATH` from `environment.apiUrl`
- Steps: `curl -s http://localhost:8080/v3/api-docs | jq -r '.servers[0].url'`; read `frontend/src/environments/*.ts`, `app.config.ts`, `src/app/api/api.base.service.ts`
- Expected: all `http://localhost:8080`
- Result: passed

### TC-P1-E2E-003 — App with running backend: all pages, no failing calls
- Story: US6  AC: US6 AS1 + "no console errors"
- Steps: `browser_run_code_unsafe` listening to `request` and `console`; open each of the six pages
- Expected: 0 console errors/warnings; 0 failed requests (no backend calls in phase 1)
- Result: passed
