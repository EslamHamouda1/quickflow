# Implementation Plan: QuickFlow Personal Productivity Workspace

**Branch**: `001-quickflow-productivity` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-quickflow-productivity/spec.md`

## Summary

A single-user web app with six pages (Dashboard, Tasks, Habits, Learning Resources, Todo Plans,
Settings). A Spring Boot REST API (`backend/`, :8080) owns persistence (H2) and all business rules
(validation, overdue, habit stats, learning status, derived plan status/progress/rest time,
plan-item side effects, dashboard aggregation) behind an injectable clock. An Angular zoneless
SPA (`frontend/`, :4200) consumes the API exclusively through a client generated from the
springdoc swagger, adds a 1 s ticker for live rest time, in-app/browser start notifications, and a
polished, animated, WCAG 2.1 AA UI. Contract: [contracts/openapi.yaml](contracts/openapi.yaml).

## Technical Context

**Language/Version**: Java 25 (JDK 25 LTS) backend; TypeScript (Angular 22.2.0 toolchain) on Node 24.x LTS (>= 24.15) frontend

**Primary Dependencies**: Spring Boot 4.1.1 (webmvc, data-jpa, validation), springdoc-openapi-starter-webmvc-ui 3.1.1, springdoc-openapi-maven-plugin + jacoco-maven-plugin (pinned in pom.xml at setup); Angular 22.2.0 (standalone, signals, zoneless), @openapitools/openapi-generator-cli 2.41.0 (typescript-angular)

**Storage**: H2 (Boot-managed): default profile file `./data/quickflow`, `test` file `./data/test`, `openapi` in-memory

**Testing**: spring-boot-starter-test, spring-boot-starter-webmvc-test, spring-boot-starter-data-jpa-test (`@MockitoBean`, `MockMvcTester`) + JaCoCo; Angular CLI unit-test builder (Vitest) with coverage; curl API checks; @playwright/mcp 0.0.82 (headless chromium) for UI, end-to-end and accessibility checks (accessibility snapshot, contrast evaluation, keyboard walkthrough)

**Target Platform**: Local machine — backend JVM on Linux/macOS/Windows, modern desktop browser (Chromium for tests)

**Project Type**: Web application (REST backend + SPA frontend)

**Performance Goals**: CRUD/filter results visible < 500 ms with up to 1,000 items per entity; rest time refresh every 1 s (minimum every 60 s); animations ≤ 250 ms, 60 fps

**Constraints**: Single user, no auth; versions pinned by tech-stack.yaml; generated API client only; RFC 9457 errors; reduced-motion respected; state persists across restarts

**Scale/Scope**: 1 user, ≤ 1,000 items per entity, 6 pages, 37 API operations, 9 entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|---|---|---|---|
| I. Pinned Tech Stack | Only tech-stack.yaml technologies/versions | PASS | PASS — research R11–R14 use only the pinned stack (accessibility checked with Playwright MCP, no extra library) |
| II. Contract-First API | OpenAPI contract + matching springdoc swagger + problem+json | PASS | PASS — contracts/openapi.yaml, R2, R12 |
| III. Generated API Client | FE calls backend only via typescript-angular client | PASS | PASS — R13 (`src/app/api/` generated, never edited) |
| IV. Tested Phases | curl + Playwright + e2e + unit/coverage per phase, traced to US | PASS | PASS — R14, quickstart scenarios per US, [TEST] tasks per phase |
| V. Separated, Testable Domain Logic | Rules in domain/services with injectable clock | PASS | PASS — R3, R4, R8, R9, R10 calculators |
| VI. Simplicity | No speculative components | PASS | PASS — derived plan status (no scheduler), polling (no websockets), no paging |

No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-quickflow-productivity/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities, rules, transitions
├── quickstart.md        # Phase 1 run + validation guide
├── contracts/
│   └── openapi.yaml     # Phase 1 REST contract (source of swagger + client)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/                                   # Maven wrapper project (groupId com.quickflow, artifactId quickflow)
├── pom.xml                                # Boot 4.1.1, springdoc 3.1.1, jacoco, profile "openapi"
├── openapi/openapi.json                   # generated swagger (springdoc-openapi-maven-plugin)
└── src/
    ├── main/java/com/quickflow/
    │   ├── QuickflowApplication.java
    │   ├── config/                        # ClockConfig, CorsConfig, OpenApiConfig
    │   ├── common/                        # ApiExceptionHandler (ProblemDetail), NotFoundException, ConflictException, BadRequestException, FieldErrorDto, Problem (doc schema)
    │   ├── task/                          # Task, TaskStatus, TaskPriority, TaskRepository, TaskSpecifications, TaskService, TaskController, dto/
    │   ├── habit/                         # Habit, HabitCompletion, HabitFrequency, repositories, HabitStatsCalculator, HabitService, HabitController, dto/
    │   ├── learning/                      # LearningCard, LearningMilestone, LearningNote, LearningStatus, repo, LearningStatusCalculator, LearningService, LearningController, dto/
    │   ├── plan/                          # Plan, PlanItem, enums, PlanRepository, PlanStatusCalculator, PlanItemCompletionService, PlanService, PlanController, dto/
    │   ├── dashboard/                     # DashboardService, DashboardController, dto/
    │   └── settings/                      # Settings, SettingsRepository, SettingsService, SettingsController, dto/
    ├── main/resources/
    │   ├── application.yaml               # default: jdbc:h2:file:./data/quickflow
    │   ├── application-test.yaml          # jdbc:h2:file:./data/test
    │   └── application-openapi.yaml       # jdbc:h2:mem:openapi, port 8081
    └── test/java/com/quickflow/           # calculator unit tests, @WebMvcTest, @DataJpaTest, service tests

frontend/                                  # Angular 22.2.0 workspace
├── package.json                           # script api:gen (openapi-generator-cli 2.41.0, typescript-angular)
├── openapitools.json
└── src/
    ├── environments/environment*.ts       # apiUrl = http://localhost:8080
    ├── styles/                            # tokens.scss, motion.scss (reduced-motion), base.scss
    └── app/
        ├── api/                           # GENERATED — never edit
        ├── app.config.ts                  # zoneless, router (view transitions), http client, BASE_PATH
        ├── app.routes.ts                  # lazy routes + default-view redirect
        ├── core/                          # NowService (1 s signal), NotificationService (toast + browser), RefreshService, SettingsStore, PlanStartWatcher, reduced-motion, api-errors, format (rest-time formatter)
        ├── shared/                        # ui/: empty-state, confirm-dialog, progress-bar, toast-host, form-field
        ├── layout/                        # shell with persistent nav
        └── features/
            ├── dashboard/
            ├── tasks/
            ├── habits/
            ├── learning/
            ├── plans/
            └── settings/
```

**Structure Decision**: Web application with `backend/` and `frontend/` at the repo root (plan
template option 2), feature-packaged on both sides so each user story maps to one backend package
and one frontend feature folder.

## Delivery phases (input for /speckit-tasks)

| Phase | Scope | Stories |
|---|---|---|
| 1 | Setup + foundation: backend bootstrap (pom, profiles, clock, CORS, problem+json, swagger generation), frontend bootstrap (zoneless app, design tokens, motion, shell + persistent nav, client generation, core services) | — |
| 2 | Tasks end to end | US1 |
| 3 | Habits end to end | US2 |
| 4 | Learning resources end to end | US3 |
| 5 | Todo Plans end to end (builder, derived status, rest time, notifications, item side effects, history) | US4 |
| 6 | Settings + navigation end to end (needed by the dashboard greeting/default view) | US6 |
| 7 | Dashboard end to end | US5 |
| 8 | Polish: animation, accessibility and performance audits, full e2e regression | all |

Each phase: [BE] backend tasks → [FE] frontend tasks → [TEST] tasks (unit + coverage, curl,
Playwright, end-to-end), so every phase is independently testable.

## Complexity Tracking

No constitution violations.
