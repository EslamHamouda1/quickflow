# Phase 3 — Test report (User Story 2 - Track recurring habits)

Mode: test · Trial: 0 · Started 2026-10-03T19:51:56+03:00 · Ended 2026-10-03T20:05:18+03:00
Phase file: `loops/loop-3-testing/outputs/phase-3-testing.md` · Checklist: `specs/001-quickflow-productivity/checklists/phase-3-habits.md`
**Result: passed**, 37/37 · Tasks ticked: T047, T048, T049, T050 · Bugs: none

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 15 | 15 | 0 | 0 |
| Frontend tests | 15 | 15 | 0 | 0 |
| Backend + Frontend tests | 7 | 7 | 0 | 0 |
| **All** | **37** | **37** | **0** | **0** |

Smoke (`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200`): both OK (200).
Live swagger: all 10 Habits operations present (`listHabits`, `createHabit`, `getHabit`, `updateHabit`, `deleteHabit`, `deactivateHabit`, `activateHabit`, `listHabitCompletions`, `completeHabit` 201/400/404/409, `uncompleteHabit`).

## Bugs

None.

## Coverage

| Area | Tests | Line % | Branch % | Report |
|---|---|---|---|---|
| Backend (JaCoCo, whole app) | 114 (new: HabitStatsCalculatorTest 20, HabitServiceTest 16, HabitControllerTest 23, HabitCompletionRepositoryTest 5) | 98.0 (386/394) | 92.4 (109/118) | `outputs/coverage/phase-3/backend/index.html` |
| Backend `com.quickflow.habit*` | — | 98.2 (163/166) | 95.5 (42/44) | same |
| Frontend (vitest v8, whole app) | 88 in 8 files (26 new) | 57.68 (stmts 60.26) | 47.45 | `outputs/coverage/phase-3/frontend/quickflow/index.html` |
| Frontend `habits.store.ts` | 17 | 99.03 (stmts 99.19) | 93.88 | same |
| Frontend `habit-card.component.ts` | 9 | 100 | 100 | same |

The overall frontend line % went down from phase 2 (61.61). The reasons are the new generated `api/api/habits.service.ts` (about 11 % covered, since the specs mock it) and `habits-page` / `habit-form-dialog`, which T049 does not cover with unit specs. Playwright cases TC-P3-FE-003…015 cover those components instead.

## Test code added

- `backend/src/test/java/com/quickflow/habit/HabitStatsCalculatorTest.java`, `HabitServiceTest.java`, `MutableClock.java` (T047)
- `backend/src/test/java/com/quickflow/habit/HabitControllerTest.java`, `HabitCompletionRepositoryTest.java` (T048)
- `frontend/src/app/features/habits/habits.store.spec.ts`, `habit-card.component.spec.ts` (T049)
- `loops/loop-3-testing/outputs/curl/phase-3-curl.sh` (T050 curl script; output in `phase-3-curl.out`)

Commands: `cd backend && ./mvnw -q verify` (exit 0, 114 tests, 0 failures) · `cd frontend && npx ng test --watch=false --coverage` (88/88 passed).
Two test-side corrections were needed during the run, and neither was an app defect. First, the 409 store spec's reload mock returned the stale list; it now returns the server state. Second, the curl script expected 2 completions in BE-043 after BE-037 had already removed one.

## curl commands

`$B=http://localhost:8080/api/habits`. Each request is `curl -s -o <file> -w '%{http_code} %{content_type}' -X <M> [-H 'Accept: <a>'] [-H 'Content-Type: application/json' --data <body>] <url>`. `Y` / `T` / `TM` are yesterday, today and tomorrow (2026-10-02, 2026-10-03, 2026-10-04), and `MON` is this ISO week's Monday (2026-09-28). `$TAG` is a random prefix (`p3qa…`). Validation rows also check `Content-Type: application/problem+json` and that `errors[].field` contains the named field. Full output is in `outputs/curl/phase-3-curl.out`: 53/53 PASS.

| # | Command | Expected | Actual |
|---|---|---|---|
| BE-001 | `POST $B {"name":"  $TAG water  ","description":"8 glasses","frequency":"DAILY"}` | 201, trimmed, active, stats 0/null | 201 ✓ |
| BE-002 | `POST $B {"name":"$TAG run","frequency":"WEEKLY"}` | 201, description null | 201 ✓ |
| BE-003 | `POST $B {"name":<150×a>,"description":<2000×d>,"frequency":"DAILY"}` | 201 | 201 ✓ |
| BE-004 | `POST $B {"name":"","frequency":"DAILY"}` | 400 name | 400 ✓ ("Name is required; Name must be 1-150 characters") |
| BE-005 | `POST $B {"name":"   ","frequency":"DAILY"}` | 400 name | 400 ✓ |
| BE-006 | `POST $B {"frequency":"DAILY"}` | 400 name | 400 ✓ |
| BE-007 | `POST $B {"name":<151×a>,"frequency":"DAILY"}` | 400 name | 400 ✓ |
| BE-008 | `POST $B {"name":"x","description":<2001×d>,"frequency":"DAILY"}` | 400 description | 400 ✓ |
| BE-009 | `POST $B {"name":"x"}` | 400 frequency | 400 ✓ ("Frequency is required") |
| BE-010 | `POST $B {"name":"x","frequency":"MONTHLY"}` | 400 frequency | 400 ✓ |
| BE-011 | `POST $B {bad` | 400 problem+json | 400 ✓ |
| BE-012 | `GET $B/{D}` | 200 | 200 ✓ |
| BE-013 | `GET $B/999999` | 404 "Habit 999999 not found" | 404 ✓ |
| BE-014 | `GET $B/abc` | 400 id | 400 ✓ |
| BE-015 | `GET $B` | 200 newest first | 200 ✓ (12,11,10) |
| BE-016 | `GET $B?active=bogus` | 400 active | 400 ✓ |
| BE-017 | `PUT $B/{D} {"name":" $TAG water2 ","description":null,"frequency":"DAILY"}` | 200 trimmed, desc null | 200 ✓ |
| BE-018 | `PUT $B/{D} {"name":"","frequency":"DAILY"}` | 400 name | 400 ✓ |
| BE-019 | `PUT $B/{D} {"name":<151>,"frequency":"DAILY"}` | 400 name | 400 ✓ |
| BE-020 | `PUT $B/{D} {"name":"x","frequency":"YEARLY"}` | 400 frequency | 400 ✓ |
| BE-021 | `PUT $B/999999 {"name":"x","frequency":"DAILY"}` | 404 | 404 ✓ |
| BE-022 | `POST $B/{D}/completions` (no body) | 201 completedToday, streak 1, rate 100, last=T | 201 ✓ |
| BE-023 | `POST $B/{D}/completions` again | 409 "Habit is already completed on T" | 409 ✓ |
| BE-024 | `POST $B/{D}/completions {"date":"T"}` | 409 | 409 ✓ |
| BE-025 | `POST $B/{D}/completions {}` | 409 | 409 ✓ |
| BE-026 | `POST $B/{D}/completions {"date":"Y"}` | 201 streak 2 | 201 ✓ |
| BE-027 | `POST $B/{D}/completions {"date":"TM"}` | 400 date | 400 ✓ ("Completion date must not be in the future") |
| BE-028 | `POST $B/{D}/completions {"date":"2026-13-40"}` | 400 date | 400 ✓ |
| BE-029 | `POST $B/999999/completions` | 404 | 404 ✓ |
| BE-030 | 6 × `POST $B/{R}/completions` in parallel | 1×201, 5×409, 1 row | 1×201/5×409/1 row ✓ |
| BE-031 | `GET $B/{D}/completions` | 200 `T,Y` | 200 ✓ |
| BE-032 | `GET $B/999999/completions` | 404 | 404 ✓ |
| BE-033 | `DELETE $B/{D}/completions/T` | 200 completedToday false, streak 1, last=Y | 200 ✓ |
| BE-034 | `DELETE $B/{D}/completions/T` again | 404 "Habit {D} has no completion on T" | 404 ✓ |
| BE-035 | `DELETE $B/{D}/completions/notadate` | 400 date | 400 ✓ |
| BE-036 | `DELETE $B/999999/completions/T` | 404 | 404 ✓ |
| BE-037 | `DELETE $B/{D}/completions/Y` with `Accept: application/json, application/problem+json` | 200 | 200 ✓ |
| BE-038 | `POST $B/{W}/completions {"date":"MON"}` | 201 completedToday false, doneForCurrentPeriod true, streak 1, rate 100 | 201 ✓ |
| BE-039 | `DELETE $B/{W}/completions/MON` | 200 doneForCurrentPeriod false | 200 ✓ |
| BE-040 | `POST $B/{D}/deactivate` (after completing today) | 200 active false, stats kept | 200 ✓ |
| BE-041 | `GET $B?active=true` | excludes D | 200 ✓ |
| BE-042 | `GET $B?active=false` | includes D, all inactive | 200 ✓ |
| BE-043 | `GET $B/{D}/completions` | 1 completion (T) kept | 200 ✓ |
| BE-044 | `POST $B/{D}/activate` | 200 active true | 200 ✓ |
| BE-045 | `POST $B/999999/deactivate` | 404 | 404 ✓ |
| BE-046 | `POST $B/999999/activate` | 404 | 404 ✓ |
| BE-047 | `POST $B/abc/activate` | 400 id | 400 ✓ |
| BE-048 | `DELETE $B/{D}` with `Accept: application/problem+json` | 204 | 204 ✓ |
| BE-049 | `GET $B/{D}` | 404 | 404 ✓ |
| BE-050 | `GET $B/{D}/completions` | 404 | 404 ✓ |
| BE-051 | `DELETE $B/{D}` again | 404 | 404 ✓ |
| BE-052 | `DELETE $B/abc` | 400 id | 400 ✓ |
| BE-053 | cleanup `DELETE` W, L, R; `GET $B` | no `$TAG` habits | 200 ✓ |

E2E curl (habit ids 18 Daily / 19 Weekly created in the UI):
- `curl -s $B | jq -c '.[]|{id,name,description,frequency,active,completedToday}'` returned id 18 "QA3 Drink water", "Eight glasses a day", DAILY, active, not completed.
- `curl -s $B/18 | jq -c '{completedToday,doneForCurrentPeriod,currentStreak,completionRate,lastCompletedDate}'` after the UI toggle returned true, true, 1, 100, 2026-10-03.
- `curl -s -X POST $B/18/completions` returned 409 `{"detail":"Habit is already completed on 2026-10-03",…}`, and `curl -s $B/18/completions | jq length` returned 1.
- After the UI undo, `curl -s $B/18/completions | jq length` returned 0.
- `curl -s -X POST $B/18/completions` returned 201. `curl -s -X POST -H 'Content-Type: application/json' --data '{"date":"2026-09-28"}' $B/19/completions` returned 201 with doneForCurrentPeriod true and completedToday false.
- `curl -s $B/18 | jq .name` after the UI edit returned "QA3 Drink more water".
- `curl -s $B/18 | jq .active` returned false. `curl -s "$B?active=true" | jq 'map(.id)'` returned [19]. `curl -s $B/18/completions | jq length` returned 1.
- After the UI weekly toggle, `curl -s $B/19` returned completedToday true and lastCompletedDate 2026-10-03.
- After the UI removal, `curl $B/18` returned 404, `curl $B/18/completions` returned 404, and `curl $B` returned [].

## Playwright steps (Playwright MCP, headless chromium, 1280×800)

| Case | Steps (tool → target → value) | Screenshot |
|---|---|---|
| FE-003 | navigate `http://localhost:4200/habits` → snapshot `main` | `p3-fe-001-empty.png` |
| FE-004 | click header "Add Habit" → click "Add habit" (empty) → evaluate set `#habit-name` = 151×a, textarea = 2001×d → click "Add habit" → network_requests `/api/habits` (only GET) | `p3-fe-002-validation.png` |
| FE-005 | fill_form Name "QA3 Drink water", Description "Eight glasses a day" → click "Add habit"; click "Add Habit" → type Name (132 chars) → click "Weekly" → click "Add habit" → evaluate cards | `p3-fe-003-created.png` |
| FE-006 | click `button[aria-label="Mark done for today: QA3 Drink water"]` → evaluate → click `button[aria-label="Undo today's completion: QA3 Drink water"]` → network_requests `/completions` (POST 201, DELETE …/2026-10-03 200) | `p3-e2e-002-ui-complete.png` |
| FE-007 | curl complete → click stale "Mark done for today: QA3 Drink water" → evaluate toasts ("Already done Habit is already completed on 2026-10-03") | `p3-fe-005-already-done.png` |
| FE-008 / E2E-003 | curl complete daily + weekly Monday → navigate `/habits` → evaluate cards → click `button[aria-label^="Undo this week's completion"]` → network_requests (DELETE /api/habits/19/completions/2026-09-28 200) | `p3-e2e-003-curl-in-ui.png` |
| FE-009 | click "Edit habit: QA3 Drink water" → evaluate (pre-filled, focus `habit-name`) → fill_form `#habit-name` "QA3 Drink more water" → press Enter | — |
| FE-010 | click header "Add Habit" → press Escape → evaluate (closed, focus "Add Habit") | — |
| FE-011 | click "Deactivate habit: QA3 Drink more water" → evaluate → click "Reactivate habit: QA3 Drink more water" → evaluate | `p3-fe-009-inactive.png` |
| FE-012 | click "Remove habit: QA3 Drink more water" → snapshot confirm → click Cancel → click Remove again → click confirm "Remove"; same for Weekly → wait_for "No habits yet" | `p3-fe-010-remove-confirm.png` |
| E2E-006 | click `button[aria-label^="Mark done for today: QA3 Weekly"]` → curl | — |
| FE-013 | navigate `/habits?new=1` → evaluate (dialog open, focus `habit-name`, URL `/habits`) → press Escape | — |
| FE-014 | resize 375×800 → evaluate (scrollWidth 375, card 343 px) → resize 1280×800 | `p3-fe-012-narrow.png` |
| FE-015 | console_messages level warning: only the deliberate 409 on `/api/habits/18/completions` in this run | — |

Screenshots are in `loops/loop-3-testing/outputs/screenshots/`.

## Observations (not bugs)

- A completion may be recorded for a past date before the habit's creation date. The spec does not forbid this (checklist CHK003). Such a completion counts toward the streak but not the rate window.
- An inactive habit can still be completed through the API. The UI disables the toggle. The spec is silent on this (checklist CHK004).
