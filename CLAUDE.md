# Project: PRD → Spec Kit → backend / frontend / testing loops

Run everything with one line: `/orchestrator <path/to/feature-PRD.md>`.

## Layout
- `tech-stack.yaml` — the only source of stack + versions. Read-only for all loops; changed only by the user.
- `specs/<NNN-feature>/` — Spec Kit artifacts, single source of truth. `tasks.md` tasks carry an owner tag `[BE]`, `[FE]` or `[TEST]`; only the owner loop ticks a task.
- `loops/loop-0-orchestrator/` — `/orchestrator` (`.claude/commands/orchestrator.md`).
- `loops/loop-1-backend-dev/` — agent `backend-dev`, code in `backend/` (http://localhost:8080).
- `loops/loop-2-frontend-dev/` — agent `frontend-dev`, code in `frontend/` (http://localhost:4200).
- `loops/loop-3-testing/` — agent `testing`.
- Each loop folder: `Loop-instructions.md` (process), `task.md`, `progress.md` (milestones with start/end time and tokens), `state/` (JSON, resume source), `outputs/` (one md per phase).
- `scripts/preflight.sh` — checks that input files exist and URLs answer.
- `.mcp.json` — Playwright MCP (headless chromium) used by frontend-dev and testing.

## Rules
- Phase md files in `outputs/` mirror `tasks.md` and must never diverge from it.
- Loops hand off through `loops/<loop>/state/handoff-phase-<N>.json`; the orchestrator passes paths and URLs only.
- Clarify / analyze never ask the user: take the recommended answer, max 10 rounds.
- Max 3 bug-fix trials per phase.
