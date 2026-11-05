import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  policyCandidate,
  validatePolicy,
  type ActivationPolicy
} from "../src/core/activation-policy.js";
import { writeThreadPolicy } from "../src/core/activation-policy-store.js";
import type { McpOptions } from "../src/mcp/types.js";
import { workspaceWithThread } from "./daemon-session-http-fixtures.js";

export const AGENT = "claude-software-architect";
export const IDENTITY = { pid: 99, ppid: 100, hostId: "host-a" };
export const RESERVATION = "msg_granted:codex-software-architect";

export const STAMP = {
  status: 200,
  body: {
    decision: "stamp",
    stage: "planning",
    cycle: 2,
    reservation: RESERVATION,
    expectedStage: "execution"
  }
};

export const BODY = { agentId: AGENT, body: "Advancing.", role: "architect" };
export const ADVANCE = { to: "review", identity: IDENTITY };

export type Call = { path: string; body: Record<string, unknown> };

export type Fake = {
  calls: Call[];
  fetch: typeof fetch;
};

type Answer = (init: RequestInit) => Promise<Response>;

/** The route that never answers: it waits until the MCP's own time limit aborts the request. */
const NEVER: Answer = (init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });

function answerOf(answer: { status: number; body: unknown }): Answer {
  return async () =>
    new Response(JSON.stringify(answer.body), { status: answer.status });
}

/**
 * A daemon that answers the activation routes from a table. A route with no answer in the table never
 * answers: the request waits until the MCP's own time limit aborts it, which is how an unknown
 * advance looks from the MCP.
 */
export function fakeDaemon(
  answers: Record<string, { status: number; body: unknown }>
): Fake {
  const calls: Call[] = [];
  const table: Record<string, Answer> = Object.fromEntries(
    Object.entries(answers).map(([route, answer]) => [route, answerOf(answer)])
  );
  const fetcher = (async (url: URL, init: RequestInit) => {
    const route = url.pathname.split("/activation/")[1];
    calls.push({
      path: route,
      body: JSON.parse(String(init.body)) as Record<string, unknown>
    });
    return (table[route] ?? NEVER)(init);
  }) as typeof fetch;
  return { calls, fetch: fetcher };
}

export function optionsOf(fake: Fake, timeoutMs = 1_000): McpOptions {
  return {
    daemonUrl: "http://127.0.0.1:9",
    token: "route-secret",
    activationFetch: fake.fetch,
    activationTimeoutMs: timeoutMs
  } as McpOptions;
}

/** A thread whose policy is enabled on disk, as a daemon save leaves it. */
export async function governedWorkspace(t: { after(fn: () => unknown): void }) {
  const fx = await workspaceWithThread();
  t.after(() => fs.rm(fx.root, { recursive: true, force: true }));
  const candidate = policyCandidate(
    { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 },
    "rev-1",
    new Date().toISOString()
  );
  const result = validatePolicy(candidate);
  assert.equal(result.ok, true);
  await writeThreadPolicy(
    fx.info,
    fx.threadId,
    (result as { policy: ActivationPolicy }).policy
  );
  return fx;
}

export async function chatOf(root: string, threadId: string): Promise<string> {
  return fs.readFile(
    path.join(root, ".marc", "threads", threadId, "CHAT.md"),
    "utf8"
  );
}
