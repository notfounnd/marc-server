import assert from "node:assert/strict";
import test from "node:test";
import {
  architectChainLength,
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

const CHAIN_SCENARIOS: Array<{
  name: string;
  messages: ChatMessage[];
  expected: number;
}> = [
  {
    name: "without any user message, every architect message counts",
    messages: [
      message("msg_1", "claude-software-architect", "architect", "a"),
      message("msg_2", "codex-software-architect", "architect", "b")
    ],
    expected: 2
  },
  {
    name: "only architect messages after the last user message count",
    messages: [
      message("msg_1", "claude-software-architect", "architect", "a"),
      message("msg_2", "owner", "user", "b"),
      message("msg_3", "codex-software-architect", "architect", "c")
    ],
    expected: 1
  },
  {
    name: "unknown roles neither count nor reset",
    messages: [
      message("msg_1", "owner", "user", "a"),
      message("msg_2", "claude-software-architect", "architect", "b"),
      message("msg_3", "someone", undefined, "c"),
      message("msg_4", "someone", "reviewer", "d")
    ],
    expected: 1
  }
];

CHAIN_SCENARIOS.forEach((scenario) =>
  test(`architectChainLength: ${scenario.name}`, () => {
    assert.equal(architectChainLength(scenario.messages), scenario.expected);
  })
);
