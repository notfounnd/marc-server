import test from "node:test";
import {
  MENTION_BODY,
  SESSION,
  baseArgs,
  mention,
  nothing,
  runScenario,
  sleep,
  type Scenario
} from "./cli-wait-fixtures.js";
import fs from "node:fs/promises";
import path from "node:path";

/** Lifecycle outcomes: a mention, the cursor, the thread state, and the chain limit. */
const SCENARIOS: Scenario[] = [
  {
    name: "a mention written while the wait runs ends it with code 0",
    setup: nothing,
    args: (fx) => [
      ...baseArgs(fx, fx.cursor, fx.threadId),
      "--session",
      SESSION
    ],
    whileRunning: async (fx) => {
      await sleep(1500);
      await mention(fx, "claude-software-architect", "architect", MENTION_BODY);
    },
    expected: { status: "mention", exitCode: 0, sessionLock: "held" }
  },
  {
    name: "a mention already written after the cursor ends at once with code 0",
    setup: async (fx) => {
      await mention(fx, "claude-software-architect", "architect", MENTION_BODY);
    },
    args: (fx) => [
      ...baseArgs(fx, fx.cursor, fx.threadId),
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "mention", exitCode: 0, sessionLock: "held" }
  },
  {
    name: "a missing cursor ends with code 3",
    setup: nothing,
    args: (fx) => [
      ...baseArgs(fx, "msg_missing", fx.threadId),
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "cursor_not_found", exitCode: 3, sessionLock: "held" }
  },
  {
    name: "a closed thread ends with code 4",
    setup: async (fx) => {
      const summaryPath = path.join(
        fx.info.marcPath,
        "threads",
        fx.threadId,
        "SUMMARY.md"
      );
      await fs.writeFile(summaryPath, "# Summary\n", "utf8");
    },
    args: (fx) => [
      ...baseArgs(fx, fx.cursor, fx.threadId),
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "thread_closed", exitCode: 4, sessionLock: "held" }
  },
  {
    name: "a chain at its limit ends with code 2",
    setup: async (fx) => {
      await mention(fx, "claude-software-architect", "architect", "Proposal.");
      await mention(fx, "codex-software-architect", "architect", "Review.");
      await mention(fx, "claude-software-architect", "architect", MENTION_BODY);
    },
    args: (fx) => [
      ...baseArgs(fx, fx.cursor, fx.threadId),
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "chain_limit", exitCode: 2, sessionLock: "held" }
  },
  {
    name: "without a session the wait runs with the lock unavailable",
    setup: async (fx) => {
      await mention(fx, "claude-software-architect", "architect", MENTION_BODY);
    },
    args: (fx) => baseArgs(fx, fx.cursor, fx.threadId),
    whileRunning: nothing,
    expected: { status: "mention", exitCode: 0, sessionLock: "unavailable" }
  }
];

SCENARIOS.forEach((scenario) =>
  test(`marc wait: ${scenario.name}`, () => runScenario(scenario))
);
