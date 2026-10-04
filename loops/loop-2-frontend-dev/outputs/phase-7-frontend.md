# Phase 7 — frontend-dev (US5 See everything on a dashboard)

Mirrors the [FE] tasks of Phase 7 in `specs/001-quickflow-productivity/tasks.md`.

- [x] T095 [FE] [US5] Run `npm run api:gen`; create `features/dashboard/dashboard.store.ts` (loads `getDashboard`; reloads on RefreshService bumps and every 60 s; rest time from NowService)
- [x] T096 [FE] [US5] Create `features/dashboard/dashboard-page.component.ts` with sub-components: greeting header (time-of-day greeting + displayName, today's date), summary metric cards (tasks %, habits done for current period / active (count of `today[]` with `doneForCurrentPeriod`), plans in progress, learning milestones) with count-up animation, today's tasks list (complete in place), overdue list, today's habit checklist (toggle in place, same `completedToday` / weekly "done this week" rules as T045), active plans with live rest time + animated progress, learning snapshot, quick-add actions opening the Task/Habit/Learning/Plan create dialogs; skeleton loading states; staggered entrance animation
- [x] T097 [FE] [US5] Playwright MCP check of the Dashboard against the running backend (metrics update after toggles on the dashboard and on other pages); screenshots

## Pages / features

- `/dashboard` — `features/dashboard/dashboard-page.component.ts` with `DashboardStore` (`dashboard.store.ts`, generated `DashboardService.getDashboard`; reloads on `RefreshService` bumps, every 60 s, and when the app-wide plans store sees a plan start/end; live rest time from `NowService`).
- Sub-components: `dashboard-greeting` (time-of-day greeting + display name + date), `metric-card` + `count-up` (tasks %, habits done for current period / active, plans in progress, learning milestones), `dashboard-task-list` (due today + overdue, complete in place), `dashboard-habits` (toggle bound to `completedToday`, weekly "Done this week" + Undo), `dashboard-plans` (live countdown, animated progress, item toggles), `dashboard-learning` (snapshot), `quick-add` (Task / Habit / Learning card / Plan create dialogs).
- Skeleton loading state, error state with Retry, staggered entrance animation (`--i` delay).

## Playwright checks

Run against the real backend (http://localhost:8080) on 2026-10-04.

1. Seeded a task due today via `POST /api/tasks`; loaded `/dashboard` — greeting "Good night, Friend", date, 4 metric cards, Due today (1), Overdue (3), 3 habits, 1 plan with live countdown, learning snapshot. Numbers matched `GET /api/dashboard`. Screenshot `screenshots/phase-7-dashboard.png`. PASS
2. Completed "P7FE Due today task" in place → Due today 0, Tasks card 50% → 63% (5 of 8, 1 completed today). PASS
3. Toggled habit "P5E2E Read 10 pages" in place → habits 1 / 3 (card + badge). PASS
4. Ticked plan item "P5E2E temp task" → progress 0% → 50%, "1 of 2 done". PASS
5. Compared UI with `GET /api/dashboard`: percent 63, done 5/8, completed today 1, habits done 1, plan items done 1 — all match. PASS
6. Other page: on `/habits` marked "Stretch 10 minutes" done, navigated back to Dashboard → habits 2 / 3. PASS
7. Quick-add Task: dialog opened, created "P7FE quick-add task" due today → dialog closed, Due today 1, Tasks card 5 of 9 (56%). Screenshot `screenshots/phase-7-dashboard-after-toggles.png`. PASS
8. Quick-add Habit / Learning card / Plan: each opens its create dialog ("Add habit", "Add learning card", "Create plan") and closes on Cancel. PASS
9. Console: 0 errors during the dashboard checks. PASS

## Notes

- Client regenerated (`npm run api:gen`) from `backend/openapi/openapi.json`; `npx ng build` passes (only existing style-budget warnings on habit-card / plan-builder-dialog); `npx ng test --watch=false` 186/186 pass.
- Test data left in DB: tasks "P7FE Due today task" (DONE), "P7FE quick-add task"; habits "P5E2E Read 10 pages" and "Stretch 10 minutes" completed today; plan 20 item "P5E2E temp task" done.
