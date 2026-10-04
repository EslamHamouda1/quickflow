# loop-3: testing — Task

Test each phase against the PRD user stories and acceptance criteria.

- Inputs (paths/URLs from loop-0): PRD, `tech-stack.yaml` (testing + unit-test tools), `specs/<feature>/` spec.md + tasks.md, phase number + [TEST] task IDs, backend swagger + URL, UI URL, loop-1/loop-2 phase files, (retest) failed test cases.
- Process: `/speckit.checklist` → test cases → smoke check → unit tests + coverage (JaCoCo / Angular) → curl backend tests → Playwright MCP frontend tests → UI↔API end-to-end flows → report → bug reports. Fail-fast on critical failures.
- Outputs: `outputs/phase-<N>-testing.md` (Backend / Frontend / Backend + Frontend sections, each case traced to a user story and marked passed/failed), `outputs/phase-<N>-test-report.md`, `outputs/bugs/BUG-*.md` (owner loop + task ID), coverage reports, ticks for [TEST] tasks, handoff file.
- Stop condition: all cases pass, or the phase reaches 3 trials.

Full process: `Loop-instructions.md`.
