# loop-0: orchestrator — Loop instructions

Entry point: `/orchestrator <path/to/feature-PRD.md>` (e.g. `/orchestrator Task_PRD.md`).

## Paths

| What | Path |
|---|---|
| This loop | `loops/loop-0-orchestrator/` |
| State (source of truth for resume) | `loops/loop-0-orchestrator/state/state.json` |
| Clarify / analyze round logs | `loops/loop-0-orchestrator/state/clarify-log.json`, `state/analyze-log.json` |
| Progress log | `loops/loop-0-orchestrator/progress.md` |
| Run plan / summary | `loops/loop-0-orchestrator/outputs/run-plan.md`, `outputs/run-summary.md` |
| Tech stack (read-only) | `tech-stack.yaml` |
| Spec Kit artifacts | `specs/<NNN-feature>/` |
| Loop agents | `.claude/agents/backend-dev.md`, `frontend-dev.md`, `testing.md` |
| Preflight checker | `scripts/preflight.sh` |

## How to run a Spec Kit command

`specify init --ai claude` installs the Spec Kit commands into `.claude/` (as `.claude/commands/speckit.*.md` or `.claude/skills/speckit-*`). To "run `/speckit.X <args>`":
1. Invoke it with the Skill tool if `speckit.X` / `speckit-X` is listed, else
2. Read the installed command file and carry out its instructions yourself, with `<args>` as `$ARGUMENTS`.

Never hand-edit Spec Kit's scripts or templates.

## Logging rules (every step)

- Before a step: append `| <ISO time> | <step> | started | | |` to the table in `progress.md` and set `state.json.current_step`.
- After a step: append `| <ISO time> | <step> | done/failed | <duration> | <tokens> | <notes> |`.
- Tokens: for dispatched agents, copy `total_tokens` and `duration_ms` from the Agent tool result into `state.json.ledger[]` and progress.md. For steps you run yourself, write `n/a (in-session; see /cost)`. Never invent numbers.
- Get timestamps with `date -Is`.
- Use `scripts/orch.py` for updates (inline `python3 -c`/heredocs are blocked): `python3 scripts/orch.py set <state.json> <dotted.key> '<json>'`, `append <file.json> <key|.> '<json>'`, `get <state.json> <key>`, `log <progress.md> <step> <status> [duration] [tokens] [notes]`.

## Process

### 0. Setup (first run only, skip parts already true in state.json.setup)
1. If `specify` is missing: `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@<planning.spec_kit from tech-stack.yaml>`.
2. If `.specify/` is missing: `specify init --here --ai claude` (answer yes to merging into a non-empty dir: add `--force` if it asks).
3. Run `/speckit.constitution` with: the full content of `tech-stack.yaml` (stack + pinned versions, "never change versions unless tech-stack.yaml changes"), plus these principles:
   - Backend: Java + Spring Boot via Maven wrapper, H2 profiles exactly as in tech-stack.yaml, springdoc-openapi swagger required and must match `contracts/`, JaCoCo coverage.
   - Frontend: Angular standalone + signals + zoneless; API client generated from the backend swagger by openapi-generator-cli (typescript-angular), never hand-written.
   - Testing: every phase tested with curl (backend), Playwright MCP (UI) and end-to-end flows; unit tests + coverage for backend and frontend; every test case traces to a user story ID.
   - Coding standards: small focused classes, validation on all inputs, consistent error body (RFC 9457 problem+json), no secrets in code.
4. Set `state.json.setup = {specify_installed, specify_init, constitution: true}`.

### 1. Specify
Run `/speckit.specify` with the whole PRD content. Record the created feature dir in `state.json.feature_dir` (e.g. `specs/001-quickflow`) and `state.json.prd`.

### 2. Clarify loop (no user input)
Repeat, max 10 rounds:
a. Run `/speckit.clarify`.
b. When it presents a question, **do not ask the user**: pick the option marked *Recommended*; if none, the safest option that best matches the PRD. Let Spec Kit integrate the answer into spec.md as it normally would.
c. Append `{round, time, questions:[{q, options, chosen, reason}]}` to `state/clarify-log.json`, and a round summary to `progress.md`.
d. Stop when clarify reports no questions / no critical ambiguities. Set `state.json.pipeline.clarify = {status: "clean", rounds}`.
If round 10 is still not clean: set status `"capped"`, list the open items in `run-summary.md`, and stop the run.

### 3. Plan
Run `/speckit.plan` with this technical context: the content of `tech-stack.yaml` plus "backend in `backend/` (port 8080), frontend in `frontend/` (port 4200), the OpenAPI file in `contracts/` is the source for the backend swagger and the generated Angular client". Expect `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

### 4. Tasks
Run `/speckit.tasks` with: "Split into numbered phases. After each task ID add exactly one owner tag: `[BE]` (backend code in backend/), `[FE]` (frontend code in frontend/) or `[TEST]` (test planning, unit tests/coverage, curl/Playwright/e2e checks). Example: `- [ ] T012 [BE] [P] [US1] Create TaskController in backend/src/main/java/...`. Every phase that delivers user-facing behaviour must have [TEST] tasks."
Then verify every task line has exactly one owner tag; fix any missing tag in tasks.md yourself.

### 5. Analyze loop (gate before any code; no user input)
Repeat, max 10 rounds:
a. Run `/speckit.analyze`.
b. For each finding, apply the recommended fix (or the safest fix that matches the PRD) to the right artifact (spec.md / plan.md / tasks.md). `/speckit.analyze` is read-only, so you make the edits; keep the owner tags valid.
c. Log `{round, time, findings:[{id, severity, artifact, fix}]}` to `state/analyze-log.json` and a summary to `progress.md`.
d. Stop when analyze reports zero findings. Cap handling same as clarify.

Then write `outputs/run-plan.md`: one section per phase with its name, and a table `Task ID | Owner loop | Description` (owner: [BE]→loop-1 backend-dev, [FE]→loop-2 frontend-dev, [TEST]→loop-3 testing). Fill `state.json.phases[]` (see state schema below).

### 6. Dispatch, for each phase in order (skip phases with status `passed`)

Before each loop: run `scripts/preflight.sh <files/URLs the loop needs>`. If anything is missing/unreachable → mark the phase `blocked`, report in `run-summary.md`, stop.

Dispatch with the Agent tool (`subagent_type` = loop name, `run_in_background: false`). The prompt contains **only paths, URLs, the phase number and task IDs** — use the templates below verbatim with values filled in. After each agent returns, read its handoff from `loops/<loop>/state/handoff-phase-<N>.json` (not from the chat text), copy it into `state.json.handoffs`, update the ledger, then continue.

If a phase has no tasks for a loop, skip that loop and reuse the latest handoff values already in state.json.

**a. backend-dev**
```
Phase: <N>   Tasks: <[BE] IDs>   Mode: implement
PRD: <path>
Tech stack: tech-stack.yaml (section: stack.backend)
Spec dir: <feature_dir>  (spec.md, plan.md, data-model.md, contracts/, tasks.md)
Write handoff to: loops/loop-1-backend-dev/state/handoff-phase-<N>.json
```
Wait for handoff: `backend_url`, `swagger_url`, `swagger_file`, `phase_file`.

**b. frontend-dev**
```
Phase: <N>   Tasks: <[FE] IDs>   Mode: implement
PRD: <path>
Tech stack: tech-stack.yaml (section: stack.frontend)
Spec dir: <feature_dir>  (spec.md, plan.md, tasks.md)
Backend URL: <backend_url>   Swagger: <swagger_url> | <swagger_file>
Write handoff to: loops/loop-2-frontend-dev/state/handoff-phase-<N>.json
```
Wait for handoff: `ui_url`, `phase_file`.

**c. testing**
```
Phase: <N>   Tasks: <[TEST] IDs>   Mode: test   Trial: <t>
PRD: <path>
Tech stack: tech-stack.yaml (sections: stack.testing, stack.backend.unit_tests, stack.frontend)
Spec dir: <feature_dir>  (spec.md, tasks.md)
Backend URL: <backend_url>   Swagger: <swagger_url> | <swagger_file>
UI URL: <ui_url>
Loop phase files: <loop-1 phase_file>, <loop-2 phase_file>
Write handoff to: loops/loop-3-testing/state/handoff-phase-<N>.json
```
Wait for handoff: `test_report`, `bugs: [{path, owner, task_id, test_case}]`, `failed_test_cases`, `result`.

**d. Bug-fix trials** (when `bugs` is non-empty)
- `trial += 1` in `state.json.phases[N].trials`. If trial would exceed 3 → phase `failed`, stop (step 7).
- Add bugs to `state.json.open_bugs`. Dispatch each owner loop once with all its bugs:
```
Phase: <N>   Mode: fix   Trial: <t>
Bugs: <bug path> (task <ID>), ...
(same PRD / tech stack / spec dir / backend URL / swagger lines as its implement dispatch)
Write handoff to: loops/<loop>/state/handoff-phase-<N>.json
```
  Backend fixes first (frontend may need to regenerate the client from the new swagger).
- Re-dispatch testing with step c inputs + `Mode: retest` and `Failed test cases: <list from handoff>`.
- Remove fixed bugs from `open_bugs`.

**e. Phase done**: save all handoff values in state.json, set phase `passed`, log in progress.md, next phase.

### 7. Finish
Write `outputs/run-summary.md`:
- Overall result and stop reason.
- Spec Kit pipeline: clarify rounds, analyze rounds (links to the logs).
- Table per phase: `Phase | Loop | Status | Trials | Start | End | Duration | Tokens`.
- Bugs: every bug report path, owner, task ID, final status.
- Handoff values (backend URL, swagger, UI URL, test reports).
- Totals: wall time, total tokens of dispatched agents (+ note that loop-0's own tokens are only visible via `/cost`).
- Any capped / blocked items.
Set `state.json.status` to `done` / `failed` / `blocked`.

## state.json schema
```json
{
  "status": "not_started | running | done | failed | blocked",
  "prd": null, "feature_dir": null,
  "started": null, "ended": null,
  "current_step": null, "current_phase": null, "current_loop": null,
  "setup": {"specify_installed": false, "specify_init": false, "constitution": false},
  "pipeline": {"specify": "pending", "clarify": {"status": "pending", "rounds": 0},
               "plan": "pending", "tasks": "pending", "analyze": {"status": "pending", "rounds": 0}},
  "phases": [{"number": 1, "name": "", "be_tasks": [], "fe_tasks": [], "test_tasks": [],
              "status": "pending | in_progress | passed | failed | blocked",
              "loops": {"backend-dev": "pending", "frontend-dev": "pending", "testing": "pending"},
              "trials": 0}],
  "open_bugs": [],
  "handoffs": {"backend_url": null, "swagger_url": null, "swagger_file": null, "ui_url": null,
               "phases": {}},
  "ledger": [{"loop": "", "phase": 0, "mode": "", "trial": 0, "started": "", "ended": "",
              "duration_ms": 0, "total_tokens": 0}]
}
```

## Resume
On start read state.json. Continue from the first step whose status is not done; within step 6, from the first phase not `passed` and its first loop not `done`. A loop marked `in_progress` is re-dispatched (the loop agents resume from their own state).
