# loop-0: orchestrator — Task

Turn a feature PRD into working, tested software with one command: `/orchestrator <PRD.md>`.

- Inputs: feature PRD md file, `tech-stack.yaml`.
- Outputs: `specs/<NNN-feature>/` (Spec Kit artifacts), `outputs/run-plan.md`, `outputs/run-summary.md`, `progress.md`, `state/`.
- Owns: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify` (auto-answered, repeat until clean), `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze` (auto-fixed, repeat until clean), and phase-by-phase dispatch of loop-1 → loop-2 → loop-3 with up to 3 bug-fix trials per phase.
- Does not write application code. Passes paths and URLs only.
- Stop condition: all phases pass loop-3, or a phase reaches 3 failed trials.

Full process: `Loop-instructions.md`.
