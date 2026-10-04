# Data Model: QuickFlow

Types: `Long` ids (identity), `OffsetDateTime` timestamps, `LocalDate` dates. Enum values are
stored and sent as UPPER_SNAKE strings. All `createdAt`/`updatedAt` are set by the server.
PUT replaces the editable fields; optional enum/boolean fields omitted in a PUT keep their current
value (on create they take their default). Creating a task with status DONE sets `completedAt`. Creating a milestone with done=true sets `completedAt`.

## Task
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| title | String | required, trimmed, 1–200 chars |
| description | String? | ≤ 2,000 chars |
| status | TaskStatus | `TODO` \| `IN_PROGRESS` \| `DONE`; default `TODO` |
| priority | TaskPriority | `LOW` \| `MEDIUM` \| `HIGH`; default `MEDIUM` |
| dueDate | LocalDate? | optional |
| createdAt | OffsetDateTime | set on create |
| updatedAt | OffsetDateTime | set on every change |
| completedAt | OffsetDateTime? | set when status → DONE; cleared when status leaves DONE |
| archived | boolean | default false |

Derived (API only): `overdue` = dueDate != null && dueDate < today && status != DONE.
Transitions: any status ↔ any status; archive/restore toggles `archived` only.

## Habit
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| name | String | required, trimmed, 1–150 chars |
| description | String? | ≤ 2,000 chars |
| frequency | HabitFrequency | `DAILY` \| `WEEKLY` |
| createdAt | OffsetDateTime | |
| active | boolean | default true; deactivate/activate |

Derived (API only, `HabitStatsCalculator`, R8): `completedToday`, `doneForCurrentPeriod`,
`currentStreak`, `completionRate` (0–100), `lastCompletedDate`.

## HabitCompletion
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| habitId | Long | FK → Habit, cascade delete |
| completionDate | LocalDate | default today; not in the future |
| createdAt | OffsetDateTime | |

Unique (habitId, completionDate) → duplicate returns 409.

## LearningCard
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| title | String | required, trimmed, 1–200 chars |
| description | String? | description / source, ≤ 2,000 chars |
| status | LearningStatus | `NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED`; default `NOT_STARTED` |
| createdAt | OffsetDateTime | |

Has many milestones and notes (cascade delete). Derived: `milestonesTotal`, `milestonesDone`,
`progressPercent`. Status recomputed on milestone changes (R9).

## LearningMilestone
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| learningCardId | Long | FK → LearningCard (exactly one) |
| title | String | required, 1–200 chars |
| done | boolean | default false |
| targetDate | LocalDate? | optional |
| completedAt | OffsetDateTime? | set when done → true, cleared when false (dashboard "last 7 days") |

## LearningNote
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| learningCardId | Long | FK → LearningCard |
| text | String | required, non-blank, ≤ 5,000 chars |
| createdAt | OffsetDateTime | |

## Plan
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| title | String | required, 1–200 chars |
| estimatedDurationMinutes | int | required, ≥ 1 |
| startDateTime | OffsetDateTime | required |
| endDateTime | OffsetDateTime | required, > startDateTime |
| priorityOrder | int | required, ≥ 1 (1 = highest); ties allowed |
| createdAt | OffsetDateTime | |
| startNotifiedAt | OffsetDateTime? | set by `POST /plans/{id}/start-notification` |

Derived (API only, `PlanStatusCalculator`, R4): `status` (`NOT_STARTED` \| `IN_PROGRESS` \|
`COMPLETED`), `progressPercent`, `itemsTotal`, `itemsDone`, `restSeconds` (only IN_PROGRESS).

State transitions (pure function of now, start, end, items):
```
NOT_STARTED --(now ≥ start)--> IN_PROGRESS --(all items done OR now ≥ end)--> COMPLETED
NOT_STARTED --(all items done)--> COMPLETED
COMPLETED --(an item undone AND start ≤ now < end)--> IN_PROGRESS   (derived, so it follows the data)
```

## PlanItem
| Field | Type | Rules |
|---|---|---|
| id | Long | PK |
| planId | Long | FK → Plan, cascade delete |
| sourceType | PlanItemSourceType | `TASK` \| `HABIT` \| `LEARNING_RESOURCE` |
| sourceId | Long | id of the source (no FK; source may be deleted later) |
| sourceTitle | String | snapshot of title/name at creation |
| done | boolean | default false |

Derived: `sourceAvailable` (source still exists). Unique (planId, sourceType, sourceId).
On create, every source must exist (task non-archived, habit active) → else 400.
Item done side effects: see research R6.

## Settings (single row, id = 1)
| Field | Type | Rules |
|---|---|---|
| displayName | String | 1–80 chars, default "Friend" |
| inAppNotifications | boolean | default true |
| browserNotifications | boolean | default false |
| defaultView | DefaultView | `DASHBOARD` \| `TASKS` \| `HABITS` \| `LEARNING` \| `PLANS`; default `DASHBOARD` |

## Dashboard (read model, not stored)
- `greetingName`, `today`
- `tasks`: `dueToday[]` (non-archived, dueDate = today, not DONE), `overdue[]` (non-archived, overdue rule), `completedTodayCount` (non-archived, completedAt today), `totalActive` (non-archived), `doneCount` (non-archived, DONE), `completionPercent`
- `habits`: `today[]` (active habits with `completedToday`/`doneForCurrentPeriod`), `activeCount`, `completedTodayCount`
- `plans`: `inProgress[]` (full Plan, priority then start order), `upcomingCount`, `completedCount`
- `learning`: `inProgressCount`, `cardsTotal`, `milestonesTotal`, `milestonesDone`, `milestonesCompletedLast7Days`
