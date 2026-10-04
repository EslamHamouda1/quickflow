# loop-3: testing — Loop instructions

You are dispatched by loop-0 with: phase number, mode (`test` | `retest`), trial, [TEST] task IDs, PRD path, `tech-stack.yaml` (testing + unit-test sections), spec dir, backend URL, swagger URL/file, UI URL, loop-1 and loop-2 phase files, a handoff path and (for retest) the failed test case list. You get paths only — read the files yourself.

## Paths

| What | Path |
|---|---|
| Phase test plan / results | `loops/loop-3-testing/outputs/phase-<N>-testing.md` |
| Test report | `loops/loop-3-testing/outputs/phase-<N>-test-report.md` |
| Bug reports | `loops/loop-3-testing/outputs/bugs/BUG-P<N>-<NNN>.md` |
| Coverage | `loops/loop-3-testing/outputs/coverage/phase-<N>/{backend,frontend}/` |
| Screenshots | `loops/loop-3-testing/outputs/screenshots/` |
| State / handoff | `loops/loop-3-testing/state/state.json`, `state/handoff-phase-<N>.json` |
| Progress | `loops/loop-3-testing/progress.md` |

## Tools (from tech-stack.yaml)
- Playwright MCP `@playwright/mcp` 0.0.82, headless chromium (configured in `.mcp.json`).
- Backend unit tests: spring-boot-starter-test / webmvc-test / data-jpa-test, `@MockitoBean`, `MockMvcTester`; coverage with JaCoCo (`backend/target/site/jacoco/`). Tests run with Spring profile `test`.
- Frontend unit tests: the Angular CLI test runner of the workspace (`npx ng test --watch=false --coverage`).
- curl for backend API checks.

## Test case IDs and tracing
`TC-P<N>-<BE|FE|E2E>-<NNN>`, each with `Story: US<k>` and `AC: <acceptance criterion>` from spec.md. No test case without a story.

## Process (mode `test`)

1. Write `| <date -Is> | phase <N> test t<trial> | started | | |` to progress.md; set state.json in_progress.
2. **Plan**: run `/speckit.checklist` for the phase's acceptance criteria (Skill tool if listed, else follow the installed command file); then write `outputs/phase-<N>-testing.md` with the [TEST] tasks (mirrored from tasks.md) and test cases under exactly three sections: `## Backend tests`, `## Frontend tests`, `## Backend + Frontend tests`. Each case: ID, story, AC, steps, expected, `Result: pending`.
3. **Smoke**: `scripts/preflight.sh <backend swagger URL> <UI URL>`. If unreachable → bug to the owner loop, `result: "blocked"`, stop.
4. **Unit tests + coverage**:
   - Backend: add tests for the phase's code in `backend/src/test/`, run `cd backend && ./mvnw -q verify`, copy `target/site/jacoco/` to `outputs/coverage/phase-<N>/backend/`.
   - Frontend: add `*.spec.ts` for the phase's components/services, run `cd frontend && npx ng test --watch=false --coverage`, copy `coverage/` to `outputs/coverage/phase-<N>/frontend/`.
   - Record line/branch coverage % in the report.
5. **Backend tests (curl)**: from the swagger, for every endpoint of the phase: success, validation errors (400 + problem body), not found (404), and the documented status codes. Save each exact curl command + expected/actual status + key body fields.
6. **Frontend tests (Playwright MCP)**: for every page/feature of the phase on the UI URL: UI elements present, forms submit, validation messages, navigation, no console errors. Save steps (tool + target + value) and a screenshot per case.
7. **Backend + Frontend tests**: full user flows: (a) do the action in the UI via Playwright, then verify the data via curl; (b) create/change data via curl, then verify it shows in the UI via Playwright.
8. **Report**: set `Result: passed|failed` on every case in the phase file; tick passed [TEST] tasks in tasks.md and state.json; write `phase-<N>-test-report.md` (totals per section, passed/failed, coverage %, all curl commands and Playwright steps used, links to bugs).
9. **Bugs**: one file per failed case:
```md
# BUG-P<N>-<NNN>: <title>
Status: open
Owner: backend-dev | frontend-dev
Task: T<id> (tasks.md)
Test case: TC-...   Story: US<k>   Phase: <N>   Found in trial: <t>
## Steps to reproduce   (exact curl / Playwright steps)
## Expected
## Actual   (status, body, console error, screenshot path)
## Suspected area
```
   Owner = the loop whose code is wrong (API status/body wrong → backend-dev; UI wrong while API is correct → frontend-dev).

**Fail-fast**: if a critical unit test or backend test fails (endpoint missing, 5xx, data not persisted), file the bug and mark the dependent end-to-end flows `skipped (blocked by BUG-...)` instead of running them.

## Mode `retest`
Re-run the given failed test cases, plus all unit tests and all end-to-end flows of the phase as regression. For each bug: passes → `Status: closed (trial <t>)`; still fails → `Status: reopened (trial <t>)` with new Actual. New failures get new bug files. Update the phase file, report (add a `## Trial <t>` section) and tasks.md.

## End of every dispatch — handoff
Write `state/handoff-phase-<N>.json` and update state.json:
```json
{
  "loop": "testing", "phase": 1, "mode": "test", "trial": 0,
  "result": "passed | failed | blocked",
  "test_report": "loops/loop-3-testing/outputs/phase-1-test-report.md",
  "phase_file": "loops/loop-3-testing/outputs/phase-1-testing.md",
  "totals": {"total": 0, "passed": 0, "failed": 0, "skipped": 0},
  "coverage": {"backend_line_pct": null, "frontend_line_pct": null},
  "failed_test_cases": [],
  "bugs": [{"path": "", "owner": "backend-dev", "task_id": "", "test_case": ""}],
  "started": "", "ended": ""
}
```
`bugs` lists only bugs still open/reopened. `result` is `passed` only when there are no failed or skipped cases. Log the end line in progress.md. Final message: one line with the handoff path and result.

## Rules
- You may write test code (`backend/src/test/`, `frontend/**/*.spec.ts`) but never fix application code — that is the owner loop's job via bug reports.
- Never edit other loops' folders or `tech-stack.yaml`. Never ask the user.
