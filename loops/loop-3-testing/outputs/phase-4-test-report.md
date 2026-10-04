# Phase 4 — Test report (User Story 3 - Track learning resources)

Mode: test · Trial: 0 · Started 2026-10-03T20:19:20+03:00 · Ended 2026-10-03T20:31:00+03:00
Phase file: `loops/loop-3-testing/outputs/phase-4-testing.md` · Checklist: `specs/001-quickflow-productivity/checklists/phase-4-learning.md`
**Result: passed**, 34/34 · Tasks ticked: T062, T063, T064, T065 · Bugs: none

## Totals

| Section | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend tests | 14 | 14 | 0 | 0 |
| Frontend tests | 13 | 13 | 0 | 0 |
| Backend + Frontend tests | 7 | 7 | 0 | 0 |
| **All** | **34** | **34** | **0** | **0** |

Smoke (`scripts/preflight.sh http://localhost:8080/v3/api-docs http://localhost:4200`): both OK (200).
All 10 Learning operations exercised: `listLearningCards`, `createLearningCard`, `getLearningCard`, `updateLearningCard`, `deleteLearningCard`, `addMilestone`, `updateMilestone`, `deleteMilestone`, `addNote`, `deleteNote`.

## Bugs

None.

## Coverage

| Area | Tests | Line % | Branch % | Report |
|---|---|---|---|---|
| Backend (JaCoCo, whole app) | 184 (new: LearningStatusCalculatorTest 17, LearningServiceTest 17, LearningControllerTest 31, LearningCardRepositoryTest 5) | 97.7 (541/554) | 93.5 (129/138) | `outputs/coverage/phase-4/backend/index.html` |
| Backend `com.quickflow.learning*` | — | 96.9 (155/160) | 100 (20/20) | same |
| Frontend (vitest v8, whole app) | 126 in 10 files (38 new) | 56.09 (stmts 59.15) | 43.55 | `outputs/coverage/phase-4/frontend/quickflow/index.html` |
| Frontend `learning.store.ts` | 21 | stmts 99.29 | 96.36 | same |
| Frontend `learning-card.component.ts` (+ children milestones 93.28 / notes 91.4 stmts) | 17 | stmts 100 | 96.15 | same |

The whole-app frontend line % dropped slightly from phase 3 (57.68). The new generated `api/api/learning.service.ts` is mocked by the specs, and `learning-page` / `learning-card-form-dialog` were tested through Playwright, not unit specs. T064 only scopes the store and card specs.

## Test code added

- `backend/src/test/java/com/quickflow/learning/LearningStatusCalculatorTest.java`, `LearningServiceTest.java`, `MutableClock.java` (T062)
- `backend/src/test/java/com/quickflow/learning/LearningControllerTest.java`, `LearningCardRepositoryTest.java` (T063)
- `frontend/src/app/features/learning/learning.store.spec.ts`, `learning-card.component.spec.ts` (T064)
- `loops/loop-3-testing/outputs/curl/phase-4-curl.sh` (T065 curl script; output in `phase-4-curl.out`, 66/66 PASS)

Commands: `cd backend && ./mvnw -q verify` (exit 0, 184 tests, 0 failures) · `cd frontend && npx ng test --watch=false --coverage` (126/126 passed).
Two corrections were needed in the test code. Neither was an app defect:
- The create-store spec's reload mock returned the old list.
- jsdom does not reflect the `inert` property as an attribute, so the spec now reads the property. Inert was also confirmed in the real browser (FE-006).

## curl commands

`$B=http://localhost:8080/api/learning-cards`. Each request is `curl -s -o <file> -w '%{http_code} %{content_type}' -X <M> [-H 'Accept: <a>'] [-H 'Content-Type: application/json' --data <body>] <url>`. `$C` is the main card, `$D` is a second card, `$TAG=p4qa<random>`. The full script is `outputs/curl/phase-4-curl.sh`.

| # | Command | Expected | Actual |
|---|---|---|---|
| BE-001 | `POST $B {"title":"  $TAG Spring  ","description":"Book: Spring in Action"}` | 201 trimmed, NOT_STARTED, 0/0 | 201 ✓ |
| BE-002 | `POST $B {"title":"$TAG B","status":"IN_PROGRESS"}` | 201 IN_PROGRESS | 201 ✓ |
| BE-003 | `POST $B {"title":<200×a>,"description":<2000×d>}` | 201 | 201 ✓ |
| BE-004 | `POST $B {"title":""}` | 400 title | 400 ✓ |
| BE-005 | `POST $B {"title":"   "}` | 400 title | 400 ✓ |
| BE-006 | `POST $B {}` | 400 title | 400 ✓ |
| BE-007 | `POST $B {"title":<201×a>}` | 400 title | 400 ✓ ("Title must be 1-200 characters") |
| BE-008 | `POST $B {"title":"x","description":<2001×d>}` | 400 description | 400 ✓ |
| BE-009 | `POST $B {"title":"x","status":"DONE"}` | 400 status | 400 ✓ |
| BE-010 | `POST $B {bad` | 400 problem | 400 ✓ |
| BE-011 | `GET $B/$C` | 200 | 200 ✓ |
| BE-012 | `GET $B/999999` | 404 problem | 404 ✓ |
| BE-013 | `GET $B/abc` | 400 id | 400 ✓ |
| BE-014 | `GET $B` | 200 newest first | 200 ✓ |
| BE-015 | `PUT $B/$C {"title":" $TAG Spring 2 "}` | 200 trimmed, description null, status kept | 200 ✓ |
| BE-016 | `PUT $B/$C {"title":…,"status":"COMPLETED"}` | 200 COMPLETED | 200 ✓ |
| BE-017 | `PUT $B/$C {"title":…}` | 200 COMPLETED kept | 200 ✓ |
| BE-018…021 | `PUT $B/$C` blank title / 201 title / 2001 description / status "bogus" | 400 field | 400 ✓ |
| BE-022 | `PUT $B/999999 {"title":"x"}` | 404 | 404 ✓ |
| BE-023 | `POST $B/$C/milestones {"title":"  Ch 1  ","targetDate":"2026-12-01"}` | 201, "Ch 1", done false, NOT_STARTED (manual COMPLETED recomputed) | 201 ✓ |
| BE-024 | `POST $B/$C/milestones {"title":"Ch 2","done":true}` | 201 completedAt set, IN_PROGRESS 50 % | 201 ✓ |
| BE-025…028 | `POST $B/$C/milestones` "" / "  " / 201 chars / targetDate "2026-13-45" | 400 title / targetDate | 400 ✓ |
| BE-029 | `POST $B/999999/milestones {"title":"x"}` | 404 | 404 ✓ |
| BE-030 | `POST $B/$C/milestones {"title":<200×a>}` | 201, 33 % | 201 ✓ |
| BE-031 | `DELETE $B/$C/milestones/$M3` | 200, 50 % | 200 ✓ |
| BE-032 | `PUT $B/$C/milestones/$M1 {"title":"Ch 1","done":true,"targetDate":"2026-12-01"}` | 200 COMPLETED 100 % | 200 ✓ |
| BE-033 | `PUT $B/$C {"title":…,"status":"NOT_STARTED"}` | 200 | 200 ✓ |
| BE-034 | `PUT $B/$C/milestones/$M1 {"title":"Ch 1 renamed"}` | 200, manual NOT_STARTED kept, done kept, targetDate null | 200 ✓ |
| BE-035 | `PUT $B/$C/milestones/$M1 {"title":"Ch 1","done":false}` | 200 completedAt null, IN_PROGRESS | 200 ✓ |
| BE-036 | `PUT $B/$C/milestones/$M1 {"title":"","done":true}` | 400 title | 400 ✓ |
| BE-037 | `PUT $B/$C/milestones/999999 {"title":"x"}` | 404 | 404 ✓ |
| BE-038 | `PUT $B/$C/milestones/$MD` (milestone of card D) | 404 | 404 ✓ |
| BE-039 | `PUT $B/999999/milestones/$M1` | 404 | 404 ✓ |
| BE-040 | `PUT $B/$C/milestones/abc` | 400 milestoneId | 400 ✓ |
| BE-041 | `DELETE $B/$C/milestones/$MD` | 404 | 404 ✓ |
| BE-042 | `DELETE $B/$C/milestones/$M2` | 200 NOT_STARTED 0 % | 200 ✓ |
| BE-043 | `DELETE $B/$C/milestones/$M2` (again) | 404 | 404 ✓ |
| BE-044 | `DELETE $B/$C/milestones/x` | 400 milestoneId | 400 ✓ |
| BE-045 | `DELETE $B/999999/milestones/$M1` | 404 | 404 ✓ |
| BE-046 | `PUT $B/$C status COMPLETED` then `DELETE $B/$C/milestones/$M1` (last) | 200 COMPLETED kept, 0 % | 200 ✓ |
| BE-047 | `POST $B/$C/notes {"text":"first note"}` | 201 createdAt set | 201 ✓ |
| BE-048 | `POST $B/$C/notes {"text":"second\nline"}` | 201 newest first | 201 ✓ |
| BE-049 | `POST $B/$C/notes {"text":<5000×n>}` | 201 | 201 ✓ |
| BE-050…053 | `POST $B/$C/notes` "" / "   " / {} / 5001 chars | 400 text | 400 ✓ |
| BE-054 | `POST $B/999999/notes {"text":"x"}` | 404 | 404 ✓ |
| BE-055 | `DELETE $B/$C/notes/$N3` | 200 | 200 ✓ |
| BE-056 | `DELETE $B/$C/notes/$N3` (again) | 404 | 404 ✓ |
| BE-057 | `DELETE $B/$C/notes/$ND` (note of card D) | 404 | 404 ✓ |
| BE-058 | `DELETE $B/999999/notes/$N1` | 404 | 404 ✓ |
| BE-059 | `DELETE $B/$C/notes/x` | 400 noteId | 400 ✓ |
| BE-060 | `DELETE $B/$C -H 'Accept: application/problem+json'` | 204 | 204 ✓ |
| BE-061 | `GET $B/$C` | 404 | 404 ✓ |
| BE-062 | `DELETE $B/$C/notes/$N1` | 404 (notes gone) | 404 ✓ |
| BE-063 | `DELETE $B/$C` (again) | 404 | 404 ✓ |
| BE-064 | `DELETE $B/abc` | 400 id | 400 ✓ |
| BE-065 | `GET $B/$D` | 200, its milestone + note untouched | 200 ✓ |
| BE-066 | `GET $B` after cleanup | no `$TAG` cards | 200 ✓ |

E2E curl commands:
- E2E-001 / 004 / 005: `curl -s http://localhost:8080/api/learning-cards/10`
- E2E-002: `curl -s -X PUT -H 'Content-Type: application/json' --data '{"title":"Read chapters 1-5","done":true,"targetDate":"2026-11-15"}' http://localhost:8080/api/learning-cards/10/milestones/11` → IN_PROGRESS 50 %
- E2E-003: `curl -s http://localhost:8080/api/learning-cards/10 | jq '[.notes[]|{id,text}]'`
- E2E-006: `curl -s -w '%{http_code}' http://localhost:8080/api/learning-cards/10` → 404; `curl -X DELETE …/10/notes/11` → 404; `GET …/learning-cards` → `[]`
- E2E-007: `POST …/learning-cards {"title":"P4 curl Very long …"(177),"description":"Created via curl"}` → id 11. Then `POST …/11/milestones` three times (`{"title":"curl milestone A","done":true,"targetDate":"2026-10-20"}`, B, C) and `POST …/11/notes {"text":"curl note"}`, giving IN_PROGRESS 33 %. Finally `DELETE …/11` → 204.

## Playwright steps (Playwright MCP, headless chromium, http://localhost:4200)

| Case | Steps (tool → target → value) | Observed |
|---|---|---|
| FE-003 | `browser_navigate` /learning → `browser_snapshot` → `browser_take_screenshot` | heading "No learning cards yet", 2× "Add Learning Card" |
| FE-004 | `browser_click` header "Add Learning Card" → `browser_run_code`: click "Add card"; fill Title 201×a, Description 2001×d; click "Add card"; press Escape | "Title is required."; "201/200", both length messages; 2 `aria-invalid`; 0 comboboxes; 0 POST; dialog closed; focus "Add Learning Card" |
| FE-005 | `browser_run_code`: Add Learning Card → Title "  P4 E2E Rust Book  ", Description → "Add card" | card id 10, "Not Started", "1 card · 0 in progress · 0 completed" |
| FE-006 | click `app-learning-card[data-id=10] button.expand` | aria-expanded false→true, body 316 px, inert false |
| FE-007 | submit empty milestone form; fill `input[name=milestoneTitle]` "Read chapters 1-5", `input[name=milestoneTargetDate]` 2026-11-15, submit; fill "Build a CLI tool" + Enter; later click checkbox 2, then checkbox 1 | "Milestone title is required."; items "Read chapters 1-5 / Nov 15, 2026", "Build a CLI tool"; 0 of 2; then Completed 100 % → In Progress 50 % |
| FE-008 | fill `textarea[name=noteText]` "   " + submit; "Ownership chapter is key" + submit; "Borrowing\nand lifetimes" + Control+Enter; click "Remove note" on "Ownership…" | "Note text is required."; 2 notes newest first with `datetime`; then 1 note |
| FE-009 | click "Edit learning card: …" → combobox pre-filled IN_PROGRESS → select COMPLETED → submit; Edit → Title "P4 E2E Rust Book 2nd ed" → submit; expand → "Remove milestone: Build a CLI tool" | Completed; Completed kept with new title; Not Started 0 % |
| FE-010 | "Remove learning card: …" → Escape → "Remove learning card: …" → dialog "Remove" | message names the card with 1 milestone(s) and 1 note(s); cancel keeps it; confirm removes it and the empty state shows |
| FE-011 | reload; evaluate `.lcard__title` sizes; expand; `setViewportSize` 375×800 | scrollWidth 1327 > clientWidth 394, `title` 177 chars, full title in the expanded view; no horizontal overflow; card 343 px |
| FE-012 | `goto` /learning?new=1; Escape; click nav "Learning Resources" | dialog open, focus `#learning-title`, URL without `?new=1`; `aria-current="page"` |
| FE-013 | `browser_console_messages` level=warning all=true | 0 errors, 0 warnings |

Screenshots (`loops/loop-3-testing/outputs/screenshots/`): `p4-fe-001-empty.png`, `p4-fe-002-validation.png`, `p4-fe-003-created-expanded.png`, `p4-e2e-002-curl-progress.png`, `p4-e2e-003-notes.png`, `p4-fe-remove-confirm.png`, `p4-e2e-long-title-narrow.png`.

Note: two `browser_run_code` calls that registered `page.on('request')` listeners failed with "Connection closed" (MCP tool transport). The steps were re-run without listeners; the data from the first attempt was removed with `curl -X DELETE …/learning-cards/9`. This was a test-tool issue, not an app defect. Test data was cleaned up, so the backend learning list is `[]` again.
