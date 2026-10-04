---

description: "Task list for QuickFlow Personal Productivity Workspace"
---

# Tasks: QuickFlow Personal Productivity Workspace

**Input**: Design documents from `/specs/001-quickflow-productivity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Requested by the PRD (§11 Testing Requirements) and the constitution (IV) — every phase has [TEST] tasks.

**Organization**: One phase per user story (dependency order), each delivered backend → frontend → testing.

## Format: `[ID] [Owner] [P?] [Story] Description`

- **[Owner]**: `[BE]` backend-dev (code in `backend/`), `[FE]` frontend-dev (code in `frontend/`), `[TEST]` testing (unit tests + coverage, curl, Playwright MCP, end-to-end)
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US6)
- Backend package root: `backend/src/main/java/com/quickflow/`; tests: `backend/src/test/java/com/quickflow/`; frontend app root: `frontend/src/app/`

---

## Phase 1: Setup & Foundation (Shared Infrastructure)

**Purpose**: Both projects created, running, contract tooling in place, app shell with persistent navigation. Blocks all user stories.

**Independent Test**: Backend serves `/v3/api-docs` and Swagger UI; frontend at http://localhost:4200 shows the shell with six navigation links.

- [x] T001 [BE] Generate the backend from start.spring.io into `backend/` (type maven-project, bootVersion 4.1.1, javaVersion 25, groupId `com.quickflow`, artifactId `quickflow`, name QuickFlow, dependencies web, data-jpa, h2, validation) with the Maven wrapper (`backend/mvnw`)
- [x] T002 [BE] Edit `backend/pom.xml`: add `springdoc-openapi-starter-webmvc-ui` 3.1.1, `spring-boot-starter-webmvc-test` and `spring-boot-starter-data-jpa-test` (test scope), `jacoco-maven-plugin` (latest release supporting Java 25, version pinned, `prepare-agent` + `report` on `verify`), `springdoc-openapi-maven-plugin` (latest release, version pinned) and a Maven profile `openapi` that runs `spring-boot-maven-plugin` `start` (Spring profile `openapi`) / `stop` around `springdoc-openapi-maven-plugin:generate` with `apiDocsUrl=http://localhost:8081/v3/api-docs`, `outputDir=${project.basedir}/openapi`, `outputFileName=openapi.json`
- [x] T003 [BE] [P] Create H2 profile files: `backend/src/main/resources/application.yaml` (default: `jdbc:h2:file:./data/quickflow`, `ddl-auto: update`, port 8080, `spring.jackson` ISO dates), `application-test.yaml` (`jdbc:h2:file:./data/test`, `ddl-auto: create-drop`), `application-openapi.yaml` (`jdbc:h2:mem:openapi`, `ddl-auto: create-drop`, `server.port: 8081`); add `backend/src/test/resources/application.properties` with `spring.profiles.active=test` (a different file name so it does not shadow main `application.yaml`); add `data/` and `target/` to `backend/.gitignore`
- [x] T004 [BE] [P] Create `config/ClockConfig.java` exposing a `java.time.Clock` bean (`Clock.systemDefaultZone()`) — every time-dependent rule injects this clock (research R3)
- [x] T005 [BE] [P] Create `config/CorsConfig.java` allowing origin `http://localhost:4200`, methods GET/POST/PUT/DELETE/OPTIONS, all headers, on `/api/**`
- [x] T006 [BE] [P] Create `config/OpenApiConfig.java` (title "QuickFlow API", version 1.0.0, server http://localhost:8080) matching `info` in `specs/001-quickflow-productivity/contracts/openapi.yaml`
- [x] T007 [BE] Create `common/NotFoundException.java`, `common/ConflictException.java`, `common/BadRequestException.java` (carries `field` and `message`), `common/FieldErrorDto.java` (`@Schema(name = "FieldError")`, `field` and `message` marked `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)`), `common/Problem.java` (documentation-only schema `@Schema(name = "Problem")` with type/title/status/detail/instance/`errors: FieldError[]`, used as `@ApiResponse` content for 400/404/409) and `common/ApiExceptionHandler.java` (`@RestControllerAdvice`, returns `ProblemDetail` as `application/problem+json`: `MethodArgumentNotValidException`, `ConstraintViolationException`, `HttpMessageNotReadableException`, `MethodArgumentTypeMismatchException`, `IllegalArgumentException` → 400 with property `errors: [{field, message}]`; `BadRequestException` → 400 with `errors: [{field: <its field>, message}]`; `NotFoundException` → 404; `ConflictException` → 409); set `springdoc.override-with-generic-response: false` in `application.yaml` so swagger responses come only from `@ApiResponse` annotations
- [x] T008 [BE] Verify `cd backend && ./mvnw verify` passes, `./mvnw -Popenapi verify -DskipTests` writes `backend/openapi/openapi.json`, and the running backend answers `GET http://localhost:8080/v3/api-docs` and `/swagger-ui/index.html`
- [x] T009 [FE] Generate the Angular 22.2.0 workspace in `frontend/` (`npx -y @angular/cli@22.2.0 new quickflow --directory frontend --zoneless --routing --style=scss --ssr=false --skip-git`); confirm `node -v` is 24.x ≥ 24.15; confirm the unit-test builder's coverage provider is installed with the workspace — packages the Angular CLI 22.2.0 itself requires (versions chosen by the CLI) count as part of the pinned Angular toolchain (research R14); never add other libraries
- [x] T010 [FE] Add `@openapitools/openapi-generator-cli` 2.41.0 as devDependency, `frontend/openapitools.json`, and script `"api:gen": "openapi-generator-cli generate -i ../backend/openapi/openapi.json -g typescript-angular -o src/app/api --additional-properties=ngVersion=22.2.0,providedIn=root,supportsES6=true"` in `frontend/package.json`; run it to create `frontend/src/app/api/` (generated, never edited)
- [x] T011 [FE] [P] Create `frontend/src/environments/environment.ts` / `environment.development.ts` (`apiUrl: 'http://localhost:8080'`) and `frontend/src/app/app.config.ts` with `provideZonelessChangeDetection()`, `provideRouter(routes, withViewTransitions(), withComponentInputBinding())`, `provideHttpClient(withFetch())`, `{provide: BASE_PATH, useValue: environment.apiUrl}`
- [x] T012 [FE] [P] Create the design system in `frontend/src/styles/`: `tokens.scss` (color tokens for light and dark via `prefers-color-scheme`, text contrast ≥ 4.5:1, spacing, radius, elevation, typography), `motion.scss` (durations ≤ 250 ms, easing tokens, keyframes fade/slide/scale/pop, `@media (prefers-reduced-motion: reduce)` disables animations and transitions), `base.scss` (reset, focus-visible ring, form controls, `.truncate` / line-clamp utilities); import them in `frontend/src/styles.scss`
- [x] T013 [FE] Create `frontend/src/app/layout/shell.component.ts` (persistent navigation: Dashboard, Tasks, Habits, Learning Resources, Todo Plans, Settings with icons, `routerLinkActive` highlight + `aria-current="page"`, skip-to-content link, sidebar on wide screens / top bar on narrow screens, animated active indicator) and lazy routes `/dashboard`, `/tasks`, `/habits`, `/learning`, `/plans`, `/settings` (placeholder page components under `frontend/src/app/features/*/`) in `frontend/src/app/app.routes.ts`, `''` → `/dashboard`
- [x] T014 [FE] [P] Create shared UI in `frontend/src/app/shared/ui/`: `empty-state.component.ts` (icon, message, primary action), `confirm-dialog.service.ts` + component (native `<dialog>`, focus trap, Esc to cancel), `progress-bar.component.ts` (animated width, `role="progressbar"` with aria values), `toast-host.component.ts` (animated enter/leave via `animate.enter`/`animate.leave`, `aria-live="polite"`), `form-field.component.ts` (label, hint, error text linked by `aria-describedby`)
- [x] T015 [FE] [P] Create core services in `frontend/src/app/core/`: `now.service.ts` (signal updated every 1 s), `notification.service.ts` (in-app toasts; browser `Notification` when enabled and permitted), `refresh.service.ts` (version signal bumped after every mutation), `api-errors.ts` (maps problem+json `errors[]` to field messages), `format.ts` (duration `h m s` formatter for rest time)
- [x] T016 [FE] Create `frontend/src/app/core/reduced-motion.ts` (signal from `matchMedia('(prefers-reduced-motion: reduce)')`) used to skip script-driven motion (count-up numbers, countdown pulse, highlight pulse); CSS motion is already disabled by `motion.scss`
- [x] T017 [FE] Verify `npx ng build` passes and `npx ng serve --port 4200` shows the shell; navigation reaches all six placeholder pages
- [x] T018 [TEST] [P] Backend unit test `common/ApiExceptionHandlerTest.java` (`@WebMvcTest` with a test-only controller, `MockMvcTester`): validation error → 400 problem+json with `errors[]`, `BadRequestException` → 400 with its field in `errors[]`, `NotFoundException` → 404, `ConflictException` → 409; run `./mvnw verify` and record JaCoCo coverage (traces US1, US2, US3, US4, US6: 400/404/409 error format)
- [x] T019 [TEST] [P] Frontend unit tests `core/now.service.spec.ts`, `core/notification.service.spec.ts`, `layout/shell.component.spec.ts`; run `npx ng test --watch=false --coverage` (traces US4 for now/notification services, US6 for the shell)
- [x] T020 [TEST] curl smoke: `/v3/api-docs` 200, `/swagger-ui/index.html` 200, CORS preflight `OPTIONS /api/tasks` with `Origin: http://localhost:4200` returns `Access-Control-Allow-Origin`; Playwright MCP: shell loads, all six links navigate and highlight, skip link and keyboard Tab order work, accessibility snapshot (`browser_snapshot`) shows a named navigation landmark with labelled links, and emulated reduced motion disables animations (traces US6)

**Checkpoint**: Foundation ready — user stories can start.

---

## Phase 2: User Story 1 - Manage tasks (Priority: P1) 🎯 MVP

**Goal**: Create, edit, complete, archive/restore, delete, search, filter, sort tasks; overdue detection.

**Independent Test**: Tasks page CRUD + search/filter/sort + overdue badge, with no other feature present.

- [x] T021 [BE] [P] [US1] Create `task/TaskStatus.java` (`TODO`, `IN_PROGRESS`, `DONE`), `task/TaskPriority.java` (`LOW`, `MEDIUM`, `HIGH`) and entity `task/Task.java` (id, title "required, trimmed, 1–200 chars", description "≤ 2,000 chars", status default `TODO`, priority default `MEDIUM`, dueDate `LocalDate?`, createdAt, updatedAt, completedAt `OffsetDateTime?`, archived default false)
- [x] T022 [BE] [P] [US1] Create `task/TaskRepository.java` (`JpaRepository` + `JpaSpecificationExecutor`) and `task/TaskSpecifications.java` (title contains case-insensitive, status, priority, dueFrom/dueTo, overdue = dueDate < today AND status ≠ DONE, archived flag)
- [x] T023 [BE] [P] [US1] Create DTOs `task/dto/TaskRequest.java` (`@NotBlank @Size(max=200) title`, `@Size(max=2000) description`, status, priority, dueDate) and `task/dto/TaskResponse.java` (all Task fields + `overdue`, `@Schema(name = "Task")`; mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)`) per contract schemas `TaskRequest`/`Task`; create enums `task/TaskSort.java` (`DUE_DATE`, `CREATED_AT`) and `task/SortDirection.java` (`ASC`, `DESC`) for the list query; annotate every enum with `@Schema(enumAsRef = true)` so swagger uses `$ref` enums like the contract
- [x] T024 [BE] [US1] Create `task/TaskService.java` (injects `Clock`): create (trim title, defaults TODO/MEDIUM, timestamps; completedAt set if created DONE), update (keeps current status/priority when omitted; sets updatedAt; completedAt set when status becomes DONE, cleared when it leaves DONE), complete (idempotent: if already DONE, completedAt is kept), archive, restore, delete (404 if missing), list with filters and sort `DUE_DATE`/`CREATED_AT` + `ASC`/`DESC` (tasks without dueDate last for DUE_DATE), default excludes archived; `isOverdue(task, today)` rule
- [x] T025 [BE] [US1] Create `task/TaskController.java` implementing `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/{id}`, `POST /api/tasks/{id}/complete|archive|restore` exactly as `contracts/openapi.yaml` (operationIds, query params, 200/201/204/400/404), with springdoc `@Tag(name="Tasks")`, `@Operation(operationId=…)`, `@ApiResponse` annotations
- [x] T026 [BE] [US1] Regenerate `backend/openapi/openapi.json`, check Tasks paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify all task endpoints (success, 400, 404)
- [x] T027 [FE] [US1] Run `npm run api:gen`; create `frontend/src/app/features/tasks/tasks.store.ts` (signals: tasks, filters, loading, error; actions call generated `TasksService`; bumps `RefreshService` after mutations; optimistic update with rollback on error)
- [x] T028 [FE] [P] [US1] Create `features/tasks/task-form-dialog.component.ts` (title required ≤ 200 with live counter, description ≤ 2,000, status, priority, due date; client validation + server `errors[]` shown per field; create and edit modes)
- [x] T029 [FE] [P] [US1] Create `features/tasks/task-toolbar.component.ts` (search box debounced 200 ms, status filter, priority filter, due from/to, overdue toggle, show archived toggle, sort field + direction)
- [x] T030 [FE] [US1] Create `features/tasks/tasks-page.component.ts` + `task-item.component.ts`: list with animated enter/leave and reorder, status/priority chips, overdue badge, actions complete (check animation), edit, archive/restore, delete (confirm dialog); long titles truncated with full text in `title` attribute; "Add Task" button; empty state guiding to Add Task; filtered-empty state
- [x] T031 [FE] [US1] Playwright MCP check of the Tasks page against the running backend (create, edit, complete, archive/restore, delete, search/filter/sort, validation messages); save screenshots
- [x] T032 [TEST] [P] [US1] Backend unit tests `task/TaskServiceTest.java` (fixed `Clock`: defaults, trim, completedAt set/cleared, complete on an already-DONE task keeps completedAt, overdue rule incl. due today/no due date/DONE, archive excluded by default, sort with null due dates) and `task/TaskRepositoryTest.java` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` so the `test` profile H2 file is used: each filter)
- [x] T033 [TEST] [P] [US1] Backend controller test `task/TaskControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean TaskService`: status codes, validation 400 for empty / 201-char title / 2,001-char description / invalid enum, 404)
- [x] T034 [TEST] [P] [US1] Frontend unit tests `features/tasks/tasks.store.spec.ts`, `task-form-dialog.component.spec.ts` (validation, server errors mapping)
- [x] T035 [TEST] [US1] curl tests for all 8 task operations (success, validation errors, not found, filters/sort/overdue/archived); Playwright MCP tests of the Tasks page (elements, forms, validation messages, empty state, keyboard use); e2e: create task in UI → verify via `GET /api/tasks`; create via curl → appears in UI; complete task in UI → `status=DONE` via curl

**Checkpoint**: US1 fully functional and tested (MVP).

---

## Phase 3: User Story 2 - Track recurring habits (Priority: P2)

**Goal**: Daily/weekly habits, complete for today (no duplicates), streak and completion rate, deactivate/remove.

**Independent Test**: Habits page: create daily + weekly habit, complete, duplicate prevented, undo, deactivate, remove.

- [x] T036 [BE] [P] [US2] Create `habit/HabitFrequency.java` (`DAILY`, `WEEKLY`), entity `habit/Habit.java` (id, name "required, trimmed, 1–150 chars", description "≤ 2,000 chars", frequency, createdAt, active default true) and `habit/HabitCompletion.java` (id, habit FK cascade delete, completionDate `LocalDate`, createdAt; unique constraint (habit_id, completion_date))
- [x] T037 [BE] [P] [US2] Create `habit/HabitRepository.java` and `habit/HabitCompletionRepository.java` (exists by habit+date, find by habit ordered desc, delete by habit+date, find by habit in date range)
- [x] T038 [BE] [P] [US2] Create pure `habit/HabitStatsCalculator.java` (inputs: frequency, createdAt date, completion dates, today): `completedToday`, `doneForCurrentPeriod` (Daily = today, Weekly = any date in current ISO week Mon–Sun), `currentStreak` (consecutive done periods ending at current period, or previous period if current not yet done), `completionRate` 0–100 over last 30 days (Daily) / 12 weeks (Weekly) not earlier than creation, `lastCompletedDate`
- [x] T039 [BE] [P] [US2] Create DTOs `habit/dto/HabitRequest.java` (`@NotBlank @Size(max=150) name`, `@Size(max=2000) description`, `@NotNull frequency`), `HabitResponse.java` (fields + stats, `@Schema(name = "Habit")`), `HabitCompletionRequest.java` (optional date; no date-range annotation — the not-in-future rule is checked only in `HabitService` with the injected `Clock`, T040), `HabitCompletionResponse.java` (`@Schema(name = "HabitCompletion")`); mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on `HabitResponse` and `HabitCompletionResponse`; annotate every enum with `@Schema(enumAsRef = true)` so swagger uses `$ref` enums like the contract
- [x] T040 [BE] [US2] Create `habit/HabitService.java` (Clock): create, update, activate, deactivate, delete (cascade completions), complete(date default today; future date → `BadRequestException` field `date` (400); duplicate → `ConflictException` 409, also guard unique-constraint race), uncomplete(date) (404 if no record), list(active filter, newest first) with stats
- [x] T041 [BE] [US2] Create `habit/HabitController.java` implementing all 10 Habits operations of the contract (`/api/habits`, `/{id}`, `/{id}/deactivate`, `/{id}/activate`, `/{id}/completions`, `/{id}/completions/{date}`) with springdoc annotations
- [x] T042 [BE] [US2] Regenerate swagger, verify Habits paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify (201, 409 duplicate, 400, 404)
- [x] T043 [FE] [US2] Run `npm run api:gen`; create `features/habits/habits.store.ts` (signals, generated `HabitsService`, optimistic toggle with rollback, RefreshService bump)
- [x] T044 [FE] [P] [US2] Create `features/habits/habit-form-dialog.component.ts` (name required ≤ 150, description, Daily/Weekly segmented control; create/edit)
- [x] T045 [FE] [US2] Create `features/habits/habits-page.component.ts` + `habit-card.component.ts`: card grid with animated enter/leave, completion toggle bound to `completedToday` (pop/check animation, "already done" feedback; Weekly habits with `doneForCurrentPeriod && !completedToday` show a "done this week" badge with an undo button that calls `uncompleteHabit(lastCompletedDate)`; the toggle itself (off) records today's completion), frequency label, streak indicator (flame + count with bump animation), completion-rate ring/bar, edit, deactivate/reactivate, remove (confirm); long names/descriptions truncated with full text in `title` attribute; "Add Habit" button; active/inactive sections; empty state
- [x] T046 [FE] [US2] Playwright MCP check of the Habits page against the running backend; screenshots
- [x] T047 [TEST] [P] [US2] Backend unit tests `habit/HabitStatsCalculatorTest.java` (daily/weekly streaks across gaps, week boundaries Mon–Sun, current period not yet done, rate window shorter than 30 days/12 weeks for new habits) and `habit/HabitServiceTest.java` (duplicate → 409, future date → 400, uncomplete missing → 404, deactivate keeps history)
- [x] T048 [TEST] [P] [US2] Backend tests `habit/HabitControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean HabitService`: request-DTO validation 400 problem+json for blank / 151-char name, 2,001-char description, missing or invalid frequency; 409 and 404 mapped from the service) and `habit/HabitCompletionRepositoryTest.java` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`: unique (habit, date) enforced)
- [x] T049 [TEST] [P] [US2] Frontend unit tests `features/habits/habits.store.spec.ts`, `habit-card.component.spec.ts`
- [x] T050 [TEST] [US2] curl tests for all 10 habit operations; Playwright MCP tests of the Habits page; e2e: create habit in UI → verify via curl; complete habit in UI → `completedToday=true` via curl and second completion via curl → 409; complete via curl → UI card shows done

**Checkpoint**: US1 + US2 work independently.

---

## Phase 4: User Story 3 - Track learning resources (Priority: P3)

**Goal**: Learning cards with milestones and notes; status derived from milestones.

**Independent Test**: Learning page: add card, expand, add/complete/remove milestones, add/remove notes, remove card.

- [x] T051 [BE] [P] [US3] Create `learning/LearningStatus.java` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), entities `learning/LearningCard.java` (id, title "required, trimmed, 1–200 chars", description/source "≤ 2,000 chars", status default `NOT_STARTED`, createdAt; milestones + notes `@OneToMany` cascade ALL, orphanRemoval), `learning/LearningMilestone.java` (id, card FK, title "required, 1–200 chars", done default false, targetDate `LocalDate?`, completedAt `OffsetDateTime?`), `learning/LearningNote.java` (id, card FK, text "required, non-blank, ≤ 5,000 chars", createdAt)
- [x] T052 [BE] [P] [US3] Create `learning/LearningCardRepository.java` (fetch milestones/notes, newest first) and `learning/LearningMilestoneRepository.java` (count done, count completedAt within last N days)
- [x] T053 [BE] [P] [US3] Create pure `learning/LearningStatusCalculator.java` (none done → NOT_STARTED, some → IN_PROGRESS, all → COMPLETED, no milestones → unchanged) and progress percent
- [x] T054 [BE] [P] [US3] Create DTOs `learning/dto/LearningCardRequest.java`, `MilestoneRequest.java`, `NoteRequest.java` (validation per data-model) and `LearningCardResponse.java` (`@Schema(name = "LearningCard")`), `MilestoneResponse.java` (`@Schema(name = "Milestone")`), `NoteResponse.java` (`@Schema(name = "Note")`) (mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on all three; enumAsRef on `LearningStatus`; milestones in insertion order, notes newest first, milestonesTotal/Done, progressPercent)
- [x] T055 [BE] [US3] Create `learning/LearningService.java` (Clock): card create/update(status manual; status kept when omitted)/delete; milestone add (done defaults false; completedAt set if created done)/update (done kept when omitted; done → completedAt set; undone → cleared)/delete; note add/delete; recompute status after a milestone add, delete, or an update that changes `done` (title/targetDate-only updates keep a manual status, FR-016); 404 for unknown card/milestone/note or milestone of another card
- [x] T056 [BE] [US3] Create `learning/LearningController.java` implementing all 10 Learning operations of the contract with springdoc annotations
- [x] T057 [BE] [US3] Regenerate swagger, verify Learning paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify
- [x] T058 [FE] [US3] Run `npm run api:gen`; create `features/learning/learning.store.ts` (signals, generated `LearningService`, RefreshService bump)
- [x] T059 [FE] [P] [US3] Create `features/learning/learning-card-form-dialog.component.ts` (title required ≤ 200, description/source ≤ 2,000; create and edit modes; in edit mode a status select `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED` for manual status, FR-013)
- [x] T060 [FE] [US3] Create `features/learning/learning-page.component.ts` + `learning-card.component.ts`: card grid with animated enter/leave, status chip, progress bar, expand/collapse with height animation (`aria-expanded`), milestone list (add inline form with optional target date, done checkbox with strike-through animation, remove), notes list (add textarea, timestamp, remove), edit card (opens the form dialog incl. manual status), remove card (confirm); long titles/notes truncated with full text in the expanded view; "Add Learning Card" button; empty state
- [x] T061 [FE] [US3] Playwright MCP check of the Learning Resources page against the running backend; screenshots
- [x] T062 [TEST] [P] [US3] Backend unit tests `learning/LearningStatusCalculatorTest.java`, `learning/LearningServiceTest.java` (status recompute, completedAt set/cleared, manual status kept on a title-only milestone update and recomputed on the next add/toggle/remove, 404 cases)
- [x] T063 [TEST] [P] [US3] Backend tests `learning/LearningControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean LearningService`: request-DTO validation 400 problem+json for blank / 201-char card title, 2,001-char description, invalid status enum, blank / 201-char milestone title, blank / 5,001-char note text; 404) and `learning/LearningCardRepositoryTest.java` (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`: cascade delete of milestones/notes)
- [x] T064 [TEST] [P] [US3] Frontend unit tests `features/learning/learning.store.spec.ts`, `learning-card.component.spec.ts`
- [x] T065 [TEST] [US3] curl tests for all 10 learning operations; Playwright MCP tests of the Learning page; e2e: add card with 2 milestones in UI → verify via curl; complete milestone via curl → UI shows progress 50% and In Progress; add/remove note in UI → verify via curl

**Checkpoint**: US1–US3 work independently.

---

## Phase 5: User Story 4 - Build and run time-boxed plans (Priority: P2)

**Goal**: Plans from existing items, derived status/progress/rest time, start notification, item side effects, history.

**Independent Test**: With a task, habit and card present: create plan, watch status/rest time, tick items, see side effects, remove plan.

- [x] T066 [BE] [P] [US4] Create `plan/PlanStatus.java`, `plan/PlanItemSourceType.java` (`TASK`, `HABIT`, `LEARNING_RESOURCE`), entities `plan/Plan.java` (id, title "required, 1–200 chars", estimatedDurationMinutes "≥ 1", startDateTime, endDateTime "> startDateTime", priorityOrder "≥ 1 (1 = highest); ties allowed", createdAt, startNotifiedAt `OffsetDateTime?`; items `@OneToMany` cascade ALL) and `plan/PlanItem.java` (id, plan FK, sourceType, sourceId (no FK), sourceTitle snapshot, done default false; unique (plan_id, source_type, source_id))
- [x] T067 [BE] [P] [US4] Create `plan/PlanRepository.java` (fetch items; order by priorityOrder asc, startDateTime asc)
- [x] T068 [BE] [P] [US4] Create pure `plan/PlanStatusCalculator.java` (inputs start, end, items, now): status = COMPLETED if all items done or now ≥ end; else IN_PROGRESS if now ≥ start; else NOT_STARTED; `progressPercent` = round(done × 100 / total); `restSeconds` = end − now only when IN_PROGRESS else null
- [x] T069 [BE] [P] [US4] Create DTOs `plan/dto/PlanRequest.java` (`@NotBlank @Size(max=200) title`, `@NotNull @Min(1) Integer estimatedDurationMinutes`, `@NotNull` start/end, `@NotNull @Min(1) Integer priorityOrder`, `@NotEmpty @Valid items` of `PlanItemSource`), `PlanItemSource.java` (`@NotNull sourceType`, `@NotNull sourceId`), `PlanItemUpdateRequest.java` (`@NotNull Boolean done`), `PlanResponse.java` (`@Schema(name = "Plan")`), `PlanItemResponse.java` (`@Schema(name = "PlanItem")`, incl. `sourceAvailable`); mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on `PlanResponse` and `PlanItemResponse`; annotate every enum with `@Schema(enumAsRef = true)` so swagger uses `$ref` enums like the contract
- [x] T070 [BE] [US4] Create `plan/PlanItemCompletionService.java` (business rule 13 / research R6): item done=true → TASK calls `TaskService.complete` (sets DONE + completedAt only if not already DONE); HABIT records today's completion if missing via HabitService; LEARNING_RESOURCE no side effect; done=false never reverts the source; missing source → no side effect
- [x] T071 [BE] [US4] Create `plan/PlanService.java` (Clock): create (validate end > start → `BadRequestException` field `endDateTime`; ≥ 1 item; each source exists — task not archived, habit active, card exists — else `BadRequestException` field `items`; duplicate sources → `BadRequestException` field `items`; snapshot sourceTitle), get, list (optional status filter on derived status), delete, setItemDone (calls PlanItemCompletionService), acknowledgeStart (sets startNotifiedAt if null; idempotent); maps derived fields via PlanStatusCalculator and `sourceAvailable` lookups
- [x] T072 [BE] [US4] Create `plan/PlanController.java` implementing all 6 Plans operations of the contract with springdoc annotations
- [x] T073 [BE] [US4] Regenerate swagger, verify Plans paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify (status transitions using start in past/future, side effects on task/habit, 400 cases)
- [x] T074 [FE] [US4] Run `npm run api:gen`; create `features/plans/plans.store.ts` (signals; polls `listPlans` every 30 s and on RefreshService bumps; computed groups active/upcoming vs completed history; client-side rest time = end − `NowService.now()` with status re-derivation at start/end boundaries)
- [x] T075 [FE] [US4] Create `core/plan-start-watcher.service.ts` (provided in root and started from the app shell so polling runs on every page; consumes plans + derived status from `plans.store.ts` (T074): when a plan is IN_PROGRESS and `startNotifiedAt` is null → toast + browser notification if permitted (Settings preferences are applied later in T088) → `acknowledgePlanStart`; highlights the plan with a pulse animation)
- [x] T076 [FE] [P] [US4] Create `features/plans/plan-builder-dialog.component.ts`: step 1 pick items (tabs Tasks / Habits / Learning with search, multi-select chips, only non-archived tasks and active habits), step 2 title, estimated duration (hours + minutes), start and end date-time, priority order; validation (≥ 1 item, end after start, duration ≥ 1 min) incl. server `errors[]`; animated step transition
- [x] T077 [FE] [US4] Create `features/plans/plans-page.component.ts` + `plan-card.component.ts`: groups "Active & upcoming" (priority then start) and "History" (final %), each card shows status chip, animated progress ring/bar, live rest-time countdown (updates every second, `aria-live="off"` with periodic sr text), estimated duration, start/end, per-item done toggles with source-type icons and "removed source" label, remove plan (confirm); long titles truncated with full text in `title` attribute; "Create Plan" button; start highlight; empty state
- [x] T078 [FE] [US4] Playwright MCP check of the Todo Plans page against the running backend (builder, countdown ticking, item toggles, notification toast); screenshots
- [x] T079 [TEST] [P] [US4] Backend unit tests `plan/PlanStatusCalculatorTest.java` (Not Started → In Progress → Completed across start/end boundaries, all done before start, end passed with open items, rest time only In Progress, progress rounding) and `plan/PlanItemCompletionServiceTest.java` (task → DONE, habit → today's completion once, learning untouched, undo never reverts, deleted source)
- [x] T080 [TEST] [P] [US4] Backend tests `plan/PlanServiceTest.java` (service validation: no items, end ≤ start → field `endDateTime`, archived task, inactive habit, unknown source, duplicate source → 400; acknowledgeStart idempotent; status consistent after reload from repository) and `plan/PlanControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean PlanService`: request-DTO validation 400 problem+json for blank title, `items: []`, missing estimatedDurationMinutes / priorityOrder / startDateTime / endDateTime / item sourceType / item sourceId, estimatedDurationMinutes or priorityOrder = 0, and PlanItemUpdateRequest without done; 404)
- [x] T081 [TEST] [P] [US4] Frontend unit tests `features/plans/plans.store.spec.ts` (grouping, rest time from NowService), `core/plan-start-watcher.service.spec.ts` (notifies once, acknowledges), `plan-builder-dialog.component.spec.ts`
- [x] T082 [TEST] [US4] curl tests for all 6 plan operations; Playwright MCP tests of the Todo Plans page; e2e: build plan from existing task + habit + card in UI → verify via curl; mark task item done in UI → task `DONE` and plan 33% via curl; create in-progress plan via curl → UI shows start toast once, countdown decreasing over 3 s, and plan highlighted; mark all items done → Completed in history

**Checkpoint**: US1–US4 work independently.

---

## Phase 6: User Story 6 - Navigate and set preferences (Priority: P4)

**Goal**: Settings persisted and applied (display name, notifications, default view).

**Independent Test**: Change settings, reload, verify persistence, greeting name and landing page.

- [x] T083 [BE] [P] [US6] Create `settings/DefaultView.java` (`DASHBOARD`, `TASKS`, `HABITS`, `LEARNING`, `PLANS`), entity `settings/Settings.java` (single row id = 1: displayName "1–80 chars, default Friend", inAppNotifications default true, browserNotifications default false, defaultView default `DASHBOARD`) and `settings/SettingsRepository.java`
- [x] T084 [BE] [US6] Create `settings/dto/SettingsDto.java` (`@Schema(name = "Settings")`, all four fields `requiredMode = REQUIRED` and `@NotNull` (boxed `Boolean`), validation per contract `Settings`; `DefaultView` with `@Schema(enumAsRef = true)`), `settings/SettingsService.java` (get creates defaults on first call; update) and `settings/SettingsController.java` (`GET/PUT /api/settings`, springdoc annotations)
- [x] T085 [BE] [US6] Regenerate swagger, verify Settings paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify
- [x] T086 [FE] [US6] Run `npm run api:gen`; create `core/settings.store.ts` (loads once at startup via `provideAppInitializer`; exposes displayName, notification prefs, defaultView) and a `defaultViewGuard` redirecting `''` to the configured landing page in `app.routes.ts`
- [x] T087 [FE] [US6] Create `features/settings/settings-page.component.ts`: profile section (display name), notifications (in-app on/off, browser on/off — requests `Notification.requestPermission()` and shows denied state), default view select; save with success toast; validation messages
- [x] T088 [FE] [US6] Make NotificationService respect settings (in-app off → no toasts for plan start; browser on + granted → system notification); Playwright MCP check of Settings and navigation; screenshots
- [x] T089 [TEST] [P] [US6] Backend tests `settings/SettingsServiceTest.java` (defaults created once) and `settings/SettingsControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean SettingsService`: request-DTO validation 400 problem+json for blank / 81-char displayName, missing displayName / inAppNotifications / browserNotifications / defaultView, invalid defaultView enum)
- [x] T090 [TEST] [P] [US6] Frontend unit tests `core/settings.store.spec.ts`, `features/settings/settings-page.component.spec.ts`
- [x] T091 [TEST] [US6] curl tests for both settings operations; Playwright MCP tests: all six nav links from every page (one click, highlight), settings form; e2e: change display name and default view in UI → verify via curl, reload → app opens on the chosen view; change via curl → UI reflects after reload

**Checkpoint**: US1–US4 + US6 work independently.

---

## Phase 7: User Story 5 - See everything on a dashboard (Priority: P3)

**Goal**: Dashboard summary that matches the data and updates live.

**Independent Test**: Seed data, compare every dashboard number with list endpoints; toggle items and see updates.

- [x] T092 [BE] [P] [US5] Create DTOs `dashboard/dto/DashboardResponse.java` (`@Schema(name = "Dashboard")`), `DashboardTasks.java`, `DashboardHabits.java`, `DashboardPlans.java`, `DashboardLearning.java` per contract (nested lists reuse the `Task`, `Habit`, `Plan` response DTOs); mark every field listed in the contract's `required` array with `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)` on all Dashboard DTOs
- [x] T093 [BE] [US5] Create `dashboard/DashboardService.java` (Clock; reuses TaskService/HabitStatsCalculator/PlanStatusCalculator/repositories — no duplicated rules): greetingName from Settings, today; tasks dueToday (non-archived, dueDate = today, not DONE), overdue (non-archived, overdue rule), completedTodayCount (non-archived, completedAt today), totalActive (non-archived), doneCount (non-archived, DONE), completionPercent = round(done × 100 / totalActive), 0 when none; habits today = active habits with stats, activeCount, completedTodayCount; plans inProgress (priority, start order), upcomingCount, completedCount; learning cardsTotal, inProgressCount, milestonesTotal, milestonesDone, milestonesCompletedLast7Days
- [x] T094 [BE] [US5] Create `dashboard/DashboardController.java` (`GET /api/dashboard`, springdoc annotations); regenerate swagger, verify the full swagger now matches all 37 contract operations (paths, operationIds, status codes, schema names, schema properties and required lists), restart backend, curl-verify
- [x] T095 [FE] [US5] Run `npm run api:gen`; create `features/dashboard/dashboard.store.ts` (loads `getDashboard`; reloads on RefreshService bumps and every 60 s; rest time from NowService)
- [x] T096 [FE] [US5] Create `features/dashboard/dashboard-page.component.ts` with sub-components: greeting header (time-of-day greeting + displayName, today's date), summary metric cards (tasks %, habits done for current period / active (count of `today[]` with `doneForCurrentPeriod`), plans in progress, learning milestones) with count-up animation, today's tasks list (complete in place), overdue list, today's habit checklist (toggle in place, same `completedToday` / weekly "done this week" rules as T045), active plans with live rest time + animated progress, learning snapshot, quick-add actions opening the Task/Habit/Learning/Plan create dialogs; skeleton loading states; staggered entrance animation
- [x] T097 [FE] [US5] Playwright MCP check of the Dashboard against the running backend (metrics update after toggles on the dashboard and on other pages); screenshots
- [x] T098 [TEST] [P] [US5] Backend tests `dashboard/DashboardServiceTest.java` (fixed Clock, seeded data: every metric equals expected counts; archived excluded; zero-division cases) and `dashboard/DashboardControllerTest.java` (`@WebMvcTest`)
- [x] T099 [TEST] [P] [US5] Frontend unit tests `features/dashboard/dashboard.store.spec.ts`, `dashboard-page.component.spec.ts`
- [x] T100 [TEST] [US5] curl: `GET /api/dashboard` numbers equal counts computed from `/api/tasks`, `/api/habits`, `/api/plans`, `/api/learning-cards`; Playwright MCP tests of the Dashboard (all sections, quick-add); e2e: complete a task and a habit and a plan item in the UI → dashboard metrics change accordingly and match curl; change data via curl → dashboard reflects after refresh

**Checkpoint**: All user stories functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Animation/accessibility/performance quality and full regression.

- [x] T101 [BE] [P] Performance check: seed 1,000 tasks via a curl loop, confirm `GET /api/tasks` with search/filters responds < 500 ms; add indexes on `task(archived, status, due_date)` in `task/Task.java` if needed
- [x] T102 [BE] [P] Final swagger audit: `backend/openapi/openapi.json` matches `contracts/openapi.yaml` (all paths, methods, operationIds, status codes, schema names, schema properties and required lists); fix mismatches
- [x] T103 [FE] Animation audit across all pages: route view transitions, list enter/leave, dialog open/close, toggle feedback, progress and countdown animations, all ≤ 250 ms and disabled under `prefers-reduced-motion: reduce`; consistent spacing/typography; responsive at 375 px and 1440 px widths; verify truncation with 200-char titles and 5,000-char notes
- [x] T104 [FE] Accessibility pass: labels, focus order, focus return after dialogs, `aria-live` for toasts and validation, contrast ≥ 4.5:1 in light and dark themes (verify every text/background token pair in `tokens.scss`); fix findings on every page
- [x] T105 [TEST] Accessibility tests via Playwright MCP on all six pages in light and dark mode (`browser_snapshot` accessibility tree: every control has an accessible name, landmarks and headings present, validation messages announced; `browser_evaluate` computing contrast ratios of rendered text ≥ 4.5:1; emulated reduced motion disables animations; `browser_resize` to 375 px and 1440 px on all six pages (no horizontal overflow, navigation usable); `browser_evaluate` reading computed animation/transition durations ≤ 250 ms and confirming controls stay clickable during animations); keyboard-only walkthrough of every page action (traces US1–US6, SC-010, FR-032)
- [x] T106 [TEST] Performance tests: with 1,000 seeded tasks, curl timing for list/search/filter < 500 ms and Playwright-measured UI filter response < 500 ms; and curl timing < 500 ms for create/update/delete on tasks, habits (incl. completion), learning cards (incl. milestone), plans (incl. item toggle) and settings (traces US1–US4, US6, SC-002, SC-009)
- [x] T107 [TEST] Full regression: backend `./mvnw verify` + JaCoCo report, frontend `npx ng test --watch=false --coverage`, and the PRD §11 end-to-end flow (create task, complete task, create habit, complete habit, add learning card with milestones, build a plan from existing items, mark plan items done, verify plan achievement and dashboard update) via Playwright MCP + curl; persistence check: restart backend and confirm data and plan statuses unchanged (traces US1–US5, SC-005, SC-008)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup & Foundation)**: none — blocks all stories.
- **Phase 2 (US1)**: after Phase 1.
- **Phase 3 (US2)**: after Phase 1 (independent of US1).
- **Phase 4 (US3)**: after Phase 1 (independent of US1/US2).
- **Phase 5 (US4)**: after Phases 2–4 (plans reference tasks, habits and learning cards).
- **Phase 6 (US6)**: after Phase 1; placed before the dashboard because the greeting and default view use Settings.
- **Phase 7 (US5)**: after Phases 2–6 (aggregates everything).
- **Phase 8 (Polish)**: after all stories.

### Within each phase
- [BE] tasks first (entities → repositories/calculators → DTOs → services → controllers → swagger), then [FE] (regenerate client → store → components → page → Playwright check), then [TEST].
- Generated client (`npm run api:gen`) always runs after the phase's backend swagger is regenerated.

### Parallel Opportunities
- Phase 1: T003–T006 together; T011, T012, T014, T015 together.
- Each story: entity / repository / calculator / DTO tasks marked [P] together; form and toolbar components [P] together; [TEST] unit-test tasks [P] together.

## Parallel Example: User Story 4

```text
T066 entities, T067 repository, T068 PlanStatusCalculator, T069 DTOs   (BE, parallel)
T075 plan-start-watcher, T076 plan-builder-dialog                       (FE, parallel)
T079, T080, T081 unit tests                                             (TEST, parallel)
```

## Implementation Strategy

- **MVP**: Phase 1 + Phase 2 (US1 Tasks) → stop and validate.
- **Incremental**: add US2, US3 (each independently testable), then US4 (needs items), US6, US5, Polish.
- Each phase ends at a checkpoint only after its [TEST] tasks pass (max 3 bug-fix trials).
