import assert from "node:assert/strict";
import test from "node:test";
import {
  RESERVATION_LIMIT,
  closeHolds,
  confirmReservation,
  expiredBy,
  latestTimestamp,
  prepareStamp,
  pruneRecords
} from "../src/core/activation-reservation-records.js";
import type { ReservationRecord } from "../src/core/activation-reservation-types.js";

const ARCHITECT = "claude-software-architect";
const OTHER = "codex-software-architect";
const T0 = "2026-11-05T10:00:00.000Z";
const T1 = "2026-11-05T10:01:00.000Z";

function recordOf(
  overrides: Partial<ReservationRecord> = {}
): ReservationRecord {
  return {
    messageId: "msg_1",
    recipient: OTHER,
    author: ARCHITECT,
    origin: "architect",
    holder: "session-codex",
    runId: "run-1",
    runIds: ["run-1"],
    stage: "planning",
    status: "granted",
    granted: true,
    attempts: 0,
    cycle: 1,
    cycleRole: "open",
    cycleState: "open",
    messageAt: T0,
    ...overrides
  };
}

test("the pruning floor is inclusive: a message at the floor is expired, a later one is not", () => {
  assert.deepEqual(
    [expiredBy(T1, T1), expiredBy(T0, T1), expiredBy(T1, undefined)],
    [true, true, false]
  );
  assert.equal(expiredBy(T1, T0), false);
});

test("the pruning floor never moves back", () => {
  assert.equal(latestTimestamp(T1, [T0]), T1);
  assert.equal(latestTimestamp(T0, [T1]), T1);
  assert.equal(latestTimestamp(undefined, []), undefined);
});

test("pruning keeps the list at its bound, skips open cycles, and raises the floor to the newest pruned time", () => {
  const open = recordOf({ messageId: "msg_open", messageAt: T0 });
  const closed = Array.from({ length: RESERVATION_LIMIT }, (_, index) =>
    recordOf({
      messageId: `msg_${index}`,
      cycleRole: "none",
      cycleState: undefined,
      cycle: undefined,
      messageAt: `2026-11-05T09:${String(index % 60).padStart(2, "0")}:00.000Z`
    })
  );
  const pruned = pruneRecords([open, ...closed], undefined);
  assert.equal(pruned.records.length, RESERVATION_LIMIT);
  assert.ok(pruned.records.includes(open));
  assert.equal(pruned.prunedThrough, "2026-11-05T09:00:00.000Z");
});

test("closing holds ends only the held records, with stage_advanced", () => {
  const held = recordOf({
    messageId: "msg_held",
    status: "held",
    granted: false,
    runIds: []
  });
  const kept = recordOf({ messageId: "msg_kept" });
  const closed = closeHolds([held, kept]);
  assert.deepEqual(
    [
      closed.dropped,
      closed.records[0]?.status,
      closed.records[0]?.reason,
      closed.records[1]?.status
    ],
    [1, "refused", "stage_advanced", "granted"]
  );
});

type StampRow = {
  name: string;
  records: ReservationRecord[];
  expect: Record<string, unknown>;
};

const STAMP_ROWS: readonly StampRow[] = [
  {
    name: "an unanswered grant stamps its stage, its cycle and its key",
    records: [recordOf({ recipient: OTHER })],
    expect: {
      stage: "planning",
      cycle: 1,
      reservation: "msg_1:codex-software-architect"
    }
  },
  {
    name: "an answered grant stamps only the stage",
    records: [recordOf({ answeredBy: "msg_reply" })],
    expect: { stage: "planning", cycle: undefined, reservation: undefined }
  },
  {
    name: "a refused record does not stamp a cycle",
    records: [recordOf({ status: "refused", reason: "attempts_exhausted" })],
    expect: { stage: "planning", cycle: undefined, reservation: undefined }
  },
  {
    name: "a grant to another agent does not stamp this one",
    records: [recordOf({ recipient: ARCHITECT })],
    expect: { stage: "planning", cycle: undefined, reservation: undefined }
  }
];

for (const row of STAMP_ROWS) {
  test(`stamp: ${row.name}`, () => {
    const stamp = prepareStamp(row.records, "planning", OTHER);
    const picked = Object.fromEntries(
      Object.keys(row.expect).map((key) => [
        key,
        stamp[key as keyof typeof stamp]
      ])
    );
    assert.deepEqual(picked, row.expect);
  });
}

test("confirming a stamp marks it answered once, and repeating the same message changes nothing", () => {
  const key = "msg_1:codex-software-architect";
  const answered = [recordOf({ recipient: OTHER, answeredBy: "msg_reply" })];
  const first = confirmReservation([recordOf({ recipient: OTHER })], {
    agentId: OTHER,
    messageId: "msg_reply",
    reservation: key
  });
  assert.deepEqual(first, { decision: "answered", records: answered });
  const again = confirmReservation(answered, {
    agentId: OTHER,
    messageId: "msg_reply",
    reservation: key
  });
  assert.deepEqual(again, { decision: "already" });
  const second = confirmReservation(answered, {
    agentId: OTHER,
    messageId: "msg_second",
    reservation: key
  });
  assert.deepEqual(second, { decision: "refused", reason: "already_answered" });
});

test("confirming a key that is not this agent's grant is refused", () => {
  const decision = confirmReservation([recordOf({ recipient: OTHER })], {
    agentId: ARCHITECT,
    messageId: "msg_reply",
    reservation: "msg_1:codex-software-architect"
  });
  assert.deepEqual(decision, {
    decision: "refused",
    reason: "reservation_not_found"
  });
});
