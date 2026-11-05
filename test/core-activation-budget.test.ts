import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetView,
  isThreadPaused,
  type ActivationThreadState,
  type BudgetWarning
} from "../src/core/activation-budget.js";
import type { FixedStage } from "../src/core/activation-stages.js";

const GRANTED_AT = "2026-11-05T00:00:00.000Z";

function readyWith(
  cyclesUsed: number,
  grants: number[] = [],
  stage: FixedStage = "planning"
): ActivationThreadState {
  return {
    status: "ready",
    currentStage: stage,
    stages: {
      [stage]: {
        cyclesUsed,
        extensions: grants.map((cycles) => ({ at: GRANTED_AT, cycles }))
      }
    }
  };
}

type BudgetRow = {
  name: string;
  enabled: boolean;
  state: ActivationThreadState;
  cyclesPerStage: number;
  used: number | null;
  max: number;
  warnings: BudgetWarning[];
};

const BUDGET_ROWS: BudgetRow[] = [
  {
    name: "fresh stage shows no warning",
    enabled: true,
    state: readyWith(0),
    cyclesPerStage: 5,
    used: 0,
    max: 5,
    warnings: []
  },
  {
    name: "four of five shows no warning",
    enabled: true,
    state: readyWith(3),
    cyclesPerStage: 5,
    used: 3,
    max: 5,
    warnings: []
  },
  {
    name: "one cycle left is the last-cycle warning",
    enabled: true,
    state: readyWith(4),
    cyclesPerStage: 5,
    used: 4,
    max: 5,
    warnings: ["budget_last_cycle"]
  },
  {
    name: "five of five is exhausted",
    enabled: true,
    state: readyWith(5),
    cyclesPerStage: 5,
    used: 5,
    max: 5,
    warnings: ["budget_exhausted"]
  },
  {
    name: "a grant of five lifts the maximum to ten",
    enabled: true,
    state: readyWith(5, [5]),
    cyclesPerStage: 5,
    used: 5,
    max: 10,
    warnings: []
  },
  {
    name: "a granted stage warns again one cycle before its new end",
    enabled: true,
    state: readyWith(9, [5]),
    cyclesPerStage: 5,
    used: 9,
    max: 10,
    warnings: ["budget_last_cycle"]
  },
  {
    name: "a stage of one cycle never shows the last-cycle warning",
    enabled: true,
    state: readyWith(0),
    cyclesPerStage: 1,
    used: 0,
    max: 1,
    warnings: []
  },
  {
    name: "a stage of one cycle goes straight to exhausted",
    enabled: true,
    state: readyWith(1),
    cyclesPerStage: 1,
    used: 1,
    max: 1,
    warnings: ["budget_exhausted"]
  },
  {
    name: "an authorized value of three bounds the maximum, even above the count",
    enabled: true,
    state: readyWith(4),
    cyclesPerStage: 3,
    used: 4,
    max: 3,
    warnings: ["budget_exhausted"]
  },
  {
    name: "settings tampered warns while enabled",
    enabled: true,
    state: {
      status: "settings_tampered",
      currentStage: "planning",
      stages: {}
    },
    cyclesPerStage: 5,
    used: 0,
    max: 5,
    warnings: ["settings_tampered"]
  },
  {
    name: "settings tampered stays silent while disabled",
    enabled: false,
    state: {
      status: "settings_tampered",
      currentStage: "planning",
      stages: {}
    },
    cyclesPerStage: 5,
    used: 0,
    max: 5,
    warnings: []
  },
  {
    name: "an outdated enabled policy warns policy_outdated",
    enabled: true,
    state: { status: "policy_outdated", currentStage: "planning", stages: {} },
    cyclesPerStage: 5,
    used: 0,
    max: 5,
    warnings: ["policy_outdated"]
  },
  {
    name: "a lost state file reports unknown counts and warns",
    enabled: true,
    state: { status: "ledger_lost" },
    cyclesPerStage: 5,
    used: null,
    max: 5,
    warnings: ["ledger_lost"]
  },
  {
    name: "an invalid state file reports unknown counts and warns",
    enabled: false,
    state: { status: "ledger_invalid" },
    cyclesPerStage: 5,
    used: null,
    max: 5,
    warnings: ["ledger_invalid"]
  }
];

for (const row of BUDGET_ROWS) {
  test(`budget: ${row.name}`, () => {
    const view = budgetView(row.enabled, row.state, row.cyclesPerStage);
    assert.deepEqual(
      { used: view.cyclesUsed, max: view.max, warnings: view.warnings },
      { used: row.used, max: row.max, warnings: row.warnings }
    );
  });
}

test("legacy F3a counters are never read as cycles", () => {
  const state: ActivationThreadState = {
    status: "ready",
    currentStage: "planning",
    stages: { planning: { passesUsed: 4, attempts: 1 } }
  };
  const view = budgetView(true, state, 5);
  assert.equal(view.cyclesUsed, 0);
  assert.deepEqual(view.warnings, []);
});

test("the current stage falls back to planning when the stored one is not fixed", () => {
  const state: ActivationThreadState = {
    status: "policy_outdated",
    currentStage: "proposta",
    stages: {}
  };
  assert.equal(budgetView(true, state, 5).currentStage, "planning");
});

const PAUSE_ROWS: Array<{
  name: string;
  state: ActivationThreadState;
  enabled: boolean;
  paused: boolean;
}> = [
  {
    name: "ready and enabled runs",
    state: readyWith(0),
    enabled: true,
    paused: false
  },
  {
    name: "tampered settings pause an enabled thread",
    state: { status: "settings_tampered", stages: {} },
    enabled: true,
    paused: true
  },
  {
    name: "tampered settings do not pause a disabled thread",
    state: { status: "settings_tampered", stages: {} },
    enabled: false,
    paused: false
  },
  {
    name: "an outdated enabled policy pauses",
    state: { status: "policy_outdated", stages: {} },
    enabled: true,
    paused: true
  }
];

for (const row of PAUSE_ROWS) {
  test(`pause: ${row.name}`, () => {
    assert.equal(isThreadPaused(row.state, row.enabled), row.paused);
  });
}
