import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claudeCodeAdapter,
  type FailureReason,
  type ParseResult,
  type RunOutcome
} from "../src/core/client-adapters.js";
import {
  costDeltaOf,
  turnResultOf,
  type TurnEnding
} from "../src/core/supervision-turn-outcome.js";

const DELTA_ROWS: readonly {
  name: string;
  total: number;
  last: number | undefined;
  expected: number;
}[] = [
  {
    name: "the first turn of a session costs its total",
    total: 0.001,
    last: undefined,
    expected: 0.001
  },
  {
    name: "a resumed turn costs the delta",
    total: 0.005,
    last: 0.001,
    expected: 0.004
  },
  {
    name: "a total below the last one is a restarted session",
    total: 0.002,
    last: 0.005,
    expected: 0.002
  },
  { name: "no new cost costs nothing", total: 0.005, last: 0.005, expected: 0 }
];

for (const row of DELTA_ROWS) {
  test(`cost delta: ${row.name}`, () => {
    assert.ok(
      Math.abs(costDeltaOf(row.total, row.last) - row.expected) < 1e-12
    );
  });
}

function parsed(
  overrides: {
    totalCostUsd?: number;
    permissionDenials?: unknown[];
    isError?: boolean;
  } = {}
): ParseResult {
  return {
    status: "parsed",
    result: {
      sessionId: "supervision-session",
      isError: overrides.isError ?? false,
      subtype: "success",
      permissionDenials: overrides.permissionDenials ?? [],
      totalCostUsd: overrides.totalCostUsd ?? 0.001,
      durationMs: 5,
      resultText: "done"
    }
  };
}

const INVALID: ParseResult = { status: "invalid_output" };
const CLEAN: RunOutcome = {
  timedOut: false,
  crashed: false,
  missingClient: false,
  exitCode: 0,
  parsed: parsed(),
  stderr: ""
};
const DONE: TurnEnding = { status: "done" };
const failedWith = (reason: FailureReason): TurnEnding => ({
  status: "failed",
  reason
});

/** Each row is one observed turn, the ending it must have, and what it costs and keeps. */
const ENDING_ROWS: readonly {
  name: string;
  run: RunOutcome;
  last: number | undefined;
  ending: TurnEnding;
  /** Undefined when the turn's output was not read: the outcome then has no cost at all. */
  costUsd: number | undefined;
  denials: number;
  lastCostUsd: number | undefined;
}[] = [
  {
    name: "a clean turn is done",
    run: CLEAN,
    last: undefined,
    ending: DONE,
    costUsd: 0.001,
    denials: 0,
    lastCostUsd: 0.001
  },
  {
    name: "the delta of a resumed clean turn",
    run: { ...CLEAN, parsed: parsed({ totalCostUsd: 0.005 }) },
    last: 0.001,
    ending: DONE,
    costUsd: 0.004,
    denials: 0,
    lastCostUsd: 0.005
  },
  {
    name: "permission denials are counted",
    run: { ...CLEAN, parsed: parsed({ permissionDenials: [{}, {}] }) },
    last: undefined,
    ending: DONE,
    costUsd: 0.001,
    denials: 2,
    lastCostUsd: 0.001
  },
  {
    name: "a timeout beats malformed output",
    run: { ...CLEAN, timedOut: true, exitCode: undefined, parsed: INVALID },
    last: 0.001,
    ending: failedWith("timeout"),
    costUsd: undefined,
    denials: 0,
    lastCostUsd: 0.001
  },
  {
    name: "a crash beats malformed output",
    run: { ...CLEAN, crashed: true, exitCode: undefined, parsed: INVALID },
    last: undefined,
    ending: failedWith("crashed"),
    costUsd: undefined,
    denials: 0,
    lastCostUsd: undefined
  },
  {
    name: "a missing client is named",
    run: {
      ...CLEAN,
      missingClient: true,
      exitCode: undefined,
      parsed: INVALID
    },
    last: undefined,
    ending: failedWith("client_missing"),
    costUsd: undefined,
    denials: 0,
    lastCostUsd: undefined
  },
  {
    name: "an error result is an error and keeps its cost",
    run: { ...CLEAN, parsed: parsed({ isError: true }) },
    last: undefined,
    ending: failedWith("error"),
    costUsd: 0.001,
    denials: 0,
    lastCostUsd: 0.001
  },
  {
    name: "malformed output with an exit code is invalid output",
    run: { ...CLEAN, exitCode: 1, parsed: INVALID },
    last: 0.001,
    ending: failedWith("invalid_output"),
    costUsd: undefined,
    denials: 0,
    lastCostUsd: 0.001
  }
];

for (const row of ENDING_ROWS) {
  test(`turn ending: ${row.name}`, () => {
    const result = turnResultOf(row.run, claudeCodeAdapter, row.last);
    assert.deepEqual(result.ending, row.ending);
    assert.equal(result.outcome.denials, row.denials);
    assert.equal(
      Object.hasOwn(result.outcome, "costUsd"),
      row.costUsd !== undefined
    );
    assert.ok(
      Math.abs((result.outcome.costUsd ?? -1) - (row.costUsd ?? -1)) < 1e-12
    );
    assert.equal(
      result.outcome.failure,
      (row.ending as { reason?: string }).reason
    );
    assert.equal(result.lastCostUsd, row.lastCostUsd);
  });
}
