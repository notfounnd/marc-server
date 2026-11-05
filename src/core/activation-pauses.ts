/**
 * Pause history of a workspace, kept as closed intervals and bounded. When the oldest
 * interval is dropped, completeSince moves to its end: every question about a later moment
 * is still exact, and a question about an earlier moment is answered "paused unknown".
 */
export const PAUSE_HISTORY_LIMIT = 200;

export type PauseInterval = { pausedAt: string; resumedAt?: string };

export type PauseHistory = {
  intervals: PauseInterval[];
  completeSince?: string;
};

/** "yes" and "never" are exact answers. "paused unknown" means the history was truncated before the thread began. */
export type PausedDuringThread = "yes" | "never" | "paused unknown";

export function openPause(history: PauseHistory, at: string): PauseHistory {
  return capped({
    ...history,
    intervals: [...history.intervals, { pausedAt: at }]
  });
}

/** Closes the open interval, if there is one. A resume without an open pause changes nothing. */
export function closePause(history: PauseHistory, at: string): PauseHistory {
  const last = history.intervals.at(-1);
  if (!last || last.resumedAt !== undefined) return history;
  return {
    ...history,
    intervals: [...history.intervals.slice(0, -1), { ...last, resumedAt: at }]
  };
}

/**
 * Whether the workspace was paused at any moment between the thread's start and its
 * closure. An interval that is still open at closure counts as overlapping.
 */
export function pausedDuringThread(input: {
  history: PauseHistory;
  threadStart: string;
  closedAt: string;
}): PausedDuringThread {
  const start = Date.parse(input.threadStart);
  const end = Date.parse(input.closedAt);
  const overlaps = input.history.intervals.some(
    (interval) =>
      Date.parse(interval.pausedAt) <= end &&
      (interval.resumedAt === undefined ||
        Date.parse(interval.resumedAt) >= start)
  );
  if (overlaps) return "yes";
  if (
    input.history.completeSince !== undefined &&
    start < Date.parse(input.history.completeSince)
  ) {
    return "paused unknown";
  }
  return "never";
}

function capped(history: PauseHistory): PauseHistory {
  const overflow = history.intervals.length - PAUSE_HISTORY_LIMIT;
  if (overflow <= 0) return history;
  const dropped = history.intervals.slice(0, overflow);
  const newest = dropped[dropped.length - 1];
  return {
    intervals: history.intervals.slice(overflow),
    completeSince: newest.resumedAt ?? newest.pausedAt
  };
}
