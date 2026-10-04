# Phase 2 — User Story 1: Manage tasks (frontend-dev)

Source: `specs/001-quickflow-productivity/tasks.md` (Phase 2, [FE] tasks). Ticks mirror tasks.md.

- [x] T027 [FE] [US1] Run `npm run api:gen`; create `frontend/src/app/features/tasks/tasks.store.ts` (signals: tasks, filters, loading, error; actions call generated `TasksService`; bumps `RefreshService` after mutations; optimistic update with rollback on error)
- [x] T028 [FE] [P] [US1] Create `features/tasks/task-form-dialog.component.ts` (title required ≤ 200 with live counter, description ≤ 2,000, status, priority, due date; client validation + server `errors[]` shown per field; create and edit modes)
- [x] T029 [FE] [P] [US1] Create `features/tasks/task-toolbar.component.ts` (search box debounced 200 ms, status filter, priority filter, due from/to, overdue toggle, show archived toggle, sort field + direction)
- [x] T030 [FE] [US1] Create `features/tasks/tasks-page.component.ts` + `task-item.component.ts`: list with animated enter/leave and reorder, status/priority chips, overdue badge, actions complete (check animation), edit, archive/restore, delete (confirm dialog); long titles truncated with full text in `title` attribute; "Add Task" button; empty state guiding to Add Task; filtered-empty state
- [x] T031 [FE] [US1] Playwright MCP check of the Tasks page against the running backend (create, edit, complete, archive/restore, delete, search/filter/sort, validation messages); save screenshots

## Pages / features

- **Store** (`features/tasks/tasks.store.ts`, provided by the page): `tasks`, `filters`, `loading`, `loaded`, `error`, `pending` (per-task in-flight ids) signals. Changing filters reloads the list through the generated `TasksService.listTasks` (stale responses are dropped, and a filter update that changes nothing is skipped). `create`/`update` reject with `ApiErrorInfo` so the form can show field errors. `complete`, `setStatus` (reopen = full `updateTask`), `archive`, `restore` and `remove` update the list optimistically. On failure they roll back only that task and show an error toast. Every successful mutation bumps `RefreshService` and re-fetches the list.
- **Form dialog** (`task-form-dialog.component.ts`): a native modal `<dialog>` used for both create and edit (edit fills in the task's values). Esc, the Close button and a backdrop click cancel, and focus goes back to the opener. Title shows a live `n/200` counter that turns red past the limit, and "required" is checked on blur or submit. Over-length title and description (> 2,000) errors show while typing. Server `errors[]` from problem+json are shown under their field. Unknown fields or a general error appear in an alert above the form. Focus moves to the first invalid field.
- **Toolbar** (`task-toolbar.component.ts`): a `role=search` region with a search box (200 ms debounce; Esc clears it), Status and Priority selects, Due from/to date inputs (min/max linked), Sort by (Created date / Due date) and Order (Desc / Asc), plus "Overdue only" and "Show archived" toggle chips. "Clear filters" appears when a narrowing filter is set. It keeps the archived view and the sort.
- **Page + item** (`tasks-page.component.ts`, `task-item.component.ts`): the "Add Task" header button, and a list (`role=list`/`listitem`) with `animate.enter`/`animate.leave` and a FLIP reorder animation (WAAPI, skipped under reduced motion). Each row has a round completion toggle that plays a pop animation and also reopens a Done task. It shows status and priority chips, an "Overdue" badge with a red due date, plus Archived, Completed-at, and Updated (with Created in a tooltip). Rows offer Edit, Archive/Restore and Delete (confirm dialog), with aria-labels that include the task title. Long titles are truncated and the full text is in the `title` attribute. The description is clamped to 2 lines. Other states: loading skeletons, an error state with Retry, a "No tasks yet" empty state with an Add Task action, a "No matching tasks" filtered-empty state with Clear filters, and "No archived tasks". `?new=1` opens the create form, ready for the dashboard quick-add.
- **Accept header interceptor** (`core/accept-header.interceptor.ts`, registered in `app.config.ts`): see Notes.

## Playwright checks

Run against `ng serve` at http://localhost:4200 with the real backend at :8080 (headless chromium).

| # | Check | Steps | Result |
|---|---|---|---|
| 1 | Empty state | Open `/tasks` with no tasks | PASS. Page shows "No tasks yet" with an Add Task button, a "0 tasks" count, and a labelled search region with every filter control. |
| 2 | Client validation | Add Task → submit empty; then type a 201-char title and a 2,001-char description and submit | PASS. "Title is required." appears. Counter reads `201/200` in red. Both over-length messages are shown with `aria-invalid` and `aria-describedby` linking the error. No POST is sent. |
| 3 | Server `errors[]` mapping | Stub one POST with a 400 problem+json response `errors:[title,dueDate]` | PASS. Each message appears under its field, and "Please fix the highlighted fields." appears in the form alert. |
| 4 | Create | Title, description, High priority, due 2026-10-01 | PASS. Dialog closes and a "Task added" toast appears. The row shows Todo, High priority, an Overdue badge and the due date. |
| 5 | Long title | Create a 186-char title | PASS. It is truncated (`scrollWidth > clientWidth`) and the full text is in `title`. |
| 6 | Edit | Edit "Buy groceries" to "Buy groceries and milk" with status In Progress; also clear a description | PASS. Form opens pre-filled. The row updates and its Updated time changes. A cleared description is saved as null. |
| 7 | Complete / reopen | Click the toggle, then click it again | PASS. Status becomes Done with "Completed …" and the overdue badge goes away. Reopening sets Todo and clears completedAt (checked with `GET /api/tasks`). |
| 8 | Optimistic + rollback | Stub `/complete` to return 500 (one slow, one fast) | PASS. While the request is pending the row shows Done with `aria-busy` and disabled actions. After the error it rolls back to Todo and an error toast shows "boom". |
| 9 | Search (debounced) | Type "GROC" one key every 40 ms | PASS. Exactly one request with `q=GROC` is sent, and the case-insensitive match shows "Buy groceries and milk". |
| 10 | Filters | Status = In Progress, Priority = High, Overdue only, Due from 2026-11-01 | PASS. Each filter shows only the matching task, using the right query params. |
| 11 | Sort | Due date Asc / Desc, Created date Desc | PASS. Asc order is Oct 1, Dec 1, then the task with no date. Desc order is Dec 1, Oct 1, no date (undated tasks always last). |
| 12 | Filtered empty | Search "nomatchxyz" → Clear filters | PASS. "No matching tasks" is shown. Clear filters restores all 3 tasks and empties the search box. |
| 13 | Archive / restore | Archive a task → Show archived → Restore → back | PASS. The task leaves the default list and appears under "Archived tasks · 1 archived task". After Restore, the archived view is empty and the task is back in the default list. |
| 14 | Delete | Delete → Esc (cancel) → Delete → confirm | PASS. Cancel keeps the task. Confirm removes it and shows a "Task deleted" toast. It failed before the interceptor fix (see Notes). |
| 15 | Quick-add + keyboard | Open `/tasks?new=1`, then press Esc | PASS. Form opens with focus on Title, and the query param is removed. Esc closes the form. |
| 16 | Narrow + dark | 375 px wide with dark color scheme | PASS. No horizontal overflow, and action buttons wrap below the content. |
| 17 | Reduced motion | Emulate `reduce` | PASS. Row animation and transition durations are 1e-05 s. |
| 18 | Console | Whole run | PASS. 0 errors and 0 warnings from app code. The only errors were the intentionally stubbed 400/500 responses. |

Test data created during the checks was deleted through the UI, so the backend task list is empty again.

Screenshots (`outputs/screenshots/`): `phase-2-tasks-empty.png`, `phase-2-tasks-validation.png`, `phase-2-tasks-list.png`, `phase-2-tasks-filtered-empty.png`, `phase-2-tasks-archived.png`, `phase-2-tasks-narrow-dark.png`.

## Notes

- **Backend defect (for backend-dev / testing):** `DELETE /api/tasks/{id}` sent with `Accept: application/problem+json` returns **406 Not Acceptable**, and that response has no CORS headers, so the browser reports a CORS error. The generated `deleteTask` sends exactly this header, because the 204 response has no content type and only the 400/404 problem+json responses are declared. `Accept: application/json`, `*/*`, or `application/json, application/problem+json` all return 204. Frontend workaround: `core/accept-header.interceptor.ts` widens an Accept of exactly `application/problem+json` to `application/json, application/problem+json`. It goes through the generated client, with no hand-written HTTP. The backend should still accept `application/problem+json` on body-less operations, because every future DELETE endpoint will hit the same problem.
- "Show archived" follows the API's semantics: `archived=true` returns only archived tasks, so the toggle switches to an archived-only view.
- Default sort is Created date, descending (sent explicitly).
- Build: `npx ng build` passes. Existing unit tests: 31 of 31 pass (`npx ng test --watch=false`). The phase-2 unit specs belong to the [TEST] task T034.
- `checklists/phase-1-foundation.md` has 19 unchecked items. It is a reviewer-owned requirements-quality checklist for phase 1, not an implementation gate. Under the no-ask rule, implementation went ahead.
