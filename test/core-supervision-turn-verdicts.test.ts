import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import {
  isStartingRun,
  judgeRecheck,
  turnFingerprintOf,
  type RecheckFacts
} from "../src/core/supervision-turn-recheck.js";

const PASSING: RecheckFacts = {
  policyReady: true,
  cyclesAuthorized: true,
  paused: false,
  turnAuthorized: true,
  fingerprintMatches: true,
  ownerMatches: true,
  eligible: true
};

/** Each row breaks one fact of the approval and expects the second pass to answer the verdict. */
const RECHECK_ROWS: readonly {
  name: string;
  change: Partial<RecheckFacts>;
  status: "ok" | "revoked";
}[] = [
  { name: "every fact still holds", change: {}, status: "ok" },
  {
    name: "the policy is no longer ready",
    change: { policyReady: false },
    status: "revoked"
  },
  {
    name: "the cycles setting is tampered",
    change: { cyclesAuthorized: false },
    status: "revoked"
  },
  {
    name: "the workspace is paused",
    change: { paused: true },
    status: "revoked"
  },
  {
    name: "the time limit is tampered",
    change: { turnAuthorized: false },
    status: "revoked"
  },
  {
    name: "the policy or the setting fingerprint changed",
    change: { fingerprintMatches: false },
    status: "revoked"
  },
  {
    name: "the binding changed generation or was released",
    change: { ownerMatches: false },
    status: "revoked"
  },
  {
    name: "the recipient is no longer an eligible architect",
    change: { eligible: false },
    status: "revoked"
  }
];

for (const row of RECHECK_ROWS) {
  test(`second pass: ${row.name}`, () => {
    assert.deepEqual(judgeRecheck({ ...PASSING, ...row.change }), {
      status: row.status
    });
  });
}

const CARD: SupervisionRecord = {
  messageId: "msg_a",
  messageAt: "2026-11-10T12:00:00.000Z",
  recipient: "claude-second-architect",
  stage: "planning",
  status: "starting",
  createdAt: "2026-11-10T12:00:00.000Z",
  expiresAt: "2026-11-11T12:00:00.000Z",
  attempt: 1,
  runId: "run-1",
  turn: { generation: 1, mode: "new", fingerprint: "f", continuation: false }
};

const STARTING_ROWS: readonly {
  name: string;
  card: SupervisionRecord | undefined;
  runId: string | undefined;
  expected: boolean;
}[] = [
  {
    name: "the starting card of this run",
    card: CARD,
    runId: "run-1",
    expected: true
  },
  {
    name: "a card of another run",
    card: CARD,
    runId: "run-2",
    expected: false
  },
  {
    name: "no run id to compare",
    card: CARD,
    runId: undefined,
    expected: false
  },
  {
    name: "a card that is already running",
    card: { ...CARD, status: "running" },
    runId: "run-1",
    expected: false
  },
  {
    name: "a starting card without its launch block",
    card: { ...CARD, turn: undefined },
    runId: "run-1",
    expected: false
  },
  { name: "no card", card: undefined, runId: "run-1", expected: false }
];

for (const row of STARTING_ROWS) {
  test(`starting card: ${row.name}`, () => {
    assert.equal(isStartingRun(row.card, row.runId), row.expected);
  });
}

test("the fingerprint changes with the policy, the cycles and the time limit, and not with the order of the keys", () => {
  const base = {
    policy: { attemptCap: 2 },
    cyclesPerStage: 3,
    turnTimeoutMinutes: 60
  };
  const reordered = {
    turnTimeoutMinutes: 60,
    cyclesPerStage: 3,
    policy: { attemptCap: 2 }
  };
  assert.equal(turnFingerprintOf(base), turnFingerprintOf(reordered));
  assert.notEqual(
    turnFingerprintOf(base),
    turnFingerprintOf({ ...base, policy: { attemptCap: 3 } })
  );
  assert.notEqual(
    turnFingerprintOf(base),
    turnFingerprintOf({ ...base, cyclesPerStage: 4 })
  );
  assert.notEqual(
    turnFingerprintOf(base),
    turnFingerprintOf({ ...base, turnTimeoutMinutes: 45 })
  );
});
