# Phase 3 — Testing (User Story 2 - Track recurring habits)

Mode: test · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-3-habits.md` (from `/speckit-checklist`, 24 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T047 [TEST] [P] [US2] Backend unit tests `habit/HabitStatsCalculatorTest.java` (daily/weekly streaks across gaps, week boundaries Mon–Sun, current period not yet done, rate window shorter than 30 days/12 weeks for new habits) and `habit/HabitServiceTest.java` (duplicate → 409, future date → 400, uncomplete missing → 404, deactivate keeps history)
- [x] T048 [TEST] [P] [US2] Backend tests `habit/HabitControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean HabitService`: request-DTO validation 400 problem+json for blank / 151-char name, 2,001-char description, missing or invalid frequency; 409 and 404 mapped from the service) and `habit/HabitCompletionRepositoryTest.java` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`: unique (habit, date) enforced)
- [x] T049 [TEST] [P] [US2] Frontend unit tests `features/habits/habits.store.spec.ts`, `habit-card.component.spec.ts`
- [x] T050 [TEST] [US2] curl tests for all 10 habit operations; Playwright MCP tests of the Habits page; e2e: create habit in UI → verify via curl; complete habit in UI → `completedToday=true` via curl and second completion via curl → 409; complete via curl → UI card shows done

## Backend tests

### TC-P3-BE-001 — Unit: `HabitStatsCalculatorTest` (T047)
- Story: US2  AC: AS2 / AS5, FR-011 (streak ending at current or previous period, rate over 30 days / 12 weeks from creation if younger), Edge case "Weekly = any completion in the ISO week Mon–Sun"
- Steps: `cd backend && ./mvnw -q verify`. TODAY = Wed 2026-06-17. 20 tests: daily streak with gap, from yesterday when today not done, zero; 30-day rate (50 %, 100 %), window from creation (25 %, 33 %, 67 %, 100 %, 0 %); future/duplicate/null dates ignored; weekStart Monday incl. year end; weekly done Monday not today; Sunday belongs to previous week; weekly streak with a gap; several completions in one week count once; 12-week rate; creation-week window; streak across year end.
- Expected: all pass
- Result: passed

### TC-P3-BE-002 — Unit: `HabitServiceTest` (T047)
- Story: US2  AC: AS1 (trim, active default, zero stats), AS2 (complete defaults to today), AS3 (duplicate → `ConflictException`, unique-constraint race → 409), AS4 (uncomplete, missing → 404), AS5 (stats follow the clock), AS6 (deactivate keeps history, activate, delete cascades completions only of that habit)
- Steps: `./mvnw -q verify`. `@DataJpaTest` + `replace = NONE` + `HabitService` + `MutableClock` at 2026-06-17T10:00Z; `@MockitoSpyBean HabitCompletionRepository` to simulate the race. 16 tests (future date → `BadRequestException` field `date`; 404 for every operation on an unknown id; list newest first with active filter).
- Expected: all pass
- Result: passed

### TC-P3-BE-003 — Unit: `HabitControllerTest` (T048)
- Story: US2  AC: AS1 (400 for empty / blank / missing / 151-char name, 2,001-char description, missing / invalid frequency, malformed JSON; 150/2,000 accepted), AS2–AS4 (201 complete with and without body, 409 / 400 / 404 mapped from the service, uncomplete 200/404/400), AS6 (activate/deactivate 200/404, delete 204/404 incl. `Accept: application/problem+json`)
- Steps: `./mvnw -q verify`. `@WebMvcTest(HabitController)`, `MockMvcTester`, `@MockitoBean HabitService`. 23 tests.
- Expected: all pass; every error is `application/problem+json` with `status` and `errors[].field` on 400
- Result: passed

### TC-P3-BE-004 — Unit: `HabitCompletionRepositoryTest` (T048)
- Story: US2  AC: AS3 / FR-009 (unique habit + date), repository queries used by the service
- Steps: `./mvnw -q verify`. `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`. 5 tests: duplicate (habit, date) → `DataIntegrityViolationException`; same date for another habit allowed; exists / find desc / between / in / delete-by-date / delete-by-habit; habit list newest first + active filter; active default true.
- Expected: all pass
- Result: passed

### TC-P3-BE-005 — createHabit success and boundaries
- Story: US2  AC: AS1
- Steps: curl BE-001…BE-003 (see report): padded name DAILY with description; WEEKLY without description; 150-char name + 2,000-char description
- Expected: 201, name trimmed, `active=true`, `completedToday=false`, streak 0, rate 0, `lastCompletedDate=null`
- Result: passed

### TC-P3-BE-006 — createHabit validation errors
- Story: US2  AC: AS1 (name required, max 150), FR-007
- Steps: curl BE-004…BE-011: name "", "   ", missing, 151 chars; description 2,001; frequency missing / MONTHLY; body `{bad`
- Expected: 400 `application/problem+json`, `errors[]` naming the field
- Result: passed

### TC-P3-BE-007 — getHabit
- Story: US2  AC: AS5 (stats in response), 404 / 400 format
- Steps: curl BE-012…BE-014
- Expected: 200; 404 "Habit 999999 not found"; 400 field `id`
- Result: passed

### TC-P3-BE-008 — listHabits
- Story: US2  AC: AS1, AS6
- Steps: curl BE-015…BE-016 (default list order; `active=bogus`)
- Expected: newest first; 400 field `active`
- Result: passed

### TC-P3-BE-009 — updateHabit
- Story: US2  AC: AS1, FR-008
- Steps: curl BE-017…BE-021
- Expected: 200 trimmed name, description cleared; 400 empty/151 name, bad frequency; 404 unknown
- Result: passed

### TC-P3-BE-010 — completeHabit
- Story: US2  AC: AS2, AS3, Edge case "toggled twice quickly"
- Steps: curl BE-022…BE-030: no body; duplicate (no body, explicit date, `{}`); yesterday; tomorrow; invalid date; unknown habit; 6 parallel POSTs on a new habit
- Expected: 201 with `completedToday=true`, streak 1, rate 100, `lastCompletedDate=today`; 409 problem "Habit is already completed on <today>"; 201 yesterday (streak 2); 400 field `date` for future/invalid; 404; parallel → one 201, five 409, one row
- Result: passed

### TC-P3-BE-011 — listHabitCompletions
- Story: US2  AC: AS6 (history), FR-009
- Steps: curl BE-031…BE-032
- Expected: newest first `today,yesterday`, `habitId` set; 404 unknown
- Result: passed

### TC-P3-BE-012 — uncompleteHabit
- Story: US2  AC: AS4
- Steps: curl BE-033…BE-037 (incl. the generated client's Accept header)
- Expected: 200 `completedToday=false`, streak from yesterday, `lastCompletedDate=yesterday`; 404 missing completion / unknown habit; 400 field `date`
- Result: passed

### TC-P3-BE-013 — Weekly current period
- Story: US2  AC: AS2, AS4, AS5, Edge case Weekly ISO week
- Steps: curl BE-038…BE-039: complete the weekly habit on this week's Monday, then delete that completion
- Expected: `completedToday=false`, `doneForCurrentPeriod=true`, streak 1, rate 100; after undo `doneForCurrentPeriod=false`, streak 0
- Result: passed

### TC-P3-BE-014 — deactivateHabit / activateHabit
- Story: US2  AC: AS6
- Steps: curl BE-040…BE-047
- Expected: `active=false` with stats kept; excluded from `active=true`, in `active=false`; completions kept; activate → `active=true`; 404 unknown; 400 bad id
- Result: passed

### TC-P3-BE-015 — deleteHabit
- Story: US2  AC: AS6
- Steps: curl BE-048…BE-053 (`Accept: application/problem+json`, as the generated `deleteHabit` sends)
- Expected: 204; then 404 for the habit and its completions; 404 on second delete; 400 bad id; test data cleaned up
- Result: passed

## Frontend tests

### TC-P3-FE-001 — Unit: `habits.store.spec.ts` (T049)
- Story: US2  AC: AS1–AS6
- Steps: `cd frontend && npx ng test --watch=false --coverage`. 17 tests: `withCompletedToday` / `withoutCompletion` helpers; load + active/inactive/doneCount; stale response ignored; load error; create/update (field errors on 400, 404); toggle off → `completeHabit(id, {})` optimistic then server result; toggle on → `uncompleteHabit(id, lastCompletedDate)`; weekly undo date; 409 → "Already done" info toast, stays done, reload; 500 rollback + error toast; 404 rollback + reload; pending guard; deactivate/activate sections; remove + rollback at old index; RefreshService bump.
- Expected: all pass
- Result: passed

### TC-P3-FE-002 — Unit: `habit-card.component.spec.ts` (T049)
- Story: US2  AC: AS1 (frequency chip), AS2/AS3 (toggle `aria-pressed`, "Already done today — click to undo"), AS4 (toggle emits, weekly "Done this week" + Undo emits `undoPeriod`), AS5 (streak unit day/days/week/weeks, rate ring and window, clamp 0–100, flame bump only on growth), AS6 (edit/deactivate/remove/reactivate outputs, inactive card disabled), busy state
- Steps: `npx ng test --watch=false --coverage`. 9 tests.
- Expected: all pass
- Result: passed

### TC-P3-FE-003 — Empty state
- Story: US2  AC: AS7
- Steps: `browser_navigate` http://localhost:4200/habits with no habits; `browser_snapshot` main
- Expected: "No habits yet" heading, guidance text and an "Add Habit" action; header "Add Habit" button
- Result: passed (screenshot `p3-fe-001-empty.png`)

### TC-P3-FE-004 — Client validation in the form
- Story: US2  AC: AS1 (name required, max 150), FR-007 (description ≤ 2,000)
- Steps: `browser_click` "Add Habit" → `browser_click` "Add habit" (empty); `browser_evaluate` set name 151 chars and description 2,001 chars; submit
- Expected: "Name is required." with `aria-invalid=true`; "Name must be at most 150 characters (currently 151)." and "Description must be at most 2,000 characters (currently 2,001)."; no POST sent
- Result: passed (screenshot `p3-fe-002-validation.png`; network shows only GET /api/habits)

### TC-P3-FE-005 — Create Daily and Weekly habits
- Story: US2  AC: AS1
- Steps: `browser_fill_form` Name "QA3 Drink water", Description "Eight glasses a day" → submit; "Add Habit" → `browser_type` a 132-char name → `browser_click` "Weekly" segment → submit
- Expected: dialog closes; cards with Daily / Weekly chips, "Not done today yet" / "Not done this week yet", streak 0, 0 %; long name truncated with full text in `title`; summary "0 of 2 done for this period"
- Result: passed (screenshot `p3-fe-003-created.png`)

### TC-P3-FE-006 — Complete today and undo with the toggle
- Story: US2  AC: AS2, AS4, AS5
- Steps: `browser_click` `button[aria-label="Mark done for today: QA3 Drink water"]`; `browser_evaluate` card state; `browser_click` "Undo today's completion: …"; `browser_network_requests` filter `/completions`
- Expected: `aria-pressed=true`, "Done today", "Current streak: 1 day", 100 %, "Last done Oct 3, 2026", summary "1 of 2"; undo sends `DELETE …/completions/2026-10-03` → 200
- Result: passed (screenshot `p3-e2e-002-ui-complete.png`)

### TC-P3-FE-007 — Duplicate completion shows "already done"
- Story: US2  AC: AS3
- Steps: curl `POST /api/habits/18/completions` behind the UI (201); `browser_click` the stale toggle; `browser_evaluate` toasts
- Expected: server 409; info toast "Already done — Habit is already completed on 2026-10-03"; card stays "Done today"; API still has 1 completion
- Result: passed (screenshot `p3-fe-005-already-done.png`)

### TC-P3-FE-008 — Weekly "Done this week" undo
- Story: US2  AC: AS4, AS5
- Steps: curl complete weekly habit on Monday 2026-09-28; reload; `browser_click` `button[aria-label^="Undo this week's completion"]`
- Expected: card shows "Done this week" + Undo, toggle off, "1 week", 100 % over the last 12 weeks; Undo sends exactly `DELETE /api/habits/19/completions/2026-09-28` and the card shows "Not done this week yet", 0 weeks
- Result: passed

### TC-P3-FE-009 — Edit habit
- Story: US2  AC: AS1, FR-008
- Steps: `browser_click` "Edit habit: QA3 Drink water"; `browser_evaluate` pre-fill; `browser_fill_form` name "QA3 Drink more water"; `browser_press_key` Enter
- Expected: "Edit habit" dialog pre-filled (name, description, Daily) with focus on Name; card renamed; focus returns to the Edit button
- Result: passed

### TC-P3-FE-010 — Dialog keyboard use
- Story: US2  AC: AS1
- Steps: `browser_click` "Add Habit"; `browser_press_key` Escape
- Expected: dialog closes, focus back on "Add Habit"
- Result: passed

### TC-P3-FE-011 — Deactivate / reactivate
- Story: US2  AC: AS6
- Steps: `browser_click` "Deactivate habit: QA3 Drink more water"; `browser_evaluate`; `browser_click` "Reactivate habit: …"
- Expected: "Inactive habits" section with "1 paused · history kept", Inactive chip, disabled toggle, "Paused — reactivate to track", active summary "0 of 1"; reactivate removes the section and summary is "1 of 2"
- Result: passed (screenshot `p3-fe-009-inactive.png`)

### TC-P3-FE-012 — Remove with confirmation, then empty state
- Story: US2  AC: AS6, AS7, FR-031
- Steps: `browser_click` "Remove habit: …" → snapshot confirm → Cancel; again → Remove; same for the Weekly habit; `browser_wait_for` "No habits yet"
- Expected: "Remove habit?" with "…To keep the history, deactivate it instead."; Cancel keeps it (GET 200); Remove sends DELETE 204; after both, the empty state is back
- Result: passed (screenshot `p3-fe-010-remove-confirm.png`)

### TC-P3-FE-013 — Quick-add link
- Story: US2  AC: AS1 (dashboard quick-add target)
- Steps: `browser_navigate` http://localhost:4200/habits?new=1
- Expected: create dialog open, focus on Name, `?new=1` removed from the URL
- Result: passed

### TC-P3-FE-014 — Narrow layout
- Story: US2  AC: AS1, AS5 (cards readable)
- Steps: `browser_resize` 375×800; `browser_evaluate` scroll width
- Expected: no horizontal overflow (scrollWidth 375), card full width (343 px with 16 px gutter)
- Result: passed (screenshot `p3-fe-012-narrow.png`)

### TC-P3-FE-015 — No console errors
- Story: US2  AC: AS1–AS7
- Steps: `browser_console_messages` level warning over the whole run
- Expected: no app errors; only the deliberate 409 of TC-P3-FE-007
- Result: passed

## Backend + Frontend tests

### TC-P3-E2E-001 — Create in UI → verify via curl
- Story: US2  AC: AS1
- Steps: TC-P3-FE-005 create "QA3 Drink water"; `curl -s http://localhost:8080/api/habits | jq`
- Expected: habit with name, description "Eight glasses a day", DAILY, active, not completed
- Result: passed (id 18)

### TC-P3-E2E-002 — Complete in UI → `completedToday=true` via curl; second completion via curl → 409
- Story: US2  AC: AS2, AS3
- Steps: TC-P3-FE-006 click toggle; `curl -s $B/18`; `curl -s -X POST $B/18/completions`; `curl -s $B/18/completions | jq length`
- Expected: `completedToday=true`, `doneForCurrentPeriod=true`, streak 1, rate 100, `lastCompletedDate=2026-10-03`; 409 problem "Habit is already completed on 2026-10-03"; 1 completion
- Result: passed

### TC-P3-E2E-003 — Complete via curl → UI card shows done
- Story: US2  AC: AS2, AS5
- Steps: `curl -X POST $B/18/completions` (daily, today) and `curl -X POST $B/19/completions -d '{"date":"2026-09-28"}'` (weekly, Monday); `browser_navigate` /habits; `browser_evaluate`
- Expected: daily card `aria-pressed=true` "Done today" 1 day 100 %; weekly card "Done this week" + Undo, 1 week, 100 % over 12 weeks; summary "2 of 2 done for this period"
- Result: passed (screenshot `p3-e2e-003-curl-in-ui.png`)

### TC-P3-E2E-004 — Undo in UI → verify via curl
- Story: US2  AC: AS4
- Steps: TC-P3-FE-006 undo click; `curl $B/18/completions | jq length`; `curl $B/18`
- Expected: 0 completions, `completedToday=false`, streak 0
- Result: passed

### TC-P3-E2E-005 — Deactivate in UI → curl shows inactive, history kept
- Story: US2  AC: AS6
- Steps: TC-P3-FE-011; `curl $B/18`; `curl "$B?active=true"`; `curl $B/18/completions`
- Expected: `active=false`; excluded from `active=true` ([19]); 1 completion kept
- Result: passed

### TC-P3-E2E-006 — Edit in UI → verify via curl; weekly toggle records today
- Story: US2  AC: AS1, AS2
- Steps: TC-P3-FE-009; `curl $B/18`; then `browser_click` "Mark done for today: QA3 Weekly…"; `curl $B/19`
- Expected: name "QA3 Drink more water", description and DAILY unchanged; weekly `completedToday=true`, `lastCompletedDate=2026-10-03`
- Result: passed

### TC-P3-E2E-007 — Remove in UI → gone via curl with its completions
- Story: US2  AC: AS6
- Steps: TC-P3-FE-012 confirm; `curl $B/18` and `curl $B/18/completions`; `curl $B`
- Expected: 404 and 404; final list `[]`
- Result: passed
