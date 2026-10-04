# Phase 4 — Backend (User Story 3 - Track learning resources)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T051 [BE] [P] [US3] Create `learning/LearningStatus.java` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), entities `learning/LearningCard.java` (id, title "required, trimmed, 1–200 chars", description/source "≤ 2,000 chars", status default `NOT_STARTED`, createdAt; milestones + notes `@OneToMany` cascade ALL, orphanRemoval), `learning/LearningMilestone.java` (id, card FK, title "required, 1–200 chars", done default false, targetDate `LocalDate?`, completedAt `OffsetDateTime?`), `learning/LearningNote.java` (id, card FK, text "required, non-blank, ≤ 5,000 chars", createdAt)
- [x] T052 [BE] [P] [US3] Create `learning/LearningCardRepository.java` (fetch milestones/notes, newest first) and `learning/LearningMilestoneRepository.java` (count done, count completedAt within last N days)
- [x] T053 [BE] [P] [US3] Create pure `learning/LearningStatusCalculator.java` (none done → NOT_STARTED, some → IN_PROGRESS, all → COMPLETED, no milestones → unchanged) and progress percent
- [x] T054 [BE] [P] [US3] Create DTOs `learning/dto/LearningCardRequest.java`, `MilestoneRequest.java`, `NoteRequest.java` (validation per data-model) and `LearningCardResponse.java` (`@Schema(name = "LearningCard")`), `MilestoneResponse.java` (`@Schema(name = "Milestone")`), `NoteResponse.java` (`@Schema(name = "Note")`) (mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on all three; enumAsRef on `LearningStatus`; milestones in insertion order, notes newest first, milestonesTotal/Done, progressPercent)
- [x] T055 [BE] [US3] Create `learning/LearningService.java` (Clock): card create/update(status manual; status kept when omitted)/delete; milestone add (done defaults false; completedAt set if created done)/update (done kept when omitted; done → completedAt set; undone → cleared)/delete; note add/delete; recompute status after a milestone add, delete, or an update that changes `done` (title/targetDate-only updates keep a manual status, FR-016); 404 for unknown card/milestone/note or milestone of another card
- [x] T056 [BE] [US3] Create `learning/LearningController.java` implementing all 10 Learning operations of the contract with springdoc annotations
- [x] T057 [BE] [US3] Regenerate swagger, verify Learning paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify

## Endpoints

| Method | Path | operationId | Success | Errors |
|---|---|---|---|---|
| GET | `/api/learning-cards` | listLearningCards | 200 `LearningCard[]` (newest first) | — |
| POST | `/api/learning-cards` (body `LearningCardRequest`) | createLearningCard | 201 `LearningCard` | 400 |
| GET | `/api/learning-cards/{id}` | getLearningCard | 200 `LearningCard` | 400, 404 |
| PUT | `/api/learning-cards/{id}` (body `LearningCardRequest`) | updateLearningCard | 200 `LearningCard` | 400, 404 |
| DELETE | `/api/learning-cards/{id}` | deleteLearningCard | 204 (milestones + notes deleted) | 400, 404 |
| POST | `/api/learning-cards/{id}/milestones` (body `MilestoneRequest`) | addMilestone | 201 `LearningCard` | 400, 404 |
| PUT | `/api/learning-cards/{id}/milestones/{milestoneId}` (body `MilestoneRequest`) | updateMilestone | 200 `LearningCard` | 400, 404 (unknown card/milestone, or milestone of another card) |
| DELETE | `/api/learning-cards/{id}/milestones/{milestoneId}` | deleteMilestone | 200 `LearningCard` | 400, 404 |
| POST | `/api/learning-cards/{id}/notes` (body `NoteRequest`) | addNote | 201 `LearningCard` | 400, 404 |
| DELETE | `/api/learning-cards/{id}/notes/{noteId}` | deleteNote | 200 `LearningCard` | 400, 404 (unknown card/note, or note of another card) |

Errors are `application/problem+json` (`Problem` with `errors: FieldError[]` on 400).
Swagger check (`backend/openapi/openapi.json` vs `contracts/openapi.yaml`): all 10 Learning operations match on paths, methods, operationIds, status codes, path params, request-body required flag; schemas `LearningStatus`, `LearningCardRequest`, `MilestoneRequest`, `NoteRequest`, `LearningCard`, `Milestone`, `Note` match on properties, `$ref` enums/items and `required` lists. Tasks and Habits operations still match (only later-phase paths are absent).

## curl checks

All commands are `curl -s -o /dev/stderr -w '%{http_code}' -X <method> <url>` against `http://localhost:8080/api/learning-cards`, JSON bodies with `Content-Type: application/json`; the Detail column is a jq assertion on the body (`true` = holds). Run after the final restart.

| # | Check | Expected | Actual | Result | Detail |
|---|---|---|---|---|---|
| 1 | POST create card (title trimmed, defaults) | 201 | 201 | PASS | true |
| 2 | POST create card with status IN_PROGRESS | 201 | 201 | PASS | true |
| 3 | POST title 200 + description 2000 chars | 201 | 201 | PASS | true |
| 4 | POST blank title | 400 | 400 | PASS | true |
| 5 | POST missing title | 400 | 400 | PASS | true |
| 6 | POST title 201 chars | 400 | 400 | PASS | true |
| 7 | POST description 2001 chars | 400 | 400 | PASS | true |
| 8 | POST invalid status | 400 | 400 | PASS | true |
| 9 | POST malformed JSON | 400 | 400 | PASS | true |
| 10 | 400 content-type problem+json | 400 | 400 | PASS | application/problem+json |
| 11 | GET card | 200 | 200 | PASS | true |
| 12 | GET unknown card | 404 | 404 | PASS | true |
| 13 | GET non-numeric id | 400 | 400 | PASS | true |
| 14 | GET list newest first | 200 | 200 | PASS | true |
| 15 | PUT update (status omitted kept) | 200 | 200 | PASS | true |
| 16 | PUT manual status COMPLETED | 200 | 200 | PASS | true |
| 17 | PUT omitted status keeps COMPLETED | 200 | 200 | PASS | true |
| 18 | PUT blank title | 400 | 400 | PASS | true |
| 19 | PUT invalid status | 400 | 400 | PASS | true |
| 20 | PUT unknown card | 404 | 404 | PASS | true |
| 21 | POST milestone 1 (done default false) → NOT_STARTED recompute | 201 | 201 | PASS | true |
| 22 | POST milestone 2 created done → completedAt, IN_PROGRESS, 50% | 201 | 201 | PASS | true |
| 23 | PUT milestone 1 done → COMPLETED 100%, completedAt set | 200 | 200 | PASS | true |
| 24 | PUT manual status NOT_STARTED on card | 200 | 200 | PASS | true |
| 25 | PUT milestone title-only (done omitted) keeps manual status + done | 200 | 200 | PASS | true |
| 26 | PUT milestone undone → completedAt cleared, IN_PROGRESS | 200 | 200 | PASS | true |
| 27 | POST milestone blank title | 400 | 400 | PASS | true |
| 28 | POST milestone title 201 chars | 400 | 400 | PASS | true |
| 29 | POST milestone invalid targetDate | 400 | 400 | PASS | true |
| 30 | POST milestone unknown card | 404 | 404 | PASS | true |
| 31 | PUT milestone blank title | 400 | 400 | PASS | true |
| 32 | PUT milestone unknown milestone | 404 | 404 | PASS | true |
| 33 | PUT milestone of another card | 404 | 404 | PASS | true |
| 34 | PUT milestone unknown card | 404 | 404 | PASS | true |
| 35 | DELETE milestone of another card | 404 | 404 | PASS | true |
| 36 | DELETE milestone 2 (done) → NOT_STARTED 0% | 200 | 200 | PASS | true |
| 37 | DELETE milestone 2 again | 404 | 404 | PASS | true |
| 38 | PUT manual status COMPLETED then delete last milestone keeps it | 200 | 200 | PASS | true |
| 39 | DELETE last milestone → status unchanged (no milestones) | 200 | 200 | PASS | true |
| 40 | DELETE milestone non-numeric id | 400 | 400 | PASS | true |
| 41 | DELETE milestone unknown card | 404 | 404 | PASS | true |
| 42 | POST note 1 | 201 | 201 | PASS | true |
| 43 | POST note 2 → newest first | 201 | 201 | PASS | true |
| 44 | POST note 5000 chars | 201 | 201 | PASS | true |
| 45 | POST note blank | 400 | 400 | PASS | true |
| 46 | POST note missing text | 400 | 400 | PASS | true |
| 47 | POST note 5001 chars | 400 | 400 | PASS | true |
| 48 | POST note unknown card | 404 | 404 | PASS | true |
| 49 | DELETE note | 200 | 200 | PASS | true |
| 50 | DELETE note again | 404 | 404 | PASS | true |
| 51 | DELETE note of another card | 404 | 404 | PASS | true |
| 52 | DELETE note unknown card | 404 | 404 | PASS | true |
| 53 | DELETE note non-numeric id | 400 | 400 | PASS | true |
| 54 | POST milestone before card delete | 201 | 201 | PASS | true |
| 55 | DELETE card (problem+json accept) | 204 | 204 | PASS |  |
| 56 | GET deleted card | 404 | 404 | PASS | true |
| 57 | DELETE note of deleted card | 404 | 404 | PASS | true |
| 58 | DELETE unknown card | 404 | 404 | PASS | true |
| 59 | DELETE card non-numeric | 400 | 400 | PASS | true |
| 60 | DELETE card B | 204 | 204 | PASS |  |
| 61 | DELETE long card | 204 | 204 | PASS |  |

**Result: 61/61 pass.** Regression after restart: Tasks 47/47, Habits 46/46.

## Notes

- `LearningStatusCalculator` (pure/static): `derive(total, done, current)` → none done NOT_STARTED, some IN_PROGRESS, all COMPLETED, no milestones → `current`; `progressPercent(total, done)` = `round(done*100/total)`, 0 with no milestones.
- Status is recomputed only after a milestone add, delete, or an update whose `done` actually changes. A title/targetDate-only update (or one with the same `done`) keeps a manual status (FR-016). Deleting the last milestone keeps the current status.
- `PUT /{id}`: omitted `status` keeps the current status; given `status` sets it manually. `description` is replaced (omitted → null). Title trimmed on cards and milestones; note text stored as sent (blank rejected).
- `PUT .../milestones/{milestoneId}`: omitted `done` keeps it; `targetDate` replaced (omitted → null). done false→true sets `completedAt`, true→false clears it. Milestone created with `done:true` gets `completedAt`.
- Milestones/notes are looked up inside the card's collections, so a milestone or note of another card → 404.
- Ordering: milestones by id (insertion order), notes `createdAt desc, id desc`, cards `createdAt desc, id desc`. List fetches milestones with an entity graph, notes via `@BatchSize(50)` (avoids the multiple-bag fetch issue).
- Children: `@OneToMany(cascade = ALL, orphanRemoval = true)` plus DB-level `@OnDelete(CASCADE)` on `learning_card_id` FKs. Service mutates the managed card and calls `flush()` (no `merge`), so new children get ids before the response is built.
- `LearningMilestoneRepository` exposes `countByDoneTrue()` and `countByDoneTrueAndCompletedAtGreaterThanEqual(since)` for the dashboard (phase 7); `LearningCardRepository.countByStatus` likewise.
- `deleteLearningCard` produces both `application/json` and `application/problem+json` (same fix as BUG-P2-001).
- Unit tests for this phase are [TEST] tasks T062/T063 (loop-3); `./mvnw -q verify` passes with the existing tests.
- Backend restarted detached with `setsid nohup ./mvnw spring-boot:run` (pid in `state/backend.pid`).
