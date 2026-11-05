import assert from "node:assert/strict";
import test from "node:test";
import {
  faultLinesOf,
  isRecoverable,
  pillOf,
  recoverNoteKeyOf,
  showsStageOf,
  stageLinesOf,
  type Tone
} from "../src/ui/thread-activation-status.js";
import type {
  ActivationBudget,
  ActivationWarning,
  ThreadActivationView
} from "../src/ui/types.js";

function viewWith(
  overrides: Partial<ThreadActivationView>
): ThreadActivationView {
  return {
    threadId: "thread-a",
    policyState: "ready",
    policy: null,
    enabled: true,
    participants: [],
    budget: null,
    legacyStage: null,
    paused: false,
    threadPaused: false,
    warnings: [],
    ...overrides
  };
}

const BUDGET: ActivationBudget = {
  currentStage: "planning",
  cyclesUsed: 2,
  cyclesPerStage: 5,
  granted: 0,
  max: 5,
  remaining: 3,
  warnings: []
};

const HOLD = {
  messageId: "msg_held",
  recipient: "claude-software-architect",
  stage: "planning",
  reason: "budget_exhausted"
};

const PILL_ROWS: Array<{
  name: string;
  view: ThreadActivationView;
  label: string;
  tone: Tone;
}> = [
  {
    name: "an unreadable policy shows the unreadable pill",
    view: viewWith({ policyState: "invalid", enabled: false }),
    label: "Unreadable policy",
    tone: "warn"
  },
  {
    name: "a disabled switch shows off",
    view: viewWith({ enabled: false }),
    label: "Off",
    tone: "muted"
  },
  {
    name: "a restored state shows paused in the stop tone",
    view: viewWith({ warnings: ["ledger_restored"] }),
    label: "Paused",
    tone: "stop"
  },
  {
    name: "a paused thread shows paused in the warn tone",
    view: viewWith({ threadPaused: true }),
    label: "Paused",
    tone: "warn"
  },
  {
    name: "an exhausted stage waits for the human",
    view: viewWith({ warnings: ["budget_exhausted"] }),
    label: "Waiting for you",
    tone: "warn"
  },
  {
    name: "a held reservation waits for the human",
    view: viewWith({ holds: [HOLD] }),
    label: "Waiting for you",
    tone: "warn"
  },
  {
    name: "the last cycle keeps the thread on",
    view: viewWith({ warnings: ["budget_last_cycle"] }),
    label: "On",
    tone: "on"
  },
  {
    name: "an enabled thread with budget left shows on",
    view: viewWith({ budget: BUDGET }),
    label: "On",
    tone: "on"
  }
];

for (const row of PILL_ROWS) {
  test(`pill: ${row.name}`, () => {
    assert.deepEqual(pillOf(row.view), { tone: row.tone, key: row.label });
  });
}

const FAULT_ROWS: Array<{ warning: ActivationWarning; key: string }> = [
  {
    warning: "settings_tampered",
    key: "The cycles setting was edited by hand. Save the setting again in workspace settings to authorize it."
  },
  {
    warning: "policy_outdated",
    key: "Save the policy again to use the new stages."
  },
  {
    warning: "policy_tampered",
    key: "The saved policy file was edited by hand. Save again to authorize it."
  },
  {
    warning: "ledger_restored",
    key: "The thread state counts fewer cycles than the messages show. It may have been restored from an older copy. Recover to continue."
  }
];

for (const row of FAULT_ROWS) {
  test(`fault line: ${row.warning}`, () => {
    const lines = faultLinesOf(viewWith({ warnings: [row.warning] }));
    assert.deepEqual(
      lines.map((line) => line.key),
      [row.key]
    );
  });
}

test("the last-cycle warning shows a stage line, not a fault line", () => {
  const view = viewWith({ warnings: ["budget_last_cycle"] });
  assert.deepEqual(faultLinesOf(view), []);
  assert.deepEqual(
    stageLinesOf(view).map((line) => line.key),
    ["One cycle left in this stage."]
  );
});

test("an exhausted stage shows its line in the warn tone", () => {
  const view = viewWith({ warnings: ["budget_exhausted"] });
  assert.deepEqual(stageLinesOf(view), [
    {
      tone: "warn",
      key: "This stage used all its cycles. Add cycles or advance."
    }
  ]);
});

const RECOVERABLE_ROWS: Array<{
  name: string;
  warnings: ActivationWarning[];
  recoverable: boolean;
  note: string;
}> = [
  {
    name: "a lost state file offers recovery with the files note",
    warnings: ["ledger_lost"],
    recoverable: true,
    note: "Moves invalid state files aside and recreates the missing ones. Enabled policies stay blocked until you save them again."
  },
  {
    name: "an invalid state file offers recovery with the files note",
    warnings: ["ledger_invalid"],
    recoverable: true,
    note: "Moves invalid state files aside and recreates the missing ones. Enabled policies stay blocked until you save them again."
  },
  {
    name: "a restored state offers recovery with the counts note",
    warnings: ["ledger_restored"],
    recoverable: true,
    note: "Raises each stage's cycle count to the highest cycle already stamped in the messages. No count goes down."
  },
  {
    name: "a setting edited by hand offers no recovery",
    warnings: ["settings_tampered"],
    recoverable: false,
    note: "Moves invalid state files aside and recreates the missing ones. Enabled policies stay blocked until you save them again."
  }
];

for (const row of RECOVERABLE_ROWS) {
  test(`recovery: ${row.name}`, () => {
    const view = viewWith({ warnings: row.warnings });
    assert.equal(isRecoverable(view), row.recoverable);
    assert.equal(recoverNoteKeyOf(view), row.note);
  });
}

const STAGE_SHOWN_ROWS: Array<{
  name: string;
  view: ThreadActivationView;
  shown: boolean;
}> = [
  {
    name: "an enabled thread with a budget shows the stage",
    view: viewWith({ budget: BUDGET }),
    shown: true
  },
  {
    name: "a restored state hides the stage until the human recovers it",
    view: viewWith({ budget: BUDGET, warnings: ["ledger_restored"] }),
    shown: false
  },
  {
    name: "a disabled switch hides the stage",
    view: viewWith({ budget: BUDGET, enabled: false }),
    shown: false
  },
  {
    name: "a thread without a budget hides the stage",
    view: viewWith({ budget: null }),
    shown: false
  }
];

for (const row of STAGE_SHOWN_ROWS) {
  test(`stage section: ${row.name}`, () => {
    assert.equal(showsStageOf(row.view), row.shown);
  });
}
