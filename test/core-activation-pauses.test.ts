import assert from "node:assert/strict";
import test from "node:test";
import {
  PAUSE_HISTORY_LIMIT,
  closePause,
  openPause,
  pausedDuringThread,
  type PauseHistory,
  type PausedDuringThread
} from "../src/core/activation-pauses.js";
import {
  renderActivitySection,
  type ThreadActivitySnapshot
} from "../src/core/thread-activity-markdown.js";

const T0 = "2026-11-04T10:00:00.000Z";
const T0_HALF = "2026-11-04T10:30:00.000Z";
const T1 = "2026-11-04T11:00:00.000Z";
const T2 = "2026-11-04T12:00:00.000Z";
const T3 = "2026-11-04T13:00:00.000Z";
const T4 = "2026-11-04T14:00:00.000Z";
const T5 = "2026-11-04T15:00:00.000Z";
const T6 = "2026-11-04T16:00:00.000Z";
const CLOSED = "2026-11-04T20:00:00.000Z";

const ROWS: ReadonlyArray<{
  name: string;
  history: PauseHistory;
  threadStart: string;
  expected: PausedDuringThread;
}> = [
  {
    name: "never paused",
    history: { intervals: [] },
    threadStart: T1,
    expected: "never"
  },
  {
    name: "paused during the thread's life",
    history: { intervals: [{ pausedAt: T2, resumedAt: T3 }] },
    threadStart: T1,
    expected: "yes"
  },
  {
    name: "paused before the thread existed",
    history: { intervals: [{ pausedAt: T0, resumedAt: T0_HALF }] },
    threadStart: T1,
    expected: "never"
  },
  {
    name: "still paused at closure",
    history: { intervals: [{ pausedAt: T2 }] },
    threadStart: T1,
    expected: "yes"
  },
  {
    name: "paused before the thread and resumed after its start",
    history: { intervals: [{ pausedAt: T0, resumedAt: T2 }] },
    threadStart: T1,
    expected: "yes"
  },
  {
    name: "history truncated after the thread started, with no kept overlap: the answer is unknown",
    history: { intervals: [], completeSince: T4 },
    threadStart: T1,
    expected: "paused unknown"
  },
  {
    name: "history truncated before the thread started: the answer is exact",
    history: { intervals: [], completeSince: T4 },
    threadStart: T5,
    expected: "never"
  },
  {
    name: "history truncated, but the overlap is still in the kept intervals",
    history: {
      intervals: [{ pausedAt: T5, resumedAt: T6 }],
      completeSince: T4
    },
    threadStart: T5,
    expected: "yes"
  }
];

for (const row of ROWS) {
  test(`pause status during the thread: ${row.name}`, () => {
    assert.equal(
      pausedDuringThread({
        history: row.history,
        threadStart: row.threadStart,
        closedAt: CLOSED
      }),
      row.expected
    );
  });
}

test("opening a pause past the limit drops the oldest interval and moves completeSince to its end", () => {
  const full: PauseHistory = {
    intervals: Array.from({ length: PAUSE_HISTORY_LIMIT }, (_, index) => ({
      pausedAt: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
      resumedAt: `2026-01-01T00:01:${String(index % 60).padStart(2, "0")}.000Z`
    }))
  };
  const next = openPause(full, T6);
  assert.equal(next.intervals.length, PAUSE_HISTORY_LIMIT);
  assert.equal(next.intervals.at(-1)?.pausedAt, T6);
  assert.equal(next.completeSince, full.intervals[0]?.resumedAt);
});

test("closing a pause that is not open changes nothing, and closing the open one records its end", () => {
  const closedOnly: PauseHistory = {
    intervals: [{ pausedAt: T2, resumedAt: T3 }]
  };
  assert.deepEqual(closePause(closedOnly, T4), closedOnly);
  const open: PauseHistory = { intervals: [{ pausedAt: T2 }] };
  assert.deepEqual(closePause(open, T4), {
    intervals: [{ pausedAt: T2, resumedAt: T4 }]
  });
});

test("an unknown pause status is rendered as paused unknown, never as never", () => {
  const snapshot: ThreadActivitySnapshot = {
    threadId: "thread-1",
    profiles: [],
    stages: [],
    policyRevision: "rev-1",
    pausedDuringThread: "paused unknown",
    conflicts: 0
  };
  const section = renderActivitySection({ status: "recorded", snapshot }) ?? "";
  assert.ok(section.includes("Pause during the thread: paused unknown."));
  assert.equal(section.includes("Pause during the thread: never."), false);
});
