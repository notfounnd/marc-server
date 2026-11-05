import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceChoicesOf,
  dropLineOf,
  statusNoteKeyOf
} from "../src/ui/thread-activation-status.js";
import type { ThreadActivationView } from "../src/ui/types.js";

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

const ADVANCE_ROWS: Array<{
  name: string;
  view: ThreadActivationView;
  choices: string[];
}> = [
  {
    name: "a planning stage can advance to execution or review",
    view: viewWith({ nextStages: ["execution", "review"] }),
    choices: ["execution", "review"]
  },
  {
    name: "the last stage has no choice",
    view: viewWith({ nextStages: [] }),
    choices: []
  },
  {
    name: "a view without the list gives no choice",
    view: viewWith({}),
    choices: []
  }
];

for (const row of ADVANCE_ROWS) {
  test(`advance choices: ${row.name}`, () => {
    assert.deepEqual(advanceChoicesOf(row.view), row.choices);
  });
}

const DROP_ROWS: Array<{ waiting: number; key: string | undefined }> = [
  { waiting: 0, key: undefined },
  {
    waiting: 1,
    key: "1 waiting activation will be dropped. Mention the agent again in the new stage to continue."
  },
  {
    waiting: 3,
    key: "{{waiting}} waiting activations will be dropped. Mention the agents again in the new stage to continue."
  }
];

for (const row of DROP_ROWS) {
  test(`drop line for ${row.waiting} waiting`, () => {
    assert.equal(dropLineOf(row.waiting), row.key);
  });
}

const NOTE_ROWS: Array<{
  name: string;
  enabled: boolean;
  key: string | undefined;
}> = [
  {
    name: "a switch that is on shows no note in F3b",
    enabled: true,
    key: undefined
  },
  {
    name: "a switch that is off keeps its note",
    enabled: false,
    key: "Agents wake only when you ask them. Turn this on to let a mention wake the agent it names."
  }
];

for (const row of NOTE_ROWS) {
  test(`switch note: ${row.name}`, () => {
    assert.equal(statusNoteKeyOf(row.enabled), row.key);
  });
}
