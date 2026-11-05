import assert from "node:assert/strict";
import test from "node:test";
import { judgeSupervision } from "../src/core/activation-supervision.js";
import {
  MAX_SUPERVISION_RECORDS,
  advanceFloor,
  belowFloor,
  pruneSupervision,
  upsertRecord
} from "../src/core/activation-supervision-records.js";
import type {
  SupervisionRecord,
  SupervisionState,
  SupervisionStatus
} from "../src/core/activation-supervision-types.js";

const EPOCH = "2026-11-10T00:00:00.000Z";
const EARLIER = "2026-11-10T11:00:00.000Z";
const MESSAGE_AT = "2026-11-10T12:00:00.000Z";
const LATER = "2026-11-10T13:00:00.000Z";

function record(overrides: Partial<SupervisionRecord> = {}): SupervisionRecord {
  return {
    messageId: "msg-1",
    messageAt: MESSAGE_AT,
    recipient: "reviewer",
    stage: "planning",
    status: "waiting",
    createdAt: EARLIER,
    expiresAt: LATER,
    attempt: 0,
    ...overrides
  };
}

function minuteAt(index: number): string {
  return new Date(Date.parse(EPOCH) + index * 60_000).toISOString();
}

const floorRows: {
  name: string;
  messageAt: string;
  floor: string | undefined;
  below: boolean;
}[] = [
  {
    name: "no floor means nothing is below it",
    messageAt: MESSAGE_AT,
    floor: undefined,
    below: false
  },
  {
    name: "a mention equal to the floor is below it",
    messageAt: MESSAGE_AT,
    floor: MESSAGE_AT,
    below: true
  },
  {
    name: "an earlier mention is below the floor",
    messageAt: EARLIER,
    floor: MESSAGE_AT,
    below: true
  },
  {
    name: "a later mention is above the floor",
    messageAt: LATER,
    floor: MESSAGE_AT,
    below: false
  }
];

for (const row of floorRows) {
  test(`floor: ${row.name}`, () => {
    assert.equal(belowFloor(row.messageAt, row.floor), row.below);
  });
}

const advanceRows: {
  name: string;
  status: SupervisionStatus;
  expectedFloor: string | undefined;
}[] = [
  {
    name: "a declined card moves the floor to its message",
    status: "declined",
    expectedFloor: MESSAGE_AT
  },
  {
    name: "an expired card moves the floor to its message",
    status: "expired",
    expectedFloor: MESSAGE_AT
  },
  {
    name: "a waiting card does not move the floor",
    status: "waiting",
    expectedFloor: undefined
  },
  {
    name: "a failed card does not move the floor, because it can be retried",
    status: "failed",
    expectedFloor: undefined
  }
];

for (const row of advanceRows) {
  test(`floor advance: ${row.name}`, () => {
    const floors = advanceFloor({}, record({ status: row.status }));
    assert.equal(floors["reviewer"], row.expectedFloor);
  });
}

test("the floor never moves backwards", () => {
  const floors = advanceFloor(
    { reviewer: MESSAGE_AT },
    record({ status: "declined", messageAt: EARLIER })
  );
  assert.equal(floors["reviewer"], MESSAGE_AT);
});

function stateWith(settled: number, active: number): SupervisionState {
  const settledRecords = Array.from({ length: settled }, (_, index) =>
    record({
      messageId: `settled-${index}`,
      messageAt: minuteAt(index),
      createdAt: minuteAt(index),
      status: "declined"
    })
  );
  const activeRecords = Array.from({ length: active }, (_, index) =>
    record({
      messageId: `active-${index}`,
      messageAt: minuteAt(index),
      createdAt: minuteAt(index),
      status: "starting"
    })
  );
  return { records: [...activeRecords, ...settledRecords], floors: {} };
}

const pruneRows: {
  name: string;
  settled: number;
  active: number;
  expectedLength: number;
}[] = [
  {
    name: "keeps every card at or under the limit",
    settled: MAX_SUPERVISION_RECORDS,
    active: 0,
    expectedLength: MAX_SUPERVISION_RECORDS
  },
  {
    name: "prunes the oldest settled card beyond the limit",
    settled: MAX_SUPERVISION_RECORDS + 1,
    active: 0,
    expectedLength: MAX_SUPERVISION_RECORDS
  },
  {
    name: "never prunes starting or running cards, even above the limit",
    settled: 0,
    active: MAX_SUPERVISION_RECORDS + 2,
    expectedLength: MAX_SUPERVISION_RECORDS + 2
  },
  {
    name: "prunes settled cards around the active ones and keeps every active card",
    settled: MAX_SUPERVISION_RECORDS + 1,
    active: 1,
    expectedLength: MAX_SUPERVISION_RECORDS
  }
];

for (const row of pruneRows) {
  test(`prune: ${row.name}`, () => {
    const pruned = pruneSupervision(stateWith(row.settled, row.active));
    const activeKept = pruned.records.filter(
      (candidate) => candidate.status === "starting"
    );
    assert.equal(pruned.records.length, row.expectedLength);
    assert.equal(activeKept.length, row.active);
  });
}

test("a pruned card moves its recipient's floor, so it is never recreated", () => {
  const pruned = pruneSupervision(stateWith(MAX_SUPERVISION_RECORDS + 1, 0));
  assert.equal(pruned.floors["reviewer"], minuteAt(0));
  const verdict = judgeSupervision({
    reservation: { status: "granted" },
    slot: {
      state: "unbound",
      details: {
        busy: false,
        listening: false,
        reason: "fixture",
        pastConflict: false
      },
      sameHost: true,
      identityVerified: true
    },
    existing: undefined,
    messageAt: minuteAt(0),
    floor: pruned.floors["reviewer"]
  });
  assert.deepStrictEqual(verdict, { action: "none", reason: "below_floor" });
});

const upsertRows: {
  name: string;
  recipient: string;
  expectedLength: number;
  expectedStatus: SupervisionStatus;
}[] = [
  {
    name: "the same message and recipient updates the card in place",
    recipient: "reviewer",
    expectedLength: 1,
    expectedStatus: "awaiting_confirmation"
  },
  {
    name: "another recipient of the same message gets its own card",
    recipient: "architect",
    expectedLength: 2,
    expectedStatus: "waiting"
  }
];

for (const row of upsertRows) {
  test(`upsert: ${row.name}`, () => {
    const existing = [record({ status: "waiting" })];
    const next = record({
      status: row.expectedStatus,
      recipient: row.recipient
    });
    const records = upsertRecord(existing, next);
    assert.equal(records.length, row.expectedLength);
    assert.equal(
      records.find((candidate) => candidate.recipient === row.recipient)
        ?.status,
      row.expectedStatus
    );
  });
}
