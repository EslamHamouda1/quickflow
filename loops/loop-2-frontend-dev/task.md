# loop-2: frontend-dev — Task

Implement the [FE] tasks of each phase in `frontend/` with the frontend stack in `tech-stack.yaml` (Node, Angular, exact versions).

- Inputs (paths/URLs from loop-0): PRD, `tech-stack.yaml` (stack.frontend), `specs/<feature>/` spec.md, plan.md, tasks.md, phase number + [FE] task IDs (or bug report paths in fix mode), backend swagger + backend URL.
- Process: generate the API client from the swagger with openapi-generator-cli (typescript-angular, never hand-written) → `/speckit.implement` scoped to the phase's [FE] tasks → run the UI → check each feature with Playwright MCP. Unit tests optional.
- Outputs: `outputs/phase-<N>-frontend.md` (mirrors tasks.md with ticks), ticks in tasks.md / progress.md / state/, running UI URL, handoff file `state/handoff-phase-<N>.json`.
- Stop condition: phase tasks done and Playwright checks pass, or 3 failed attempts.

Full process: `Loop-instructions.md`.
