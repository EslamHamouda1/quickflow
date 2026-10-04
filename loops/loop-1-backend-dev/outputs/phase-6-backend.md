# Phase 6 — Backend (User Story 6 - Navigate and set preferences)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T083 [BE] [P] [US6] Create `settings/DefaultView.java` (`DASHBOARD`, `TASKS`, `HABITS`, `LEARNING`, `PLANS`), entity `settings/Settings.java` (single row id = 1: displayName "1–80 chars, default Friend", inAppNotifications default true, browserNotifications default false, defaultView default `DASHBOARD`) and `settings/SettingsRepository.java`
- [x] T084 [BE] [US6] Create `settings/dto/SettingsDto.java` (`@Schema(name = "Settings")`, all four fields `requiredMode = REQUIRED` and `@NotNull` (boxed `Boolean`), validation per contract `Settings`; `DefaultView` with `@Schema(enumAsRef = true)`), `settings/SettingsService.java` (get creates defaults on first call; update) and `settings/SettingsController.java` (`GET/PUT /api/settings`, springdoc annotations)
- [x] T085 [BE] [US6] Regenerate swagger, verify Settings paths, operationIds, status codes, schema names, schema properties and required lists match the contract, restart backend, curl-verify

## Endpoints

| Method | Path | operationId | Success | Errors |
|---|---|---|---|---|
| GET | `/api/settings` | getSettings | 200 `Settings` (single row id = 1; created with defaults `Friend` / true / false / `DASHBOARD` on first call) | — |
| PUT | `/api/settings` (body `Settings`, all four fields required) | updateSettings | 200 `Settings` | 400 (`displayName` blank / > 80 chars / missing; missing `inAppNotifications`, `browserNotifications`, `defaultView`; invalid `DefaultView` enum; malformed JSON) |

Errors are `application/problem+json` (`Problem` with `errors: FieldError[]` on 400). No 404 exists for this singleton resource.

## curl checks

Base `http://localhost:8080/api/settings`, each run as `curl -s -o r.json -w '%{http_code}' -X <M> -H 'Content-Type: application/json' -d '<body>' $B` and asserted with `jq`.

| # | Check | Request | Expected | Actual | Assertion | Result |
|---|---|---|---|---|---|---|
| 1 | get settings | `GET /api/settings` | 200 | 200 | `has("displayName") and has("inAppNotifications") and has("browserNotifications") and has("defaultView")` → true | PASS |
| 2 | update all fields | `PUT /api/settings {Sara,false,true,TASKS}` | 200 | 200 | `.displayName=="Sara" and .inAppNotifications==false and .browserNotifications==true and .defaultView=="TASKS"` → true | PASS |
| 3 | persisted | `GET /api/settings` | 200 | 200 | `.displayName=="Sara" and .defaultView=="TASKS" and .browserNotifications==true` → true | PASS |
| 4 | name trimmed | `PUT displayName='  Omar  '` | 200 | 200 | `.displayName=="Omar" and .defaultView=="PLANS"` → true | PASS |
| 5 | 80-char name ok | `PUT displayName=80 chars` | 200 | 200 | `(.displayName|length)==80` → true | PASS |
| 6 | blank name | `PUT displayName='  '` | 400 | 400 | `any(.errors[];.field=="displayName")` → true | PASS |
| 7 | empty name | `PUT displayName=''` | 400 | 400 | `any(.errors[];.field=="displayName")` → true | PASS |
| 8 | 81-char name | `PUT displayName=81 chars` | 400 | 400 | `any(.errors[];.field=="displayName")` → true | PASS |
| 9 | missing displayName | `PUT no displayName` | 400 | 400 | `any(.errors[];.field=="displayName")` → true | PASS |
| 10 | missing inAppNotifications | `PUT no inAppNotifications` | 400 | 400 | `any(.errors[];.field=="inAppNotifications")` → true | PASS |
| 11 | missing browserNotifications | `PUT no browserNotifications` | 400 | 400 | `any(.errors[];.field=="browserNotifications")` → true | PASS |
| 12 | missing defaultView | `PUT no defaultView` | 400 | 400 | `any(.errors[];.field=="defaultView")` → true | PASS |
| 13 | invalid defaultView | `PUT defaultView=CALENDAR` | 400 | 400 | `.status==400` → true | PASS |
| 14 | malformed json | `PUT body '{'` | 400 | 400 | `.status==400` → true | PASS |
| 15 | unchanged after 400s | `GET /api/settings` | 200 | 200 | `(.displayName|length)==80 and .defaultView=="HABITS"` → true | PASS |
| 16 | restore defaults | `PUT {Friend,true,false,DASHBOARD}` | 200 | 200 | `.displayName=="Friend" and .defaultView=="DASHBOARD"` → true | PASS |
| 17 | unsupported method | `DELETE /api/settings` | 405 | 405 |  | PASS |
| 18 | 400 is problem+json | `PUT {} content-type` | problem+json | application/problem+json |  | PASS |

TOTAL=18 FAIL=0

## Notes

- Swagger (`backend/openapi/openapi.json`) compared with `contracts/openapi.yaml`: `/api/settings` GET `getSettings` [200], PUT `updateSettings` [200, 400], requestBody required `$ref Settings`, tag `Settings`; schema `Settings` properties (displayName string minLength 1 maxLength 80, two booleans, defaultView `$ref DefaultView`) and `required` [displayName, inAppNotifications, browserNotifications, defaultView]; `DefaultView` enum [DASHBOARD, TASKS, HABITS, LEARNING, PLANS]: match.
- `SettingsDto` (`@Schema(name = "Settings")`) is used for both request and response; booleans are boxed `Boolean` with `@NotNull` so missing fields return 400.
- `displayName` is trimmed on save (validated with `@NotBlank` + `@Size(1..80)` before trimming).
- `SettingsService.displayName()` is exposed for the dashboard greeting.
- `./mvnw -q verify` passes; settings unit tests are [TEST] task T089.
- Curl run leaves settings at defaults (Friend / true / false / DASHBOARD).
