# Research: QuickFlow Personal Productivity Workspace

All Technical Context items are fixed by `tech-stack.yaml`; no NEEDS CLARIFICATION remained.
This file records the design decisions taken inside that stack.

## R1 — Project layout
- **Decision**: Web application: `backend/` (Spring Boot, Maven wrapper) + `frontend/` (Angular workspace).
- **Rationale**: Matches constitution (backend :8080, frontend :4200) and loop ownership ([BE]/[FE]).
- **Alternatives**: Single Spring app serving the Angular build — rejected: couples loops and slows the FE dev loop.

## R2 — API style and errors
- **Decision**: REST/JSON under `/api`, OpenAPI 3.1 contract in `contracts/openapi.yaml`; errors as RFC 9457 `application/problem+json` via Spring `ProblemDetail` (400 validation with `errors[]` field list, 404 not found, 409 conflict).
- **Rationale**: Constitution II; springdoc renders it; typescript-angular generator consumes it.
- **Alternatives**: GraphQL — rejected (not in stack, generator target is REST).

## R3 — Time handling
- **Decision**: Plan start/end and all timestamps are `OffsetDateTime` (ISO-8601 with offset) in the API; task due date and habit completion date are `LocalDate`. "Today" = server local date from an injectable `java.time.Clock` bean (`Clock.systemDefaultZone()`); tests use `Clock.fixed`. Frontend sends date-times with the browser's offset.
- **Rationale**: Single user on one machine → server zone = user zone; injectable clock makes status/rest-time/overdue rules unit-testable (constitution V).
- **Alternatives**: Client-supplied "today" on every request — rejected (more surface, harder to test).

## R4 — Plan status
- **Decision**: Plan status is **derived, not stored**: computed by a pure domain function `PlanStatusCalculator.status(start, end, items, now)` on every read: Completed if all items done or now ≥ end; else In Progress if now ≥ start; else Not Started. `restSeconds` = max(0, end − now) only when In Progress, else null. `progressPercent` = round(done × 100 / total).
- **Rationale**: Guarantees FR-021 / SC-005 consistency after restart; no scheduler needed.
- **Alternatives**: Scheduled job updating a status column — rejected (drift, extra moving parts).

## R5 — Start notification
- **Decision**: Plan has `startNotifiedAt` (nullable). The frontend polls `GET /api/plans` every 30 s and runs a 1 s ticker; when a plan is In Progress and `startNotifiedAt` is null it shows an in-app toast (and a browser notification if enabled and permitted), highlights the plan, then calls `POST /api/plans/{id}/start-notification` which sets `startNotifiedAt`. Plans already Completed are never notified.
- **Rationale**: Satisfies "notify once, also when the app was closed at start" (US4-6) with persisted state and no push infrastructure.
- **Alternatives**: Server-sent events / WebSocket — rejected (YAGNI for single user).

## R6 — Plan item ↔ source completion (Business Rule 13)
- **Decision**: `PlanItem` stores `sourceType`, `sourceId`, `sourceTitle` (snapshot at creation) and `done`. On item done=true: Task → set status Done (+completedAt); Habit → create today's completion if missing; LearningResource → nothing. Undo never reverts source. Deleting a source keeps the item with `sourceAvailable=false`.
- **Rationale**: Exactly what FR-024 / spec edge cases require; logic lives in one service (`PlanItemCompletionService`).

## R7 — Deletion
- **Decision**: Hard delete for tasks, habits (+completions cascade), learning cards (+milestones, notes cascade), plans (+items cascade). Plan items referencing a deleted source are kept (no FK on `sourceId`).
- **Rationale**: Simplest way to satisfy "deleted resources are never returned"; archive covers reversible task hiding.

## R8 — Habit metrics
- **Decision**: Period = date (Daily) or ISO week Monday–Sunday (Weekly). `doneForCurrentPeriod`, `completedToday`, `currentStreak` (consecutive done periods ending at the current period, or the previous one if the current is not yet done), `completionRate` = done periods ÷ periods in window (30 days / 12 weeks, window starts no earlier than creation date). Computed in a pure `HabitStatsCalculator`.
- **Duplicate prevention**: unique constraint (habit_id, completion_date) + service check → 409.

## R9 — Learning card status
- **Decision**: Recomputed from milestones whenever a milestone is added/toggled/removed (none done → NOT_STARTED, some → IN_PROGRESS, all → COMPLETED; no milestones → unchanged). Manual status change via `PUT /api/learning-cards/{id}` is allowed and persists until the next milestone change.

## R10 — Dashboard
- **Decision**: One endpoint `GET /api/dashboard` computed server-side by `DashboardService` from repositories + calculators (testable against seeded data, SC-004). Frontend re-fetches after any mutation (shared refresh signal) and every 60 s; rest time ticks client-side every second from `endDateTime`.
- **Task completion %**: Done ÷ non-archived tasks (0 when none).

## R11 — Persistence
- **Decision**: Spring Data JPA + H2 per tech-stack profiles: default `jdbc:h2:file:./data/quickflow`, `test` `jdbc:h2:file:./data/test` (tests clean tables before each test), `openapi` `jdbc:h2:mem:openapi`. `ddl-auto=update` (default), `create-drop` (test/openapi). Settings is a single row (id=1) created on first read.

## R12 — Swagger generation
- **Decision**: springdoc-openapi-starter-webmvc-ui 3.1.1 serves `/v3/api-docs` and `/swagger-ui/index.html`. Maven profile `openapi` starts the app (Spring profile `openapi`, port 8081) and runs springdoc-openapi-maven-plugin to write `backend/openapi/openapi.json`. Controllers annotated so the output matches `contracts/openapi.yaml` (paths, methods, schemas, status codes).

## R13 — Frontend architecture
- **Decision**: Angular 22.2.0 standalone components, signals, zoneless (`provideZonelessChangeDetection`). Lazy-loaded routes: `/dashboard`, `/tasks`, `/habits`, `/learning`, `/plans`, `/settings`; default route from Settings `defaultView`. Per-feature signal stores wrap the **generated** `typescript-angular` services (`src/app/api/`, never edited). A `NowService` exposes a 1 s `now` signal used by rest-time displays; a `NotificationService` handles toasts + browser notifications; a `RefreshService` signal triggers dashboard/plan reloads after mutations.
- **Animations**: Angular native `animate.enter` / `animate.leave` with CSS keyframes (list item enter/leave, card expand, toasts), CSS view transitions for route changes, animated progress bars and toggle feedback; all wrapped in `@media (prefers-reduced-motion: reduce)` to disable motion. Durations ≤ 250 ms so they never block input.
- **Styling**: Hand-written SCSS design tokens (color, spacing, radius, elevation), light/dark via `prefers-color-scheme`, contrast ≥ 4.5:1 (WCAG 2.1 AA).
- **Alternatives**: Angular Material — rejected to keep dependencies minimal and the look custom; `@angular/animations` package — rejected (deprecated in favour of native `animate.enter/leave`).

## R14 — Testing
- **Backend unit/slice tests**: JUnit 5 via spring-boot-starter-test; `@WebMvcTest` + `MockMvcTester` + `@MockitoBean` for controllers; `@DataJpaTest` for repositories; plain unit tests for calculators with fixed `Clock`. JaCoCo report on `verify` (`backend/target/site/jacoco/`).
- **Frontend unit tests**: Angular CLI unit-test builder (Vitest in Angular 22) — `npx ng test --watch=false --coverage`. Packages the Angular CLI 22.2.0 itself requires for this (e.g. its coverage provider, versions chosen by the CLI) are part of the pinned Angular toolchain; no other test libraries are added.
- **API tests**: curl per endpoint. **UI tests**: Playwright MCP (headless chromium). **Accessibility** (SC-010): Playwright MCP accessibility snapshot (names, roles, landmarks), `browser_evaluate` contrast computation on rendered text, reduced-motion emulation and keyboard-only walkthroughs. No extra a11y library — tech-stack.yaml is the only source of technologies (constitution I).
