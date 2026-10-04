# loop-2: frontend-dev — Loop instructions

You are dispatched by loop-0 with: phase number, mode (`implement` | `fix`), [FE] task IDs or bug report paths, PRD path, `tech-stack.yaml` (section `stack.frontend`), spec dir, backend URL, swagger URL/file, and a handoff file path. You get paths only — read the files yourself.

## Paths

| What | Path |
|---|---|
| Code | `frontend/` (Angular workspace) |
| Generated API client (never hand-edit) | `frontend/src/app/api/` |
| Phase files | `loops/loop-2-frontend-dev/outputs/phase-<N>-frontend.md` |
| Screenshots | `loops/loop-2-frontend-dev/outputs/screenshots/` |
| State / handoff | `loops/loop-2-frontend-dev/state/state.json`, `state/handoff-phase-<N>.json` |
| Server log / pid | `loops/loop-2-frontend-dev/state/frontend.log`, `state/frontend.pid` |
| Progress | `loops/loop-2-frontend-dev/progress.md` |

## Stack (exact, from tech-stack.yaml — never change versions)

- Node 24.x LTS (>= 24.15). Check `node -v` first; stop with `status: "blocked"` if it does not match.
- Angular 22.2.0: standalone components, signals, zoneless change detection.
- API client: `@openapitools/openapi-generator-cli` 2.41.0, generator `typescript-angular`, generated from the backend swagger. **Never write HTTP calls to the backend by hand** — always go through the generated services.
- If tech-stack.yaml and these notes ever disagree, tech-stack.yaml wins.

## Start of every dispatch

1. Write `| <date -Is> | phase <N> <mode> | started | | |` to progress.md; set state.json `{current_phase, mode, trial, status: "in_progress"}`.
2. Read PRD, spec.md, plan.md, tasks.md. Check the backend URL answers (`curl -sf <swagger_url>`); if not, return `status: "blocked"`.
3. If state.json shows this phase/mode already `in_progress`, resume: skip tasks already ticked in tasks.md.

## Mode: implement

1. **Phase file**: create/refresh `outputs/phase-<N>-frontend.md` from the [FE] tasks of phase N in tasks.md (same IDs/text, ticks mirrored — never diverge). Add sections: `## Pages / features`, `## Playwright checks`, `## Notes`.
2. **First phase only — bootstrap** (skip if `frontend/angular.json` exists):
   - `npx -y @angular/cli@22.2.0 new <app name from plan.md> --directory frontend --zoneless --routing --style=scss --ssr=false --skip-git --skip-tests=false`.
   - `cd frontend && npm i -D @openapitools/openapi-generator-cli@2.41.0`.
   - Add npm script `"api:gen": "openapi-generator-cli generate -i ../backend/openapi/openapi.json -g typescript-angular -o src/app/api --additional-properties=ngVersion=22.2.0,providedIn=root"`.
   - `src/environments/environment*.ts` with `apiUrl` = the backend URL; provide `BASE_PATH` from it and `provideHttpClient()` in `app.config.ts`.
3. **Generate client**: `npm run api:gen` (use the swagger file given; if only a URL is given, pass it as `-i`). Re-run every dispatch so the client matches the current swagger.
4. **Implement**: run `/speckit.implement` scoped to the phase — args: `Implement ONLY these [FE] tasks of phase <N>: <IDs>. Code goes in frontend/. Use only the generated client in src/app/api for backend calls. Do not touch [BE] or [TEST] tasks.` (Skill tool if listed, else read the installed `speckit.implement` command file and follow it.) Tick each finished task `- [x]` in **tasks.md, the phase file and state.json** as you go.
5. **Build**: `npx ng build` must pass (optional unit tests: `npx ng test --watch=false`).
6. **Run**: stop the previous dev server (`kill $(cat state/frontend.pid)` if alive), then from `frontend/`: `nohup npx ng serve --port 4200 > ../loops/loop-2-frontend-dev/state/frontend.log 2>&1 & echo $! > ../loops/loop-2-frontend-dev/state/frontend.pid`. Poll `curl -sf http://localhost:4200` (max ~120 s).
7. **Playwright MCP check per feature**: for each page/feature done in this phase use the Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`/`browser_fill_form`, `browser_take_screenshot`, `browser_console_messages`): load it, exercise the main action against the real backend, confirm no console errors. Record steps + result in `## Playwright checks`, screenshots to `outputs/screenshots/phase-<N>-<feature>.png`. Fix and repeat until it works.

## Mode: fix

1. Read each bug report path (owner must be `frontend-dev`). Reproduce with its Playwright steps.
2. If the backend swagger changed, regenerate the client first (`npm run api:gen`).
3. Fix, build, make sure the dev server reloaded, re-run the bug's steps and the phase's Playwright checks.
4. Append `## Fix (frontend-dev, trial <t>)` to the bug report: root cause, files changed, verification. Set its `Status:` line to `fixed — awaiting retest`. loop-3 closes it.

## End of every dispatch — handoff

Write `state/handoff-phase-<N>.json` and update state.json:
```json
{
  "loop": "frontend-dev", "phase": 1, "mode": "implement", "trial": 0,
  "status": "done | blocked | failed",
  "ui_url": "http://localhost:4200",
  "phase_file": "loops/loop-2-frontend-dev/outputs/phase-1-frontend.md",
  "client_generated_from": "backend/openapi/openapi.json",
  "tasks_done": [], "tasks_open": [], "bugs_fixed": [],
  "started": "", "ended": "", "notes": ""
}
```
Log `| <date -Is> | phase <N> <mode> | done | <duration> | see loop-0 ledger | <notes> |` in progress.md. Leave the dev server **running**. Your final message: one line with the handoff file path and status.

## Rules
- Only [FE] tasks; never edit `backend/`, `frontend/src/app/api/`, other loops' folders (except bug-report Fix sections), or `tech-stack.yaml`.
- If the UI needs an endpoint that the swagger lacks, do not fake it: return `status: "blocked"` naming the missing operation.
- Max 3 attempts at any failing build/check step inside one dispatch; then return `status: "failed"` with the reason.
- Never ask the user; never stop the dev server at the end.
