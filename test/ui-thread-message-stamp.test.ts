import assert from "node:assert/strict";
import test from "node:test";
import {
  advancedLabelOf,
  advanceMarksOf,
  cardBadgeOf,
  stampLabelOf
} from "../src/ui/thread-message-marks.js";
import type {
  ActivationStageMove,
  Message,
  ThreadActivationView,
  Translate
} from "../src/ui/types.js";

/** A translation stand-in: it returns the key with its variables filled in, which keeps the expectations readable. */
const translate: Translate = (key, variables = {}) =>
  key.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(variables[name] ?? "")
  );

function messageWith(fields: Partial<Message>): Message {
  return {
    id: "msg_a",
    threadId: "thread-a",
    timestamp: "2026-11-10T14:32:00.000Z",
    agentId: "claude-software-architect",
    role: "architect",
    body: "Body.",
    artifacts: [],
    ...fields
  };
}

const STAMP_ROWS: Array<{
  name: string;
  message: Message;
  label: string | undefined;
}> = [
  {
    name: "a stamped message shows its stage and cycle",
    message: messageWith({ stage: "planning", cycle: 2 }),
    label: "Planning · cycle 2"
  },
  {
    name: "a stage without a cycle shows the stage alone",
    message: messageWith({ stage: "execution" }),
    label: "Execution"
  },
  {
    name: "an unknown stage shows its own text",
    message: messageWith({ stage: "proposta", cycle: 1 }),
    label: "proposta · cycle 1"
  },
  {
    name: "an unstamped message shows no stamp",
    message: messageWith({}),
    label: undefined
  }
];

for (const row of STAMP_ROWS) {
  test(`stamp: ${row.name}`, () => {
    assert.equal(stampLabelOf(row.message, translate), row.label);
  });
}

const MARK_ROWS: Array<{
  name: string;
  stage: "planning" | "execution" | "review" | undefined;
  label: string | undefined;
}> = [
  {
    name: "a message that advanced to review carries the mark",
    stage: "review",
    label: "Advanced to Review"
  },
  {
    name: "a message that did not advance carries no mark",
    stage: undefined,
    label: undefined
  }
];

for (const row of MARK_ROWS) {
  test(`advanced mark: ${row.name}`, () => {
    assert.equal(advancedLabelOf(row.stage, translate), row.label);
  });
}

function viewWithMoves(moves: ActivationStageMove[]): ThreadActivationView {
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
    stageHistory: moves
  };
}

const AGENT_MOVE: ActivationStageMove = {
  at: "2026-11-10T14:40:00.000Z",
  from: "planning",
  to: "execution",
  by: "agent",
  agentId: "claude-software-architect",
  messageId: "msg_advance",
  droppedHolds: 0
};

const HUMAN_MOVE: ActivationStageMove = {
  at: "2026-11-10T15:00:00.000Z",
  from: "execution",
  to: "review",
  by: "human",
  droppedHolds: 1
};

const MARK_MAP_ROWS: Array<{
  name: string;
  view: ThreadActivationView | undefined;
  marks: Record<string, string>;
}> = [
  {
    name: "no loaded view gives no marks",
    view: undefined,
    marks: {}
  },
  {
    name: "only a move that names its message gets a mark",
    view: viewWithMoves([AGENT_MOVE, HUMAN_MOVE]),
    marks: { msg_advance: "execution" }
  },
  {
    name: "a view without history gives no marks",
    view: viewWithMoves([]),
    marks: {}
  }
];

for (const row of MARK_MAP_ROWS) {
  test(`marks: ${row.name}`, () => {
    assert.deepEqual(Object.fromEntries(advanceMarksOf(row.view)), row.marks);
  });
}

const BADGE_ROWS: Array<{
  name: string;
  message: Message;
  advancedTo: "planning" | "execution" | "review" | undefined;
  badge: { advanced: boolean; label: string } | undefined;
}> = [
  {
    name: "the message that advanced shows only its mark, not the stage stamp",
    message: messageWith({ stage: "execution" }),
    advancedTo: "execution",
    badge: { advanced: true, label: "Advanced to Execution" }
  },
  {
    name: "a stamped message with a cycle shows its stamp",
    message: messageWith({ stage: "planning", cycle: 2 }),
    advancedTo: undefined,
    badge: { advanced: false, label: "Planning · cycle 2" }
  },
  {
    name: "a mark without a stage still shows the mark",
    message: messageWith({}),
    advancedTo: "review",
    badge: { advanced: true, label: "Advanced to Review" }
  },
  {
    name: "an unstamped message that did not advance shows no badge",
    message: messageWith({}),
    advancedTo: undefined,
    badge: undefined
  }
];

for (const row of BADGE_ROWS) {
  test(`card badge: ${row.name}`, () => {
    assert.deepEqual(
      cardBadgeOf(row.message, row.advancedTo, translate),
      row.badge
    );
  });
}
