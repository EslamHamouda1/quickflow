# Phase 4 — Testing (User Story 3 - Track learning resources)

Mode: test · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:4200
Checklist: `specs/001-quickflow-productivity/checklists/phase-4-learning.md` (from `/speckit-checklist`, 25 requirement-quality items)

## Tasks (mirrored from tasks.md)

- [x] T062 [TEST] [P] [US3] Backend unit tests `learning/LearningStatusCalculatorTest.java`, `learning/LearningServiceTest.java` (status recompute, completedAt set/cleared, manual status kept on a title-only milestone update and recomputed on the next add/toggle/remove, 404 cases)
- [x] T063 [TEST] [P] [US3] Backend tests `learning/LearningControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean LearningService`: request-DTO validation 400 problem+json for blank / 201-char card title, 2,001-char description, invalid status enum, blank / 201-char milestone title, blank / 5,001-char note text; 404) and `learning/LearningCardRepositoryTest.java` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`: cascade delete of milestones/notes)
- [x] T064 [TEST] [P] [US3] Frontend unit tests `features/learning/learning.store.spec.ts`, `learning-card.component.spec.ts`
- [x] T065 [TEST] [US3] curl tests for all 10 learning operations; Playwright MCP tests of the Learning page; e2e: add card with 2 milestones in UI → verify via curl; complete milestone via curl → UI shows progress 50% and In Progress; add/remove note in UI → verify via curl

## Backend tests

### TC-P4-BE-001 — Unit: `LearningStatusCalculatorTest` (T062)
- Story: US3  AC: AS5 / FR-016 (none → Not Started, some → In Progress, all → Completed), Edge case "no milestones → 0 %, status set manually only"
- Steps: `cd backend && ./mvnw -q verify`. 17 tests: derive for none/some/all, no milestones keeps each of the 3 statuses; progress rounding (0/0, 1/2=50, 1/3=33, 2/3=67, 1/8=13, 1/200=1 …), clamped 0..100.
- Expected: all pass
- Result: passed

### TC-P4-BE-002 — Unit: `LearningServiceTest` (T062)
- Story: US3  AC: AS1 (trim, Not Started default), AS3 (add/toggle/remove), AS4 (notes newest first), AS5 (recompute, manual status), AS6 (delete cascades)
- Steps: `./mvnw -q verify`. `@DataJpaTest` + `replace = NONE` + `LearningService` + `MutableClock` at 2026-06-17T10:00Z. 17 tests: create/update (status kept when omitted), list newest first; milestone add defaults not done, created done → completedAt; toggle sets/clears completedAt (persisted after reload); title-only update keeps done/completedAt and manual status; manual status recomputed on next add / toggle / remove; last milestone removed keeps status; notes newest first and do not change status; 404 for every operation on an unknown card, and for a milestone/note of another card (other card untouched).
- Expected: all pass
- Result: passed

### TC-P4-BE-003 — Unit: `LearningControllerTest` (T063)
- Story: US3  AC: AS1 (400 for empty / blank / missing / null / 201-char title, 2,001-char description, invalid status enum, malformed JSON; 200/2,000 accepted), AS3 (milestone blank / 201-char title, invalid targetDate), AS4 (note empty / blank / missing / 5,001; 5,000 accepted), 404 mapped from the service for all card/milestone/note operations, 400 for non-numeric `id` / `milestoneId` / `noteId`, delete 204 incl. `Accept: application/problem+json`
- Steps: `./mvnw -q verify`. `@WebMvcTest(LearningController)`, `MockMvcTester`, `@MockitoBean LearningService`. 31 tests.
- Expected: all pass; every error is `application/problem+json` with `status` and `errors[].field` on 400
- Result: passed

### TC-P4-BE-004 — Unit: `LearningCardRepositoryTest` (T063)
- Story: US3  AC: AS6 (card removed with its milestones and notes), AS2 ordering
- Steps: `./mvnw -q verify`. `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`. 5 tests: JPA delete cascades milestones + notes (other card untouched); bulk JPQL delete cascades at DB level (`ON DELETE CASCADE`); orphan removal; list newest first with milestones in insertion order and notes newest first; `countByStatus`, `countByDoneTrue`, `countByDoneTrueAndCompletedAtGreaterThanEqual`.
- Expected: all pass
- Result: passed

### TC-P4-BE-005 — createLearningCard success and boundaries
- Story: US3  AC: AS1, FR-012
- Steps: curl BE-001…BE-003 (padded title + description; explicit status IN_PROGRESS; 200-char title + 2,000-char description)
- Expected: 201, title trimmed, status NOT_STARTED by default, 0 milestones/notes, progress 0
- Result: passed

### TC-P4-BE-006 — createLearningCard validation errors
- Story: US3  AC: AS1 (title required, max 200), FR-012
- Steps: curl BE-004…BE-010: title "", "   ", missing, 201 chars; description 2,001; status "DONE"; body `{bad`
- Expected: 400 `application/problem+json`, `errors[]` naming the field
- Result: passed

### TC-P4-BE-007 — getLearningCard / listLearningCards
- Story: US3  AC: AS1 (grid), AS2
- Steps: curl BE-011…BE-014
- Expected: 200; 404 problem; 400 field `id`; list newest first
- Result: passed

### TC-P4-BE-008 — updateLearningCard (manual status)
- Story: US3  AC: AS5, FR-013
- Steps: curl BE-015…BE-022
- Expected: 200 trimmed title, description cleared, status kept when omitted, manual COMPLETED set and kept; 400 blank/201 title, 2,001 description, bad status; 404 unknown
- Result: passed

### TC-P4-BE-009 — addMilestone
- Story: US3  AC: AS3, AS5, FR-014, FR-016
- Steps: curl BE-023…BE-031
- Expected: 201 with full card; title trimmed, done false, targetDate kept; manual COMPLETED recomputed to NOT_STARTED; created done → completedAt, IN_PROGRESS 50 %; 200-char title accepted (33 %); 400 blank/whitespace/201 title, invalid date; 404 unknown card
- Result: passed

### TC-P4-BE-010 — updateMilestone
- Story: US3  AC: AS3, AS5, FR-016
- Steps: curl BE-032…BE-040
- Expected: done → completedAt, COMPLETED 100 %; title-only update keeps manual NOT_STARTED and done, targetDate replaced; undone clears completedAt and recomputes IN_PROGRESS; 400 blank title / bad milestoneId; 404 unknown milestone, milestone of another card, unknown card
- Result: passed

### TC-P4-BE-011 — deleteMilestone
- Story: US3  AC: AS3, AS5
- Steps: curl BE-041…BE-046
- Expected: 200 card recomputed (NOT_STARTED 0 %); 404 other card / again / unknown card; 400 bad id; removing the last milestone keeps manual COMPLETED with 0 %
- Result: passed

### TC-P4-BE-012 — addNote
- Story: US3  AC: AS4, FR-015
- Steps: curl BE-047…BE-054
- Expected: 201, createdAt set, newest first, multi-line kept, 5,000 chars accepted, status unchanged; 400 empty / blank / missing / 5,001; 404 unknown card
- Result: passed

### TC-P4-BE-013 — deleteNote
- Story: US3  AC: AS4
- Steps: curl BE-055…BE-059
- Expected: 200 note removed; 404 again / note of another card / unknown card; 400 bad noteId
- Result: passed

### TC-P4-BE-014 — deleteLearningCard (cascade)
- Story: US3  AC: AS6
- Steps: curl BE-060…BE-066 (DELETE with `Accept: application/problem+json`)
- Expected: 204; card, milestones and notes gone (GET 404, note DELETE 404); 404 again; 400 bad id; other card's children untouched; cleanup leaves no test cards
- Result: passed

## Frontend tests

### TC-P4-FE-001 — Unit: `learning.store.spec.ts` (T064)
- Story: US3  AC: AS1, AS3, AS4, AS5, AS6
- Steps: `cd frontend && npx ng test --watch=false --coverage`. 21 tests: `deriveStatus` / `withMilestones` (status, counters, rounding, no milestones); load + counts, stale responses, load error; create (prepend, reload, refresh bump), create field errors; update manual status, update reject; optimistic toggle → server card, pending guard, untoggle clears completedAt, rollback + toast; remove milestone (toast, refresh), 404 rollback + reload; addMilestone success / 404 / 400; add + remove note, note rollback; remove card + restore at old index on failure.
- Expected: all pass
- Result: passed

### TC-P4-FE-002 — Unit: `learning-card.component.spec.ts` (T064)
- Story: US3  AC: AS1, AS2, AS3, AS4, AS5, AS6, Edge case long titles
- Steps: same run. 17 tests: validators (card title/description, milestone title, note), status labels; card shows title + `title` attr, chip, progress text, singular/plural; collapsed `aria-expanded=false` + inert; expand shows milestones (checked, target date, overdue class) and notes newest first with `<time datetime>`; collapse keeps body rendered; long title full text when expanded; checkbox / remove call the store; add milestone empty error, valid add (trimmed, date) clears input, server field error; notes blank error, counter, add, remove; 5,001-char note rejected; edit/remove outputs; busy disables actions and checkboxes; Completed chip.
- Expected: all pass
- Result: passed

### TC-P4-FE-003 — Empty state
- Story: US3  AC: AS7
- Steps: `browser_navigate` http://localhost:4200/learning with no cards; `browser_snapshot`
- Expected: "No learning cards yet" with an "Add Learning Card" action; header button present
- Result: passed (`screenshots/p4-fe-001-empty.png`)

### TC-P4-FE-004 — Create form validation
- Story: US3  AC: AS1 (title required ≤ 200, description ≤ 2,000)
- Steps: click "Add Learning Card"; submit empty; fill Title 201 chars + Description 2,001 chars; submit; Esc
- Expected: "Title is required."; counter 201/200, both length errors, 2 fields `aria-invalid`; no status select in create mode; no POST sent; Esc closes and focus returns to the opener
- Result: passed (`screenshots/p4-fe-002-validation.png`)

### TC-P4-FE-005 — Create card
- Story: US3  AC: AS1
- Steps: Add Learning Card → Title "  P4 E2E Rust Book  ", Description "The Rust Programming Language" → Add card
- Expected: card in grid with "Not Started" chip, 0 %, "0 of 0 milestones · 0 notes"; summary "1 card · 0 in progress · 0 completed"
- Result: passed

### TC-P4-FE-006 — Expand / collapse
- Story: US3  AC: AS2
- Steps: click the chevron (`button.expand`) of card 10
- Expected: `aria-expanded` false → true, body height 316 px and not inert
- Result: passed

### TC-P4-FE-007 — Milestones add / toggle / status derivation
- Story: US3  AC: AS3, AS5
- Steps: submit empty milestone; add "Read chapters 1-5" with date 2026-11-15; add "Build a CLI tool" with Enter; (after E2E-002) tick milestone 2, untick milestone 1
- Expected: "Milestone title is required."; both listed, date "Nov 15, 2026", input cleared, 0 of 2; tick → Completed 100 %; untick → In Progress 50 %; strike-through `background-size: 100%` on done title
- Result: passed (`screenshots/p4-fe-003-created-expanded.png`)

### TC-P4-FE-008 — Notes add / remove
- Story: US3  AC: AS4
- Steps: submit "   "; add "Ownership chapter is key" (button); add "Borrowing\nand lifetimes" (Ctrl+Enter); remove "Ownership…"
- Expected: "Note text is required."; newest first, multi-line kept, timestamp "Oct 3, 2026, 08:27 PM" with `datetime`; textarea cleared; after remove 1 note, "· 1 note"
- Result: passed (`screenshots/p4-e2e-003-notes.png`)

### TC-P4-FE-009 — Manual status via edit (FR-013 / FR-016)
- Story: US3  AC: AS5
- Steps: Edit → status pre-filled In Progress → select Completed → Save; Edit → change title only → Save; remove the done milestone
- Expected: chip Completed; title-only edit keeps Completed; milestone remove recomputes Not Started 0 %
- Result: passed

### TC-P4-FE-010 — Remove card with confirmation
- Story: US3  AC: AS6, AS7
- Steps: Remove → Esc; Remove → confirm "Remove"
- Expected: confirm text names the card and "1 milestone(s) and 1 note(s)"; cancel keeps the card; confirm removes it and the empty state returns
- Result: passed (`screenshots/p4-fe-remove-confirm.png`)

### TC-P4-FE-011 — Long title truncation and narrow layout
- Story: US3  AC: AS1, Edge case "very long titles truncated with full text"
- Steps: card with a 177-char title (curl); check `.lcard__title` scrollWidth vs clientWidth and `title`; expand; resize to 375 px
- Expected: truncated (1327 > 394) with full text in `title` and in the expanded view; no horizontal overflow at 375 px, card 343 px wide
- Result: passed (`screenshots/p4-e2e-long-title-narrow.png`)

### TC-P4-FE-012 — Quick-add and navigation
- Story: US3  AC: AS1 (quick add used by US5 AS7)
- Steps: navigate `/learning?new=1`; Esc; click nav "Learning Resources"
- Expected: create dialog open with focus on Title, query param removed; nav link `aria-current="page"`
- Result: passed

### TC-P4-FE-013 — No console errors
- Story: US3  AC: all
- Steps: `browser_console_messages` level warning, all=true after the whole run
- Expected: 0 errors, 0 warnings
- Result: passed

## Backend + Frontend tests

### TC-P4-E2E-001 — Add card with 2 milestones in UI → verify via curl
- Story: US3  AC: AS1, AS3
- Steps: FE-005 + FE-007 in the UI; `curl -s http://localhost:8080/api/learning-cards/10`
- Expected: title "P4 E2E Rust Book" (trimmed), description, NOT_STARTED, 2 milestones (targetDate 2026-11-15 / null), both not done, 0 %
- Result: passed

### TC-P4-E2E-002 — Complete milestone via curl → UI shows 50 % and In Progress
- Story: US3  AC: AS3, AS5
- Steps: `curl -X PUT …/learning-cards/10/milestones/11 -d '{"title":"Read chapters 1-5","done":true,"targetDate":"2026-11-15"}'`; reload `/learning`
- Expected: API IN_PROGRESS 50 %, completedAt set; UI chip "In Progress", bar 50 %, "1 of 2 milestones", summary "1 in progress", checkbox 1 checked
- Result: passed (`screenshots/p4-e2e-002-curl-progress.png`)

### TC-P4-E2E-003 — Add / remove note in UI → verify via curl
- Story: US3  AC: AS4
- Steps: FE-008; curl GET after adding and after removing
- Expected: after add notes `[11 "Borrowing\nand lifetimes", 10 "Ownership chapter is key"]`; after remove only note 11
- Result: passed

### TC-P4-E2E-004 — Toggle milestones in UI → verify via curl
- Story: US3  AC: AS3, AS5
- Steps: FE-007 toggles; curl GET
- Expected: m11 done=false completedAt=null, m12 done=true completedAt set, IN_PROGRESS 50 %
- Result: passed

### TC-P4-E2E-005 — Manual status and milestone remove in UI → verify via curl
- Story: US3  AC: AS5, FR-013, FR-016
- Steps: FE-009; curl GET after the title-only edit and after the milestone remove
- Expected: `{"title":"P4 E2E Rust Book 2nd ed","status":"COMPLETED","progressPercent":50}`; then NOT_STARTED with 1 milestone, 1 note
- Result: passed

### TC-P4-E2E-006 — Remove card in UI → verify via curl
- Story: US3  AC: AS6
- Steps: FE-010; `curl …/learning-cards/10` and `curl -X DELETE …/learning-cards/10/notes/11`
- Expected: 404 / 404, list `[]`
- Result: passed

### TC-P4-E2E-007 — Card, milestones and note created via curl → UI; delete via curl → UI
- Story: US3  AC: AS2, AS5, AS6, AS7
- Steps: curl POST card 11 (177-char title), 3 milestones (first done, date 2026-10-20), 1 note; reload `/learning`, expand; `curl -X DELETE …/learning-cards/11`; reload
- Expected: UI In Progress 33 %, "1 of 3 milestones · 1 note", milestone A checked with "Oct 20, 2026", note with timestamp; after delete the card is gone and the empty state shows
- Result: passed
