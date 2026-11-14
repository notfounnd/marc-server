import assert from "node:assert/strict";
import test from "node:test";
import {
  architectCycleCount,
  mentionsProfile
} from "../src/core/thread-mentions.js";
import type { ChatMessage } from "../src/core/types.js";

const PROFILE = "claude-dev";

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

const MENTION_SCENARIOS: Array<{
  name: string;
  body: string;
  expected: boolean;
}> = [
  { name: "a bare reference", body: "marc://@claude-dev", expected: true },
  {
    name: "a trailing punctuation mark",
    body: "Ping marc://@claude-dev!",
    expected: true
  },
  {
    name: "a reference to a different agent",
    body: "marc://@claude-dev-two",
    expected: false
  },
  {
    name: "a thread reference is not an agent reference",
    body: "marc://$claude-dev",
    expected: false
  },
  { name: "a quote line", body: "> marc://@claude-dev", expected: false },
  {
    name: "an indented quote line",
    body: "   > marc://@claude-dev",
    expected: false
  },
  {
    name: "a fenced block",
    body: "```\nmarc://@claude-dev\n```",
    expected: false
  },
  { name: "inline code", body: "`marc://@claude-dev`", expected: false }
];

MENTION_SCENARIOS.forEach((scenario) =>
  test(`mentionsProfile: ${scenario.name}`, () => {
    assert.equal(mentionsProfile(scenario.body, PROFILE), scenario.expected);
  })
);

const ARCHITECTS = ["claude-software-architect", "codex-software-architect"];

const CHAIN_SCENARIOS: Array<{
  name: string;
  messages: ChatMessage[];
  expected: number;
}> = [
  {
    name: "without any user message, a closed architect cycle counts",
    messages: [
      message(
        "msg_1",
        "claude-software-architect",
        "architect",
        "a marc://@codex-software-architect"
      ),
      message(
        "msg_2",
        "codex-software-architect",
        "architect",
        "b marc://@claude-software-architect"
      )
    ],
    expected: 1
  },
  {
    name: "only cycles after the last user message count",
    messages: [
      message(
        "msg_1",
        "claude-software-architect",
        "architect",
        "a marc://@codex-software-architect"
      ),
      message(
        "msg_2",
        "codex-software-architect",
        "architect",
        "b marc://@claude-software-architect"
      ),
      message("msg_3", "owner", "user", "c"),
      message(
        "msg_4",
        "claude-software-architect",
        "architect",
        "d marc://@codex-software-architect"
      ),
      message(
        "msg_5",
        "codex-software-architect",
        "architect",
        "e marc://@claude-software-architect"
      )
    ],
    expected: 1
  },
  {
    name: "unknown roles neither count nor reset an open request",
    messages: [
      message("msg_1", "owner", "user", "a"),
      message(
        "msg_2",
        "claude-software-architect",
        "architect",
        "b marc://@codex-software-architect"
      ),
      message("msg_3", "someone", undefined, "c"),
      message(
        "msg_4",
        "codex-software-architect",
        "architect",
        "d marc://@claude-software-architect"
      )
    ],
    expected: 1
  }
];

CHAIN_SCENARIOS.forEach((scenario) =>
  test(`architectCycleCount: ${scenario.name}`, () => {
    assert.equal(
      architectCycleCount(scenario.messages, ARCHITECTS),
      scenario.expected
    );
  })
);
