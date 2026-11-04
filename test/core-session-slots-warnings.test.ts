import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSessionWarnings,
  type SessionWarning,
  type WarningProfile
} from "../src/core/session-warnings.js";
import type { ChatMessage } from "../src/core/types.js";

const DEV: WarningProfile = { id: "claude-dev", role: "developer" };
const ARCHITECT: WarningProfile = {
  id: "claude-software-architect",
  role: "architect"
};
const SECOND_ARCHITECT: WarningProfile = {
  id: "codex-software-architect",
  role: "architect"
};
const HUMAN: WarningProfile = { id: "ui-user", role: "user" };
const PROFILES = [DEV, ARCHITECT, SECOND_ARCHITECT, HUMAN];

function message(
  id: string,
  agentId: string,
  role: string | undefined,
  body: string
): ChatMessage {
  return {
    id,
    threadId: "thread-1",
    timestamp: "2026-11-03T12:00:00.000Z",
    agentId,
    role,
    body,
    artifacts: []
  };
}

const CALL_DEV = "Pode seguir marc://@claude-dev";
const CALL_HUMAN = "Preciso de você marc://@ui-user";

const rows: Array<{
  name: string;
  messages: ChatMessage[];
  expected: SessionWarning[];
}> = [
  {
    name: "an architect mention with no later message from the profile is pending",
    messages: [message("m1", ARCHITECT.id, "architect", CALL_DEV)],
    expected: [{ kind: "pending_mention", profile: DEV.id, messageIds: ["m1"] }]
  },
  {
    name: "a mention answered by the profile is no longer pending",
    messages: [
      message("m1", ARCHITECT.id, "architect", CALL_DEV),
      message("m2", DEV.id, "developer", "Feito")
    ],
    expected: []
  },
  {
    name: "a developer-role message does not create a pending mention",
    messages: [message("m1", ARCHITECT.id, "developer", CALL_DEV)],
    expected: []
  },
  {
    name: "three architect messages without a user message reach the chain limit",
    messages: [
      message("a1", ARCHITECT.id, "architect", "um"),
      message("a2", ARCHITECT.id, "architect", "dois"),
      message("a3", ARCHITECT.id, "architect", "três")
    ],
    expected: [
      { kind: "chain_limit", length: 3, messageIds: ["a1", "a2", "a3"] }
    ]
  },
  {
    name: "two architect messages stay below the chain limit",
    messages: [
      message("a1", ARCHITECT.id, "architect", "um"),
      message("a2", ARCHITECT.id, "architect", "dois")
    ],
    expected: []
  },
  {
    name: "an architect mention of a user profile with no later user message awaits the human",
    messages: [message("m1", ARCHITECT.id, "architect", CALL_HUMAN)],
    expected: [
      {
        kind: "awaiting_human",
        profile: HUMAN.id,
        messageIds: ["m1"],
        askedBy: ARCHITECT.id
      }
    ]
  },
  {
    name: "the awaiting warning names the author of the last architect message that asks the human",
    messages: [
      message("m1", ARCHITECT.id, "architect", CALL_HUMAN),
      message("m2", SECOND_ARCHITECT.id, "architect", CALL_HUMAN)
    ],
    expected: [
      {
        kind: "awaiting_human",
        profile: HUMAN.id,
        messageIds: ["m1", "m2"],
        askedBy: SECOND_ARCHITECT.id
      }
    ]
  },
  {
    name: "a user message after the mention clears the human request",
    messages: [
      message("m1", ARCHITECT.id, "architect", CALL_HUMAN),
      message("u1", HUMAN.id, "user", "Pode seguir")
    ],
    expected: []
  }
];

for (const row of rows) {
  test(`session warnings: ${row.name}`, () => {
    assert.deepEqual(
      deriveSessionWarnings({ messages: row.messages, profiles: PROFILES }),
      row.expected
    );
  });
}
