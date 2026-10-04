# Phase 1 — Backend (Setup & Foundation)

Mode: implement · Trial: 0 · Backend: http://localhost:8080 · Swagger: http://localhost:8080/v3/api-docs · UI: http://localhost:8080/swagger-ui/index.html

## Tasks

- [x] T001 [BE] Generate the backend from start.spring.io into `backend/` (type maven-project, bootVersion 4.1.1, javaVersion 25, groupId `com.quickflow`, artifactId `quickflow`, name QuickFlow, dependencies web, data-jpa, h2, validation) with the Maven wrapper (`backend/mvnw`)
- [x] T002 [BE] Edit `backend/pom.xml`: add `springdoc-openapi-starter-webmvc-ui` 3.1.1, `spring-boot-starter-webmvc-test` and `spring-boot-starter-data-jpa-test` (test scope), `jacoco-maven-plugin` (latest release supporting Java 25, version pinned, `prepare-agent` + `report` on `verify`), `springdoc-openapi-maven-plugin` (latest release, version pinned) and a Maven profile `openapi` that runs `spring-boot-maven-plugin` `start` (Spring profile `openapi`) / `stop` around `springdoc-openapi-maven-plugin:generate` with `apiDocsUrl=http://localhost:8081/v3/api-docs`, `outputDir=${project.basedir}/openapi`, `outputFileName=openapi.json`
- [x] T003 [BE] [P] Create H2 profile files: `backend/src/main/resources/application.yaml` (default: `jdbc:h2:file:./data/quickflow`, `ddl-auto: update`, port 8080, `spring.jackson` ISO dates), `application-test.yaml` (`jdbc:h2:file:./data/test`, `ddl-auto: create-drop`), `application-openapi.yaml` (`jdbc:h2:mem:openapi`, `ddl-auto: create-drop`, `server.port: 8081`); add `backend/src/test/resources/application.properties` with `spring.profiles.active=test` (a different file name so it does not shadow main `application.yaml`); add `data/` and `target/` to `backend/.gitignore`
- [x] T004 [BE] [P] Create `config/ClockConfig.java` exposing a `java.time.Clock` bean (`Clock.systemDefaultZone()`) — every time-dependent rule injects this clock (research R3)
- [x] T005 [BE] [P] Create `config/CorsConfig.java` allowing origin `http://localhost:4200`, methods GET/POST/PUT/DELETE/OPTIONS, all headers, on `/api/**`
- [x] T006 [BE] [P] Create `config/OpenApiConfig.java` (title "QuickFlow API", version 1.0.0, server http://localhost:8080) matching `info` in `specs/001-quickflow-productivity/contracts/openapi.yaml`
- [x] T007 [BE] Create `common/NotFoundException.java`, `common/ConflictException.java`, `common/BadRequestException.java` (carries `field` and `message`), `common/FieldErrorDto.java` (`@Schema(name = "FieldError")`, `field` and `message` marked `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)`), `common/Problem.java` (documentation-only schema `@Schema(name = "Problem")` with type/title/status/detail/instance/`errors: FieldError[]`, used as `@ApiResponse` content for 400/404/409) and `common/ApiExceptionHandler.java` (`@RestControllerAdvice`, returns `ProblemDetail` as `application/problem+json`: `MethodArgumentNotValidException`, `ConstraintViolationException`, `HttpMessageNotReadableException`, `MethodArgumentTypeMismatchException`, `IllegalArgumentException` → 400 with property `errors: [{field, message}]`; `BadRequestException` → 400 with `errors: [{field: <its field>, message}]`; `NotFoundException` → 404; `ConflictException` → 409); set `springdoc.override-with-generic-response: false` in `application.yaml` so swagger responses come only from `@ApiResponse` annotations
- [x] T008 [BE] Verify `cd backend && ./mvnw verify` passes, `./mvnw -Popenapi verify -DskipTests` writes `backend/openapi/openapi.json`, and the running backend answers `GET http://localhost:8080/v3/api-docs` and `/swagger-ui/index.html`

## Endpoints

Phase 1 adds no `/api/**` operations (contract `paths` for Tasks start in phase 2). Infrastructure endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/v3/api-docs` | springdoc OpenAPI 3.1 JSON (info/servers/tags match contract) |
| GET | `/swagger-ui/index.html` | Swagger UI |
| OPTIONS | `/api/**` | CORS preflight for `http://localhost:4200` |

## curl checks

| # | Command | Expected | Actual |
|---|---|---|---|
| 1 | `curl -s -o /dev/stderr -w '%{http_code}' http://localhost:8080/v3/api-docs` | 200, `application/json`, openapi 3.1.0, title "QuickFlow API", version 1.0.0, server http://localhost:8080 | 200 ✓ |
| 2 | `curl -s -o /dev/stderr -w '%{http_code}' http://localhost:8080/swagger-ui/index.html` | 200 | 200 ✓ |
| 3 | `curl -s -o /dev/stderr -w '%{http_code}' -X OPTIONS -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: POST' http://localhost:8080/api/tasks` | 200 + `Access-Control-Allow-Origin: http://localhost:4200`, `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS` | 200 ✓ (headers present) |
| 4 | `curl -s -o /dev/stderr -w '%{http_code}' -X OPTIONS -H 'Origin: http://evil.test' -H 'Access-Control-Request-Method: POST' http://localhost:8080/api/tasks` | 403 (origin rejected) | 403 ✓ |
| 5 | `curl -s -o /dev/stderr -w '%{http_code}' http://localhost:8080/api/nope` | 404 `application/problem+json` | 404 problem+json ✓ |

Build checks: `./mvnw -q verify` → exit 0 (2 test classes, 3 tests, 0 failures; JaCoCo report `backend/target/site/jacoco/`). `./mvnw -q -Popenapi verify -DskipTests` → exit 0, writes `backend/openapi/openapi.json` (openapi 3.1.0, info/servers/tags = contract, `paths: {}` until phase 2).

## Notes

- Versions: Spring Boot 4.1.1 / Java 25 (start.spring.io accepted both), springdoc-openapi-starter-webmvc-ui 3.1.1, springdoc-openapi-maven-plugin **1.5** (latest on Maven Central), jacoco-maven-plugin **0.8.15** (latest; Java 25 supported since 0.8.14). Pinned as properties in `backend/pom.xml`.
- start.spring.io (Boot 4) generates `spring-boot-starter-webmvc`, `spring-boot-h2console`, `spring-boot-starter-validation-test`, plus `spring-boot-starter-data-jpa-test` / `spring-boot-starter-webmvc-test`; `spring-boot-starter-test` added explicitly. Application class is `com.quickflow.QuickFlowApplication`.
- `springdoc.api-docs.version: openapi_3_1` so the swagger is OpenAPI 3.1.0 like the contract. Jackson 3: ISO dates via `spring.jackson.datatype.datetime.write-dates-as-timestamps: false`.
- `spring.mvc.problemdetails.enabled: true` so framework errors (unknown path, 405, 415) are problem+json too; `ApiExceptionHandler` is `@Order(HIGHEST_PRECEDENCE)` so it wins for the exceptions it handles. It also maps `HandlerMethodValidationException` (Spring 7 method validation on `@RequestParam`/`@PathVariable`) → 400 with `errors[]`.
- `errors` is serialized as a top-level member of the problem body (verified by `backend/src/test/java/com/quickflow/common/ProblemJsonSmokeTest.java`; T018 `ApiExceptionHandlerTest` is left to loop-3).
- `Problem` / `FieldError` schemas appear in the swagger once controllers reference them in `@ApiResponse` (phase 2+).
- Server is started with `nohup ./mvnw spring-boot:run`; `state/backend.pid` holds the **Maven JVM** pid (killing it also stops the forked app JVM).
