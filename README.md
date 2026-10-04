# QuickFlow

QuickFlow is a personal productivity app. It puts tasks, habits, learning resources and time-boxed plans in one workspace, with a dashboard that sums them all up.

The app was built by a pipeline of Claude Code agents, not by hand. The pipeline starts from a product requirements document ([Task_PRD.md](Task_PRD.md)). [Spec Kit](https://github.com/github/spec-kit) turns that document into a spec, a plan and a task list. Then backend, frontend and testing agents build and test the app one phase at a time. This repo holds both the app and the pipeline that built it.

## Features

| Area | What you can do |
|---|---|
| **Tasks** | Create, edit, complete, archive, restore and delete tasks. Search, filter and sort, and see what's overdue. |
| **Habits** | Track daily and weekly habits, with streaks, completion rates and undo. |
| **Learning** | Track learning resources, each with its own milestones and notes. Status updates from milestone progress. |
| **Plans** | Group tasks, habits and learning resources into a scheduled plan with a start and end time and a priority. Live progress and a countdown to the end. |
| **Dashboard** | Today's tasks, a habit checklist, live plans and a learning snapshot, with quick-add. |
| **Settings** | Display name, in-app and browser notifications, and which page opens first. |

## Tech stack

All versions are pinned in [tech-stack.yaml](tech-stack.yaml).

- **Backend:** Java 25, Spring Boot 4.1.1, Spring Data JPA, H2, springdoc-openapi, JaCoCo
- **Frontend:** Angular 22.2 (standalone components, signals, zoneless), TypeScript client generated from the backend's OpenAPI spec with openapi-generator
- **Testing:** JUnit and MockMvc, the Angular unit-test runner, curl, and Playwright MCP (headless Chromium)
- **Planning:** Spec Kit 1.0.11

## Quick start

You need **JDK 25** and **Node.js 24.15 or newer**. An older JDK fails to compile the backend, and an older Node makes the Angular CLI refuse to start.

```bash
# Backend: http://localhost:8081 (Swagger UI at /swagger-ui/index.html)
cd backend
./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081

# Frontend: http://localhost:4200 (in a second terminal)
cd frontend
npm install
npx ng serve
```

Then open http://localhost:4200.

> **Port note:** the frontend calls the API at `http://localhost:8081`, set by `apiUrl` in [frontend/src/environments/environment.development.ts](frontend/src/environments/environment.development.ts). The backend's own default port is 8080. To use 8080, change `apiUrl` and start the backend without the `--server.port` argument.

Data is stored in a local H2 file database at `backend/data/`, which git ignores.

### Tests

```bash
cd backend && ./mvnw verify                      # unit tests + JaCoCo report in target/site/jacoco/
cd frontend && npx ng test --watch=false --coverage
```

If you change the backend API, regenerate the OpenAPI spec and the frontend client:

```bash
cd backend && ./mvnw -Popenapi verify -DskipTests   # writes backend/openapi/openapi.json
cd frontend && npm run api:gen                       # regenerates src/app/api/
```

## How it was built

One command runs the whole pipeline in Claude Code:

```
/orchestrator Task_PRD.md
```

1. **loop-0, orchestrator:** runs Spec Kit (constitution → specify → clarify → plan → tasks → analyze) and answers its own clarifying questions using the recommended option. It then splits the work into phases.
2. **loop-1, backend-dev:** builds each phase's `[BE]` tasks, keeps the generated swagger matching the contract, and checks the endpoints with curl.
3. **loop-2, frontend-dev:** builds each phase's `[FE]` tasks on the generated API client and checks each feature with Playwright.
4. **loop-3, testing:** runs unit tests with coverage, curl checks, Playwright checks and end-to-end flows. It files bug reports, and the owner loop fixes them. A phase gets at most 3 fix-and-retest rounds.

The full walkthrough is in **[docs/FLOW.md](docs/FLOW.md)**.

**Result of the run:** all 8 phases passed testing, and all 107 of 107 tasks were completed. Three bugs were found and fixed, each within one fix round. Details are in [run-summary.md](loops/loop-0-orchestrator/outputs/run-summary.md).

## Repository layout

```
backend/                 Spring Boot API (port 8080 by default)
frontend/                Angular app (port 4200)
specs/001-quickflow-productivity/
                         Spec Kit output: spec, plan, data model, OpenAPI contract, tasks
loops/
  loop-0-orchestrator/   run plan, run summary, pipeline state and logs
  loop-1-backend-dev/    per-phase backend notes and handoffs
  loop-2-frontend-dev/   per-phase frontend notes, handoffs and screenshots
  loop-3-testing/        test plans, test reports, bug reports and screenshots
.claude/                 agent definitions, /orchestrator command, Spec Kit skills
.specify/                Spec Kit scripts and templates
docs/FLOW.md             how the pipeline works
tech-stack.yaml          the only source of stack and versions
Task_PRD.md              the input PRD
```
