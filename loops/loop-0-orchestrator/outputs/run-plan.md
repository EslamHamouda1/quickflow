# Run plan — 001-quickflow-productivity

Source: `specs/001-quickflow-productivity/tasks.md` (single source of truth; full task text there).
Order per phase: loop-1 backend-dev → loop-2 frontend-dev → loop-3 testing (max 3 bug-fix trials).

## Phase 1: Setup & Foundation (Shared Infrastructure)

[BE] 8 · [FE] 9 · [TEST] 3

| Task ID | Owner loop | Description |
|---|---|---|
| T001 | loop-1 backend-dev | Generate the backend from start.spring.io into `backend/` (type maven-project, bootVersion 4.1.1, javaVersion 25, groupId `com.quickflow`… |
| T002 | loop-1 backend-dev | Edit `backend/pom.xml`: add `springdoc-openapi-starter-webmvc-ui` 3.1.1, `spring-boot-starter-webmvc-test` and `spring-boot-starter-data-… |
| T003 | loop-1 backend-dev | Create H2 profile files: `backend/src/main/resources/application.yaml` (default: `jdbc:h2:file:./data/quickflow`, `ddl-auto: update`, por… |
| T004 | loop-1 backend-dev | Create `config/ClockConfig.java` exposing a `java.time.Clock` bean (`Clock.systemDefaultZone()`) — every time-dependent rule injects this… |
| T005 | loop-1 backend-dev | Create `config/CorsConfig.java` allowing origin `http://localhost:4200`, methods GET/POST/PUT/DELETE/OPTIONS, all headers, on `/api/**` |
| T006 | loop-1 backend-dev | Create `config/OpenApiConfig.java` (title "QuickFlow API", version 1.0.0, server http://localhost:8080) matching `info` in `specs/001-qui… |
| T007 | loop-1 backend-dev | Create `common/NotFoundException.java`, `common/ConflictException.java`, `common/BadRequestException.java` (carries `field` and `message`… |
| T008 | loop-1 backend-dev | Verify `cd backend && ./mvnw verify` passes, `./mvnw -Popenapi verify -DskipTests` writes `backend/openapi/openapi.json`, and the running… |
| T009 | loop-2 frontend-dev | Generate the Angular 22.2.0 workspace in `frontend/` (`npx -y @angular/cli@22.2.0 new quickflow --directory frontend --zoneless --routing… |
| T010 | loop-2 frontend-dev | Add `@openapitools/openapi-generator-cli` 2.41.0 as devDependency, `frontend/openapitools.json`, and script `"api:gen": "openapi-generato… |
| T011 | loop-2 frontend-dev | Create `frontend/src/environments/environment.ts` / `environment.development.ts` (`apiUrl: 'http://localhost:8080'`) and `frontend/src/ap… |
| T012 | loop-2 frontend-dev | Create the design system in `frontend/src/styles/`: `tokens.scss` (color tokens for light and dark via `prefers-color-scheme`, text contr… |
| T013 | loop-2 frontend-dev | Create `frontend/src/app/layout/shell.component.ts` (persistent navigation: Dashboard, Tasks, Habits, Learning Resources, Todo Plans, Set… |
| T014 | loop-2 frontend-dev | Create shared UI in `frontend/src/app/shared/ui/`: `empty-state.component.ts` (icon, message, primary action), `confirm-dialog.service.ts… |
| T015 | loop-2 frontend-dev | Create core services in `frontend/src/app/core/`: `now.service.ts` (signal updated every 1 s), `notification.service.ts` (in-app toasts;… |
| T016 | loop-2 frontend-dev | Create `frontend/src/app/core/reduced-motion.ts` (signal from `matchMedia('(prefers-reduced-motion: reduce)')`) used to skip script-drive… |
| T017 | loop-2 frontend-dev | Verify `npx ng build` passes and `npx ng serve --port 4200` shows the shell; navigation reaches all six placeholder pages |
| T018 | loop-3 testing | Backend unit test `common/ApiExceptionHandlerTest.java` (`@WebMvcTest` with a test-only controller, `MockMvcTester`): validation error →… |
| T019 | loop-3 testing | Frontend unit tests `core/now.service.spec.ts`, `core/notification.service.spec.ts`, `layout/shell.component.spec.ts`; run `npx ng test -… |
| T020 | loop-3 testing | curl smoke: `/v3/api-docs` 200, `/swagger-ui/index.html` 200, CORS preflight `OPTIONS /api/tasks` with `Origin: http://localhost:4200` re… |

## Phase 2: User Story 1 - Manage tasks (Priority: P1) 🎯 MVP

[BE] 6 · [FE] 5 · [TEST] 4

| Task ID | Owner loop | Description |
|---|---|---|
| T021 | loop-1 backend-dev | Create `task/TaskStatus.java` (`TODO`, `IN_PROGRESS`, `DONE`), `task/TaskPriority.java` (`LOW`, `MEDIUM`, `HIGH`) and entity `task/Task.j… |
| T022 | loop-1 backend-dev | Create `task/TaskRepository.java` (`JpaRepository` + `JpaSpecificationExecutor`) and `task/TaskSpecifications.java` (title contains case-… |
| T023 | loop-1 backend-dev | Create DTOs `task/dto/TaskRequest.java` (`@NotBlank @Size(max=200) title`, `@Size(max=2000) description`, status, priority, dueDate) and… |
| T024 | loop-1 backend-dev | Create `task/TaskService.java` (injects `Clock`): create (trim title, defaults TODO/MEDIUM, timestamps; completedAt set if created DONE),… |
| T025 | loop-1 backend-dev | Create `task/TaskController.java` implementing `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/{id}`, `POST /api/tasks/{id}/complete\|ar… |
| T026 | loop-1 backend-dev | Regenerate `backend/openapi/openapi.json`, check Tasks paths, operationIds, status codes, schema names, schema properties and required li… |
| T027 | loop-2 frontend-dev | Run `npm run api:gen`; create `frontend/src/app/features/tasks/tasks.store.ts` (signals: tasks, filters, loading, error; actions call gen… |
| T028 | loop-2 frontend-dev | Create `features/tasks/task-form-dialog.component.ts` (title required ≤ 200 with live counter, description ≤ 2,000, status, priority, due… |
| T029 | loop-2 frontend-dev | Create `features/tasks/task-toolbar.component.ts` (search box debounced 200 ms, status filter, priority filter, due from/to, overdue togg… |
| T030 | loop-2 frontend-dev | Create `features/tasks/tasks-page.component.ts` + `task-item.component.ts`: list with animated enter/leave and reorder, status/priority c… |
| T031 | loop-2 frontend-dev | Playwright MCP check of the Tasks page against the running backend (create, edit, complete, archive/restore, delete, search/filter/sort,… |
| T032 | loop-3 testing | Backend unit tests `task/TaskServiceTest.java` (fixed `Clock`: defaults, trim, completedAt set/cleared, complete on an already-DONE task… |
| T033 | loop-3 testing | Backend controller test `task/TaskControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean TaskService`: status codes, validat… |
| T034 | loop-3 testing | Frontend unit tests `features/tasks/tasks.store.spec.ts`, `task-form-dialog.component.spec.ts` (validation, server errors mapping) |
| T035 | loop-3 testing | curl tests for all 8 task operations (success, validation errors, not found, filters/sort/overdue/archived); Playwright MCP tests of the… |

## Phase 3: User Story 2 - Track recurring habits (Priority: P2)

[BE] 7 · [FE] 4 · [TEST] 4

| Task ID | Owner loop | Description |
|---|---|---|
| T036 | loop-1 backend-dev | Create `habit/HabitFrequency.java` (`DAILY`, `WEEKLY`), entity `habit/Habit.java` (id, name "required, trimmed, 1–150 chars", description… |
| T037 | loop-1 backend-dev | Create `habit/HabitRepository.java` and `habit/HabitCompletionRepository.java` (exists by habit+date, find by habit ordered desc, delete… |
| T038 | loop-1 backend-dev | Create pure `habit/HabitStatsCalculator.java` (inputs: frequency, createdAt date, completion dates, today): `completedToday`, `doneForCur… |
| T039 | loop-1 backend-dev | Create DTOs `habit/dto/HabitRequest.java` (`@NotBlank @Size(max=150) name`, `@Size(max=2000) description`, `@NotNull frequency`), `HabitR… |
| T040 | loop-1 backend-dev | Create `habit/HabitService.java` (Clock): create, update, activate, deactivate, delete (cascade completions), complete(date default today… |
| T041 | loop-1 backend-dev | Create `habit/HabitController.java` implementing all 10 Habits operations of the contract (`/api/habits`, `/{id}`, `/{id}/deactivate`, `/… |
| T042 | loop-1 backend-dev | Regenerate swagger, verify Habits paths, operationIds, status codes, schema names, schema properties and required lists match the contrac… |
| T043 | loop-2 frontend-dev | Run `npm run api:gen`; create `features/habits/habits.store.ts` (signals, generated `HabitsService`, optimistic toggle with rollback, Ref… |
| T044 | loop-2 frontend-dev | Create `features/habits/habit-form-dialog.component.ts` (name required ≤ 150, description, Daily/Weekly segmented control; create/edit) |
| T045 | loop-2 frontend-dev | Create `features/habits/habits-page.component.ts` + `habit-card.component.ts`: card grid with animated enter/leave, completion toggle bou… |
| T046 | loop-2 frontend-dev | Playwright MCP check of the Habits page against the running backend; screenshots |
| T047 | loop-3 testing | Backend unit tests `habit/HabitStatsCalculatorTest.java` (daily/weekly streaks across gaps, week boundaries Mon–Sun, current period not y… |
| T048 | loop-3 testing | Backend tests `habit/HabitControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean HabitService`: request-DTO validation 400 p… |
| T049 | loop-3 testing | Frontend unit tests `features/habits/habits.store.spec.ts`, `habit-card.component.spec.ts` |
| T050 | loop-3 testing | curl tests for all 10 habit operations; Playwright MCP tests of the Habits page; e2e: create habit in UI → verify via curl; complete habi… |

## Phase 4: User Story 3 - Track learning resources (Priority: P3)

[BE] 7 · [FE] 4 · [TEST] 4

| Task ID | Owner loop | Description |
|---|---|---|
| T051 | loop-1 backend-dev | Create `learning/LearningStatus.java` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), entities `learning/LearningCard.java` (id, title "requ… |
| T052 | loop-1 backend-dev | Create `learning/LearningCardRepository.java` (fetch milestones/notes, newest first) and `learning/LearningMilestoneRepository.java` (cou… |
| T053 | loop-1 backend-dev | Create pure `learning/LearningStatusCalculator.java` (none done → NOT_STARTED, some → IN_PROGRESS, all → COMPLETED, no milestones → uncha… |
| T054 | loop-1 backend-dev | Create DTOs `learning/dto/LearningCardRequest.java`, `MilestoneRequest.java`, `NoteRequest.java` (validation per data-model) and `Learnin… |
| T055 | loop-1 backend-dev | Create `learning/LearningService.java` (Clock): card create/update(status manual; status kept when omitted)/delete; milestone add (done d… |
| T056 | loop-1 backend-dev | Create `learning/LearningController.java` implementing all 10 Learning operations of the contract with springdoc annotations |
| T057 | loop-1 backend-dev | Regenerate swagger, verify Learning paths, operationIds, status codes, schema names, schema properties and required lists match the contr… |
| T058 | loop-2 frontend-dev | Run `npm run api:gen`; create `features/learning/learning.store.ts` (signals, generated `LearningService`, RefreshService bump) |
| T059 | loop-2 frontend-dev | Create `features/learning/learning-card-form-dialog.component.ts` (title required ≤ 200, description/source ≤ 2,000; create and edit mode… |
| T060 | loop-2 frontend-dev | Create `features/learning/learning-page.component.ts` + `learning-card.component.ts`: card grid with animated enter/leave, status chip, p… |
| T061 | loop-2 frontend-dev | Playwright MCP check of the Learning Resources page against the running backend; screenshots |
| T062 | loop-3 testing | Backend unit tests `learning/LearningStatusCalculatorTest.java`, `learning/LearningServiceTest.java` (status recompute, completedAt set/c… |
| T063 | loop-3 testing | Backend tests `learning/LearningControllerTest.java` (`@WebMvcTest`, `MockMvcTester`, `@MockitoBean LearningService`: request-DTO validat… |
| T064 | loop-3 testing | Frontend unit tests `features/learning/learning.store.spec.ts`, `learning-card.component.spec.ts` |
| T065 | loop-3 testing | curl tests for all 10 learning operations; Playwright MCP tests of the Learning page; e2e: add card with 2 milestones in UI → verify via… |

## Phase 5: User Story 4 - Build and run time-boxed plans (Priority: P2)

[BE] 8 · [FE] 5 · [TEST] 4

| Task ID | Owner loop | Description |
|---|---|---|
| T066 | loop-1 backend-dev | Create `plan/PlanStatus.java`, `plan/PlanItemSourceType.java` (`TASK`, `HABIT`, `LEARNING_RESOURCE`), entities `plan/Plan.java` (id, titl… |
| T067 | loop-1 backend-dev | Create `plan/PlanRepository.java` (fetch items; order by priorityOrder asc, startDateTime asc) |
| T068 | loop-1 backend-dev | Create pure `plan/PlanStatusCalculator.java` (inputs start, end, items, now): status = COMPLETED if all items done or now ≥ end; else IN_… |
| T069 | loop-1 backend-dev | Create DTOs `plan/dto/PlanRequest.java` (`@NotBlank @Size(max=200) title`, `@NotNull @Min(1) Integer estimatedDurationMinutes`, `@NotNull… |
| T070 | loop-1 backend-dev | Create `plan/PlanItemCompletionService.java` (business rule 13 / research R6): item done=true → TASK calls `TaskService.complete` (sets D… |
| T071 | loop-1 backend-dev | Create `plan/PlanService.java` (Clock): create (validate end > start → `BadRequestException` field `endDateTime`; ≥ 1 item; each source e… |
| T072 | loop-1 backend-dev | Create `plan/PlanController.java` implementing all 6 Plans operations of the contract with springdoc annotations |
| T073 | loop-1 backend-dev | Regenerate swagger, verify Plans paths, operationIds, status codes, schema names, schema properties and required lists match the contract… |
| T074 | loop-2 frontend-dev | Run `npm run api:gen`; create `features/plans/plans.store.ts` (signals; polls `listPlans` every 30 s and on RefreshService bumps; compute… |
| T075 | loop-2 frontend-dev | Create `core/plan-start-watcher.service.ts` (provided in root and started from the app shell so polling runs on every page; consumes plan… |
| T076 | loop-2 frontend-dev | Create `features/plans/plan-builder-dialog.component.ts`: step 1 pick items (tabs Tasks / Habits / Learning with search, multi-select chi… |
| T077 | loop-2 frontend-dev | Create `features/plans/plans-page.component.ts` + `plan-card.component.ts`: groups "Active & upcoming" (priority then start) and "History… |
| T078 | loop-2 frontend-dev | Playwright MCP check of the Todo Plans page against the running backend (builder, countdown ticking, item toggles, notification toast); s… |
| T079 | loop-3 testing | Backend unit tests `plan/PlanStatusCalculatorTest.java` (Not Started → In Progress → Completed across start/end boundaries, all done befo… |
| T080 | loop-3 testing | Backend tests `plan/PlanServiceTest.java` (service validation: no items, end ≤ start → field `endDateTime`, archived task, inactive habit… |
| T081 | loop-3 testing | Frontend unit tests `features/plans/plans.store.spec.ts` (grouping, rest time from NowService), `core/plan-start-watcher.service.spec.ts`… |
| T082 | loop-3 testing | curl tests for all 6 plan operations; Playwright MCP tests of the Todo Plans page; e2e: build plan from existing task + habit + card in U… |

## Phase 6: User Story 6 - Navigate and set preferences (Priority: P4)

[BE] 3 · [FE] 3 · [TEST] 3

| Task ID | Owner loop | Description |
|---|---|---|
| T083 | loop-1 backend-dev | Create `settings/DefaultView.java` (`DASHBOARD`, `TASKS`, `HABITS`, `LEARNING`, `PLANS`), entity `settings/Settings.java` (single row id… |
| T084 | loop-1 backend-dev | Create `settings/dto/SettingsDto.java` (`@Schema(name = "Settings")`, all four fields `requiredMode = REQUIRED` and `@NotNull` (boxed `Bo… |
| T085 | loop-1 backend-dev | Regenerate swagger, verify Settings paths, operationIds, status codes, schema names, schema properties and required lists match the contr… |
| T086 | loop-2 frontend-dev | Run `npm run api:gen`; create `core/settings.store.ts` (loads once at startup via `provideAppInitializer`; exposes displayName, notificat… |
| T087 | loop-2 frontend-dev | Create `features/settings/settings-page.component.ts`: profile section (display name), notifications (in-app on/off, browser on/off — req… |
| T088 | loop-2 frontend-dev | Make NotificationService respect settings (in-app off → no toasts for plan start; browser on + granted → system notification); Playwright… |
| T089 | loop-3 testing | Backend tests `settings/SettingsServiceTest.java` (defaults created once) and `settings/SettingsControllerTest.java` (`@WebMvcTest`, `Moc… |
| T090 | loop-3 testing | Frontend unit tests `core/settings.store.spec.ts`, `features/settings/settings-page.component.spec.ts` |
| T091 | loop-3 testing | curl tests for both settings operations; Playwright MCP tests: all six nav links from every page (one click, highlight), settings form; e… |

## Phase 7: User Story 5 - See everything on a dashboard (Priority: P3)

[BE] 3 · [FE] 3 · [TEST] 3

| Task ID | Owner loop | Description |
|---|---|---|
| T092 | loop-1 backend-dev | Create DTOs `dashboard/dto/DashboardResponse.java` (`@Schema(name = "Dashboard")`), `DashboardTasks.java`, `DashboardHabits.java`, `Dashb… |
| T093 | loop-1 backend-dev | Create `dashboard/DashboardService.java` (Clock; reuses TaskService/HabitStatsCalculator/PlanStatusCalculator/repositories — no duplicate… |
| T094 | loop-1 backend-dev | Create `dashboard/DashboardController.java` (`GET /api/dashboard`, springdoc annotations); regenerate swagger, verify the full swagger no… |
| T095 | loop-2 frontend-dev | Run `npm run api:gen`; create `features/dashboard/dashboard.store.ts` (loads `getDashboard`; reloads on RefreshService bumps and every 60… |
| T096 | loop-2 frontend-dev | Create `features/dashboard/dashboard-page.component.ts` with sub-components: greeting header (time-of-day greeting + displayName, today's… |
| T097 | loop-2 frontend-dev | Playwright MCP check of the Dashboard against the running backend (metrics update after toggles on the dashboard and on other pages); scr… |
| T098 | loop-3 testing | Backend tests `dashboard/DashboardServiceTest.java` (fixed Clock, seeded data: every metric equals expected counts; archived excluded; ze… |
| T099 | loop-3 testing | Frontend unit tests `features/dashboard/dashboard.store.spec.ts`, `dashboard-page.component.spec.ts` |
| T100 | loop-3 testing | curl: `GET /api/dashboard` numbers equal counts computed from `/api/tasks`, `/api/habits`, `/api/plans`, `/api/learning-cards`; Playwrigh… |

## Phase 8: Polish & Cross-Cutting Concerns

[BE] 2 · [FE] 2 · [TEST] 3

| Task ID | Owner loop | Description |
|---|---|---|
| T101 | loop-1 backend-dev | Performance check: seed 1,000 tasks via a curl loop, confirm `GET /api/tasks` with search/filters responds < 500 ms; add indexes on `task… |
| T102 | loop-1 backend-dev | Final swagger audit: `backend/openapi/openapi.json` matches `contracts/openapi.yaml` (all paths, methods, operationIds, status codes, sch… |
| T103 | loop-2 frontend-dev | Animation audit across all pages: route view transitions, list enter/leave, dialog open/close, toggle feedback, progress and countdown an… |
| T104 | loop-2 frontend-dev | Accessibility pass: labels, focus order, focus return after dialogs, `aria-live` for toasts and validation, contrast ≥ 4.5:1 in light and… |
| T105 | loop-3 testing | Accessibility tests via Playwright MCP on all six pages in light and dark mode (`browser_snapshot` accessibility tree: every control has… |
| T106 | loop-3 testing | Performance tests: with 1,000 seeded tasks, curl timing for list/search/filter < 500 ms and Playwright-measured UI filter response < 500… |
| T107 | loop-3 testing | Full regression: backend `./mvnw verify` + JaCoCo report, frontend `npx ng test --watch=false --coverage`, and the PRD §11 end-to-end flo… |
