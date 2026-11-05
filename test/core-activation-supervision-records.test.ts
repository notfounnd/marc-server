import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransition,
  expireDue,
  expiresAtFor,
  transitionRecord
} from "../src/core/activation-supervision-records.js";
import type {
  SupervisionRecord,
  SupervisionStatus
} from "../src/core/activation-supervision-types.js";

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

const transitionRows: {
  name: string;
  from: SupervisionStatus;
  to: SupervisionStatus;
  allowed: boolean;
}[] = [
  {
    name: "a waiting card may become awaiting",
    from: "waiting",
    to: "awaiting_confirmation",
    allowed: true
  },
  {
    name: "a waiting card cannot start without its approval",
    from: "waiting",
    to: "starting",
    allowed: false
  },
  {
    name: "an approved card may start",
    from: "awaiting_confirmation",
    to: "starting",
    allowed: true
  },
  {
    name: "an awaiting card may be declined",
    from: "awaiting_confirmation",
    to: "declined",
    allowed: true
  },
  {
    name: "an awaiting card may return to waiting when the slot is busy",
    from: "awaiting_confirmation",
    to: "waiting",
    allowed: true
  },
  {
    name: "a starting card may run",
    from: "starting",
    to: "running",
    allowed: true
  },
  {
    name: "a starting card may fail when its approval is revoked",
    from: "starting",
    to: "failed",
    allowed: true
  },
  {
    name: "a starting card never expires",
    from: "starting",
    to: "expired",
    allowed: false
  },
  {
    name: "a running card may finish",
    from: "running",
    to: "done",
    allowed: true
  },
  {
    name: "a running card never expires",
    from: "running",
    to: "expired",
    allowed: false
  },
  {
    name: "a failed card may be retried",
    from: "failed",
    to: "starting",
    allowed: true
  },
  {
    name: "a failed card may expire",
    from: "failed",
    to: "expired",
    allowed: true
  },
  {
    name: "a done card cannot run again",
    from: "done",
    to: "running",
    allowed: false
  },
  {
    name: "a declined card cannot start",
    from: "declined",
    to: "starting",
    allowed: false
  },
  {
    name: "an expired card cannot return to waiting",
    from: "expired",
    to: "waiting",
    allowed: false
  },
  {
    name: "a superseded card cannot become awaiting",
    from: "superseded",
    to: "awaiting_confirmation",
    allowed: false
  },
  {
    name: "a status stays the same",
    from: "starting",
    to: "starting",
    allowed: true
  }
];

for (const row of transitionRows) {
  test(`transition: ${row.name}`, () => {
    assert.equal(canTransition(row.from, row.to), row.allowed);
  });
}

test("a refused transition returns no card and changes none", () => {
  const waiting = record({ status: "waiting" });
  assert.equal(transitionRecord(waiting, "starting"), undefined);
  assert.equal(waiting.status, "waiting");
});

test("an approved transition records its run and attempt", () => {
  const approved = transitionRecord(
    record({ status: "awaiting_confirmation" }),
    "starting",
    { runId: "run-1", attempt: 1 }
  );
  assert.equal(approved?.status, "starting");
  assert.equal(approved?.runId, "run-1");
  assert.equal(approved?.attempt, 1);
});

const expiryRows: {
  name: string;
  status: SupervisionStatus;
  now: string;
  expected: SupervisionStatus;
}[] = [
  {
    name: "a waiting card before its deadline stays waiting",
    status: "waiting",
    now: EARLIER,
    expected: "waiting"
  },
  {
    name: "a waiting card at its deadline expires",
    status: "waiting",
    now: LATER,
    expected: "expired"
  },
  {
    name: "an awaiting card after its deadline expires",
    status: "awaiting_confirmation",
    now: LATER,
    expected: "expired"
  },
  {
    name: "a failed card after its deadline expires",
    status: "failed",
    now: LATER,
    expected: "expired"
  },
  {
    name: "a starting card never expires",
    status: "starting",
    now: LATER,
    expected: "starting"
  },
  {
    name: "a running card never expires",
    status: "running",
    now: LATER,
    expected: "running"
  },
  {
    name: "a declined card stays declined",
    status: "declined",
    now: LATER,
    expected: "declined"
  }
];

for (const row of expiryRows) {
  test(`expiry: ${row.name}`, () => {
    const expired = expireDue(record({ status: row.status }), row.now);
    assert.equal(expired.status, row.expected);
  });
}

test("a new card expires after the policy's pending TTL", () => {
  assert.equal(
    expiresAtFor("2026-11-10T12:00:00.000Z", 1440),
    "2026-11-11T12:00:00.000Z"
  );
});
