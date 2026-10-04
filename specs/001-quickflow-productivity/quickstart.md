# Quickstart & Validation: QuickFlow

## Prerequisites
- JDK 25, Node 24.x (>= 24.15), network access for Maven/npm on first build.
- Ports 8080 (backend), 8081 (swagger generation), 4200 (frontend) free.

## Run
```bash
# backend (default profile, file H2 at backend/data/quickflow)
cd backend && ./mvnw spring-boot:run            # http://localhost:8080
# swagger: http://localhost:8080/v3/api-docs , UI: http://localhost:8080/swagger-ui/index.html
./mvnw -Popenapi verify -DskipTests              # writes backend/openapi/openapi.json

# frontend
cd frontend && npm install && npm run api:gen    # client from ../backend/openapi/openapi.json
npx ng serve --port 4200                         # http://localhost:4200
```

## Tests
```bash
cd backend && ./mvnw verify                      # unit + slice tests, JaCoCo: target/site/jacoco/index.html
cd frontend && npx ng test --watch=false --coverage
```

## Validation scenarios (map to spec user stories)
1. **US1 Tasks** — `POST /api/tasks {"title":"Write report","dueDate":"<yesterday>"}` → 201, `overdue=true`; `POST /api/tasks {"title":""}` → 400 problem+json with `errors[0].field=title`; `POST /api/tasks/{id}/complete` → `status=DONE`, `completedAt` set; archive → absent from `GET /api/tasks`, present in `GET /api/tasks?archived=true`; `GET /api/tasks?q=rep&priority=MEDIUM&sort=DUE_DATE&direction=ASC` filters/sorts.
2. **US2 Habits** — create DAILY habit → `POST /api/habits/{id}/completions` → 201 `completedToday=true`, `currentStreak=1`; repeat → 409; `DELETE /api/habits/{id}/completions/<today>` → `completedToday=false`; deactivate → `active=false`.
3. **US3 Learning** — create card → add 2 milestones → mark one done → card `IN_PROGRESS`, `progressPercent=50`; add/remove note; delete card → 404 afterwards.
4. **US4 Plans** — create plan with one task + one habit + one card, start = now − 1 min, end = now + 60 min → `status=IN_PROGRESS`, `restSeconds≈3600`; `end ≤ start` → 400; `items: []` → 400; mark task item done → plan `progressPercent=33` and `GET /api/tasks/{id}` → `DONE`; mark all done → `COMPLETED`; in the UI the start toast appears once and the rest time ticks every second.
5. **US5 Dashboard** — `GET /api/dashboard` numbers equal counts derived from the list endpoints; UI dashboard updates after toggling a habit or plan item.
6. **US6 Navigation/Settings** — six nav links reachable; `PUT /api/settings {"displayName":"Sam",...,"defaultView":"TASKS"}` → greeting shows "Sam", app opens on Tasks after reload.
