# Phase 3 — User Story 2: Track recurring habits (frontend-dev)

Source: `specs/001-quickflow-productivity/tasks.md` (Phase 3, [FE] tasks). Ticks mirror tasks.md.

- [x] T043 [FE] [US2] Run `npm run api:gen`; create `features/habits/habits.store.ts` (signals, generated `HabitsService`, optimistic toggle with rollback, RefreshService bump)
- [x] T044 [FE] [P] [US2] Create `features/habits/habit-form-dialog.component.ts` (name required ≤ 150, description, Daily/Weekly segmented control; create/edit)
- [x] T045 [FE] [US2] Create `features/habits/habits-page.component.ts` + `habit-card.component.ts`: card grid with animated enter/leave, completion toggle bound to `completedToday` (pop/check animation, "already done" feedback; Weekly habits with `doneForCurrentPeriod && !completedToday` show a "done this week" badge with an undo button that calls `uncompleteHabit(lastCompletedDate)`; the toggle itself (off) records today's completion), frequency label, streak indicator (flame + count with bump animation), completion-rate ring/bar, edit, deactivate/reactivate, remove (confirm); long names/descriptions truncated with full text in `title` attribute; "Add Habit" button; active/inactive sections; empty state
- [x] T046 [FE] [US2] Playwright MCP check of the Habits page against the running backend; screenshots

## Pages / features

- **Store** (`features/habits/habits.store.ts`, provided by the page). It holds these signals: `habits` (active and inactive, from one `listHabits()` call), computed `active` / `inactive` / `doneCount`, `loading`, `loaded`, `error`, and `pending` (ids of habits with a request in flight). All calls go through the generated `HabitsService`.
  - `toggleToday` follows `completedToday`. When it is off, it calls `completeHabit(id, {})`, so the server picks today's date. When it is on, it calls `uncompleteHabit(id, lastCompletedDate)`; while `completedToday` is true, that date is the server's today.
  - `uncomplete(habit, date)` handles the Weekly "done this week" undo.
  - `deactivate`, `activate` and `remove` update the list straight away, before the server answers. The helpers `withCompletedToday` / `withoutCompletion` also adjust the streak. If a request fails, only that habit is rolled back and an error toast appears.
  - A **409** (duplicate completion) is not rolled back. It shows an info toast "Already done" with the server message and reloads the list.
  - Every successful mutation bumps `RefreshService` and re-fetches the list.
  - `create` / `update` reject with `ApiErrorInfo` so the form can show field errors.
- **Form dialog** (`habit-form-dialog.component.ts`) is a native modal `<dialog>` used for both create and edit:
  - **Name** is required, max 150 after trim, with a live `n/150` counter that turns red past the limit. "Required" is checked on blur or submit.
  - **Description** is optional. Over 2,000 characters shows a live error.
  - **Frequency** is a Daily/Weekly segmented control: a radio group with a sliding spring thumb, a hint text, and a visible focus ring.
  - Server `errors[]` (`name`, `description`, `frequency`) are shown under their field.
  - Esc, the Close button or a backdrop click cancels the dialog, and focus goes back to the button that opened it.
- **Card** (`habit-card.component.ts`):
  - A 44 px round toggle with `aria-pressed` = `completedToday` and a pop + ring-pulse animation when completing. Its tooltip reads "Already done today — click to undo".
  - Frequency chip (Daily / Weekly) and an Inactive chip.
  - Period line:
    - "Done today"
    - "Done this week" + **Undo** (Weekly with `doneForCurrentPeriod && !completedToday` calls `uncompleteHabit(lastCompletedDate)`; the toggle stays off and records today when clicked)
    - "Not done today/this week yet"
    - "Paused — reactivate to track"
  - Streak: flame icon + count + unit (day/days, week/weeks). The flame bumps when the streak grows.
  - Completion rate: an SVG ring (stroke-dashoffset transition) with the % and its window (last 30 days / last 12 weeks).
  - "Last done …" date.
  - Actions: Edit, Deactivate (keeps history) / Reactivate, Remove. Aria-labels include the habit name.
  - Long names are truncated with the full text in `title`. The description is clamped to 2 lines, also with `title`.
  - An inactive card's toggle is disabled.
- **Page** (`habits-page.component.ts`):
  - "Add Habit" header button.
  - **Active habits** section with an "x of n done for this period" summary and an animated progress strip.
  - **Inactive habits** section, shown only when there are inactive habits ("n paused · history kept").
  - Responsive card grid (`auto-fill, minmax(min(100%, 280px), 1fr)`). Cards scale/fade in and out via `animate.enter` / `animate.leave`, so they animate when moving between sections.
  - Other states: loading skeletons, an error state with Retry, and a "No habits yet" empty state with Add Habit.
  - Remove asks for confirmation through the shared confirm dialog, and the message suggests deactivating to keep history.
  - `?new=1` opens the create form (for the dashboard quick-add).

## Playwright checks

Run against `ng serve` at http://localhost:4200 with the real backend at :8080 (headless chromium).

| # | Check | Steps | Result |
|---|---|---|---|
| 1 | Empty state | Open `/habits` with no habits | PASS. "No habits yet" shows an Add Habit action. |
| 2 | Client validation | Add Habit → submit empty; then enter a 151-char name and a 2,001-char description | PASS. "Name is required." appears. Counter reads `151/150`. Both over-length messages show. No POST is sent. |
| 3 | Create Daily + Weekly | "Drink water" (Daily, default), then a 143-char name with Weekly selected via the segmented control | PASS. The dialog closes. Cards show Daily / Weekly chips and "Not done today/this week yet". The long name is truncated (`scrollWidth > clientWidth`) with the full text in `title`. Summary reads "0 of 2 done for this period". |
| 4 | Dialog keyboard | Open the dialog, then press Esc | PASS. Focus lands on `#habit-name`, and Esc closes the dialog. |
| 5 | Complete today | Click the Daily toggle | PASS. `aria-pressed=true`, "Done today", streak 1 day, rate 100%, green card accent. Summary reads "1 of 2". The streak bump class fired (checked with a MutationObserver). |
| 6 | Undo today | Click the toggle again | PASS. `DELETE …/completions/<today>` is sent. The card shows "Not done today yet", streak 0, 0%. |
| 7 | Duplicate prevented (409) | Complete via the API behind the UI, then click the stale toggle | PASS. Server returns 409. An info toast shows "Already done — Habit is already completed on 2026-10-03". The card stays Done, and the API still has exactly 1 completion. |
| 8 | Weekly "done this week" | `POST /completions {date: 2026-10-01}` (same ISO week), then reload | PASS. Toggle off with a "Done this week" badge and Undo. Streak 1 week, rate 100% over the last 12 weeks. Summary reads "2 of 2". |
| 9 | Weekly undo | Click Undo | PASS. Exactly `DELETE /api/habits/9/completions/2026-10-01`. The card goes back to "Not done this week yet". Clicking the toggle then records today ("Done today · this week counted"). |
| 10 | Edit | Edit "Drink water" → "Drink more water" | PASS. The form is pre-filled (name, description, Daily). The card updates. |
| 11 | Server `errors[]` | Stub one POST with a 400 problem+json response `errors:[name, frequency]` | PASS. Each message appears under its field, plus "Please fix the highlighted fields." |
| 12 | Deactivate / reactivate | Deactivate, then Reactivate | PASS. The card moves to "Inactive habits" with the toggle disabled and "Paused — reactivate to track". The active summary excludes it. Reactivate moves it back, and the Inactive section disappears. |
| 13 | Optimistic rollback | Stub `/habits/9/deactivate` → 500 | PASS. The card returns to the Active section and an error toast shows "Could not update the habit — boom". |
| 14 | Remove | Remove → Esc (cancel) → Remove → confirm (both habits) | PASS. Cancel keeps the habit. Confirm removes it with the leave animation. After both are removed, the empty state is back and the API returns `[]`. |
| 15 | Quick-add | Open `/habits?new=1` | PASS. The form opens with focus on Name, and the query param is removed. |
| 16 | Narrow + dark | 375 px wide with dark color scheme | PASS. No horizontal overflow, and cards are full width. |
| 17 | Reduced motion | Emulate `reduce` | PASS. Ring transition duration is 1e-05 s. |
| 18 | Console | Whole run | PASS. 0 app errors and 0 warnings. The only errors were the deliberate 409, the stubbed 400 and the stubbed 500 responses. |

Test data was removed through the UI, so the backend habit list is empty again.

Screenshots (`outputs/screenshots/`): `phase-3-habits-empty.png`, `phase-3-habits-validation.png`, `phase-3-habits-done.png`, `phase-3-habits-list.png`, `phase-3-habits-inactive.png`, `phase-3-habits-narrow-dark.png`.

## Notes

- `npm run api:gen` was re-run from `backend/openapi/openapi.json`. The generated `HabitsService` covers all 10 operations, and no endpoint is missing.
- `DELETE /api/habits/{id}` works thanks to the phase-2 Accept-header interceptor. The backend's 406 on `Accept: application/problem+json` for body-less operations (reported in phase 2) still applies to every DELETE.
- Observation for backend/testing (not blocking): `POST /api/habits/{id}/completions` accepted `date: 2026-10-01` for a habit created on 2026-10-03, which is earlier than the habit's creation date. The spec does not forbid this. Stats count it: rate 100%, streak 1.
- Build: `npx ng build` passes. There is one non-fatal warning: `habit-card.component.ts` styles are 4.69 kB, above the 4 kB *warning* budget (the error budget was not hit). Existing unit tests pass: 62 of 62. Phase-3 unit specs belong to [TEST] task T049.
- Checklists `phase-1-foundation.md` and `phase-2-tasks.md` have unchecked reviewer-owned items. They are not an implementation gate, and under the no-ask rule implementation went ahead.
