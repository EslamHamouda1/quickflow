# Phase 5 — Backend (User Story 4 - Build and run time-boxed plans)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T066 [BE] [P] [US4] Create `plan/PlanStatus.java`, `plan/PlanItemSourceType.java` (`TASK`, `HABIT`, `LEARNING_RESOURCE`), entities `plan/Plan.java` (id, title "required, 1–200 chars", estimatedDurationMinutes "≥ 1", startDateTime, endDateTime "> startDateTime", priorityOrder "≥ 1 (1 = highest); ties allowed", createdAt, startNotifiedAt `OffsetDateTime?`; items `@OneToMany` cascade ALL) and `plan/PlanItem.java` (id, plan FK, sourceType, sourceId (no FK), sourceTitle snapshot, done default false; unique (plan_id, source_type, source_id))
- [x] T067 [BE] [P] [US4] Create `plan/PlanRepository.java` (fetch items; order by priorityOrder asc, startDateTime asc)
- [x] T068 [BE] [P] [US4] Create pure `plan/PlanStatusCalculator.java` (inputs start, end, items, now): status = COMPLETED if all items done or now ≥ end; else IN_PROGRESS if now ≥ start; else NOT_STARTED; `progressPercent` = round(done × 100 / total); `restSeconds` = end − now only when IN_PROGRESS else null
- [x] T069 [BE] [P] [US4] Create DTOs `plan/dto/PlanRequest.java` (`@NotBlank @Size(max=200) title`, `@NotNull @Min(1) Integer estimatedDurationMinutes`, `@NotNull` start/end, `@NotNull @Min(1) Integer priorityOrder`, `@NotEmpty @Valid items` of `PlanItemSource`), `PlanItemSource.java` (`@NotNull sourceType`, `@NotNull sourceId`), `PlanItemUpdateRequest.java` (`@NotNull Boolean done`), `PlanResponse.java` (`@Schema(name = "Plan")`), `PlanItemResponse.java` (`@Schema(name = "PlanItem")`, incl. `sourceAvailable`); mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on `PlanResponse` and `PlanItemResponse`; annotate every enum with `@Schema(enumAsRef = true)` so swagger uses `$ref` enums like the contract
- [x] T070 [BE] [US4] Create `plan/PlanItemCompletionService.java` (business rule 13 / research R6): item done=true → TASK calls `TaskService.complete` (sets DONE + completedAt only if not already DONE); HABIT records today's completion if missing via HabitService; LEARNING_RESOURCE no side effect; done=false never reverts the source; missing source → no side effect
- [x] T071 [BE] [US4] Create `plan/PlanService.java` (Clock): create (validate end > start → `BadRequestException` field `endDateTime`; ≥ 1 item; each source exists — task not archived, habit active, card exists — else `BadRequestException` field `items`; duplicate sources → `BadRequestException` field `items`; snapshot sourceTitle), get, list (optional status filter on derived status), delete, setItemDone (calls PlanItemCompletionService), acknowledgeStart (sets startNotifiedAt if null; idempotent); maps derived fields via PlanStatusCalculator and `sourceAvailable` lookups
- [x] T072 [BE] [US4] Create `plan/PlanController.java` implementing all 6 Plans operations of the contract with springdoc annotations
- [x] T073 [BE] [US4] Regenerate swagger, verify Plans paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify (status transitions using start in past/future, side effects on task/habit, 400 cases)

## Endpoints

| Method | Path | operationId | Success | Errors |
|---|---|---|---|---|
| GET | `/api/plans?status=` (optional `PlanStatus`, filters on derived status) | listPlans | 200 `Plan[]` (priorityOrder asc, startDateTime asc) | 400 |
| POST | `/api/plans` (body `PlanRequest`) | createPlan | 201 `Plan` | 400 (field `endDateTime` when end ≤ start; field `items` for empty / unknown / archived task / inactive habit / duplicate source) |
| GET | `/api/plans/{id}` | getPlan | 200 `Plan` | 400, 404 |
| DELETE | `/api/plans/{id}` | deletePlan | 204 (items deleted; sources untouched) | 400, 404 |
| PUT | `/api/plans/{id}/items/{itemId}` (body `PlanItemUpdateRequest`) | setPlanItemDone | 200 `Plan` | 400, 404 (unknown plan/item, or item of another plan) |
| POST | `/api/plans/{id}/start-notification` | acknowledgePlanStart | 200 `Plan` (startNotifiedAt set once; idempotent) | 400, 404 |

Derived on every read (`PlanStatusCalculator`, research R4): `status`, `itemsTotal`, `itemsDone`, `progressPercent` = round(done×100/total), `restSeconds` = max(0, end − now) only when `IN_PROGRESS`, else null. `PlanItem.sourceAvailable` = source still exists.
Errors are `application/problem+json` (`Problem` with `errors: FieldError[]` on 400).

## curl checks

Commands are `curl -s -o /dev/stderr -w '%{http_code}' -X <method> http://localhost:8080<path>` with `Content-Type: application/json` bodies; the Detail column is a jq assertion on the response body (`true` = holds). Sources (2 tasks, 1 archived task, 1 active + 1 inactive habit, 1 learning card) are created first and everything is cleaned up afterwards. Run after the final restart.

| # | Check | Command | Expected | Actual | Detail | Result |
|---|---|---|---|---|---|---|
| 1 | create plan (start past, end future) | `POST /api/plans` | 201 | 201 | `.status=="IN_PROGRESS" and .restSeconds>3500 and .itemsTotal==3 and .progressPercent==0 and .startNotifiedAt==null and ([.items[].sourceAvailable]|all) and .items[0].sourceTitle=="P5 task"` → true | PASS |
| 2 | create plan (start future) | `POST /api/plans` | 201 | 201 | `.status=="NOT_STARTED" and .restSeconds==null` → true | PASS |
| 3 | create plan (end passed, items open) | `POST /api/plans` | 201 | 201 | `.status=="COMPLETED" and .progressPercent==0 and .restSeconds==null` → true | PASS |
| 4 | list plans ordered priority asc, start asc | `GET /api/plans` | 200 | 200 | `[.[]|select(.id==4 or .id==5 or .id==6)|.id]==[6,5,4]` → true | PASS |
| 5 | list filtered by derived status | `GET /api/plans?status=IN_PROGRESS` | 200 | 200 | `([.[].status]|all(.=="IN_PROGRESS")) and any(.[];.id==4)` → true | PASS |
| 6 | list with invalid status | `GET /api/plans?status=BOGUS` | 400 | 400 | `.status==400` → true | PASS |
| 7 | get plan | `GET /api/plans/{id}` | 200 | 200 | `.id==4` → true | PASS |
| 8 | get unknown plan | `GET /api/plans/999999` | 404 | 404 | `.status==404` → true | PASS |
| 9 | get non-numeric id | `GET /api/plans/abc` | 400 | 400 | `.status==400` → true | PASS |
| 10 | task item done → 33% | `PUT /api/plans/{id}/items/{taskItem} {done:true}` | 200 | 200 | `.itemsDone==1 and .progressPercent==33 and .status=="IN_PROGRESS"` → true | PASS |
| 11 | side effect: task DONE | `GET /api/tasks/{T}` | 200 | 200 | `.status=="DONE" and .completedAt!=null` → true | PASS |
| 12 | habit item done → 67% | `PUT /api/plans/{id}/items/{habitItem} {done:true}` | 200 | 200 | `.progressPercent==67` → true | PASS |
| 13 | side effect: habit has today's completion | `GET /api/habits/{H}/completions` | 200 | 200 | `length==1` → true | PASS |
| 14 | habit undo+redo keeps one completion | `GET /api/habits/{H}/completions` | 200 | 200 | `length==1` → true | PASS |
| 15 | all items done → COMPLETED 100% | `PUT /api/plans/{id}/items/{learningItem} {done:true}` | 200 | 200 | `.status=="COMPLETED" and .progressPercent==100 and .restSeconds==null` → true | PASS |
| 16 | learning card untouched | `GET /api/learning-cards/{C}` | 200 | 200 | `.status=="NOT_STARTED" and (.milestones|length)==0` → true | PASS |
| 17 | undo task item → IN_PROGRESS again | `PUT /api/plans/{id}/items/{taskItem} {done:false}` | 200 | 200 | `.status=="IN_PROGRESS" and .progressPercent==67` → true | PASS |
| 18 | undo never reverts task | `GET /api/tasks/{T}` | 200 | 200 | `.status=="DONE"` → true | PASS |
| 19 | item update without done | `PUT /api/plans/{id}/items/{itemId} {}` | 400 | 400 | `any(.errors[];.field=="done")` → true | PASS |
| 20 | unknown item | `PUT /api/plans/{id}/items/999999` | 404 | 404 | `.status==404` → true | PASS |
| 21 | item of another plan | `PUT /api/plans/{other}/items/{itemId}` | 404 | 404 | `.status==404` → true | PASS |
| 22 | unknown plan for item | `PUT /api/plans/999999/items/{itemId}` | 404 | 404 | `.status==404` → true | PASS |
| 23 | acknowledge start | `POST /api/plans/{id}/start-notification` | 200 | 200 | `.startNotifiedAt!=null` → true | PASS |
| 24 | acknowledge start idempotent | `POST /api/plans/{id}/start-notification` | 200 | 200 | `.startNotifiedAt=="2026-10-03T20:36:00.599335+03:00"` → true | PASS |
| 25 | acknowledge unknown plan | `POST /api/plans/999999/start-notification` | 404 | 404 | `.status==404` → true | PASS |
| 26 | blank title | `POST /api/plans title='  '` | 400 | 400 | `any(.errors[];.field=="title")` → true | PASS |
| 27 | 201-char title | `POST /api/plans title=201 chars` | 400 | 400 | `any(.errors[];.field=="title")` → true | PASS |
| 28 | no items | `POST /api/plans items=[]` | 400 | 400 | `any(.errors[];.field=="items")` → true | PASS |
| 29 | end == start | `POST /api/plans end=start` | 400 | 400 | `any(.errors[];.field=="endDateTime")` → true | PASS |
| 30 | end before start | `POST /api/plans end<start` | 400 | 400 | `any(.errors[];.field=="endDateTime")` → true | PASS |
| 31 | duration 0 | `POST /api/plans estimatedDurationMinutes=0` | 400 | 400 | `any(.errors[];.field=="estimatedDurationMinutes")` → true | PASS |
| 32 | priority 0 | `POST /api/plans priorityOrder=0` | 400 | 400 | `any(.errors[];.field=="priorityOrder")` → true | PASS |
| 33 | missing startDateTime | `POST /api/plans no startDateTime` | 400 | 400 | `any(.errors[];.field=="startDateTime")` → true | PASS |
| 34 | item without sourceType | `POST /api/plans items[0].sourceType missing` | 400 | 400 | `any(.errors[];.field|test("sourceType"))` → true | PASS |
| 35 | item without sourceId | `POST /api/plans items[0].sourceId missing` | 400 | 400 | `any(.errors[];.field|test("sourceId"))` → true | PASS |
| 36 | archived task | `POST /api/plans archived task` | 400 | 400 | `any(.errors[];.field=="items")` → true | PASS |
| 37 | inactive habit | `POST /api/plans inactive habit` | 400 | 400 | `any(.errors[];.field=="items")` → true | PASS |
| 38 | unknown card | `POST /api/plans unknown card` | 400 | 400 | `any(.errors[];.field=="items")` → true | PASS |
| 39 | duplicate source | `POST /api/plans duplicate item` | 400 | 400 | `any(.errors[];.field=="items")` → true | PASS |
| 40 | invalid sourceType enum | `POST /api/plans sourceType=BOOK` | 400 | 400 | `.status==400` → true | PASS |
| 41 | deleted source kept as removed | `GET /api/plans/{id} after DELETE task` | 200 | 200 | `(.items[]|select(.sourceType=="TASK")|.sourceAvailable==false) and .itemsTotal==3` → true | PASS |
| 42 | delete plan | `DELETE /api/plans/{id}` | 204 | 204 |  | PASS |
| 43 | delete again | `DELETE /api/plans/{id}` | 404 | 404 | `.status==404` → true | PASS |
| 44 | sources untouched after delete | `GET /api/habits/{H}` | 200 | 200 | `.id==26` → true | PASS |

TOTAL=44 FAIL=0

## Notes

- Swagger (`backend/openapi/openapi.json`) compared with `contracts/openapi.yaml` for every Plans operation (paths, methods, operationIds, status codes, `status` query param) and schemas `PlanStatus`, `PlanItemSourceType`, `PlanItemSource`, `PlanRequest`, `PlanItemUpdateRequest`, `PlanItem`, `Plan` (properties, `required`, `$ref` enums): match.
- Item side effects (`PlanItemCompletionService`): every `done=true` applies the idempotent side effect — TASK → `TaskService.complete` (completedAt kept if already DONE); HABIT → new `HabitService.completeTodayIfMissing` (no 409, no duplicate); LEARNING_RESOURCE → none. `done=false` never reverts. Missing source → no side effect.
- Archived tasks remain `sourceAvailable=true` (they still exist); only deleted sources become `false`.
- Source validation on create returns the first failing source on field `items`; title is trimmed; `sourceTitle` is a snapshot (task title / habit name / card title).
- Plan item and plan ordering: items in insertion order; list ordered priorityOrder, startDateTime, id.
- `./mvnw -q verify` passes (existing tests); plan unit tests are [TEST] tasks T079/T080.
