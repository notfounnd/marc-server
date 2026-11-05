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

const rows: {
  name: string;
  facts: Partial<SupervisionFacts>;
  expected: SupervisionVerdict;
}[] = [
  {
    name: "a listening online slot with a held reservation adds no second card",
    facts: {
      reservation: { status: "held", reason: "budget_exhausted" },
      slot: slot("online", { details: LISTENING })
    },
    expected: { action: "none", reason: "listening" }
  },
  {
    name: "a listener supersedes a pending card even when the reservation is held",
    facts: {
      reservation: { status: "held", reason: "budget_exhausted" },
      slot: slot("online", { details: LISTENING }),
      existing: record({ status: "waiting" })
    },
    expected: { action: "update", status: "superseded", reason: "listening" }
  },
  {
    name: "a busy online slot that listens needs no card, because listening comes before busy",
    facts: {
      slot: slot("online", {
        details: { ...IDLE, busy: true, listening: true }
      })
    },
    expected: { action: "none", reason: "listening" }
  },
  {
    name: "a listener on another host is barred as other_host, not taken as local",
    facts: {
      slot: slot("online", { sameHost: false, details: LISTENING })
    },
    expected: { action: "create", status: "waiting", reason: "other_host" }
  },
  {
    name: "a held reservation on an idle online slot still waits, with its reason",
    facts: {
      reservation: { status: "held", reason: "pause" },
      slot: slot("online", { details: IDLE })
    },
    expected: { action: "create", status: "waiting", reason: "pause" }
  },
  {
    name: "a reserved slot on this host is busy even with an unverified identity",
    facts: { slot: slot("reserved", { identityVerified: false }) },
    expected: { action: "create", status: "waiting", reason: "busy" }
  },
  {
    name: "a reserved slot on another host waits for other_host",
    facts: { slot: slot("reserved", { sameHost: false }) },
    expected: { action: "create", status: "waiting", reason: "other_host" }
  },
  {
    name: "an online occupant with an unverified identity waits for identity_unverified",
    facts: { slot: slot("online", { identityVerified: false }) },
    expected: {
      action: "create",
      status: "waiting",
      reason: "identity_unverified"
    }
  },
  {
    name: "an awaiting card is superseded when the reservation is refused by policy",
    facts: {
      reservation: { status: "refused", reason: "policy_disabled" },
      existing: record({ status: "awaiting_confirmation" })
    },
    expected: {
      action: "update",
      status: "superseded",
      reason: "policy_disabled"
    }
  },
  {
    name: "a waiting card is superseded when the waiter already took the mention",
    facts: {
      reservation: { status: "refused", reason: "already_reserved" },
      slot: slot("online", { details: IDLE }),
      existing: record({ status: "waiting" })
    },
    expected: {
      action: "update",
      status: "superseded",
      reason: "already_reserved"
    }
  },
  {
    name: "a refused reservation with no card creates nothing",
    facts: {
      reservation: { status: "refused", reason: "already_reserved" }
    },
    expected: { action: "none", reason: "already_reserved" }
  },
  {
    name: "a declined card stays declined even when the reservation is refused",
    facts: {
      reservation: { status: "refused", reason: "policy_disabled" },
      existing: record({ status: "declined" })
    },
    expected: { action: "none", reason: "already_declined" }
  }
];

for (const row of rows) {
  test(`judgeSupervision precedence: ${row.name}`, () => {
    assert.deepStrictEqual(judgeSupervision(facts(row.facts)), row.expected);
  });
}
