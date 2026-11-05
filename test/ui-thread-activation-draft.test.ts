import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ATTEMPT_CAP,
  DEFAULT_PENDING_TTL_MINUTES,
  draftOf,
  formOf,
  segmentsOf,
  STAGE_NAME_KEYS,
  stageNameKeyOf
} from "../src/ui/thread-activation-draft.js";
import type {
  ActivationBudget,
  ThreadActivationView
} from "../src/ui/types.js";

function viewWith(enabled: boolean): ThreadActivationView {
  return {
    threadId: "thread-a",
    policyState: enabled ? "ready" : "none",
    policy: null,
    enabled,
    participants: ["claude-software-architect", "codex-software-architect"],
    budget: null,
    legacyStage: null,
    paused: false,
    threadPaused: false,
    warnings: []
  };
}

type FormRow = {
  name: string;
  view: ThreadActivationView | undefined;
  legacyStage: string | null;
  enabled: boolean;
  mapping: { from: string; to: "planning" } | undefined;
};

const FORM_ROWS: FormRow[] = [
  {
    name: "no readable policy starts off",
    view: undefined,
    legacyStage: null,
    enabled: false,
    mapping: undefined
  },
  {
    name: "a stored switch on carries over",
    view: viewWith(true),
    legacyStage: null,
    enabled: true,
    mapping: undefined
  },
  {
    name: "an F3a stage asks for the explicit mapping to planning",
    view: viewWith(true),
    legacyStage: "proposta",
    enabled: true,
    mapping: { from: "proposta", to: "planning" }
  }
];

for (const row of FORM_ROWS) {
  test(`form: ${row.name}`, () => {
    const form = formOf(
      { enabled: draftOf(row.view).enabled },
      null,
      row.legacyStage
    );
    assert.deepEqual(
      {
        enabled: form.enabled,
        attemptCap: form.attemptCap,
        pendingTtlMinutes: form.pendingTtlMinutes,
        stageMapping: form.stageMapping
      },
      {
        enabled: row.enabled,
        attemptCap: DEFAULT_ATTEMPT_CAP,
        pendingTtlMinutes: DEFAULT_PENDING_TTL_MINUTES,
        stageMapping: row.mapping
      }
    );
  });
}

function budgetWith(used: number | null, max: number): ActivationBudget {
  return {
    currentStage: "execution",
    cyclesUsed: used,
    cyclesPerStage: 5,
    granted: 0,
    max,
    remaining: used === null ? null : max - used,
    warnings: []
  };
}

test("segments fill one per used cycle of the maximum", () => {
  assert.deepEqual(segmentsOf(budgetWith(3, 5)), [
    true,
    true,
    true,
    false,
    false
  ]);
});

test("segments stay empty while the counts are unknown", () => {
  assert.deepEqual(segmentsOf(budgetWith(null, 2)), [false, false]);
});

test("the three fixed stages keep their order and their names", () => {
  assert.deepEqual(Object.keys(STAGE_NAME_KEYS), [
    "planning",
    "execution",
    "review"
  ]);
  assert.deepEqual(Object.values(STAGE_NAME_KEYS), [
    "Planning",
    "Execution",
    "Review"
  ]);
});

const STAGE_NAME_ROWS: Array<{ stage: string; key: string }> = [
  { stage: "planning", key: "Planning" },
  { stage: "execution", key: "Execution" },
  { stage: "review", key: "Review" },
  { stage: "proposta", key: "proposta" }
];

for (const row of STAGE_NAME_ROWS) {
  test(`stage name for ${row.stage}`, () => {
    assert.equal(stageNameKeyOf(row.stage), row.key);
  });
}
