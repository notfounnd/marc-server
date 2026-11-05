import assert from "node:assert/strict";
import test from "node:test";
import { judgeSupervision } from "../src/core/activation-supervision.js";
import type {
  SlotFacts,
  SupervisionFacts,
  SupervisionRecord,
  SupervisionVerdict
} from "../src/core/activation-supervision-types.js";
import type { SlotDetails, SlotStateName } from "../src/core/session-slots.js";

const EARLIER = "2026-11-10T11:00:00.000Z";
const MESSAGE_AT = "2026-11-10T12:00:00.000Z";
const LATER = "2026-11-10T13:00:00.000Z";

const IDLE: SlotDetails = {
  busy: false,
  listening: false,
  reason: "fixture",
  pastConflict: false
};
const BUSY: SlotDetails = { ...IDLE, busy: true };
const LISTENING: SlotDetails = { ...IDLE, listening: true };

function slot(
  state: SlotStateName,
  overrides: Partial<SlotFacts> = {}
): SlotFacts {
  return {
    state,
    details: IDLE,
    sameHost: true,
    identityVerified: true,
    ...overrides
  };
}

function facts(overrides: Partial<SupervisionFacts> = {}): SupervisionFacts {
  return {
    reservation: { status: "granted" },
    slot: slot("unbound"),
    existing: undefined,
    messageAt: MESSAGE_AT,
    floor: undefined,
    ...overrides
  };
}

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

const judgeRows: {
  name: string;
  facts: Partial<SupervisionFacts>;
  expected: SupervisionVerdict;
}[] = [
  {
    name: "row 1: a refused reservation creates nothing",
    facts: { reservation: { status: "refused", reason: "thread_closed" } },
    expected: { action: "none", reason: "thread_closed" }
  },
  {
    name: "row 1: a held reservation becomes a waiting card with its reason",
    facts: { reservation: { status: "held", reason: "budget_exhausted" } },
    expected: {
      action: "create",
      status: "waiting",
      reason: "budget_exhausted"
    }
  },
  {
    name: "row 1 answers before row 2 when the reservation is refused",
    facts: {
      reservation: { status: "refused", reason: "policy_disabled" },
      slot: slot("unknown")
    },
    expected: { action: "none", reason: "policy_disabled" }
  },
  {
    name: "row 0: a declined card is never revived",
    facts: { existing: record({ status: "declined" }) },
    expected: { action: "none", reason: "already_declined" }
  },
  {
    name: "row 0: a failed card is left to the executor",
    facts: { existing: record({ status: "failed" }) },
    expected: { action: "none", reason: "already_failed" }
  },
  {
    name: "row 0: a superseded card is never revived on a free slot",
    facts: { existing: record({ status: "superseded" }) },
    expected: { action: "none", reason: "already_superseded" }
  },
  {
    name: "row 2: an unknown slot waits",
    facts: { slot: slot("unknown") },
    expected: { action: "create", status: "waiting", reason: "unknown" }
  },
  {
    name: "row 2: a conflicting slot waits",
    facts: { slot: slot("conflict") },
    expected: { action: "create", status: "waiting", reason: "conflict" }
  },
  {
    name: "row 2: a live occupant on another host waits",
    facts: { slot: slot("online", { sameHost: false, details: LISTENING }) },
    expected: { action: "create", status: "waiting", reason: "other_host" }
  },
  {
    name: "row 2 does not bar a reserved slot on this host for its identity: it is busy",
    facts: { slot: slot("reserved", { identityVerified: false }) },
    expected: { action: "create", status: "waiting", reason: "busy" }
  },
  {
    name: "row 2 never bars an unbound slot, even with an unverified identity",
    facts: { slot: slot("unbound", { identityVerified: false }) },
    expected: {
      action: "create",
      status: "awaiting_confirmation",
      reason: undefined
    }
  },
  {
    name: "row 2 never bars a proven end, even on another host",
    facts: {
      slot: slot("ended", { sameHost: false, identityVerified: false })
    },
    expected: {
      action: "create",
      status: "awaiting_confirmation",
      reason: undefined
    }
  },
  {
    name: "row 3: an existing pending card is updated, never duplicated",
    facts: {
      existing: record({ status: "waiting" }),
      slot: slot("unbound")
    },
    expected: {
      action: "update",
      status: "awaiting_confirmation",
      reason: undefined
    }
  },
  {
    name: "row 3: a mention at the recipient floor creates no card",
    facts: { floor: MESSAGE_AT },
    expected: { action: "none", reason: "below_floor" }
  },
  {
    name: "row 3: a mention above the recipient floor creates its card",
    facts: { floor: EARLIER },
    expected: {
      action: "create",
      status: "awaiting_confirmation",
      reason: undefined
    }
  },
  {
    name: "row 4: a reserved slot waits for its busy turn",
    facts: { slot: slot("reserved") },
    expected: { action: "create", status: "waiting", reason: "busy" }
  },
  {
    name: "row 4: a busy online slot without a listener waits for its busy turn",
    facts: { slot: slot("online", { details: BUSY }) },
    expected: { action: "create", status: "waiting", reason: "busy" }
  },
  {
    name: "row 5: an online listening slot needs no card",
    facts: { slot: slot("online", { details: LISTENING }) },
    expected: { action: "none", reason: "listening" }
  },
  {
    name: "row 5: a listener supersedes an earlier pending card",
    facts: {
      slot: slot("online", { details: LISTENING }),
      existing: record({ status: "waiting" })
    },
    expected: { action: "update", status: "superseded", reason: "listening" }
  },
  {
    name: "row 6: an online slot without a listener waits",
    facts: { slot: slot("online", { details: IDLE }) },
    expected: { action: "create", status: "waiting", reason: "not_listening" }
  },
  {
    name: "row 7: an unbound slot awaits the human's approval",
    facts: { slot: slot("unbound") },
    expected: {
      action: "create",
      status: "awaiting_confirmation",
      reason: undefined
    }
  },
  {
    name: "row 7: an ended slot awaits the human's approval",
    facts: { slot: slot("ended") },
    expected: {
      action: "create",
      status: "awaiting_confirmation",
      reason: undefined
    }
  }
];

for (const row of judgeRows) {
  test(`judgeSupervision: ${row.name}`, () => {
    assert.deepStrictEqual(judgeSupervision(facts(row.facts)), row.expected);
  });
}
