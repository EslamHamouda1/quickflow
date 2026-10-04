<!--
Sync Impact Report
- Version change: template (unversioned) → 1.0.0
- Modified principles: all placeholders replaced (initial ratification)
- Added principles: I. Pinned Tech Stack; II. Contract-First API; III. Generated API Client;
  IV. Tested Phases (NON-NEGOTIABLE); V. Separated, Testable Domain Logic; VI. Simplicity
- Added sections: Technology & Quality Constraints; Development Workflow
- Removed sections: none
- Follow-up TODOs: none
-->

# QuickFlow Constitution

## Core Principles

### I. Pinned Tech Stack

`tech-stack.yaml` is the only source of technologies and versions. Every loop MUST use exactly
the versions it pins:

- Backend: JDK 25 (LTS), Spring Boot 4.1.1, springdoc-openapi-starter-webmvc-ui 3.1.1,
  springdoc-openapi-maven-plugin and jacoco-maven-plugin pinned in `pom.xml` (latest release at
  setup; JaCoCo MUST support Java 25), Maven wrapper from start.spring.io.
- Database: H2 (Boot-managed) with three profiles: default = file `./data/quickflow`,
  `test` = file `./data/test`, `openapi` = in-memory.
- Backend unit tests: spring-boot-starter-test, spring-boot-starter-webmvc-test,
  spring-boot-starter-data-jpa-test; `@MockitoBean`, `MockMvcTester`.
- Frontend: Node 24.x LTS (>= 24.15), Angular 22.2.0 (standalone components, signals,
  zoneless change detection).
- API client: `@openapitools/openapi-generator-cli` 2.41.0, generator `typescript-angular`.
- UI testing: `@playwright/mcp` 0.0.82 (headless, chromium).
- Planning: Spec Kit v1.0.11.

Versions MUST NOT change unless the user first updates `tech-stack.yaml`. Rationale: reproducible
builds and one shared contract between all loops.

### II. Contract-First API

The OpenAPI contract in `specs/<feature>/contracts/` is the source of truth for the backend API.
The backend MUST expose a springdoc-openapi swagger (`/v3/api-docs`, Swagger UI) whose paths,
methods, schemas and status codes match the contract. Every error response MUST use RFC 9457
`application/problem+json` (400 for validation, 404 for not found, 409 for conflicts).
Rationale: frontend and tests are built against the contract, so drift breaks them.

### III. Generated API Client

The frontend MUST call the backend only through the client generated from the backend swagger
by openapi-generator-cli (`typescript-angular`). Generated code MUST NOT be hand-edited or
hand-written; it is regenerated whenever the swagger changes. Rationale: one typed, contract-
derived integration point.

### IV. Tested Phases (NON-NEGOTIABLE)

Every delivered phase MUST be verified before the next phase starts:

- Backend endpoints with curl (success, validation errors, not found, status codes).
- UI features with Playwright MCP (elements, forms, validation messages, navigation).
- End-to-end flows: action in the UI verified via the API, and action via the API verified in
  the UI.
- Unit tests with coverage for backend (JaCoCo) and frontend (Angular test runner).
- Every test case MUST trace to a user story ID in `spec.md`.

A phase passes only when all its test cases pass; a phase that fails 3 fix trials stops the run.

### V. Separated, Testable Domain Logic

Business rules (validation, overdue detection, habit duplicate prevention, plan status
transitions, rest-time computation, completion roll-up, dashboard metrics) MUST live in domain/
service code separate from controllers and UI components, and MUST be unit-testable without a
web server or browser. Time-dependent logic MUST take the current time from an injectable clock.
Completion-state logic MUST NOT be duplicated between a plan item and its source entity beyond
what the spec requires. Rationale: correctness of rules is checked by fast unit tests.

### VI. Simplicity

Build the smallest thing that satisfies the spec (YAGNI). Small, focused classes and components;
no speculative abstractions; validate all inputs at the API boundary; no secrets in code.

## Technology & Quality Constraints

- Backend code lives in `backend/` (port 8080); frontend in `frontend/` (port 4200); the backend
  allows CORS from `http://localhost:4200`.
- Single-user application: no authentication, multi-tenancy or team features in the MVP.
- Typical create/update/delete/filter actions MUST complete in under 500 ms locally.
- Live rest-time indicators MUST update at least once per minute (once per second preferred).
- State MUST persist across restarts (file-based H2 in the default profile).

## Development Workflow

- Spec Kit order: constitution → specify → clarify (repeat until clean) → plan → tasks →
  analyze (repeat until clean) → implement → checklist.
- `specs/<feature>/` is the single source of truth; `tasks.md` tasks carry exactly one owner tag
  `[BE]`, `[FE]` or `[TEST]`, and only the owner loop ticks a task.
- Each loop (orchestrator, backend-dev, frontend-dev, testing) keeps `Loop-instructions.md`,
  `task.md`, `progress.md`, `state/` and `outputs/`; phase files in `outputs/` mirror `tasks.md`.
- Bugs found by testing are filed as bug reports assigned to the owner loop and referencing the
  task ID; the owner loop fixes, testing re-tests (max 3 trials per phase).

## Governance

This constitution supersedes other practices for this project. Amendments are made with
`/speckit-constitution`, recorded in the Sync Impact Report, and versioned semantically (MAJOR:
principle removal/redefinition; MINOR: new principle or section; PATCH: wording). Changing a
pinned version requires updating `tech-stack.yaml` first. `/speckit-analyze` checks plan and tasks
against these principles; constitution conflicts are always CRITICAL. Runtime guidance for agents
lives in `CLAUDE.md` and each loop's `Loop-instructions.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
