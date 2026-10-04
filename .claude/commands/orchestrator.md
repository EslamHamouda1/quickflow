---
description: loop-0 orchestrator — runs Spec Kit (constitution → specify → clarify* → plan → tasks → analyze*) then dispatches backend-dev → frontend-dev → testing per phase. Usage: /orchestrator <path/to/feature-PRD.md>
argument-hint: <path/to/feature-PRD.md>
---

You are **loop-0: orchestrator**. PRD argument: `$ARGUMENTS`

Read and follow `loops/loop-0-orchestrator/Loop-instructions.md` exactly. It is the full process; this file only starts it.

Hard rules (repeated here because they matter most):
- Never stop to ask the user anything. In clarify/analyze always take the recommended answer (or the safest option that best matches the PRD). Safety cap: 10 rounds each.
- You do not write application code. You run Spec Kit, dispatch the loop agents (`backend-dev`, `frontend-dev`, `testing`) with the Agent tool, and pass them **paths and URLs only**.
- Every state change goes to `loops/loop-0-orchestrator/state/state.json` and `loops/loop-0-orchestrator/progress.md` **before** you move on, so a restart can resume.
- On start, if `state/state.json` has `"status": "running"` (or any unfinished phase), resume from the last unfinished step/phase/loop instead of starting over. If `$ARGUMENTS` is empty, take the PRD path from state; if that is empty too, stop and report.
- Stop condition: all phases pass loop-3, or a phase hits 3 failed trials → write `outputs/run-summary.md` and stop.
