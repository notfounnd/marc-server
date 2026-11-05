import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  SupervisionRecord,
  SupervisionStatus,
  SupervisionTurn
} from "../src/core/activation-supervision-types.js";
import { supervisionCardsOf } from "../src/daemon/supervision-views.js";

const T0 = "2026-11-10T12:00:00.000Z";
const MIN = 60_000;
const DEADLINE = new Date(Date.parse(T0) + 60 * MIN).toISOString();

/** The fields the card view derives. A field the row does not expect must be absent, not undefined. */
const DERIVED = [
  "deadlineAt",
  "costUsd",
  "turnMinutes",
  "canRetry",
  "canContinue"
] as const;

function turn(overrides: Partial<SupervisionTurn> = {}): SupervisionTurn {
  return {
    generation: 1,
    mode: "new",
    fingerprint: "fingerprint",
    continuation: false,
    pid: 4242,
    startedAt: T0,
    deadlineAt: DEADLINE,
    runningAt: T0,
    ...overrides
  };
}

function turnWithout(key: "deadlineAt" | "runningAt"): SupervisionTurn {
  const copy = turn();
  delete copy[key];
  return copy;
}

function card(
  overrides: Partial<SupervisionRecord> & { status: SupervisionStatus }
): SupervisionRecord {
  return {
    messageId: "msg_1",
    messageAt: T0,
    recipient: "claude-software-architect",
    stage: "planning",
    createdAt: T0,
    expiresAt: new Date(Date.parse(T0) + 24 * 60 * MIN).toISOString(),
    attempt: 1,
    ...overrides
  };
}

type Row = {
  name: string;
  record: SupervisionRecord;
  cap: number | undefined;
  expected: Record<string, unknown>;
};

const ROWS: Row[] = [
  {
    name: "a timed out turn offers Continue and Retry, with its minutes and cost",
    record: card({
      status: "failed",
      reason: "timeout",
      attempt: 1,
      turn: turn(),
      outcome: { costUsd: 0.031, denials: 0 }
    }),
    cap: 2,
    expected: {
      turnMinutes: 60,
      costUsd: 0.031,
      canRetry: true,
      canContinue: true
    }
  },
  {
    name: "a timed-out turn whose output was never read shows no cost",
    record: card({
      status: "failed",
      reason: "timeout",
      attempt: 1,
      turn: turn(),
      outcome: { denials: 0, failure: "timeout" }
    }),
    cap: 2,
    expected: { turnMinutes: 60, canRetry: true, canContinue: true }
  },
  {
    name: "a crashed turn offers Retry and not Continue",
    record: card({ status: "failed", reason: "crashed", turn: turn() }),
    cap: 2,
    expected: { turnMinutes: 60, canRetry: true, canContinue: false }
  },
  {
    name: "a revoked card offers neither action",
    record: card({ status: "failed", reason: "revoked" }),
    cap: 2,
    expected: { canRetry: false, canContinue: false }
  },
  {
    name: "a card at the attempt cap offers neither action",
    record: card({
      status: "failed",
      reason: "timeout",
      attempt: 2,
      turn: turn()
    }),
    cap: 2,
    expected: { turnMinutes: 60, canRetry: false, canContinue: false }
  },
  {
    name: "without a readable policy no action is offered",
    record: card({ status: "failed", reason: "timeout", turn: turn() }),
    cap: undefined,
    expected: { turnMinutes: 60, canRetry: false, canContinue: false }
  },
  {
    name: "a failed card without a turn omits the minutes",
    record: card({ status: "failed", reason: "crashed" }),
    cap: 2,
    expected: { canRetry: true, canContinue: false }
  },
  {
    name: "a failed card without its start instant omits the minutes",
    record: card({
      status: "failed",
      reason: "timeout",
      turn: turnWithout("runningAt")
    }),
    cap: 2,
    expected: { canRetry: true, canContinue: true }
  },
  {
    name: "a running card shows its deadline and no minutes",
    record: card({ status: "running", runId: "run-1", turn: turn() }),
    cap: 2,
    expected: { deadlineAt: DEADLINE, canRetry: false, canContinue: false }
  },
  {
    name: "a running card without a recorded deadline omits it",
    record: card({
      status: "running",
      runId: "run-1",
      turn: turnWithout("deadlineAt")
    }),
    cap: 2,
    expected: { canRetry: false, canContinue: false }
  },
  {
    name: "a running card shows its cost once it has an outcome",
    record: card({
      status: "running",
      runId: "run-1",
      turn: turn(),
      outcome: { costUsd: 0.01, denials: 0 }
    }),
    cap: 2,
    expected: {
      deadlineAt: DEADLINE,
      costUsd: 0.01,
      canRetry: false,
      canContinue: false
    }
  },
  {
    name: "a waiting card offers nothing",
    record: card({ status: "waiting", reason: "busy", attempt: 0 }),
    cap: 2,
    expected: { canRetry: false, canContinue: false }
  },
  {
    name: "an awaiting card offers nothing",
    record: card({ status: "awaiting_confirmation", attempt: 0 }),
    cap: 2,
    expected: { canRetry: false, canContinue: false }
  }
];

/** The derived fields of the one card a row builds, as JSON: an absent field stays absent. */
function derivedOf(row: Row): Record<string, unknown> {
  const [view] = supervisionCardsOf(
    { records: [row.record], floors: {} },
    undefined,
    row.cap
  );
  const picked: Record<string, unknown> = {};
  for (const key of DERIVED) picked[key] = view?.[key];
  return JSON.parse(JSON.stringify(picked)) as Record<string, unknown>;
}

for (const row of ROWS) {
  test(`card view: ${row.name}`, () => {
    assert.deepEqual(derivedOf(row), row.expected);
  });
}

const NOT_EXPOSED = [
  "turn",
  "outcome",
  "runId",
  "pid",
  "startedAt",
  "sessionId",
  "host"
];

test("the card view exposes no process, run or session field", () => {
  const [view] = supervisionCardsOf(
    {
      records: [
        card({
          status: "running",
          runId: "run-secret",
          turn: turn(),
          outcome: { costUsd: 0.01, denials: 0 }
        })
      ],
      floors: {}
    },
    undefined,
    2
  );
  const keys = Object.keys(view ?? {});
  for (const key of NOT_EXPOSED) assert.equal(keys.includes(key), false, key);
  assert.equal(JSON.stringify(view).includes("4242"), false);
  assert.equal(JSON.stringify(view).includes("run-secret"), false);
});
