import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileMentions,
  type ReconcileInput,
  type WaitDecision
} from "../src/core/thread-mentions.js";
import type { ChatMessage } from "../src/core/types.js";

const CURSOR_ID = "msg_cursor";
const PROFILE = "claude-dev";
const MENTION = "Please review marc://@claude-dev.";

function message(
  id: string,
  agentId: string,
  role: string | undefined,
  body: string
): ChatMessage {
  return {
    id,
    threadId: "thread-under-test",
    timestamp: "2026-11-03T12:00:00.000Z",
    agentId,
    role,
    body,
    artifacts: []
  };
}

const cursor = message(CURSOR_ID, "owner", "user", "Start the discussion.");

type ReconcileScenario = {
  name: string;
  messages: ChatMessage[];
  afterMessageId: string;
  maxChain: number;
  closed: boolean;
  expected: WaitDecision;
};

const DEFAULTS = { afterMessageId: CURSOR_ID, maxChain: 3, closed: false };

const RECONCILE_SCENARIOS: ReconcileScenario[] = [
  {
    ...DEFAULTS,
    name: "a message without a mention keeps waiting",
    messages: [cursor, message("msg_2", "codex-dev", "developer", "Status.")],
    expected: { status: "waiting" }
  },
  {
    ...DEFAULTS,
    name: "a mention of another profile keeps waiting",
    messages: [
      cursor,
      message(
        "msg_2",
        "claude-software-architect",
        "architect",
        "Ask marc://@codex-dev to check."
      )
    ],
    expected: { status: "waiting" }
  },
  {
    ...DEFAULTS,
    name: "a mention inside a fenced code block keeps waiting",
    messages: [
      cursor,
      message(
        "msg_2",
        "claude-software-architect",
        "architect",
        "Example:\n```\nmarc://@claude-dev\n```"
      )
    ],
    expected: { status: "waiting" }
  },
  {
    ...DEFAULTS,
    name: "a mention inside inline code keeps waiting",
    messages: [
      cursor,
      message(
        "msg_2",
        "claude-software-architect",
        "architect",
        "Use `marc://@claude-dev` as the pattern."
      )
    ],
    expected: { status: "waiting" }
  },
  {
    ...DEFAULTS,
    name: "a quoted mention keeps waiting because quoting is not calling",
    messages: [
      cursor,
      message(
        "msg_2",
        "claude-software-architect",
        "architect",
        "> marc://@claude-dev said this earlier."
      )
    ],
    expected: { status: "waiting" }
  },
  {
    ...DEFAULTS,
    name: "a valid mention outside code and quotes ends the wait",
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", MENTION)
    ],
    expected: {
      status: "mention",
      messageIds: ["msg_2"],
      authors: [{ agentId: "claude-software-architect", role: "architect" }],
      chain: { count: 1, max: 3 }
    }
  },
  {
    ...DEFAULTS,
    name: "a mention already written after the cursor is returned at once",
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", "Context."),
      message("msg_3", "claude-software-architect", "architect", MENTION)
    ],
    expected: {
      status: "mention",
      messageIds: ["msg_3"],
      authors: [{ agentId: "claude-software-architect", role: "architect" }],
      chain: { count: 2, max: 3 }
    }
  },
  {
    ...DEFAULTS,
    name: "several eligible mentions coalesce into one decision",
    maxChain: 5,
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", MENTION),
      message("msg_3", "claude-software-architect", "architect", MENTION),
      message(
        "msg_4",
        "codex-software-architect",
        "architect",
        "Also marc://@claude-dev."
      )
    ],
    expected: {
      status: "mention",
      messageIds: ["msg_2", "msg_3", "msg_4"],
      authors: [
        { agentId: "claude-software-architect", role: "architect" },
        { agentId: "codex-software-architect", role: "architect" }
      ],
      chain: { count: 3, max: 5 }
    }
  },
  {
    ...DEFAULTS,
    name: "a missing cursor returns cursor_not_found",
    afterMessageId: "msg_missing",
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", MENTION)
    ],
    expected: { status: "cursor_not_found" }
  },
  {
    ...DEFAULTS,
    name: "a closed thread returns thread_closed before anything else",
    closed: true,
    afterMessageId: "msg_missing",
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", MENTION)
    ],
    expected: { status: "thread_closed" }
  },
  {
    ...DEFAULTS,
    name: "a chain at its limit returns chain_limit",
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", "Proposal."),
      message("msg_3", "codex-software-architect", "architect", "Review."),
      message("msg_4", "claude-software-architect", "architect", MENTION)
    ],
    expected: {
      status: "chain_limit",
      messageIds: ["msg_4"],
      authors: [{ agentId: "claude-software-architect", role: "architect" }],
      chain: { count: 3, max: 3 }
    }
  },
  {
    ...DEFAULTS,
    name: "a user message resets the chain count",
    messages: [
      message(
        "msg_0",
        "claude-software-architect",
        "architect",
        "Earlier proposal."
      ),
      message(
        "msg_1",
        "codex-software-architect",
        "architect",
        "Earlier review."
      ),
      message("msg_u", "owner", "user", "Human decision."),
      cursor,
      message("msg_4", "claude-software-architect", "architect", MENTION)
    ],
    afterMessageId: CURSOR_ID,
    expected: {
      status: "mention",
      messageIds: ["msg_4"],
      authors: [{ agentId: "claude-software-architect", role: "architect" }],
      chain: { count: 1, max: 3 }
    }
  },
  {
    ...DEFAULTS,
    name: "a developer message is not eligible even with a mention",
    messages: [cursor, message("msg_2", "claude-dev", "developer", MENTION)],
    expected: { status: "waiting" }
  },
  {
    ...DEFAULTS,
    name: "developer messages neither count nor reset the chain",
    maxChain: 2,
    messages: [
      cursor,
      message("msg_2", "claude-software-architect", "architect", "Proposal."),
      message("msg_3", "codex-dev", "developer", "Implementation note."),
      message("msg_4", "codex-software-architect", "architect", MENTION)
    ],
    expected: {
      status: "chain_limit",
      messageIds: ["msg_4"],
      authors: [{ agentId: "codex-software-architect", role: "architect" }],
      chain: { count: 2, max: 2 }
    }
  },
  {
    ...DEFAULTS,
    name: "a message from the profile itself is eligible",
    messages: [cursor, message("msg_2", PROFILE, "architect", MENTION)],
    expected: {
      status: "mention",
      messageIds: ["msg_2"],
      authors: [{ agentId: PROFILE, role: "architect" }],
      chain: { count: 1, max: 3 }
    }
  }
];

RECONCILE_SCENARIOS.forEach((scenario) =>
  test(`reconcileMentions: ${scenario.name}`, () => {
    const input: ReconcileInput = {
      messages: scenario.messages,
      afterMessageId: scenario.afterMessageId,
      mention: PROFILE,
      maxChain: scenario.maxChain,
      closed: scenario.closed
    };

    assert.deepStrictEqual(reconcileMentions(input), scenario.expected);
  })
);
