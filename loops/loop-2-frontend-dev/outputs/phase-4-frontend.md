# Phase 4 — User Story 3: Track learning resources (frontend-dev)

Source: `specs/001-quickflow-productivity/tasks.md` (Phase 4, [FE] tasks). Ticks mirror tasks.md.

- [x] T058 [FE] [US3] Run `npm run api:gen`; create `features/learning/learning.store.ts` (signals, generated `LearningService`, RefreshService bump)
- [x] T059 [FE] [P] [US3] Create `features/learning/learning-card-form-dialog.component.ts` (title required ≤ 200, description/source ≤ 2,000; create and edit modes; in edit mode a status select `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED` for manual status, FR-013)
- [x] T060 [FE] [US3] Create `features/learning/learning-page.component.ts` + `learning-card.component.ts`: card grid with animated enter/leave, status chip, progress bar, expand/collapse with height animation (`aria-expanded`), milestone list (add inline form with optional target date, done checkbox with strike-through animation, remove), notes list (add textarea, timestamp, remove), edit card (opens the form dialog incl. manual status), remove card (confirm); long titles/notes truncated with full text in the expanded view; "Add Learning Card" button; empty state
- [x] T061 [FE] [US3] Playwright MCP check of the Learning Resources page against the running backend; screenshots


## Pages / features

- **Store** (`features/learning/learning.store.ts`, provided by the page). It holds these signals: `cards` (from `listLearningCards()`), computed `inProgressCount` / `completedCount`, `loading`, `loaded`, `error`, and `pending` (ids of cards with a request in flight). All calls go through the generated `LearningService`, which covers all 10 operations.
  - `create` / `update` reject with `ApiErrorInfo` so the form can show field errors. Create and remove re-fetch the list.
  - `toggleMilestone`, `removeMilestone`, `removeNote` and `remove` update the card straight away, before the server answers. The pure helpers `withMilestones` and `deriveStatus` recompute the counters, `progressPercent` and the derived status (FR-016; with no milestones the status is unchanged). The server's full `LearningCard` response then replaces the local copy. If a request fails, only that card is rolled back and an error toast appears.
  - `addMilestone` / `addNote` wait for the server and reject with `ApiErrorInfo` for the inline forms.
  - `updateMilestone` always sends `title` + `targetDate` + `done`, because `title` is required by `MilestoneRequest`.
  - Every successful mutation bumps `RefreshService`.
- **Form dialog** (`learning-card-form-dialog.component.ts`) is a native modal `<dialog>` used for both create and edit:
  - **Title** is required, max 200 after trim, with a live `n/200` counter.
  - **Description / source** is optional, max 2,000, with a live error.
  - In edit mode only, a **Status** select (Not Started / In Progress / Completed) sets the manual status (FR-013). `status` is sent only when the user changed it, so a title-only edit keeps the server's status.
  - Server `errors[]` are shown under their field.
  - Esc, Close or a backdrop click cancels, and focus goes back to the button that opened it.
- **Card** (`learning-card.component.ts`):
  - Truncated title with the full text in `title`, a colour-coded status chip, and a top accent (info = in progress, success = completed).
  - The description is clamped to 2 lines.
  - An animated `app-progress-bar` with "x of y milestones · n notes".
  - The expand/collapse button has `aria-expanded` / `aria-controls`, and its chevron rotates. The body animates its height with a `grid-template-rows` 0fr→1fr transition, and is `inert` while collapsed. It is rendered on first expand and kept, so collapsing also animates.
  - The expanded view shows the full title (when long) and the full description.
  - Footer: "Added …" timestamp, plus Edit and Remove.
- **Milestones** (`learning-milestones.component.ts`, child of the card):
  - Each milestone has a done checkbox. The title gets an animated strike-through: a line drawn with `background-size` 0→100%.
  - The target date shows in red when it is overdue and the milestone is not done.
  - A remove button.
  - An inline add form (title required ≤ 200, optional date input; Enter submits) with error display.
- **Notes** (`learning-notes.component.ts`, child of the card):
  - A textarea add form (non-blank, ≤ 5,000, live counter; Ctrl/Cmd+Enter submits).
  - Notes are listed newest first, with whitespace preserved, a `<time datetime>` timestamp and a remove button.
- **Page** (`learning-page.component.ts`):
  - "Add Learning Card" header button.
  - Summary line: "n cards · x in progress · y completed".
  - Responsive grid (`minmax(min(100%, 320px), 1fr)`, `align-items: start`). Cards scale/fade in and out with `animate.enter` / `animate.leave`.
  - Other states: loading skeletons, an error state with Retry, and an empty state.
  - Remove asks for confirmation through the shared confirm dialog, and the message gives the milestone and note counts.
  - `?new=1` opens the create form (for the dashboard quick-add).

## Playwright checks

Run against `ng serve` at http://localhost:4200 with the real backend at :8080 (headless chromium).

| # | Check | Steps | Result |
|---|---|---|---|
| 1 | Empty state | Open `/learning` with no cards | PASS. "No learning cards yet" shows an Add Learning Card action. |
| 2 | Client validation | Add Learning Card → submit empty; then enter a 201-char title and a 2,001-char description | PASS. "Title is required." appears. Counter reads `201/200`. Both over-length messages show with `aria-invalid` set. There is no status select in create mode. No POST is sent. Esc closes the dialog and focus returns to the opener. |
| 3 | Create | "Angular Signals deep dive" + description, then a 166-char title | PASS. Both cards show "Not Started". The long title is truncated (`scrollWidth > clientWidth`) with the full text in `title`. Summary reads "2 cards · 0 in progress · 0 completed". |
| 4 | Expand | Click the chevron | PASS. `aria-expanded` changes from false to true, and the body height goes from 0 to 316 px. |
| 5 | Milestones add | Submit empty (error), then "Watch intro videos" with target date 2026-10-10, then "Build a demo app" (Enter) | PASS. "Milestone title is required." appears. The POST bodies are correct and the input clears. The card shows 0 of 2, 0%, Not Started, and the date "Oct 10, 2026". |
| 6 | Status derivation | Tick 1 → tick 2 → untick 2 → remove 2 | PASS. Results in order: In Progress 50% (strike-through `background-size: 100%`), Completed 100%, In Progress 50%, then Completed 100% with "1 of 1 milestone". Each step sends `PUT …/milestones/{id}` with `done` or `DELETE`. |
| 7 | Notes | Submit empty (error), then add 2 notes (button, Ctrl+Enter), then remove one | PASS. "Note text is required." appears. Notes are listed newest first with a multi-line text and a timestamp ("Oct 3, 2026, 08:16 PM", `datetime` set). Remove leaves 1 note. |
| 8 | Manual status (FR-013/016) | Edit → status pre-filled Completed → set Not Started → save; then a title-only edit; then untick and retick a milestone | PASS. The card shows Not Started. The title-only PUT has no `status`, and the status stays Not Started. The milestone toggle recomputes it to Completed. |
| 9 | Collapse | Click the chevron again | PASS. Height is 62 px mid-transition and then 0. `aria-expanded=false` and the body is `inert`. |
| 10 | Server `errors[]` | Stub one POST with a 400 problem+json response `errors:[title, description]` | PASS. Each message appears under its field, plus "Please fix the highlighted fields." |
| 11 | Optimistic rollback | Stub `PUT …/milestones/4` → 500, then untick | PASS. The checkbox and status go back (checked, Completed). An error toast shows "Could not update the learning card — boom". |
| 12 | Remove | Remove → Esc (cancel) → Remove → confirm | PASS. The confirm dialog shows the truncated title and the counts. Cancel keeps the card. Confirm removes it with the leave animation. The API then lists only the remaining card. |
| 13 | Quick-add | Open `/learning?new=1` | PASS. The form opens with focus on Title, and the query param is removed. |
| 14 | Narrow + dark | 375 px wide with dark color scheme, card expanded | PASS. No horizontal overflow, and cards are 343 px (full width). |
| 15 | Reduced motion | Emulate `reduce` | PASS. Body transition duration is 1e-05 s. |
| 16 | Console | Whole phase-4 run | PASS. 0 app errors and 0 warnings. The only errors were the stubbed 400 and 500 responses. |

Test data was removed through the UI, so the backend learning-card list is empty again (`[]`).

Screenshots (`outputs/screenshots/`): `phase-4-learning-empty.png`, `phase-4-learning-validation.png`, `phase-4-learning-expanded.png`, `phase-4-learning-list.png`, `phase-4-learning-narrow-dark.png`.

## Notes

- `npm run api:gen` was re-run from `backend/openapi/openapi.json`. The generated `LearningService` covers all 10 operations, and no endpoint is missing.
- I split milestones and notes into child components (`learning-milestones.component.ts`, `learning-notes.component.ts`) so each component's styles stay under the 4 kB budget. `learning-card.component.ts` is still the card from T060.
- Build: `npx ng build` passes. The only warning is the existing one from phase 3 (`habit-card` styles at 4.69 kB). Existing unit tests pass: 88 of 88. Phase-4 unit specs belong to [TEST] task T064. `deriveStatus`, `withMilestones`, `validateLearningCardForm`, `validateMilestoneTitle` and `validateNote` are exported pure functions, ready for those specs.
