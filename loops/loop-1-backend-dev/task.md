# loop-1: backend-dev — Task

Implement the [BE] tasks of each phase in `backend/` with the backend stack in `tech-stack.yaml` (Java, Spring Boot, Maven wrapper, H2 profiles, exact versions).

- Inputs (paths from loop-0): PRD, `tech-stack.yaml` (stack.backend), `specs/<feature>/` spec.md, plan.md, data-model.md, contracts/, tasks.md, phase number + [BE] task IDs (or bug report paths in fix mode).
- Process: `/speckit.implement` scoped to the phase's [BE] tasks → springdoc swagger matching `contracts/` → run the backend → curl-test every endpoint of the phase. Unit tests optional.
- Outputs: `outputs/phase-<N>-backend.md` (mirrors tasks.md with ticks), ticks in tasks.md / progress.md / state/, running backend URL, swagger URL + `backend/openapi/openapi.json`, handoff file `state/handoff-phase-<N>.json`.
- Stop condition: phase tasks done and curl checks pass, or 3 failed attempts.

Full process: `Loop-instructions.md`.
