# Phase 6 — Testing (User Story 6 - Navigate and set preferences)

Mode: test · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-6-settings.md` (from `/speckit-checklist`, 26 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T089 [TEST] [P] [US6] Backend tests `settings/SettingsServiceTest.java` (defaults created once) and `settings/SettingsControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean SettingsService`: request-DTO validation 400 problem+json for blank / 81-char displayName, missing displayName / inAppNotifications / browserNotifications / defaultView, invalid defaultView enum)
- [x] T090 [TEST] [P] [US6] Frontend unit tests `core/settings.store.spec.ts`, `features/settings/settings-page.component.spec.ts`
- [x] T091 [TEST] [US6] curl tests for both settings operations; Playwright MCP tests: all six nav links from every page (one click, highlight), settings form; e2e: change display name and default view in UI → verify via curl, reload → app opens on the chosen view; change via curl → UI reflects after reload

## Backend tests

### TC-P6-BE-001 — Unit: `SettingsServiceTest` (T089)
- Story: US6  AC: AS2 / FR-029 (defaults created once, saved, persisted)
- Steps: `cd backend && ./mvnw -q verify`. `@DataJpaTest` + `replace = NONE` + real `SettingsRepository`. 6 tests: first `get()` creates the row with Friend / true / false / DASHBOARD; repeated `get()`/`displayName()` (incl. after flush+clear) keep exactly 1 row; an existing row is returned without being overwritten; `update()` trims the name, persists all 4 fields (re-read after clear); a second update overwrites the first and `displayName()` reflects it; `displayName()` defaults to Friend.
- Expected: all pass
- Result: passed

### TC-P6-BE-002 — Unit: `SettingsControllerTest` (T089)
- Story: US6  AC: AS2 / FR-029 (validation 400 problem+json)
- Steps: `@WebMvcTest(SettingsController)`, `MockMvcTester`, `@MockitoBean SettingsService`. 19 tests: GET 200 with 4 fields; PUT 200 passes the exact DTO; 80-char name 200; each of the 5 DefaultView values 200; 400 problem+json with `errors[].field` for blank, empty, 81-char, missing and null displayName, missing inAppNotifications / browserNotifications / defaultView, `{}` lists all 4 fields; invalid enum `CALENDAR` 400; malformed JSON 400. The service is never called on a 400.
- Expected: all pass
- Result: passed

### TC-P6-BE-003 — curl: getSettings (curl BE-001)
- Story: US6  AC: AS2
- Steps: `GET /api/settings`
- Expected: 200, body has displayName, inAppNotifications (boolean), browserNotifications, defaultView
- Result: passed

### TC-P6-BE-004 — curl: updateSettings all fields + persisted (curl BE-002, BE-003)
- Story: US6  AC: AS2
- Steps: `PUT {Sara,false,true,TASKS}` then `GET`
- Expected: 200 with the same values; GET returns them
- Result: passed

### TC-P6-BE-005 — curl: display name trimmed (curl BE-004)
- Story: US6  AC: AS2 / FR-029
- Steps: `PUT displayName "  Omar  "`
- Expected: 200, `displayName == "Omar"`
- Result: passed

### TC-P6-BE-006 — curl: every DefaultView accepted (curl BE-005-*)
- Story: US6  AC: AS2
- Steps: PUT with each of DASHBOARD, TASKS, HABITS, LEARNING, PLANS
- Expected: 200 and echoed defaultView for each
- Result: passed

### TC-P6-BE-007 — curl: 80-char display name accepted (curl BE-006)
- Story: US6  AC: FR-029
- Expected: 200, name length 80
- Result: passed

### TC-P6-BE-008 — curl: displayName validation (curl BE-007..BE-010)
- Story: US6  AC: FR-029
- Steps: PUT with blank `"   "`, empty `""`, 81 chars, missing displayName
- Expected: 400 `application/problem+json` with `errors[].field == "displayName"`
- Result: passed

### TC-P6-BE-009 — curl: required fields (curl BE-011..BE-013, BE-017)
- Story: US6  AC: FR-029
- Steps: PUT without inAppNotifications / browserNotifications / defaultView; PUT `{}`
- Expected: 400 problem+json naming the missing field; `{}` names all four
- Result: passed

### TC-P6-BE-010 — curl: malformed values (curl BE-014..BE-016)
- Story: US6  AC: FR-029
- Steps: defaultView `CALENDAR`; inAppNotifications `"yes"`; body `{`
- Expected: 400 problem+json
- Result: passed

### TC-P6-BE-011 — curl: rejected updates do not change data (curl BE-018)
- Story: US6  AC: AS2
- Expected: GET after the 400s still returns the last valid values (80-char name, HABITS)
- Result: passed

### TC-P6-BE-012 — curl: unsupported method / media type (curl BE-019..BE-021)
- Story: US6  AC: AS2
- Steps: `DELETE`, `POST /api/settings`; `PUT` with `text/plain`
- Expected: 405, 405, 415
- Result: passed

### TC-P6-BE-013 — Swagger matches contract
- Story: US6  AC: AS2
- Steps: `curl -s http://localhost:8080/v3/api-docs | jq` on `/api/settings`, `Settings.required`, `DefaultView.enum`
- Expected: GET getSettings [200], PUT updateSettings [200,400]; required = 4 fields; enum DASHBOARD..PLANS
- Result: passed

## Frontend tests

### TC-P6-FE-001 — Unit: `settings.store.spec.ts` (T090)
- Story: US6  AC: AS2 (loaded, saved, applied), AS3
- Steps: `cd frontend && npx ng test --watch=false --coverage`. 8 tests: defaults before load; load exposes values + pushes in-app/browser prefs into NotificationService; load never rejects when backend down (defaults kept, error set); later load clears error; save sends full body and applies; save rejects with problem+json field errors and keeps previous values; every DefaultView → route; `defaultViewGuard` returns UrlTree `/dashboard`, `/plans`, `/habits` as settings change.
- Expected: all pass
- Result: passed

### TC-P6-FE-002 — Unit: `settings-page.component.spec.ts` (T090)
- Story: US6  AC: AS2, AS3
- Steps: 14 tests: `validateSettings` (blank, empty, 80 after trim, 81); 5 landing options with labels; renders 3 sections with loaded values, counter, granted state, no unsaved; save name/in-app/view → API body trimmed, success toast, store + NotificationService updated; empty name blocked with message + aria-invalid; 81 chars live message, counter over, blocked; 80 accepted; server field error shown + form message, cleared on input; non-field error shows API message; browser on → requestPermission → denied warning, switch stays on, saved; no request when denied already / turning off; unsupported state; reset restores; load-error banner.
- Expected: all pass
- Result: passed

### TC-P6-FE-003 — Settings page structure (Playwright)
- Story: US6  AC: AS2
- Steps: `browser_navigate` `/settings`; `browser_snapshot`
- Expected: h1 Settings; form "Settings" with regions Profile / Notifications / Default view; textbox "Display name" (Friend, counter 6/80); switches "In-app notifications" (checked) / "Browser notifications"; combobox "Landing page" with 5 options; Reset (disabled), Save settings
- Result: passed — screenshot `outputs/screenshots/phase-6-tc-fe-settings.png`

### TC-P6-FE-004 — All six nav links from every page (Playwright)
- Story: US6  AC: AS1 / FR-028 / SC-006
- Steps: `browser_run_code_unsafe`: for each of the 6 pages, `goto` page, click each of the 6 links in navigation "Main navigation" once; assert URL, exactly one `a[aria-current="page"]` which is the clicked link, and `main h1` equals the link name; active-link color compared with inactive
- Expected: 36/36 correct; active link visually distinct
- Result: passed — 36/36; active rgb(67,56,202) vs inactive rgb(84,90,110)

### TC-P6-FE-005 — Empty display name validation (Playwright)
- Story: US6  AC: FR-029
- Steps: fill "Display name" `""`; click "Save settings"
- Expected: "Display name is required.", `aria-invalid=true`, input focused
- Result: passed

### TC-P6-FE-006 — 81-character display name (Playwright)
- Story: US6  AC: FR-029
- Steps: fill 81 × "a"; click Save; GET `/api/settings` before/after
- Expected: live message "…at most 80 characters (currently 81).", counter 81/80, nothing saved
- Result: passed — screenshot `phase-6-tc-fe-validation.png`

### TC-P6-FE-007 — Reset discards unsaved changes (Playwright)
- Story: US6  AC: AS2
- Steps: change name → Reset; invalid submit → Reset; select Todo Plans → Reset
- Expected: values restored (Friend / Dashboard), "Unsaved changes" gone, errors cleared, Reset disabled
- Result: passed

### TC-P6-FE-008 — Save with success toast (Playwright)
- Story: US6  AC: AS2
- Steps: fill "  QA Tester  ", click switch "In-app notifications", select HABITS → "Unsaved changes" → Save
- Expected: PUT 200 body `{QA Tester,false,false,HABITS}`, toast "Settings saved", input shows trimmed name
- Result: passed — screenshot `phase-6-tc-fe-save.png`

### TC-P6-FE-009 — Browser permission denied state (Playwright)
- Story: US6  AC: AS3
- Steps: new context, `Notification.permission` default and `requestPermission` → denied (init script); click switch "Browser notifications"
- Expected: permission requested once; `data-state=denied` with "…in-app notifications still work."; switch stays on; save succeeds
- Result: passed — screenshot `phase-6-tc-fe-permission-denied.png`

### TC-P6-FE-010 — Server validation error mapped (Playwright)
- Story: US6  AC: FR-029
- Steps: `page.route` PUT `/api/settings` → 400 problem+json `errors[{displayName}]`; fill "Srv"; Save
- Expected: field message shown, "Please fix the highlighted fields.", `aria-invalid=true`
- Result: passed — screenshot `phase-6-tc-fe-server-error.png`

### TC-P6-FE-011 — 375 px layout and console (Playwright)
- Story: US6  AC: AS1, FR-032
- Steps: `setViewportSize(375,800)`, `/settings`; collect console errors/warnings over all phase-6 UI runs
- Expected: no horizontal overflow; no console errors (except the intentionally mocked 400)
- Result: passed — screenshot `phase-6-tc-fe-375.png`

### TC-P6-FE-012 — Switch keyboard operation (Playwright)
- Story: US6  AC: AS2 / FR-034
- Steps: focus switch "Browser notifications" (on); press Space
- Expected: switch toggles off
- Result: passed

## Backend + Frontend tests

### TC-P6-E2E-001 — UI save → verify via curl
- Story: US6  AC: AS2
- Steps: TC-P6-FE-008, then `curl -s http://localhost:8080/api/settings`
- Expected: `{"displayName":"QA Tester","inAppNotifications":false,"browserNotifications":false,"defaultView":"HABITS"}`
- Result: passed

### TC-P6-E2E-002 — Reload → app opens on the chosen view
- Story: US6  AC: AS2
- Steps: `goto http://localhost:4200/`; then reload `/settings`
- Expected: redirected to `/habits` (h1 Habits); settings form shows QA Tester / in-app off / HABITS
- Result: passed — screenshot `phase-6-tc-e2e-landing-habits.png`

### TC-P6-E2E-003 — curl change → UI reflects after reload
- Story: US6  AC: AS2
- Steps: `curl -X PUT -H 'Content-Type: application/json' -d '{"displayName":"Curl User","inAppNotifications":true,"browserNotifications":true,"defaultView":"LEARNING"}' http://localhost:8080/api/settings`; `goto /`; `goto /settings`
- Expected: `/` → `/learning`; form shows Curl User / in-app on / browser on / LEARNING
- Result: passed — screenshot `phase-6-tc-e2e-curl-reflected.png`

### TC-P6-E2E-004 — Permission denied → in-app notification still works
- Story: US6  AC: AS3
- Steps: TC-P6-FE-009 saved (in-app on, browser on, permission denied); create task + in-progress plan "P6QA started plan" via API; open `/tasks`
- Expected: toast "Plan started: P6QA started plan" appears
- Result: passed — screenshot `phase-6-tc-e2e-denied-inapp-toast.png` (test data deleted)

### TC-P6-E2E-005 — In-app off → no plan-start toast
- Story: US6  AC: AS2 (preference applied)
- Steps: PUT in-app false via API; create in-progress plan "P6QA silent plan"; open `/tasks`, wait 4 s
- Expected: no "Plan started: P6QA silent plan" toast
- Result: passed (test data deleted)

### TC-P6-E2E-006 — Defaults restored → landing on Dashboard
- Story: US6  AC: AS2
- Steps: PUT `{Friend,true,false,DASHBOARD}`; `goto /`
- Expected: `/dashboard`; `GET /api/settings` = defaults
- Result: passed
