# Phase 5 — User Story 4: Build and run time-boxed plans (frontend-dev)

Source: `specs/001-quickflow-productivity/tasks.md` (Phase 5, [FE] tasks). Ticks mirror tasks.md.

- [x] T074 [FE] [US4] Run `npm run api:gen`; create `features/plans/plans.store.ts` (signals; polls `listPlans` every 30 s and on RefreshService bumps; computed groups active/upcoming vs completed history; client-side rest time = end − `NowService.now()` with status re-derivation at start/end boundaries)
- [x] T075 [FE] [US4] Create `core/plan-start-watcher.service.ts` (provided in root and started from the app shell so polling runs on every page; consumes plans + derived status from `plans.store.ts` (T074): when a plan is IN_PROGRESS and `startNotifiedAt` is null → toast + browser notification if permitted (Settings preferences are applied later in T088) → `acknowledgePlanStart`; highlights the plan with a pulse animation)
- [x] T076 [FE] [P] [US4] Create `features/plans/plan-builder-dialog.component.ts`: step 1 pick items (tabs Tasks / Habits / Learning with search, multi-select chips, only non-archived tasks and active habits), step 2 title, estimated duration (hours + minutes), start and end date-time, priority order; validation (≥ 1 item, end after start, duration ≥ 1 min) incl. server `errors[]`; animated step transition
- [x] T077 [FE] [US4] Create `features/plans/plans-page.component.ts` + `plan-card.component.ts`: groups "Active & upcoming" (priority then start) and "History" (final %), each card shows status chip, animated progress ring/bar, live rest-time countdown (updates every second, `aria-live="off"` with periodic sr text), estimated duration, start/end, per-item done toggles with source-type icons and "removed source" label, remove plan (confirm); long titles truncated with full text in `title` attribute; "Create Plan" button; start highlight; empty state
- [x] T078 [FE] [US4] Playwright MCP check of the Todo Plans page against the running backend (builder, countdown ticking, item toggles, notification toast); screenshots


## Pages / features

- **Store** (`features/plans/plans.store.ts`, provided in root so the watcher works on every page):
  - Signals: `plans`, `loading`, `loaded`, `error`, `pending`. Computed values: `views` (status and rest time re-derived each second from `NowService`), `active` (Not Started + In Progress, sorted by priority, then start, then id), `history` (Completed, most recently ended first) and `inProgressCount`.
  - Polls `listPlans` every 30 s after `start()`. It also reloads when another feature bumps `RefreshService`; its own bumps are skipped.
  - Pure helpers, exported for T081: `derivePlanStatus`, `toPlanView`, `withItems`, `compareActive`, `compareHistory`.
  - `create` rejects with `ApiErrorInfo`.
  - `remove` and `setItemDone` are optimistic and roll back if the request fails. `setItemDone` then uses the server's `Plan` response. Each mutation bumps `RefreshService` so tasks, habits and the dashboard see the side effects.
  - `acknowledgeStart` calls `acknowledgePlanStart`.
- **Watcher** (`core/plan-start-watcher.service.ts`, started from `ShellComponent`):
  - When a plan's client-derived status is In Progress and `startNotifiedAt` is null, it runs once per plan: it shows a toast through `NotificationService.notify` (which already respects `inAppEnabled`), raises a browser notification when one is enabled and permitted, and calls `acknowledgePlanStart`.
  - The `highlighted` set holds plans started this session that are still In Progress. Their cards pulse 3 times and show a "Just started" chip.
- **Builder** (`features/plans/plan-builder-dialog.component.ts`, a native modal `<dialog>`):
  - **Step 1, items:**
    - Tabs Tasks / Habits / Learning: an ARIA tablist with roving tabindex and arrow, Home and End keys. Each tab shows a count of selected items.
    - A search box filters the items.
    - Each item is a checkbox row. Selected items appear as chips with a remove button and animate in and out.
    - Sources: tasks with `archived=false` (open tasks first), habits with `active=true`, and all learning cards.
  - **Step 2, details:**
    - Title (required, max 200, with a counter).
    - Duration in hours + minutes (at least 1 min; shows the total).
    - Start and end (`datetime-local`). End follows start + duration until the user edits it.
    - Priority (whole number, at least 1).
  - **Validation:** Client checks cover at least 1 item, end after start, duration at least 1 minute, title, and priority. Server `errors[]` are mapped to fields; any `items*` error sends the user back to step 1.
  - **Animation:** Steps slide in from the direction of travel.
  - **Focus:** Esc or the backdrop cancels, and focus goes back to the button that opened the dialog.
- **Card** (`features/plans/plan-card.component.ts`):
  - Truncated title with the full text in `title`, a status chip, a P<n> chip, and an SVG progress ring that animates its stroke.
  - **Countdown** (In Progress only): `aria-live="off"` and updated every second. A separate sr-only `aria-live="polite"` text is coarse (5-minute steps above 10 minutes).
  - **History cards:** "Final n% · x of y done".
  - **Details:** estimated duration, and start/end in `<time datetime>` elements.
  - **Items:** each has a checkbox, a source-type icon with sr text, a strike-through animation, and a "removed source" chip when `sourceAvailable` is false.
  - A remove button.
- **Page** (`features/plans/plans-page.component.ts`):
  - "Create Plan" button.
  - "Active & upcoming" and "History" sections, each with a count.
  - Other states: skeletons, an error state with Retry, an empty state, and a "Nothing scheduled" note.
  - Cards scale in and out with `animate.enter` / `animate.leave`.
  - Remove asks for confirmation first.
  - `?new=1` opens the builder (for the dashboard quick-add).

## Playwright checks

Run against `ng serve` at http://localhost:4200 with the real backend at :8080 (headless chromium). Seed data was created with curl: task 57 "Write plan report", habit 28 "Stretch 10 minutes", card 15 "RxJS interop course".

| # | Check | Steps | Result |
|---|---|---|---|
| 1 | Empty state | Open `/plans` with no plans | PASS. "No plans yet" shows a Create Plan action. |
| 2 | Builder step 1 | Create Plan → Next with nothing selected; search "plan report"; pick the task, a habit (Habits tab) and a card (Learning tab) | PASS. Focus starts in the search box. "Select at least one item." appears. Search filters the list to 1 match. Chips and tab counts update. |
| 3 | Client validation | Step 2: empty title, 0 h 0 m, end = start, priority 0 | PASS. All 4 messages show and no POST is sent. Focus moves to Title when step 2 opens. |
| 4 | Create (in progress) | Title "Evening focus block", 1 h 30 m, start now−2 min, end now+90 min, P2 | PASS. The POST body is correct (ISO UTC times, 3 items). The dialog closes with a "Plan created" toast. Then the toast "Plan started: Evening focus block · 3 items · 1h 29m 33s left" appears and `POST /plans/7/start-notification` is sent. |
| 5 | Grouping / order / truncation | Seed via curl: an upcoming P1 plan with a 120-char title (tomorrow) and a past plan; reload | PASS. Active order is P1 (tomorrow), then P2. History holds "Yesterday review" with "Final 0%". The long title is truncated with the full text in `title`. The Not Started plan shows no rest time. Reloading does **not** notify again. |
| 6 | Countdown ticking | Read `data-rest-seconds` twice, 3.1 s apart | PASS. It dropped by 3 s ("1h 29m 14s" then "1h 29m 11s"). Visible text has `aria-live="off"`. The sr text reads "About 1h 30m left". |
| 7 | Item toggles + side effects | Tick the task item, then the habit item, then the learning item; untick the task | PASS. Results in order: 33% with strike-through and task 57 = `DONE` in the API; habit 28 `completedToday=true`; the plan moves to History as Completed; unticking returns it to In Progress while the task stays `DONE` (FR-024). |
| 8 | Start notification on another page + highlight | Create an in-progress plan through the API, then open `/tasks` | PASS. The toast "Plan started: Curl started plan" shows on the Tasks page. After going to Todo Plans, the card has `is-highlighted` (`qf-pulse` ×3) and a "Just started" chip. `startNotifiedAt` is set on the server. |
| 9 | Remove | Remove → Esc (cancel) → Remove → confirm | PASS. The confirm message names the plan and its item count. Cancel keeps the plan. Confirm removes it with the leave animation, and the API returns 404. |
| 10 | Removed source | Plan with a temporary task, then delete the task through the API and reload | PASS. The item shows the "removed source" chip. |
| 11 | Server `errors[]` | Stub POST with 400 `errors:[endDateTime, title]`, then with `errors:[items]` | PASS. Each message appears under its field, plus "Please fix the highlighted fields.". The `items` error goes back to step 1 and shows there. |
| 12 | Keyboard tabs | Focus the Tasks tab, then ArrowRight ×2 | PASS. Learning is selected and focused (`plan-tab-2`). Esc closes the dialog. |
| 13 | Narrow + dark | 375 px wide, dark scheme, page and builder | PASS. No horizontal overflow on the page or in the dialog. |
| 14 | Console | Whole phase-5 run | PASS. 0 app errors and 0 warnings. The only 2 errors were the stubbed 400 responses. |

Screenshots (`outputs/screenshots/`): `phase-5-plans-empty.png`, `phase-5-plans-builder-step1.png`, `phase-5-plans-builder-validation.png`, `phase-5-plans-list.png`, `phase-5-plans-start-toast.png`, `phase-5-plans-after-toggles.png`, `phase-5-plans-narrow-dark.png`.

Data left in the backend for loop-3:
- Plans 7 (Completed, then In Progress after the untick), 8 (upcoming P1) and 9 (history).
- Seeded task 57 (now DONE), habit 28 and card 15.
- Plan 10 and the temporary task were removed.

## Notes

- I re-ran `npm run api:gen` from `backend/openapi/openapi.json`. The generated `PlansService` covers all 6 operations, and no endpoint is missing.
- The watcher is started in `ShellComponent`, so `PlansService` now needs `HttpClient` there. I added `provideHttpClient()` + `provideHttpClientTesting()` to the providers of the existing `app.spec.ts` and `layout/shell.component.spec.ts`. These are test setup changes only; no assertions changed.
- Build: `npx ng build` passes. There are 2 style budget warnings (over 4 kB, under the 8 kB error limit): the existing one for `habit-card` (4.69 kB) and the new one for `plan-builder-dialog` (4.52 kB). Unit tests pass: 126 of 126. Phase-5 specs belong to [TEST] task T081.
- The client re-derives status from the browser clock. If the browser and server clocks differ, the status can be off by that difference until the next poll or acknowledge call.
- Browser notifications only show when `NotificationService.browserEnabled` is on, which is off by default. Settings will turn it on in T088.
