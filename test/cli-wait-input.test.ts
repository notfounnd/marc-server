import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { tryWithWorkspaceWriteLock } from "../src/core/write-coordination.js";
import {
  SESSION,
  baseArgs,
  fixture,
  nothing,
  runCli,
  runScenario,
  singleJsonLine,
  type Scenario
} from "./cli-wait-fixtures.js";

/** Input and session errors: each ends with code 5 before any wait starts, so no lock is reported. */
const INPUT_SCENARIOS: Scenario[] = [
  {
    name: "an unknown thread is an input error with code 5",
    setup: nothing,
    args: (fx) => [
      ...baseArgs(fx, fx.cursor, "no-such-thread"),
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "error", exitCode: 5, sessionLock: undefined }
  },
  {
    name: "an unregistered profile is an input error with code 5",
    setup: nothing,
    args: (fx) => [
      "wait",
      "--workspace",
      fx.root,
      "--thread",
      fx.threadId,
      "--mention",
      "ghost-agent",
      "--since",
      fx.cursor,
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "error", exitCode: 5, sessionLock: undefined }
  },
  {
    name: "a max-chain below one is rejected with code 5",
    setup: nothing,
    args: (fx) => [
      ...baseArgs(fx, fx.cursor, fx.threadId),
      "--max-chain",
      "0",
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "error", exitCode: 5, sessionLock: undefined }
  },
  {
    name: "a flag given without its value is rejected with code 5",
    setup: nothing,
    args: (fx) => [
      "wait",
      "--workspace",
      fx.root,
      "--thread",
      fx.threadId,
      "--mention",
      "--since",
      fx.cursor,
      "--session",
      SESSION
    ],
    whileRunning: nothing,
    expected: { status: "error", exitCode: 5, sessionLock: undefined }
  }
];

INPUT_SCENARIOS.forEach((scenario) =>
  test(`marc wait: ${scenario.name}`, () => runScenario(scenario))
);

test("marc wait: a second waiter for the same thread and session reports already_waiting", async () => {
  const fx = await fixture();
  let markAcquired: () => void = () => undefined;
  const acquired = new Promise<void>((resolve) => {
    markAcquired = () => resolve();
  });
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  try {
    const holder = tryWithWorkspaceWriteLock(
      fx.info.marcPath,
      `wait:${fx.threadId}:${SESSION}`,
      async () => {
        markAcquired();
        await held;
      },
      { staleAfterMs: 30000 }
    );
    await acquired;

    const result = await runCli([
      ...baseArgs(fx, fx.cursor, fx.threadId),
      "--session",
      SESSION
    ]);

    const payload = singleJsonLine(result.stdout);
    assert.equal(result.code, 6, result.stderr);
    assert.equal(payload.status, "already_waiting");
    assert.equal(payload.sessionLock, "busy");

    release();
    assert.equal((await holder).acquired, true);
  } finally {
    await fs.rm(fx.root, { recursive: true, force: true });
  }
});
