# Feature Specification: QuickFlow Personal Productivity Workspace

**Feature Branch**: `001-quickflow-productivity`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Task_PRD.md — QuickFlow: a personal productivity application that unifies task management, habit tracking, learning-resource tracking and time-boxed Todo Plans built from existing items, with a dashboard summary and settings. The user wants a great UI with good animations."

## Clarifications

### Session 2026-10-03

- Q: How should the app know which tasks were "completed today"? → A: Store a completed-at timestamp, set when a task becomes Done and cleared when it leaves Done.
- Q: What does a habit's "completion progress" show? → A: Current-period done state, current streak, and completion rate over the last 30 days (Daily) or last 12 weeks (Weekly).
- Q: How many items per list must the app handle without paging? → A: Up to 1,000 items per entity type; lists return the full filtered result, no paging.
- Q: What accessibility level must the UI meet? → A: WCAG 2.1 AA (keyboard reachable, visible focus, labelled controls, 4.5:1 contrast, reduced motion respected).
- Q: Can two plans share the same priority order? → A: Yes; ties are allowed and broken by earlier start date-time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage tasks (Priority: P1)

As a single user, I create, edit, complete, archive, restore and delete tasks, and I find them
quickly with search, filters and sorting, including seeing which tasks are overdue.

**Why this priority**: Tasks are the core of the product and the source items for plans and the
dashboard; on its own this is a viable MVP.

**Independent Test**: Open the Tasks page, create a task, edit it, mark it done, archive and
restore it, delete it, and use search/filters/sort — all without any other feature present.

**Acceptance Scenarios**:

1. **Given** the Tasks page, **When** I add a task with a title (and optional description, priority, due date), **Then** it appears in the list with status Todo and default priority Medium.
2. **Given** the add/edit form, **When** I submit an empty title, a title over 200 characters, or a description over 2,000 characters, **Then** the task is not saved and a validation message explains why.
3. **Given** an existing task, **When** I edit its title, description, status, priority or due date, **Then** the change is saved and its last-updated time changes.
4. **Given** a task, **When** I mark it completed, **Then** its status is Done and its completion time is recorded; **When** I move it back to Todo or In Progress, **Then** the completion time is cleared.
5. **Given** a task, **When** I archive it, **Then** it disappears from the default list and appears when I show archived tasks; **When** I restore it, **Then** it returns to the default list.
6. **Given** a task, **When** I delete it and confirm, **Then** it no longer appears anywhere, including searches and plans' pickers.
7. **Given** several tasks, **When** I search by part of a title (case-insensitive) and/or filter by status, priority or due-date range and sort by due date or creation date, **Then** only matching tasks are shown in the chosen order.
8. **Given** a task whose due date is before today and whose status is not Done, **When** I view the Tasks page, **Then** it is marked as overdue and can be filtered as overdue.
9. **Given** no tasks (or no matches), **When** I open the page, **Then** an empty state guides me to add a task.

---

### User Story 2 - Track recurring habits (Priority: P2)

As a user, I create daily or weekly habits, mark them complete for today, see my progress and
streak, and deactivate or remove habits I no longer track.

**Why this priority**: Habits are the second source of plan items and dashboard metrics.

**Independent Test**: On the Habits page create a daily and a weekly habit, complete each for
today, try to complete again, deactivate one and remove the other.

**Acceptance Scenarios**:

1. **Given** the Habits page, **When** I add a habit with a name (required, max 150 characters), optional description and frequency Daily or Weekly, **Then** it appears as an active habit card with its frequency label.
2. **Given** an active habit, **When** I toggle it complete for today, **Then** a completion is recorded for today's date and the card shows it done for the current period.
3. **Given** a habit already completed today, **When** a second completion for the same date is attempted, **Then** no duplicate record is created and the user sees it is already done.
4. **Given** a habit completed today, **When** I toggle it off, **Then** the completion record for the current period is removed (today's, or for a Weekly habit the latest one in the current week).
5. **Given** a habit, **When** I view its card, **Then** I see whether it is done for the current period, its current streak (consecutive completed periods: days for Daily, weeks for Weekly) and its completion rate over the last 30 days (Daily) or 12 weeks (Weekly).
6. **Given** a habit, **When** I deactivate it, **Then** it no longer counts in today's habits or dashboard metrics but its history is kept, and I can reactivate it; **When** I remove it and confirm, **Then** it and its completions are gone.
7. **Given** no habits, **When** I open the page, **Then** an empty state guides me to add a habit.

---

### User Story 3 - Track learning resources (Priority: P3)

As a user, I add learning cards (course, book, topic), break each into milestones that I tick
off, attach notes, and remove cards I no longer need.

**Why this priority**: Third source of plan items and of the dashboard's learning snapshot.

**Independent Test**: On the Learning Resources page add a card, expand it, add/complete/remove
milestones, add/remove notes, then remove the card.

**Acceptance Scenarios**:

1. **Given** the Learning Resources page, **When** I add a card with a title (required, max 200 characters) and optional description/source, **Then** it appears in the card grid with status Not Started.
2. **Given** a card, **When** I expand it, **Then** I see its milestones (title, done flag, optional target date) and notes (text, timestamp).
3. **Given** an expanded card, **When** I add a milestone, mark it done/undone, or remove it, **Then** the list and the card's progress update immediately.
4. **Given** an expanded card, **When** I add a note (non-empty text) or remove a note, **Then** the notes list updates and each note shows when it was created.
5. **Given** a card, **When** at least one milestone is done (but not all) its status is In Progress; **When** all its milestones are done its status is Completed; **When** none are done its status is Not Started — unless I set the status manually; a manual status persists until the next milestone add/toggle/remove, which recomputes the status.
6. **Given** a card, **When** I remove it and confirm, **Then** the card with its milestones and notes is gone.
7. **Given** no cards, **When** I open the page, **Then** an empty state guides me to add a card.

---

### User Story 4 - Build and run time-boxed plans (Priority: P2)

As a user, I build a plan from existing tasks, habits and learning resources, set its estimated
duration, start/end date-time and priority order, tick off its items, and watch its live progress
and rest (remaining) time; I am notified when it starts and can review past plans.

**Why this priority**: The differentiating feature; depends on User Stories 1-3 for items.

**Independent Test**: With at least one task, habit and learning card present, create a plan
from them, see it move Not Started → In Progress → Completed while ticking items, and see the
rest time count down.

**Acceptance Scenarios**:

1. **Given** existing tasks, habits and learning cards, **When** I open the plan builder, **Then** I can pick one or more of them (active, non-archived, non-deleted items only) and enter a title, estimated duration, start date-time, end date-time and priority order.
2. **Given** the builder, **When** I select no items, leave the title empty, or set an end date-time that is not after the start date-time, **Then** the plan is not saved and a validation message explains why.
3. **Given** a saved plan, **When** I mark an item done or not done, **Then** the plan's progress (done items ÷ total items, shown as a percentage) updates immediately on the plan and on the dashboard.
4. **Given** a task-type plan item, **When** I mark it done, **Then** the underlying task's status becomes Done; **When** I mark a habit-type item done, **Then** the habit gets a completion for today (if not already); **When** I mark a learning-type item done, **Then** only the plan item changes (the learning card is untouched). Undoing a plan item never reverts the source entity.
5. **Given** a plan whose start date-time has not been reached, **Then** its status is Not Started and no rest time is shown; **Given** the current time is between start and end, **Then** its status is In Progress and the rest time (end minus now) is displayed and updates continuously; **Given** all items are done or the end time has passed, **Then** its status is Completed and the rest-time display stops.
6. **Given** the app is open, **When** a plan's start date-time is reached, **Then** I receive an in-app notification and the plan is highlighted; **Given** the app was closed at the start time, **When** I next open the app while the plan is in progress, **Then** I am notified once.
7. **Given** plans, **When** I view the Todo Plans page, **Then** active/upcoming plans are shown ordered by priority order (1 = highest) then start time, and completed plans are shown in a history group with their final completion percentage.
8. **Given** a plan, **When** I remove it and confirm, **Then** the plan and its items are gone and the source tasks/habits/cards are unaffected.
9. **Given** a source item that is deleted after being added to a plan, **Then** the plan keeps the item shown as "removed source" and it still counts towards progress.
10. **Given** no plans, **When** I open the page, **Then** an empty state guides me to create a plan.

---

### User Story 5 - See everything on a dashboard (Priority: P3)

As a user, I open the app on a dashboard that shows today's tasks, overdue tasks, today's habits,
completion percentages, active plans with live rest time and progress, a learning snapshot and
quick-add actions.

**Why this priority**: Summarizes the other stories; valuable once they exist.

**Independent Test**: Seed tasks, habits, learning cards and plans, open the dashboard and check
each number against the underlying data; change an item and see the dashboard update.

**Acceptance Scenarios**:

1. **Given** the default view setting is Dashboard (the default), **When** the app is opened, **Then** the dashboard is the landing page with a greeting that uses the display name from Settings.
2. **Given** tasks, **Then** the dashboard lists non-archived tasks due today that are not Done, overdue tasks and the count of tasks completed today, and shows task completion percentage = Done tasks ÷ all non-archived tasks.
3. **Given** habits, **Then** the dashboard shows today's habit checklist (all active habits, each with its done-for-current-period state), togglable in place.
4. **Given** in-progress plans, **Then** the dashboard shows each with live rest time and progress percentage.
5. **Given** learning cards, **Then** the dashboard shows cards in progress, total and completed milestones, and milestones completed in the last 7 days.
6. **Given** any change in tasks, habits, plan items or milestones, **When** I return to or stay on the dashboard, **Then** all metrics match the underlying data.
7. **Given** the dashboard, **When** I use a quick-add action (task, habit, learning card, plan), **Then** the matching create form opens.

---

### User Story 6 - Navigate and set preferences (Priority: P4)

As a user, I move between the six pages with persistent navigation and set my profile and app
preferences.

**Why this priority**: Needed for the Definition of Done, low complexity.

**Independent Test**: Visit every page from the navigation; change settings, reload, and confirm
they persist and take effect.

**Acceptance Scenarios**:

1. **Given** any page, **Then** persistent navigation shows Dashboard, Tasks, Habits, Learning Resources, Todo Plans and Settings, highlights the current page, and each link opens its page.
2. **Given** Settings, **When** I change display name, notification behavior (in-app notifications on/off, browser notifications on/off) or default view (landing page), **Then** the preferences are saved, persist across restarts and are applied.
3. **Given** I enable browser notifications, **Then** the app asks for browser permission; if denied, in-app notifications still work.

---

### Edge Cases

- Task due today but already Done → not overdue, counted as completed today if completed today.
- Task without a due date → never overdue; sorts after dated tasks when sorting by due date.
- Archived tasks → excluded from default list, dashboard lists, completion percentage and plan picker.
- Deleted entities → never returned by normal queries; plan items referencing them show "removed source".
- Habit completion toggled twice quickly → only one record per habit per date.
- Weekly habit → "done for current period" if any completion exists in the current ISO week (Monday-Sunday).
- Deactivated habit → excluded from today's habits; existing completions kept.
- Learning card with no milestones → progress 0%, status set manually only.
- Plan whose start time is in the past at creation → immediately In Progress and the start notification is shown once; a plan that is already Completed (end passed or all items done) is never notified.
- Plan whose end time passes with items open → Completed with its final percentage below 100%.
- Plan with all items done before its start time → Completed.
- Status must be correct after the app is closed and reopened (derived from stored times and items).
- Very long titles/notes → truncated visually with full text available.
- Time zone → all date-times shown and evaluated in the user's local time zone.

## Requirements *(mandatory)*

### Functional Requirements

**Tasks**
- **FR-001**: System MUST store tasks with id, title, description, status (Todo, In Progress, Done), priority (Low, Medium, High), due date (optional), created-at, updated-at, completed-at and archived flag; completed-at is set when the status becomes Done and cleared when it leaves Done.
- **FR-002**: Users MUST be able to create, read, update, archive, restore and delete tasks.
- **FR-003**: System MUST require a task title of 1-200 characters and allow an optional description of at most 2,000 characters; status and priority MUST be one of the allowed values.
- **FR-004**: System MUST exclude archived tasks from the default task list and show them on demand.
- **FR-005**: System MUST support case-insensitive free-text search by title, filters by status, priority, due-date range and overdue, and sorting by due date or creation date (ascending/descending).
- **FR-006**: System MUST mark a task overdue when its due date is before today and its status is not Done.

**Habits**
- **FR-007**: System MUST store habits with id, name (1-150 characters), description (≤ 2,000 characters), frequency (Daily, Weekly), created-at and active flag.
- **FR-008**: Users MUST be able to create, update, deactivate/reactivate and delete habits.
- **FR-009**: System MUST record habit completions (id, habit id, completion date, created-at) and MUST prevent more than one completion per habit per date.
- **FR-010**: Users MUST be able to mark a habit complete for today and undo today's completion.
- **FR-011**: System MUST show each habit's current-period completion state, current streak (consecutive completed periods ending with the current or previous period) and completion rate over the last 30 days (Daily) or last 12 weeks (Weekly), counted from the habit's creation if younger.

**Learning resources**
- **FR-012**: System MUST store learning cards with id, title (1-200 characters), description/source, status (Not Started, In Progress, Completed) and created-at.
- **FR-013**: Users MUST be able to add and remove learning cards and change their status.
- **FR-014**: Each card MUST support milestones (title 1-200 characters, done flag, optional target date) that users can add, mark done/undone and remove; each milestone belongs to exactly one card.
- **FR-015**: Each card MUST support notes (non-empty text ≤ 5,000 characters, created-at) that users can add and remove.
- **FR-016**: System MUST derive a card's status from its milestones when they change (none done → Not Started, some → In Progress, all → Completed). A manual status change (FR-013) persists until the next milestone add/toggle/remove, which recomputes the status.

**Plans**
- **FR-017**: System MUST store plans with id, title (1-200 characters), estimated duration (minutes, > 0), start date-time, end date-time, priority order (positive integer, 1 = highest), created-at (status Not Started / In Progress / Completed is derived per FR-021, not stored) and a collection of plan items (source type Task | Habit | LearningResource, source id, done flag).
- **FR-018**: Users MUST be able to create a plan by selecting one or more existing items; a plan MUST reference at least one item and its end date-time MUST be after its start date-time.
- **FR-019**: Users MUST be able to mark individual plan items done/not done and remove a plan.
- **FR-020**: System MUST compute plan progress as done items ÷ total items (percentage).
- **FR-021**: System MUST derive plan status consistently from stored start/end times and item completion: Completed if all items are done or now ≥ end; otherwise In Progress if now ≥ start; otherwise Not Started.
- **FR-022**: System MUST display rest time (end − now) only while a plan is In Progress, updating at least once per minute (target once per second).
- **FR-023**: System MUST notify the user in-app when a plan's start date-time is reached (and once on next open if the plan is in progress and the start was missed), and highlight the plan.
- **FR-024**: Marking a task-type plan item done MUST set the task to Done; marking a habit-type plan item done MUST record today's completion for that habit if missing; learning-type items MUST NOT change the card. Undoing a plan item MUST NOT revert the source.
- **FR-025**: System MUST list plans grouped as active/upcoming (ordered by priority order, then start) and completed history (with final completion percentage). Several plans MAY share a priority order; ties are ordered by earlier start date-time.

**Dashboard**
- **FR-026**: Dashboard MUST show a greeting, summary metric cards (tasks, habits, plans, learning), tasks due today, overdue tasks, tasks completed today, task completion percentage, today's habit checklist, in-progress plans with live rest time and progress, a learning snapshot, and quick-add actions.
- **FR-027**: Dashboard metrics MUST match the underlying data and reflect changes to tasks, habits, plan items and milestones without a manual reload.

**Navigation, settings, experience**
- **FR-028**: The application MUST provide six pages (Dashboard, Tasks, Habits, Learning Resources, Todo Plans, Settings) reachable from persistent navigation.
- **FR-029**: Settings MUST let the user set display name (1-80 characters), notification preferences (in-app on/off, browser on/off) and default landing view; settings MUST persist.
- **FR-030**: Every list page MUST allow adding and removing items directly and MUST show an empty state that guides to the add action.
- **FR-031**: Destructive actions (delete task, remove habit, card, plan) MUST ask for confirmation.
- **FR-032**: The UI MUST be visually polished with consistent spacing, typography and color, and animate page transitions, list item enter/leave, dialogs, progress and toggle feedback and the live countdown; each animation MUST last at most 250 ms, MUST NOT block input, and MUST be disabled when the user prefers reduced motion. Layout MUST work from 375 px to 1440 px wide.
- **FR-033**: All data MUST persist between sessions; deleted entities MUST NOT be returned by normal queries.
- **FR-034**: The UI MUST meet WCAG 2.1 AA: every action reachable by keyboard, visible focus indicator, labelled form controls with announced validation messages, text contrast at least 4.5:1, and reduced-motion preference respected.
- **FR-035**: Lists MUST return the full filtered result without paging for up to 1,000 items per entity type.

### Key Entities

- **Task**: a unit of work with title, description, status, priority, optional due date, created/updated/completed timestamps and archived flag.
- **Habit**: a recurring activity with name, description, Daily/Weekly frequency, active flag; has many Habit Completions.
- **Habit Completion**: one record per habit per calendar date.
- **Learning Card**: a course/book/topic with title, description/source and status; has many Milestones and Notes.
- **Learning Milestone**: a step of one learning card with title, done flag, optional target date and completion time.
- **Learning Note**: free-form text with creation time, belonging to one learning card.
- **Plan**: a time-boxed block of work with title, estimated duration, start/end date-time, priority order, derived status, created-at; has many Plan Items.
- **Plan Item**: reference to one Task, Habit or Learning Card (type + id) with its own done flag.
- **Settings**: single record with display name, notification preferences and default view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a task, a habit, a learning card with a milestone, and a plan from them in under 3 minutes total on first use.
- **SC-002**: Create, update, delete and filter actions show their result in under 500 ms in typical local use.
- **SC-003**: Rest-time indicators of in-progress plans update at least once per minute (target every second) without page reloads.
- **SC-004**: 100% of dashboard metrics match the underlying data in automated checks.
- **SC-005**: Plan status after closing and reopening the app is identical to the status computed from stored times and items in 100% of test cases.
- **SC-006**: All six pages are reachable from the navigation in one click from any page.
- **SC-007**: Every list page shows an empty state with an add action when it has no items.
- **SC-008**: All automated tests (unit, API, UI, end-to-end) pass.
- **SC-009**: With 1,000 tasks stored, searching and filtering the task list still shows results in under 500 ms.
- **SC-010**: On every page all controls have accessible names, text contrast is at least 4.5:1 in light and dark themes, and every page action can be done with the keyboard alone (checked by automated UI tests).

## Assumptions

- Single user on a single device; no sign-in, accounts, collaboration or external calendars (PRD non-goals).
- "Today" and all date-times use the user's local time zone; week = ISO week (Monday-Sunday).
- Estimated duration is entered in minutes (shown as hours/minutes) and is informational; it does not change the end time.
- New tasks default to status Todo and priority Medium.
- Notifications are in-app (toast + highlight); browser notifications are optional and need permission. Email/push are out of scope.
- Deletion is permanent for the user (soft-delete is allowed internally as long as deleted data is never returned).
- Plan priority order is a manually entered positive integer; ties are allowed and broken by start time. Drag-and-drop reordering is out of scope.
- The app is used in a modern desktop browser; layout adapts to narrow screens.
