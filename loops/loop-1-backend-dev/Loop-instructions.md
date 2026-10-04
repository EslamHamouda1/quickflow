# loop-1: backend-dev — Loop instructions

You are dispatched by loop-0 with: phase number, mode (`implement` | `fix`), [BE] task IDs or bug report paths, PRD path, `tech-stack.yaml` (section `stack.backend`), spec dir, and a handoff file path. You get paths only — read the files yourself.

## Paths

| What | Path |
|---|---|
| Code | `backend/` (Maven wrapper project) |
| Phase files | `loops/loop-1-backend-dev/outputs/phase-<N>-backend.md` |
| State | `loops/loop-1-backend-dev/state/state.json` |
| Handoff | `loops/loop-1-backend-dev/state/handoff-phase-<N>.json` |
| Server log / pid | `loops/loop-1-backend-dev/state/backend.log`, `state/backend.pid` |
| Swagger file | `backend/openapi/openapi.json` |
| Progress | `loops/loop-1-backend-dev/progress.md` |

## Stack (exact, from tech-stack.yaml — never change versions)

- Java 25, Spring Boot 4.1.1, Maven wrapper from start.spring.io.
- springdoc-openapi-starter-webmvc-ui 3.1.1; springdoc-openapi-maven-plugin and jacoco-maven-plugin pinned in pom.xml to the latest release at setup (JaCoCo must support Java 25).
- H2 (Boot-managed) profiles: default → `jdbc:h2:file:./data/quickflow`; `test` → `jdbc:h2:file:./data/test`; `openapi` → `jdbc:h2:mem:openapi`.
- Unit tests: spring-boot-starter-test, spring-boot-starter-webmvc-test, spring-boot-starter-data-jpa-test; `@MockitoBean`, `MockMvcTester`.
- If tech-stack.yaml and these notes ever disagree, tech-stack.yaml wins.

## Start of every dispatch

1. Write `| <date -Is> | phase <N> <mode> | started | | |` to progress.md; set `state.json` `{current_phase, mode, trial, status: "in_progress"}`.
2. Read PRD, spec.md, plan.md, data-model.md, `contracts/` and tasks.md from the spec dir.
3. If `state.json` shows this phase/mode already `in_progress`, resume: skip tasks already ticked in tasks.md.

## Mode: implement

1. **Phase file**: create/refresh `outputs/phase-<N>-backend.md` from the [BE] tasks of phase N in tasks.md (same IDs, same text, `- [ ]` / `- [x]` mirrored from tasks.md — never diverge). Add sections: `## Endpoints`, `## curl checks`, `## Notes`.
2. **First phase only — bootstrap** (skip if `backend/mvnw` exists):
   - `curl -s https://start.spring.io/starter.zip -d type=maven-project -d language=java -d bootVersion=4.1.1 -d javaVersion=25 -d baseDir=backend -d groupId=<from plan.md or com.example> -d artifactId=<app name> -d dependencies=web,data-jpa,h2,validation -o /tmp/backend.zip && unzip` into the repo root. If start.spring.io rejects a version, stop and report it in the handoff (`status: "blocked"`) — do not substitute versions.
   - Add springdoc-openapi-starter-webmvc-ui 3.1.1, the three test starters, JaCoCo (report on `verify`).
   - Add a Maven profile `openapi` that starts the app with Spring profile `openapi` on port 8081 (spring-boot-maven-plugin `start`/`stop`) and runs springdoc-openapi-maven-plugin `generate` with `apiDocsUrl=http://localhost:8081/v3/api-docs` → `backend/openapi/openapi.json`.
   - The three H2 profile files as listed above; `data/` in `.gitignore`.
   - CORS: allow `http://localhost:4200` (frontend dev server).
   - Errors: `ProblemDetail` (RFC 9457) via `@RestControllerAdvice`, 400 for validation, 404 for not found.
3. **Implement**: run `/speckit.implement` scoped to the phase — args: `Implement ONLY these [BE] tasks of phase <N>: <IDs>. Code goes in backend/. Do not touch [FE] or [TEST] tasks.` (Run it with the Skill tool if listed, else read the installed `speckit.implement` command file and follow it.) Tick each finished task `- [x]` in **tasks.md, the phase file and state.json** as you go.
4. **Contract match**: controllers, DTOs, status codes and paths must match `contracts/`. Annotate with springdoc (`@Operation`, `@ApiResponse`, `@Schema`) so the generated spec matches. The contract wins over your own design.
5. **Build + unit tests** (optional unit tests, but the build must pass): `cd backend && ./mvnw -q verify`.
6. **Swagger**: `./mvnw -q -Popenapi verify -DskipTests` → `backend/openapi/openapi.json`. Compare it with `contracts/openapi.yaml`: paths, methods, operationIds, status codes, schema names, schema properties and `required` lists (e.g. `jq` over both files); fix code until they match for every operation of the phase.
7. **Run**: stop the previous server (`kill $(cat state/backend.pid)` if alive), then from `backend/`: `nohup ./mvnw spring-boot:run > ../loops/loop-1-backend-dev/state/backend.log 2>&1 & echo $! > ../loops/loop-1-backend-dev/state/backend.pid`. Poll `curl -sf http://localhost:8080/v3/api-docs` (max ~120 s). On failure read the log, fix, retry.
8. **curl tests**: for every endpoint of the phase run success, validation-error, not-found and status-code checks with `curl -s -o /dev/stderr -w '%{http_code}'`. Record each command, expected and actual status in `## curl checks`. Fix and repeat until all pass.

## Mode: fix

1. Read each bug report path (owner must be `backend-dev`). Reproduce with its curl steps.
2. Fix the code, rebuild, regenerate swagger (step 6), restart (step 7), re-run the bug's curl steps and the phase's curl checks.
3. Append to the bug report a `## Fix (backend-dev, trial <t>)` section: root cause, files changed, verification curl output. Set its `Status:` line to `fixed — awaiting retest`. Do not mark it closed; loop-3 does that.

## End of every dispatch — handoff

Write `state/handoff-phase-<N>.json` and update `state.json`:
```json
{
  "loop": "backend-dev", "phase": 1, "mode": "implement", "trial": 0,
  "status": "done | blocked | failed",
  "backend_url": "http://localhost:8080",
  "swagger_url": "http://localhost:8080/v3/api-docs",
  "swagger_ui": "http://localhost:8080/swagger-ui/index.html",
  "swagger_file": "backend/openapi/openapi.json",
  "phase_file": "loops/loop-1-backend-dev/outputs/phase-1-backend.md",
  "tasks_done": [], "tasks_open": [], "bugs_fixed": [],
  "started": "", "ended": "", "notes": ""
}
```
Log `| <date -Is> | phase <N> <mode> | done | <duration> | see loop-0 ledger | <notes> |` in progress.md. Leave the backend **running**. Your final message: one line with the handoff file path and status.

## Rules
- Only [BE] tasks; never edit `frontend/`, other loops' folders (except bug-report Fix sections), or `tech-stack.yaml`.
- Max 3 attempts at any failing build/test step inside one dispatch; then return `status: "failed"` with the reason.
- Never ask the user; never stop the backend at the end.
