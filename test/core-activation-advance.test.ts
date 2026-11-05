import assert from "node:assert/strict";
import test from "node:test";
import {
  agentAdvanceRefusal,
  confirmAdvanceRecord,
  destinationOf,
  isWrittenBy,
  type AdvanceRecordDecision,
  type AgentAdvanceFacts,
  type StageHistoryEntry
} from "../src/core/activation-advance.js";
import {
  derivedLeadOf,
  highestStampedStage,
  isBehindFloor,
  stampedFloorOf,
  type StageFloor
} from "../src/core/activation-floor.js";
import {
  isAheadOf,
  isJumpedBy,
  stagesAheadOf,
  type FixedStage
} from "../src/core/activation-stages.js";
import type { ChatMessage } from "../src/core/types.js";

const ARCHITECT = "claude-software-architect";
const OTHER = "codex-software-architect";
const T0 = "2026-11-05T10:00:00.000Z";

function chatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg_1",
    threadId: "thread-1",
    timestamp: T0,
    agentId: ARCHITECT,
    role: "architect",
    body: "Plan.",
    artifacts: ["artifacts/plan.md"],
    ...overrides
  };
}

const ADVANCE_ALL_CLEAR: AgentAdvanceFacts = {
  lead: true,
  identityVerified: true,
  stageMatches: true,
  exhausted: false
};

type AdvanceRow = {
  name: string;
  facts: Partial<AgentAdvanceFacts>;
  expect: string | undefined;
};

/** The agent gate, in its order: a failed earlier check hides the later ones. */
const ADVANCE_ROWS: readonly AdvanceRow[] = [
  { name: "every check passes", facts: {}, expect: undefined },
  {
    name: "a non-lead is refused first",
    facts: { lead: false, identityVerified: false },
    expect: "not_lead"
  },
  {
    name: "an unverified identity is refused before the stage",
    facts: { identityVerified: false, stageMatches: false },
    expect: "identity_unverified"
  },
  {
    name: "a stale stage is refused before the budget",
    facts: { stageMatches: false, exhausted: true },
    expect: "stage_changed"
  },
  {
    name: "an exhausted stage refuses the agent",
    facts: { exhausted: true },
    expect: "stage_exhausted"
  }
];

for (const row of ADVANCE_ROWS) {
  test(`advance gate: ${row.name}`, () => {
    assert.equal(
      agentAdvanceRefusal({ ...ADVANCE_ALL_CLEAR, ...row.facts }),
      row.expect
    );
  });
}

type DestinationRow = {
  name: string;
  from: FixedStage;
  to: string;
  expect:
    | { decision: "ready"; stage: FixedStage }
    | { decision: "refused"; reason: string };
};

/** Destinations: strictly ahead, skipping allowed, nothing from the last stage, nothing backwards. */
const DESTINATION_ROWS: readonly DestinationRow[] = [
  {
    name: "the next stage",
    from: "planning",
    to: "execution",
    expect: { decision: "ready", stage: "execution" }
  },
  {
    name: "a jump over execution to review",
    from: "planning",
    to: "review",
    expect: { decision: "ready", stage: "review" }
  },
  {
    name: "the same stage is not ahead",
    from: "execution",
    to: "execution",
    expect: { decision: "refused", reason: "not_ahead" }
  },
  {
    name: "a stage behind is not ahead",
    from: "execution",
    to: "planning",
    expect: { decision: "refused", reason: "not_ahead" }
  },
  {
    name: "free text is not a stage",
    from: "planning",
    to: "shipping",
    expect: { decision: "refused", reason: "not_ahead" }
  },
  {
    name: "the last stage has no destination",
    from: "review",
    to: "review",
    expect: { decision: "refused", reason: "last_stage" }
  }
];

for (const row of DESTINATION_ROWS) {
  test(`advance destination: ${row.name}`, () => {
    assert.deepEqual(destinationOf(row.from, row.to), row.expect);
  });
}

test("stages ahead and jumps follow the fixed order", () => {
  assert.deepEqual(stagesAheadOf("planning"), ["execution", "review"]);
  assert.deepEqual(stagesAheadOf("review"), []);
  assert.equal(isAheadOf("planning", "review"), true);
  assert.equal(isAheadOf("review", "planning"), false);
  assert.equal(isAheadOf("planning", undefined), false);
  assert.equal(isJumpedBy("planning", "review", "execution"), true);
  assert.equal(isJumpedBy("planning", "execution", "execution"), false);
  assert.equal(isJumpedBy("planning", "review", "planning"), false);
});

type RecordRow = {
  name: string;
  history: StageHistoryEntry[];
  expect: AdvanceRecordDecision;
};

const OPERATION: StageHistoryEntry = {
  at: T0,
  from: "planning",
  to: "execution",
  by: "agent",
  agentId: ARCHITECT,
  operationId: "op-1",
  droppedHolds: 0
};

const RECORD_INPUT = {
  agentId: ARCHITECT,
  operationId: "op-1",
  messageId: "msg_9"
};

/** The confirmation of an operation: unknown operations are refused, the same message is idempotent. */
const RECORD_ROWS: readonly RecordRow[] = [
  {
    name: "no operation with that id",
    history: [],
    expect: { decision: "refused", reason: "advance_not_found" }
  },
  {
    name: "an operation of another agent",
    history: [{ ...OPERATION, agentId: OTHER }],
    expect: { decision: "refused", reason: "advance_not_found" }
  },
  {
    name: "the first message answers the operation",
    history: [OPERATION],
    expect: {
      decision: "answered",
      history: [{ ...OPERATION, messageId: "msg_9" }]
    }
  },
  {
    name: "the same message again changes nothing",
    history: [{ ...OPERATION, messageId: "msg_9" }],
    expect: { decision: "already" }
  },
  {
    name: "another message cannot answer an answered operation",
    history: [{ ...OPERATION, messageId: "msg_7" }],
    expect: { decision: "refused", reason: "already_answered" }
  }
];

for (const row of RECORD_ROWS) {
  test(`advance confirmation: ${row.name}`, () => {
    assert.deepEqual(
      confirmAdvanceRecord(row.history, RECORD_INPUT),
      row.expect
    );
  });
}

type WrittenRow = {
  name: string;
  messageId: string;
  agentId: string;
  expect: boolean;
};

const WRITTEN_ROWS: readonly WrittenRow[] = [
  {
    name: "the message of this agent in this thread",
    messageId: "msg_1",
    agentId: ARCHITECT,
    expect: true
  },
  {
    name: "a message of another agent",
    messageId: "msg_1",
    agentId: OTHER,
    expect: false
  },
  {
    name: "a message id that is not in CHAT.md",
    messageId: "msg_9",
    agentId: ARCHITECT,
    expect: false
  }
];

for (const row of WRITTEN_ROWS) {
  test(`written message: ${row.name}`, () => {
    assert.equal(
      isWrittenBy([chatMessage()], {
        messageId: row.messageId,
        threadId: "thread-1",
        agentId: row.agentId
      }),
      row.expect
    );
  });
}

test("a message of another thread is not the answer", () => {
  assert.equal(
    isWrittenBy([chatMessage({ threadId: "thread-2" })], {
      messageId: "msg_1",
      threadId: "thread-1",
      agentId: ARCHITECT
    }),
    false
  );
});

test("the floor is the highest stamped cycle per stage, and a stored counter behind it is detected", () => {
  const messages = [
    chatMessage({ stage: "planning", cycle: 2 }),
    chatMessage({ id: "msg_2", stage: "planning", cycle: 3 }),
    chatMessage({ id: "msg_3", stage: "review", cycle: 1 }),
    chatMessage({ id: "msg_4" })
  ];
  const floor: StageFloor = stampedFloorOf(messages);
  assert.deepEqual(floor, { planning: 3, execution: 0, review: 1 });
  assert.equal(highestStampedStage(messages), "review");
  assert.equal(highestStampedStage([chatMessage()]), undefined);
  assert.equal(
    isBehindFloor({ planning: 2, execution: 0, review: 0 }, floor),
    true
  );
  assert.equal(
    isBehindFloor({ planning: 3, execution: 0, review: 1 }, floor),
    false
  );
  assert.equal(
    isBehindFloor({ planning: 4, execution: 0, review: 0 }, floor),
    true
  );
  assert.equal(
    isBehindFloor({ planning: 4, execution: 0, review: 1 }, floor),
    false
  );
});

test("the lead is the first architect author, and a developer never leads", () => {
  const architects = new Set([ARCHITECT, OTHER]);
  const messages = [
    chatMessage({ id: "msg_dev", agentId: "claude-dev", role: "developer" }),
    chatMessage({ id: "msg_arch", agentId: ARCHITECT }),
    chatMessage({ id: "msg_codex", agentId: OTHER })
  ];
  assert.equal(derivedLeadOf(messages, architects), ARCHITECT);
  assert.equal(derivedLeadOf(messages.slice(0, 1), architects), undefined);
});
