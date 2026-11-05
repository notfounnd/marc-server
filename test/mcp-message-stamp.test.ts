import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  policyCandidate,
  validatePolicy
} from "../src/core/activation-policy.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import {
  postMessageWithActivation,
  type PostedMessage
} from "../src/mcp/message-post-stamp.js";
import type { McpOptions } from "../src/mcp/types.js";
import { CLOCK_ISO } from "./daemon-thread-state-fixtures.js";
import { fixture, type Fixture } from "./cli-wait-fixtures.js";

const DAEMON = "http://127.0.0.1:4187";
const BODY = "Please review marc://@claude-dev now.";

type Call = { path: string; body: unknown };
type Answer = { status: number; body: unknown } | "down" | "hang";

/** A daemon double: each route answers as scripted, and every call is recorded. */
function daemonDouble(answers: Record<string, Answer>) {
  const calls: Call[] = [];
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const path = new URL(String(input)).pathname.replace(
      /^.*\/activation\//,
      ""
    );
    calls.push({ path, body: JSON.parse(String(init?.body ?? "null")) });
    const answer = answers[path];
    if (answer === "down") throw new Error("connect ECONNREFUSED");
    if (answer === "hang") return hangUntilAborted(init);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
  return { calls, fetcher };
}

/**
 * Waits for the caller's abort. A referenced timer keeps the event loop alive, because the abort
 * timer of AbortSignal.timeout is unreferenced and would otherwise let the test runner stop early.
 */
function hangUntilAborted(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(
      () => reject(new Error("never aborted")),
      5_000
    );
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(new Error("aborted"));
    });
  });
}

async function governed(t: {
  after(fn: () => unknown): void;
}): Promise<Fixture> {
  const fx = await fixture();
  t.after(() => fs.rm(fx.root, { recursive: true, force: true }));
  await enablePolicy(fx);
  return fx;
}

async function enablePolicy(fx: Fixture): Promise<void> {
  const result = validatePolicy(
    policyCandidate({ enabled: true }, "rev-on", CLOCK_ISO)
  );
  if (!result.ok) throw new Error("fixture policy is invalid");
  await writeThreadPolicy(fx.info, fx.threadId, result.policy);
}

function optionsOf(
  fetcher: typeof fetch | undefined,
  timeoutMs?: number
): McpOptions {
  return {
    daemonUrl: DAEMON,
    token: "stamp-test-token",
    activationFetch: fetcher,
    activationTimeoutMs: timeoutMs
  };
}

async function post(fx: Fixture, options: McpOptions): Promise<PostedMessage> {
  return postMessageWithActivation(options, fx.root, fx.threadId, {
    agentId: "claude-dev",
    body: BODY,
    role: "developer"
  });
}

const STAMP_WITH_RESERVATION = {
  decision: "stamp",
  stage: "planning",
  cycle: 2,
  reservation: "msg-x:claude-dev"
};

test("a thread without an enabled policy posts plainly and never contacts the daemon", async (t) => {
  const fx = await fixture();
  t.after(() => fs.rm(fx.root, { recursive: true, force: true }));
  const daemon = daemonDouble({});
  const message = await post(fx, optionsOf(daemon.fetcher));

  assert.deepEqual(
    [daemon.calls.length, message.stage, message.warnings],
    [0, undefined, []]
  );
});

test("a granted stamp carries the stage and the cycle, and the confirmation names the message and the reservation", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({
    stamp: { status: 200, body: STAMP_WITH_RESERVATION },
    "stamp/confirm": { status: 200, body: { decision: "answered" } }
  });
  const message = await post(fx, optionsOf(daemon.fetcher));

  assert.deepEqual(
    [message.stage, message.cycle, message.warnings],
    ["planning", 2, []]
  );
  assert.deepEqual(
    daemon.calls.map((call) => call.path),
    ["stamp", "stamp/confirm"]
  );
  assert.deepEqual(daemon.calls[1].body, {
    agentId: "claude-dev",
    messageId: message.id,
    reservation: "msg-x:claude-dev"
  });
});

test("a stamp without a reservation carries only the stage and asks no confirmation", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({
    stamp: { status: 200, body: { decision: "stamp", stage: "execution" } }
  });
  const message = await post(fx, optionsOf(daemon.fetcher));

  assert.deepEqual(
    [message.stage, message.cycle, message.warnings],
    ["execution", undefined, []]
  );
  assert.deepEqual(
    daemon.calls.map((call) => call.path),
    ["stamp"]
  );
});

test("a daemon that is down writes the message without a stamp and warns", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({ stamp: "down" });
  const message = await post(fx, optionsOf(daemon.fetcher));

  assert.deepEqual(
    [message.stage, message.warnings],
    [undefined, ["activation_stamp_unavailable"]]
  );
  assert.match(
    await fs.readFile(chatPathOf(fx), "utf8"),
    /Please review marc:\/\/@claude-dev now\./
  );
});

test("a slow daemon is cut by the injected time limit and the message is written without a stamp", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({ stamp: "hang" });
  const message = await post(fx, optionsOf(daemon.fetcher, 20));

  assert.deepEqual(
    [message.stage, message.warnings],
    [undefined, ["activation_stamp_unavailable"]]
  );
});

test("a failed confirmation keeps the stamp that was written and warns", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({
    stamp: { status: 200, body: STAMP_WITH_RESERVATION },
    "stamp/confirm": {
      status: 409,
      body: { decision: "refused", reason: "thread_closed" }
    }
  });
  const message = await post(fx, optionsOf(daemon.fetcher));

  assert.deepEqual(
    [message.stage, message.cycle, message.warnings],
    ["planning", 2, ["activation_confirm_failed"]]
  );
});

test("a confirmation that never answers keeps the stamp and warns, within the time limit", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({
    stamp: { status: 200, body: STAMP_WITH_RESERVATION },
    "stamp/confirm": "hang"
  });
  const message = await post(fx, optionsOf(daemon.fetcher, 20));

  assert.deepEqual(
    [message.stage, message.warnings],
    ["planning", ["activation_confirm_failed"]]
  );
});

test("a stamp naming an unknown stage is unavailable: the message is written without a stamp and warns", async (t) => {
  const fx = await governed(t);
  const daemon = daemonDouble({
    stamp: { status: 200, body: { decision: "stamp", stage: "nonsense" } }
  });
  const message = await post(fx, optionsOf(daemon.fetcher));

  assert.deepEqual(
    [message.stage, message.warnings],
    [undefined, ["activation_stamp_unavailable"]]
  );
});

function chatPathOf(fx: Fixture): string {
  return `${fx.root}/.marc/threads/${fx.threadId}/CHAT.md`;
}
