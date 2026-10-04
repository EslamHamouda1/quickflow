# Phase 3 — Backend (User Story 2 - Track recurring habits)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T036 [BE] [P] [US2] Create `habit/HabitFrequency.java` (`DAILY`, `WEEKLY`), entity `habit/Habit.java` (id, name "required, trimmed, 1–150 chars", description "≤ 2,000 chars", frequency, createdAt, active default true) and `habit/HabitCompletion.java` (id, habit FK cascade delete, completionDate `LocalDate`, createdAt; unique constraint (habit_id, completion_date))
- [x] T037 [BE] [P] [US2] Create `habit/HabitRepository.java` and `habit/HabitCompletionRepository.java` (exists by habit+date, find by habit ordered desc, delete by habit+date, find by habit in date range)
- [x] T038 [BE] [P] [US2] Create pure `habit/HabitStatsCalculator.java` (inputs: frequency, createdAt date, completion dates, today): `completedToday`, `doneForCurrentPeriod` (Daily = today, Weekly = any date in current ISO week Mon–Sun), `currentStreak` (consecutive done periods ending at current period, or previous period if current not yet done), `completionRate` 0–100 over last 30 days (Daily) / 12 weeks (Weekly) not earlier than creation, `lastCompletedDate`
- [x] T039 [BE] [P] [US2] Create DTOs `habit/dto/HabitRequest.java` (`@NotBlank @Size(max=150) name`, `@Size(max=2000) description`, `@NotNull frequency`), `HabitResponse.java` (fields + stats, `@Schema(name = "Habit")`), `HabitCompletionRequest.java` (optional date; no date-range annotation — the not-in-future rule is checked only in `HabitService` with the injected `Clock`, T040), `HabitCompletionResponse.java` (`@Schema(name = "HabitCompletion")`); mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on `HabitResponse` and `HabitCompletionResponse`; annotate every enum with `@Schema(enumAsRef = true)` so swagger uses `$ref` enums like the contract
- [x] T040 [BE] [US2] Create `habit/HabitService.java` (Clock): create, update, activate, deactivate, delete (cascade completions), complete(date default today; future date → `BadRequestException` field `date` (400); duplicate → `ConflictException` 409, also guard unique-constraint race), uncomplete(date) (404 if no record), list(active filter, newest first) with stats
- [x] T041 [BE] [US2] Create `habit/HabitController.java` implementing all 10 Habits operations of the contract (`/api/habits`, `/{id}`, `/{id}/deactivate`, `/{id}/activate`, `/{id}/completions`, `/{id}/completions/{date}`) with springdoc annotations
- [x] T042 [BE] [US2] Regenerate swagger, verify Habits paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify (201, 409 duplicate, 400, 404)

## Endpoints

| Method | Path | operationId | Success | Errors |
|---|---|---|---|---|
| GET | `/api/habits?active` | listHabits | 200 `Habit[]` (newest first, with stats) | 400 |
| POST | `/api/habits` (body `HabitRequest`) | createHabit | 201 `Habit` | 400 |
| GET | `/api/habits/{id}` | getHabit | 200 `Habit` | 400, 404 |
| PUT | `/api/habits/{id}` (body `HabitRequest`) | updateHabit | 200 `Habit` | 400, 404 |
| DELETE | `/api/habits/{id}` | deleteHabit | 204 (completions deleted too) | 400, 404 |
| POST | `/api/habits/{id}/deactivate` | deactivateHabit | 200 `Habit` | 400, 404 |
| POST | `/api/habits/{id}/activate` | activateHabit | 200 `Habit` | 400, 404 |
| GET | `/api/habits/{id}/completions` | listHabitCompletions | 200 `HabitCompletion[]` (newest first) | 400, 404 |
| POST | `/api/habits/{id}/completions` (optional body `HabitCompletionRequest`) | completeHabit | 201 `Habit` | 400 (future/invalid `date`), 404, 409 (duplicate) |
| DELETE | `/api/habits/{id}/completions/{date}` | uncompleteHabit | 200 `Habit` | 400, 404 (no completion that date) |

Errors are `application/problem+json` (`Problem` with `errors: FieldError[]` on 400).
Swagger check (`backend/openapi/openapi.json` vs `contracts/openapi.yaml`): all 10 Habits operations match on paths, methods, operationIds, status codes, path/query params, request-body required flag; schemas `HabitFrequency`, `HabitRequest`, `Habit`, `HabitCompletionRequest`, `HabitCompletion` match on properties, `$ref` enums and `required` lists. Tasks operations still match.

## curl checks

All commands are `curl -s -o /dev/stderr -w '%{http_code}' -X <method> <url>` against `http://localhost:8080/api/habits` (`$B`), JSON bodies with `Content-Type: application/json`. Run after the final restart. Dates: today / yesterday / tomorrow relative to the server clock.

| # | Check | Expected | Actual | Result | Detail |
|---|---|---|---|---|---|
| 1 | POST create DAILY (name trimmed, defaults) | 201 | 201 | PASS | id=5 |
| 2 | POST create WEEKLY | 201 | 201 | PASS | id=6 |
| 3 | POST name 150 chars | 201 | 201 | PASS | true |
| 4 | POST blank name | 400 | 400 | PASS | true |
| 5 | POST name 151 chars | 400 | 400 | PASS | true |
| 6 | POST description 2001 chars | 400 | 400 | PASS | true |
| 7 | POST missing frequency | 400 | 400 | PASS | true |
| 8 | POST invalid frequency | 400 | 400 | PASS | true |
| 9 | POST malformed JSON | 400 | 400 | PASS | true |
| 10 | 400 content-type problem+json | 400 | 400 | PASS |  |
| 11 | GET by id | 200 | 200 | PASS | true |
| 12 | GET unknown id | 404 | 404 | PASS | true |
| 13 | GET non-numeric id | 400 | 400 | PASS | true |
| 14 | GET list newest first | 200 | 200 | PASS | true |
| 15 | GET list active=bogus | 400 | 400 | PASS | true |
| 16 | PUT update | 200 | 200 | PASS | true |
| 17 | PUT blank name | 400 | 400 | PASS | true |
| 18 | PUT unknown id | 404 | 404 | PASS | true |
| 19 | POST complete (no body) = today | 201 | 201 | PASS | true |
| 20 | POST complete duplicate today | 409 | 409 | PASS | true |
| 21 | POST complete duplicate explicit date | 409 | 409 | PASS | true |
| 22 | POST complete yesterday | 201 | 201 | PASS | true |
| 23 | POST complete null date body | 409 | 409 | PASS | true |
| 24 | POST complete future date | 400 | 400 | PASS | true |
| 25 | POST complete invalid date | 400 | 400 | PASS | true |
| 26 | POST complete unknown habit | 404 | 404 | PASS | true |
| 27 | GET completions newest first | 200 | 200 | PASS | true |
| 28 | GET completions unknown habit | 404 | 404 | PASS | true |
| 29 | DELETE completion today | 200 | 200 | PASS | true |
| 30 | DELETE completion missing | 404 | 404 | PASS | true |
| 31 | DELETE completion bad date | 400 | 400 | PASS | true |
| 32 | DELETE completion unknown habit | 404 | 404 | PASS | true |
| 33 | POST weekly complete | 201 | 201 | PASS | true |
| 34 | POST deactivate | 200 | 200 | PASS | true |
| 35 | GET list active=false contains it | 200 | 200 | PASS | true |
| 36 | GET list active=true excludes it | 200 | 200 | PASS | true |
| 37 | deactivate keeps history | 200 | 200 | PASS | true |
| 38 | POST activate | 200 | 200 | PASS | true |
| 39 | POST deactivate unknown | 404 | 404 | PASS | true |
| 40 | POST activate unknown | 404 | 404 | PASS | true |
| 41 | DELETE habit (problem+json accept) | 204 | 204 | PASS |  |
| 42 | GET deleted habit | 404 | 404 | PASS | true |
| 43 | GET completions of deleted habit | 404 | 404 | PASS | true |
| 44 | DELETE unknown habit | 404 | 404 | PASS | true |
| 45 | DELETE weekly habit | 204 | 204 | PASS |  |
| 46 | DELETE 150-char habit | 204 | 204 | PASS |  |

Extra: 6 concurrent `POST $B/{id}/completions` on a new habit → one 201, five 409, exactly one completion stored; a habit created today and completed today → `completionRate` 100, `currentStreak` 1.

**Result: 46/46 pass** (+ concurrency check).

## Notes

- `HabitStatsCalculator` is pure/static: `calculate(frequency, createdDate, completionDates, today)` → `HabitStats(completedToday, doneForCurrentPeriod, currentStreak, completionRate, lastCompletedDate)`. Completion dates after today are ignored. Rate window = last 30 days (DAILY) / last 12 ISO weeks incl. the current one (WEEKLY), starting no earlier than the creation date (creation week for WEEKLY); `round(done*100/periods)`. Streak counts back from the current period if done, else from the previous period.
- Creation date for stats is `createdAt` converted to the injected `Clock` zone.
- Duplicate completion: service pre-check (`existsByHabitIdAndCompletionDate`) → 409, plus unique constraint `uk_habit_completion_habit_date` with `saveAndFlush` → `DataIntegrityViolationException` mapped to 409 (race guard).
- `HabitCompletion.habit` FK has `@OnDelete(CASCADE)`; `HabitService.delete` also bulk-deletes completions before the habit.
- `completeHabit` declares no `consumes` so a POST without a body / Content-Type works; `{"date":null}` or no body = today. Inactive habits can still be completed (not forbidden by the spec).
- `deleteHabit` produces both `application/json` and `application/problem+json` (same fix as BUG-P2-001 for tasks).
- Unit tests for this phase are [TEST] tasks T047/T048 (loop-3); `./mvnw -q verify` passes with the existing tests.
