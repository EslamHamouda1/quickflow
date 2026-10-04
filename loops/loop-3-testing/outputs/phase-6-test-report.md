# Phase 6 — Test report (US6 Navigate and set preferences)

Mode: test · Trial: 0 · Started 2026-10-03T21:10:10+03:00 · Ended 2026-10-03T21:17:18+03:00 · Result: **passed**

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 13 | 13 | 0 | 0 |
| Frontend tests | 12 | 12 | 0 | 0 |
| Backend + Frontend tests | 6 | 6 | 0 | 0 |
| **All** | **31** | **31** | **0** | **0** |

Tasks ticked: T089, T090, T091. Bugs: none.

## Unit tests and coverage

| Suite | Command | Result | Line | Branch |
|---|---|---|---|---|
| Backend (JaCoCo) | `cd backend && ./mvnw -q verify` | 296 tests, 0 failures (new: SettingsServiceTest 6, SettingsControllerTest 19) | 97.7% (settings package 94.6%) | 95.9% |
| Frontend (Angular unit-test, v8) | `cd frontend && npx ng test --watch=false --coverage` | 15 files, 186 tests pass (new: settings.store.spec 8, settings-page.component.spec 14) | 57.22% (settings.store.ts 100%, settings-page 97.53%) | 43.98% |

Coverage reports: `outputs/coverage/phase-6/backend/`, `outputs/coverage/phase-6/frontend/`.

Test code added:
- `backend/src/test/java/com/quickflow/settings/SettingsServiceTest.java`
- `backend/src/test/java/com/quickflow/settings/SettingsControllerTest.java`
- `frontend/src/app/core/settings.store.spec.ts`
- `frontend/src/app/features/settings/settings-page.component.spec.ts`
- `loops/loop-3-testing/outputs/curl/phase-6-curl.sh`

## Smoke

`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200` → both 200.

## curl (script `outputs/curl/phase-6-curl.sh`, 26/26 PASS)

Each request: `curl -s -o r.json -w '%{http_code} %{content_type}' -X <M> -H 'Content-Type: application/json' --data '<body>' http://localhost:8080/api/settings`, asserted with `jq`.

| ID | Request | Expected | Actual | Key fields |
|---|---|---|---|---|
| BE-001 | GET | 200 | 200 | 4 fields present |
| BE-002 | PUT `{Sara,false,true,TASKS}` | 200 | 200 | echoed |
| BE-003 | GET | 200 | 200 | persisted |
| BE-004 | PUT name `"  Omar  "`, PLANS | 200 | 200 | `displayName=="Omar"` |
| BE-005-* | PUT defaultView DASHBOARD/TASKS/HABITS/LEARNING/PLANS | 200 ×5 | 200 ×5 | echoed |
| BE-006 | PUT 80-char name | 200 | 200 | length 80 |
| BE-007 | PUT name `"   "` | 400 | 400 | problem+json, field displayName |
| BE-008 | PUT name `""` | 400 | 400 | field displayName |
| BE-009 | PUT 81-char name | 400 | 400 | field displayName |
| BE-010 | PUT without displayName | 400 | 400 | field displayName |
| BE-011 | PUT without inAppNotifications | 400 | 400 | field inAppNotifications |
| BE-012 | PUT without browserNotifications | 400 | 400 | field browserNotifications |
| BE-013 | PUT without defaultView | 400 | 400 | field defaultView |
| BE-014 | PUT defaultView `CALENDAR` | 400 | 400 | problem+json status 400 |
| BE-015 | PUT inAppNotifications `"yes"` | 400 | 400 | problem+json |
| BE-016 | PUT body `{` | 400 | 400 | problem+json |
| BE-017 | PUT `{}` | 400 | 400 | all 4 fields in errors |
| BE-018 | GET | 200 | 200 | unchanged after 400s |
| BE-019 | DELETE | 405 | 405 | |
| BE-020 | POST | 405 | 405 | |
| BE-021 | PUT `text/plain` | 415 | 415 | |
| BE-022 | PUT `{Friend,true,false,DASHBOARD}` | 200 | 200 | defaults restored |

Swagger: `curl -s http://localhost:8080/v3/api-docs | jq '.paths["/api/settings"]'` → get `getSettings` [200], put `updateSettings` [200,400]; `Settings.required` = 4 fields; `DefaultView.enum` = DASHBOARD, TASKS, HABITS, LEARNING, PLANS.

E2E curl: `curl -s http://localhost:8080/api/settings` after UI save → `{"displayName":"QA Tester","inAppNotifications":false,"browserNotifications":false,"defaultView":"HABITS"}`; `curl -X PUT ... '{"displayName":"Curl User","inAppNotifications":true,"browserNotifications":true,"defaultView":"LEARNING"}'` → 200.

## Playwright MCP steps (headless chromium)

| Case | Steps (tool → target → value) | Outcome |
|---|---|---|
| FE-003 | `browser_navigate` /settings; `browser_snapshot` | form, 3 regions, textbox/switches/combobox present |
| FE-004 | `browser_run_code_unsafe`: 6 pages × 6 `getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name})`.click | 36/36 URL + single `aria-current=page` + h1 |
| FE-005 | fill textbox "Display name" `""`; click button "Save settings" | required message, aria-invalid, focused |
| FE-006 | fill 81 × a; click Save; `page.request.get` before/after | live message, 81/80, not saved |
| FE-007 | fill/select → click "Reset" (3 variants) | values restored, Reset disabled |
| FE-008 | fill "  QA Tester  "; click switch "In-app notifications"; selectOption "Landing page" HABITS; click Save | PUT 200, toast "Settings saved" |
| FE-009 | new context + init script (permission default → denied); click switch "Browser notifications"; Save | requested once, denied warning, switch on, saved |
| FE-010 | `page.route` PUT → 400 problem+json; fill "Srv"; Save | field + form message, aria-invalid |
| FE-011 | `setViewportSize` 375×800; console listener | no overflow; no console errors |
| FE-012 | focus switch "Browser notifications"; press Space | toggled |
| E2E-002 | `goto /` | → /habits |
| E2E-003 | curl PUT; `goto /`; `goto /settings` | → /learning; form shows Curl User / on / on / LEARNING |
| E2E-004 | API: task + in-progress plan; `goto /tasks` | toast "Plan started: P6QA started plan" |
| E2E-005 | API: in-app false + in-progress plan; `goto /tasks`, wait 4 s | no toast |
| E2E-006 | API defaults; `goto /` | → /dashboard |

Screenshots (`outputs/screenshots/`): `phase-6-tc-fe-settings.png`, `phase-6-tc-fe-validation.png`, `phase-6-tc-fe-save.png`, `phase-6-tc-fe-permission-denied.png`, `phase-6-tc-fe-server-error.png`, `phase-6-tc-fe-375.png`, `phase-6-tc-e2e-landing-habits.png`, `phase-6-tc-e2e-curl-reflected.png`, `phase-6-tc-e2e-denied-inapp-toast.png`.

## Bugs

None.

## Notes

- Leftover-data check: the task list search parameter is `q` (a `search=` query is ignored by design); `GET /api/tasks?q=P6QA` and plans show no P6QA leftovers.
- Test data (P6QA tasks/plans) deleted; settings left at defaults (Friend / true / false / DASHBOARD).
