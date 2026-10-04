import { SortDirection, TaskPriority, TaskSort, TaskStatus } from '../../api';

export const STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string }> = [
  { value: TaskStatus.Todo, label: 'Todo' },
  { value: TaskStatus.InProgress, label: 'In Progress' },
  { value: TaskStatus.Done, label: 'Done' },
];

export const PRIORITY_OPTIONS: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: TaskPriority.High, label: 'High' },
  { value: TaskPriority.Medium, label: 'Medium' },
  { value: TaskPriority.Low, label: 'Low' },
];

export const SORT_OPTIONS: ReadonlyArray<{ value: TaskSort; label: string }> = [
  { value: TaskSort.CreatedAt, label: 'Created date' },
  { value: TaskSort.DueDate, label: 'Due date' },
];

export const DIRECTION_OPTIONS: ReadonlyArray<{ value: SortDirection; label: string }> = [
  { value: SortDirection.Desc, label: 'Descending' },
  { value: SortDirection.Asc, label: 'Ascending' },
];

export function statusLabel(status: TaskStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority;
}

/** Formats an ISO `YYYY-MM-DD` date in the user's locale without time-zone shifting. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const [y, m, d] = iso.split('-').map(Number);
  return DATE_FORMAT.format(new Date(y, m - 1, d));
}

/** Formats an ISO date-time in the user's locale and time zone. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  return DATE_TIME_FORMAT.format(new Date(iso));
}

// Shared formatters: `toLocale*String(…, options)` builds a new formatter per call, which is
// costly when a list renders hundreds of rows (SC-009).
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
