# Phase 8 — frontend-dev (Polish & Cross-Cutting Concerns)

Mirrors the [FE] tasks of Phase 8 in `specs/001-quickflow-productivity/tasks.md`.

- [x] T103 [FE] Animation audit across all pages: route view transitions, list enter/leave, dialog open/close, toggle feedback, progress and countdown animations, all ≤ 250 ms and disabled under `prefers-reduced-motion: reduce`; consistent spacing/typography; responsive at 375 px and 1440 px widths; verify truncation with 200-char titles and 5,000-char notes
- [x] T104 [FE] Accessibility pass: labels, focus order, focus return after dialogs, `aria-live` for toasts and validation, contrast ≥ 4.5:1 in light and dark themes (verify every text/background token pair in `tokens.scss`); fix findings on every page

## Pages / features

- All six pages (`/dashboard`, `/tasks`, `/habits`, `/learning`, `/plans`, `/settings`) plus every dialog (task/habit/learning/plan create+edit, confirm) audited.
- Animation fixes: loading spinners (`spin 0.8s` in 8 components) and the plan-card highlight pulse (`qf-pulse 1.2s`) moved to `var(--duration-slow)` (250 ms), so every computed animation/transition duration is ≤ 250 ms. All other motion already used the motion tokens (80–250 ms); FLIP reorder 220 ms and count-up skip under reduced motion; `styles/motion.scss` zeroes animations/transitions/view transitions under `prefers-reduced-motion: reduce`.
- Accessibility fix: `layout/shell.component.ts` adds a visually hidden `aria-live="polite"` region that announces "<Page> page" after each in-app navigation (initial load not announced).
- Contrast: every text/background token pair in `styles/tokens.scss` computed (text, text-muted, primary, primary-hover, accent, success, warning, danger, info on bg/bg-elevated/surface/surface-2/surface-hover, plus on-primary/primary, text-inverse/danger and each status on its `-soft` background) — all ≥ 4.5:1 in light and dark (lowest: light info on info-soft 4.79). No token changes needed.

## Playwright checks

Run against the real backend (http://localhost:8080) on 2026-10-04 with seeded 200-char task/learning-card titles, a 150-char habit name and a 5,000-char learning note.

1. Page audit (`browser_run_code`, script `.playwright-mcp/p8-audit.js`): 6 pages × light/dark × 1440/375 px — rendered text contrast ≥ 4.5:1 (alpha/opacity blended), every control has an accessible name, max computed animation/transition ≤ 250 ms, no horizontal overflow, one `main` landmark and one `h1` per page. Result: NO ISSUES. PASS
2. Dialogs (`p8-dialogs.js`): Add Task / Add Habit / Add Learning Card / Create Plan opened by keyboard (Enter) in both themes at both widths — dialog labelled, focus moves inside, no unnamed controls, no overflow; empty submit shows `role="alert"` message and `aria-invalid` + `aria-describedby` on the field (plan builder: "Select at least one item."); Esc closes and focus returns to the opener. PASS
3. Dialog contents audit (`p8-extra.js`): task create, task edit, delete confirm, plan builder, dashboard quick-add, expanded learning card with 5,000-char note — contrast, names, durations, overflow all clean in light/dark at 1440/375. PASS
4. Focus return from row-level openers (Edit task, Delete task, Edit habit, Edit learning card, Remove plan, dashboard quick-add Task): focus returns to the same button after Esc. PASS
5. Reduced motion emulated: max computed animation/transition duration on the dashboard 0.01 ms. PASS
6. Keyboard order from page load: Skip to main content → brand → 6 nav links → page actions, visible focus outline on each. PASS
7. Route announcer: navigating Dashboard → Habits sets the live region to "Habits page"; empty on initial load. PASS
8. Truncation: 200-char task title truncated with ellipsis (`title` attribute keeps full text); long learning title truncated, 5,000-char note wraps without overflow at 375 px. Screenshots: `screenshots/phase-8-tasks-light-1440.png`, `phase-8-tasks-dark-375.png`, `phase-8-learning-long-notes-dark-375.png`, `phase-8-dashboard-dark-375.png`. PASS
9. Console: 0 errors during the phase 8 checks. PASS

## Notes

- Client regenerated (`npm run api:gen`); `npx ng build` passes (existing style-budget warnings on habit-card / plan-builder-dialog only); `npx ng test --watch=false` 218/218 pass.
- Test data left in DB: task 1096, learning card 23 (with a 5,000-char note) and habit 43, all titled with repeated "P8FE".
- Audit scripts are reusable by loop-3 for T105: `.playwright-mcp/p8-audit.js`, `p8-dialogs.js`, `p8-extra.js`.

### Fix trial 1 (2026-10-04)
- BUG-P8-001 (T106, SC-009): tasks list renders bulk updates (search/filter, first load) without per-row enter/leave animations; only small changes (≤ 20 rows) animate. FLIP batches reads before writes and only runs for small changes near the viewport. Date formatters are cached. Emptying the search box applies at once. With 1,013 tasks every search/filter update takes 70–345 ms (was 3.5–37 s), with normal and reduced motion.
- BUG-P8-002 (T105, FR-034): new `core/focus-restorer.ts` keeps keyboard focus on the used control after in-place actions. If the control is gone, focus goes to its re-created copy, then the next row's matching control, then `<main>`. Keyboard walkthrough `p8-keyboard-actions.js`: 31/31 PASS, and focus is never left on `<body>`.
- Build ok; 218/218 unit tests; no console errors.
