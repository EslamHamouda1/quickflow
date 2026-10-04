# Phase 7 — Backend (User Story 5 - See everything on a dashboard)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T092 [BE] [P] [US5] Create DTOs `dashboard/dto/DashboardResponse.java` (`@Schema(name = "Dashboard")`), `DashboardTasks.java`, `DashboardHabits.java`, `DashboardPlans.java`, `DashboardLearning.java` per contract (nested lists reuse the `Task`, `Habit`, `Plan` response DTOs); mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on all Dashboard DTOs
- [x] T093 [BE] [US5] Create `dashboard/DashboardService.java` (Clock; reuses TaskService/HabitStatsCalculator/PlanStatusCalculator/repositories — no duplicated rules): greetingName from Settings, today; tasks dueToday (non-archived, dueDate = today, not DONE), overdue (non-archived, overdue rule), completedTodayCount (non-archived, completedAt today), totalActive (non-archived), doneCount (non-archived, DONE), completionPercent = round(done × 100 / totalActive), 0 when none; habits today = active habits with stats, activeCount, completedTodayCount; plans inProgress (priority, start order), upcomingCount, completedCount; learning cardsTotal, inProgressCount, milestonesTotal, milestonesDone, milestonesCompletedLast7Days
- [x] T094 [BE] [US5] Create `dashboard/DashboardController.java` (`GET /api/dashboard`, springdoc annotations); regenerate swagger, verify the full swagger now matches all 37 contract operations (paths, operationIds, status codes, schema names, schema properties and required lists), restart backend, curl-verify

## Endpoints

| Method | Path | operationId | Success | Errors |
|---|---|---|---|---|
| GET | `/api/dashboard` | getDashboard | 200 `Dashboard` | — (contract defines none; other methods → 405) |

`Dashboard` = `greetingName` (Settings displayName), `today` (Clock date), `tasks` (`DashboardTasks`: `dueToday[]`/`overdue[]` of `Task`, `completedTodayCount`, `totalActive`, `doneCount`, `completionPercent`), `habits` (`DashboardHabits`: `today[]` of `Habit` = active habits with stats, `activeCount`, `completedTodayCount` = active habits with `completedToday`), `plans` (`DashboardPlans`: `inProgress[]` of `Plan` in priority/start order, `upcomingCount` = NOT_STARTED, `completedCount` = COMPLETED), `learning` (`DashboardLearning`: `cardsTotal`, `inProgressCount`, `milestonesTotal`, `milestonesDone`, `milestonesCompletedLast7Days` = done milestones with completedAt ≥ now − 7 days).

## curl checks

| # | Command | Expected | Actual |
|---|---|---|---|
| 1 | `curl -s -w '%{http_code}' http://localhost:8080/api/dashboard` | 200 `application/json`, all required fields | 200 `application/json` |
| 2 | Seed: task due today, task due yesterday, task due today then archived (`POST /api/tasks`, `POST /api/tasks/{id}/archive`), daily habit + completion (`POST /api/habits`, `POST /api/habits/{id}/completions`) → `GET /api/dashboard` | dueToday = [due-today task] (archived excluded), overdue +1, totalActive +2, completionPercent = round(done×100/total), habits activeCount/completedTodayCount +1 | dueToday ["P7 due today"]; overdue 2 (1 before); totalActive 3→5; done 2; 40 %; habits 3/3 |
| 3 | `POST /api/tasks/{id}/complete` on the due-today task → `GET /api/dashboard` | dueToday empty, completedTodayCount +1, doneCount +1, percent 60 | dueToday []; 3; 3; 60 |
| 4 | Compare with list endpoints: `/api/tasks`, `/api/habits?active=true`, `/api/plans`, `/api/learning-cards` | identical counts | tasks 5/3 done/2 overdue; habits 3/3; plans IN_PROGRESS 3, NOT_STARTED 2 = inProgress 3, upcoming 2, completed 0; matches |
| 5 | Plans order in `inProgress` | priorityOrder asc, then startDateTime asc | (1, 17:53), (1, 17:57), (2, 17:51) ✓ |
| 6 | Learning: create card, add 2 milestones, `PUT .../milestones/{id}` done=true → `GET /api/dashboard` | cardsTotal +1, inProgressCount 1, milestonesTotal 2, milestonesDone 1, last7Days 1 | {3,1,2,1,1} = list-derived {cards 3, inProgress 1, ms 2, done 1} |
| 7 | `curl -s -XPOST http://localhost:8080/api/dashboard` | 405 | 405 |
| 8 | `curl -s http://localhost:8080/api/dashboard/x` | 404 problem+json | 404 |
| 9 | `curl -H 'Origin: http://localhost:4200' http://localhost:8080/api/dashboard` | CORS allow-origin header | `Access-Control-Allow-Origin: http://localhost:4200` |
| 10 | Cleanup: `DELETE` seeded tasks/habit/card | 204 each; dashboard back to baseline | 204 ×5; totalActive 3, done 2, 67 % |

## Notes

- `DashboardService` reuses `TaskService.list` (non-archived, overdue flag from `TaskService.isOverdue`), `HabitService.list(true)` (HabitStatsCalculator), `PlanService.list(null)` (PlanStatusCalculator, repository order), `LearningCardRepository.count/countByStatus`, `LearningMilestoneRepository.count/countByDoneTrue/countByDoneTrueAndCompletedAtGreaterThanEqual`; completionPercent uses `PlanStatusCalculator.progressPercent` (round, 0 when no tasks). No duplicated rules.
- Task `completedTodayCount` compares `completedAt` converted to the Clock's zone with today.
- Full swagger (`backend/openapi/openapi.json`) compared with `contracts/openapi.yaml` by script: all 37 operations match (paths, methods, operationIds, status codes), every schema present with identical property sets and `required` lists, no extra paths/schemas.
- `./mvnw -q verify` passes. Previous backend process (stale pid file) was stopped; new server running, pid in `state/backend.pid`.
