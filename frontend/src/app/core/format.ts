const pad = (n: number): string => n.toString().padStart(2, '0');

/**
 * Formats a duration in seconds as `h m s` for rest-time displays,
 * e.g. 3725 → "1h 02m 05s", 125 → "2m 05s", 9 → "9s"; days are folded into hours.
 * Negative or non-finite input is treated as 0.
 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const secs = Math.max(0, Math.floor(Number.isFinite(totalSeconds as number) ? (totalSeconds as number) : 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}h ${pad(m)}m ${pad(s)}s`;
  }
  if (m > 0) {
    return `${m}m ${pad(s)}s`;
  }
  return `${s}s`;
}

/** Formats minutes as `Xh Ym` (estimated duration), e.g. 90 → "1h 30m", 45 → "45m". */
export function formatMinutes(totalMinutes: number | null | undefined): string {
  const mins = Math.max(0, Math.floor(totalMinutes ?? 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  return h > 0 ? `${h}h` : `${m}m`;
}

/** Seconds remaining until `end` (ISO string or Date) from `nowMs`, never negative. */
export function secondsUntil(end: string | Date, nowMs: number): number {
  const endMs = typeof end === 'string' ? Date.parse(end) : end.getTime();
  return Math.max(0, Math.floor((endMs - nowMs) / 1000));
}

/** Today's local date as ISO `yyyy-MM-dd`. */
export function todayIso(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
