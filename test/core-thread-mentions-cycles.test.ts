import assert from "node:assert/strict";
import test from "node:test";
import {
  architectCycleCount,
  reconcileMentions,
  type ReconcileInput,
  type WaitDecision
} from "../src/core/thread-mentions.js";
import type { ChatMessage } from "../src/core/types.js";

const WAITER = "claude-software-architect";
const PEER = "codex-software-architect";
const ARCHITECTS: string[] = [WAITER, PEER];
const TO_PEER = `Please review marc://@${PEER}.`;
const TO_WAITER = `Answer marc://@${WAITER}.`;

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

const USER = message("msg_user", "owner", "user", "Start.");
const HUMAN = message("msg_human", "owner", "user", "Decision.");
const ask = (id: string, body: string = TO_PEER): ChatMessage =>
  message(id, WAITER, "architect", body);
const answer = (id: string, body: string = TO_WAITER): ChatMessage =>
  message(id, PEER, "architect", body);

type CycleScenario = {
  name: string;
  messages: ChatMessage[];
  architects: string[];
  expected: number;
};

const CYCLE_SCENARIOS: CycleScenario[] = [
  {
    name: "a simple exchange between two architects counts one cycle",
    messages: [USER, ask("msg_1"), answer("msg_2")],
    architects: ARCHITECTS,
    expected: 1
  },
  {
    name: "four messages between two architects count two cycles",
    messages: [
      USER,
      ask("msg_1"),
      answer("msg_2"),
      ask("msg_3"),
      answer("msg_4")
    ],
    architects: ARCHITECTS,
    expected: 2
  },
  {
    name: "six messages between two architects count three cycles",
    messages: [
      USER,
      ask("msg_1"),
      answer("msg_2"),
      ask("msg_3"),
      answer("msg_4"),
      ask("msg_5"),
      answer("msg_6")
    ],
    architects: ARCHITECTS,
    expected: 3
  },
  {
    name: "the closing message opens nothing, so the next ask does not add a cycle",
    messages: [USER, ask("msg_1"), answer("msg_2"), ask("msg_3")],
    architects: ARCHITECTS,
    expected: 1
  },
  {
    name: "the opening and the plan of the same author count nothing",
    messages: [
      USER,
      ask("msg_1", TO_PEER),
      ask("msg_2", `Plan, still open for marc://@${PEER}.`)
    ],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "a human message resets the count and the open requests",
    messages: [USER, ask("msg_1"), HUMAN, answer("msg_2")],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "a human message after a finished exchange starts a fresh count",
    messages: [
      USER,
      ask("msg_1"),
      answer("msg_2"),
      HUMAN,
      ask("msg_3"),
      answer("msg_4")
    ],
    architects: ARCHITECTS,
    expected: 1
  },
  {
    name: "developer messages neither count nor reset the cycle",
    messages: [
      USER,
      ask("msg_1"),
      message("msg_d", "codex-dev", "developer", "Progress note."),
      answer("msg_2")
    ],
    architects: ARCHITECTS,
    expected: 1
  },
  {
    name: "a developer message from an architect profile closes no request",
    messages: [
      USER,
      ask("msg_1"),
      message("msg_d", PEER, "developer", "Progress note.")
    ],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "a mention inside a fenced block opens no request",
    messages: [
      USER,
      ask("msg_1", "Example:\n```\nmarc://@codex-software-architect\n```"),
      answer("msg_2")
    ],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "a mention inside inline code opens no request",
    messages: [
      USER,
      ask("msg_1", "Use `marc://@codex-software-architect` as the pattern."),
      answer("msg_2")
    ],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "a quoted mention opens no request",
    messages: [
      USER,
      ask("msg_1", "> marc://@codex-software-architect said this."),
      answer("msg_2")
    ],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "a mention of a profile that is not an architect opens no request",
    messages: [
      USER,
      ask("msg_1", "Ask marc://@codex-reviewer."),
      message("msg_2", "codex-reviewer", "reviewer", TO_WAITER)
    ],
    architects: ARCHITECTS,
    expected: 0
  },
  {
    name: "authors that posted with the architect role count without a profile list",
    messages: [USER, ask("msg_1"), answer("msg_2")],
    architects: [],
    expected: 1
  }
];

CYCLE_SCENARIOS.forEach((scenario) =>
  test(`architectCycleCount: ${scenario.name}`, () => {
    assert.equal(
      architectCycleCount(scenario.messages, scenario.architects),
      scenario.expected
    );
  })
);

type ReconcileScenario = {
  name: string;
  messages: ChatMessage[];
  afterMessageId: string;
  expected: WaitDecision;
};

const SIX_MESSAGES: ChatMessage[] = [
  USER,
  ask("msg_1"),
  answer("msg_2"),
  ask("msg_3"),
  answer("msg_4"),
  ask("msg_5"),
  answer("msg_6")
];

const RECONCILE_SCENARIOS: ReconcileScenario[] = [
  {
    name: "a simple exchange wakes the waiter below the limit",
    messages: [USER, ask("msg_1"), answer("msg_2")],
    afterMessageId: "msg_1",
    expected: {
      status: "mention",
      messageIds: ["msg_2"],
      authors: [{ agentId: PEER, role: "architect" }],
      chain: { count: 1, max: 3 }
    }
  },
  {
    name: "four messages wake the waiter at two cycles",
    messages: [
      USER,
      ask("msg_1"),
      answer("msg_2"),
      ask("msg_3"),
      answer("msg_4")
    ],
    afterMessageId: "msg_3",
    expected: {
      status: "mention",
      messageIds: ["msg_4"],
      authors: [{ agentId: PEER, role: "architect" }],
      chain: { count: 2, max: 3 }
    }
  },
  {
    name: "the sixth message closes the third cycle and ends with chain_limit",
    messages: SIX_MESSAGES,
    afterMessageId: "msg_5",
    expected: {
      status: "chain_limit",
      messageIds: ["msg_6"],
      authors: [{ agentId: PEER, role: "architect" }],
      chain: { count: 3, max: 3 }
    }
  }
];

RECONCILE_SCENARIOS.forEach((scenario) =>
  test(`reconcileMentions: ${scenario.name}`, () => {
    const input: ReconcileInput = {
      messages: scenario.messages,
      afterMessageId: scenario.afterMessageId,
      mention: WAITER,
      architects: ARCHITECTS,
      maxChain: 3,
      closed: false
    };

    assert.deepStrictEqual(reconcileMentions(input), scenario.expected);
  })
);
