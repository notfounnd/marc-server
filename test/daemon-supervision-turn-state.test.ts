import assert from "node:assert/strict";
import { test } from "node:test";
import { isOptionalSupervision } from "../src/daemon/activation-supervision-file.js";
import {
  emptyRegistryFile,
  isRegistryFile
} from "../src/daemon/session-file.js";
import { supervisionCountsOf } from "../src/daemon/supervision-views.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";

const CARD: SupervisionRecord = {
  messageId: "msg_a",
  messageAt: "2026-11-10T12:00:00.000Z",
  recipient: "claude-second-architect",
  stage: "planning",
  status: "running",
  createdAt: "2026-11-10T12:00:00.000Z",
  expiresAt: "2026-11-11T12:00:00.000Z",
  attempt: 1,
  runId: "run-1",
  turn: {
    generation: 2,
    mode: "resume",
    fingerprint: "abc",
    continuation: false,
    pid: 4242,
    startedAt: "2026-11-10T12:00:00.000Z"
  }
};

/** Each row is a state of the card's launch block; the file must accept the whole and refuse a broken block. */
const TURN_ROWS: readonly { name: string; turn: unknown; valid: boolean }[] = [
  { name: "a complete launch block", turn: CARD.turn, valid: true },
  {
    name: "a card without a launch block, from before the approval",
    turn: undefined,
    valid: true
  },
  {
    name: "an unknown mode",
    turn: { ...CARD.turn, mode: "fork" },
    valid: false
  },
  {
    name: "a negative generation",
    turn: { ...CARD.turn, generation: -1 },
    valid: false
  },
  { name: "a negative pid", turn: { ...CARD.turn, pid: -1 }, valid: false },
  {
    name: "no continuation flag",
    turn: { generation: 2, mode: "new", fingerprint: "abc", pid: 1 },
    valid: false
  },
  {
    name: "no fingerprint",
    turn: { generation: 2, mode: "new", continuation: true },
    valid: false
  },
  {
    name: "a launch block that is not an object",
    turn: "running",
    valid: false
  }
];

for (const row of TURN_ROWS) {
  test(`supervision state, launch block: ${row.name}`, () => {
    const state = { records: [{ ...CARD, turn: row.turn }], floors: {} };
    assert.equal(isOptionalSupervision(state), row.valid);
  });
}

const BINDING = {
  workspaceId: "w",
  threadId: "t",
  profile: "claude-second-architect",
  client: "claude-code",
  nativeSessionId: "supervision-session",
  hostId: "host",
  origin: "supervisor",
  generation: 2,
  owner: { ownerToken: "token" },
  boundAt: "2026-11-10T12:00:00.000Z",
  conflicts: []
};

/** Each row is the last cost a binding keeps: absent, a finite non-negative total, or anything else. */
const COST_ROWS: readonly {
  name: string;
  lastCostUsd: unknown;
  valid: boolean;
}[] = [
  { name: "no cost yet", lastCostUsd: undefined, valid: true },
  { name: "a session total", lastCostUsd: 0.004, valid: true },
  { name: "a negative total", lastCostUsd: -0.001, valid: false },
  { name: "a total that is not a number", lastCostUsd: "0.004", valid: false },
  { name: "an infinite total", lastCostUsd: Infinity, valid: false }
];

for (const row of COST_ROWS) {
  test(`registry binding, last cost: ${row.name}`, () => {
    const registry = {
      ...emptyRegistryFile(),
      generation: 2,
      slots: {
        "w:t:claude-second-architect": {
          ...BINDING,
          lastCostUsd: row.lastCostUsd
        }
      }
    };
    assert.equal(isRegistryFile(registry), row.valid);
  });
}

const COUNT_ROWS: readonly {
  name: string;
  records: SupervisionRecord[];
  costUsd: number;
  activations: number;
}[] = [
  {
    name: "no card has a cost",
    records: [{ ...CARD, outcome: undefined }],
    costUsd: 0,
    activations: 1
  },
  {
    name: "the cost of the cards is summed, without their ids",
    records: [
      { ...CARD, messageId: "a", outcome: { costUsd: 0.001, denials: 0 } },
      {
        ...CARD,
        messageId: "b",
        status: "failed",
        attempt: 2,
        outcome: { costUsd: 0.0025, denials: 1, failure: "timeout" }
      }
    ],
    costUsd: 0.0035,
    activations: 3
  }
];

for (const row of COUNT_ROWS) {
  test(`supervisor counts: ${row.name}`, () => {
    const counts = supervisionCountsOf({ records: row.records, floors: {} });
    assert.ok(Math.abs(counts.costUsd - row.costUsd) < 1e-12);
    assert.equal(counts.activations, row.activations);
    assert.deepEqual(Object.keys(counts).sort(), [
      "activations",
      "costUsd",
      "expired",
      "failures"
    ]);
  });
}
