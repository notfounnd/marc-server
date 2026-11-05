import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { registerAgent } from "../src/core/workspace.js";
import type { ThreadFile } from "../src/daemon/thread-store.js";
import { HOST } from "./daemon-session-fixtures.js";
import {
  ARCHITECT,
  registered,
  send,
  startDaemon,
  TOKEN,
  workspaceWithThread,
  type LiveProcess,
  type Reply
} from "./daemon-session-http-fixtures.js";

/** The waiter and the recipient of the mentions: a registered architect profile. */
export const CODEX = "codex-software-architect";

/**
 * The holder of every wait and poll of a governed thread: the slot has one bound session, and a waiter's
 * identity is verified against it. The test process is the waiter's ancestor, and its parent is the bound
 * client, so both a CLI wait and a direct poll of this process descend from the client.
 */
export const CLI_SESSION = "session-cli";

/** The bound client: the test process's parent, listed as a live session of the holder, so the observe binds it. */
export const BOUND_CLIENT: LiveProcess = {
  pid: process.ppid,
  sessionId: CLI_SESSION,
  startedAt: 1000,
  status: "idle"
};

const POLICY_BODY = { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 };
const BUDGET = 5;

export type Governed = Awaited<ReturnType<typeof governedThread>>;

/**
 * A real daemon with a registered workspace and thread, and the thread's policy enabled through the
 * daemon's own PUT route, so the authorization pin is the one the UI would record. `live` lists the
 * client processes the presence may resolve; by default there are none.
 */
export async function governedThread(
  t: { after(fn: () => unknown): void },
  live: readonly LiveProcess[] = []
) {
  const daemon = await startDaemon([...live, BOUND_CLIENT]);
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);
  await registerAgent(ws.root, {
    id: CODEX,
    role: "architect",
    model: "gpt-6.1-sol",
    description: "Codex architect profile for daemon integration tests."
  });
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  await bindWaiter(daemon.baseUrl, ws.info, ws.threadId);
  return {
    daemon,
    root: ws.root,
    info: ws.info,
    threadId: ws.threadId,
    base
  };
}

/**
 * The waiter's session bound to the slot, observed through the route the MCP uses. The bound client is this
 * test process's parent, so the waiter's pid (this process, or a wait it starts) is under it.
 */
export async function bindWaiter(
  baseUrl: string,
  info: { id: string },
  threadId: string
): Promise<void> {
  const reply = await send(baseUrl, "POST", "/api/sessions/observe", {
    workspaceId: info.id,
    threadId,
    agentId: CODEX,
    observedAt: new Date().toISOString(),
    identity: {
      nativeSessionId: CLI_SESSION,
      pid: process.pid,
      ppid: process.ppid,
      hostId: HOST
    }
  });
  assert.equal(reply.status, 200);
}

/** The lead's mention of the waiter. The first architect message of the thread is this one. */
export async function mentionOf(
  g: Governed,
  body = `Please review marc://@${CODEX} now.`
): Promise<string> {
  const message = await appendMessageInWorkspace(g.info, g.threadId, {
    agentId: ARCHITECT,
    body,
    role: "architect"
  });
  return message.id;
}

/** A user message: the cursor that the waits start from. Mentions written after it are eligible. */
export async function cursorOf(g: Governed): Promise<string> {
  const message = await appendMessageInWorkspace(g.info, g.threadId, {
    agentId: "owner",
    body: "Continue the discussion.",
    role: "user"
  });
  return message.id;
}

export function parse(reply: Reply): Record<string, unknown> {
  return JSON.parse(reply.text) as Record<string, unknown>;
}

export function poll(
  g: Governed,
  messageId: string,
  runId: string,
  holder = CLI_SESSION
): Promise<Reply> {
  return send(g.daemon.baseUrl, "POST", `${g.base}/reservations`, {
    messageId,
    recipient: CODEX,
    holder,
    runId,
    pid: process.pid
  });
}

/** Grants the whole stage budget through the daemon, so the next mention meets an exhausted budget. */
export async function exhaustBudget(g: Governed): Promise<void> {
  for (let index = 1; index <= BUDGET; index += 1) {
    const messageId = await mentionOf(
      g,
      `Round ${index}: marc://@${CODEX} review.`
    );
    const granted = parse(await poll(g, messageId, `exhaust-${index}`));
    assert.deepEqual([granted.decision, granted.cycle], ["granted", index]);
  }
}

export function stateFileOf(g: Governed): string {
  return path.join(
    g.daemon.dataDir,
    "threads",
    g.info.id,
    `${g.threadId}.json`
  );
}

export async function stateOf(g: Governed): Promise<ThreadFile> {
  return JSON.parse(await fs.readFile(stateFileOf(g), "utf8")) as ThreadFile;
}

export function recordOf(file: ThreadFile, messageId: string) {
  return file.reservations?.find((item) => item.messageId === messageId);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type WaitLimits = { timeoutMs: number; intervalMs: number };

/**
 * Reads a value until the predicate holds, within a time limit. When the limit passes, it fails with
 * the last value read. The loop only waits for an observable condition: it never chooses whether or
 * how a scenario runs.
 */
export async function waitUntil<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  limits: WaitLimits
): Promise<T> {
  const deadline = Date.now() + limits.timeoutMs;
  let last = await read();
  while (!predicate(last)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `condition not met within ${limits.timeoutMs} ms; last value: ${JSON.stringify(last)}`
      );
    }
    await delay(limits.intervalMs);
    last = await read();
  }
  return last;
}

export type CliRun = { code: number; stdout: string };

type WaitState = { exited: boolean; code: number | undefined; stdout: string };

/** A waiter started by this test. Its PID is the one `spawn` returned, and only `stop` ends it. */
export type StartedWait = {
  readonly pid: number | undefined;
  state(): WaitState;
  stop(): Promise<void>;
};

/**
 * The real `marc wait` as a child process, reaching the temporary daemon through its flags. The
 * test's own `t.after` stops the process by the PID it spawned, so an assertion that fails before
 * the wait ends leaves no orphan behind.
 */
export function startWait(
  t: { after(fn: () => unknown): void },
  g: Governed,
  since: string,
  mention = CODEX
): StartedWait {
  const args = [
    "--workspace",
    g.root,
    "--thread",
    g.threadId,
    "--mention",
    mention,
    "--since",
    since,
    "--session",
    CLI_SESSION,
    "--data-dir",
    g.daemon.dataDir,
    "--daemon-url",
    g.daemon.baseUrl,
    "--timeout-minutes",
    "1"
  ];
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", "wait", ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, CLAUDE_CODE_SESSION_ID: "", MARC_TOKEN: TOKEN },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );
  let stdout = "";
  let exited = false;
  let code: number | undefined;
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  const closed = new Promise<void>((resolve) => {
    child.on("close", (exitCode) => {
      exited = true;
      code = exitCode ?? undefined;
      resolve();
    });
  });
  const wait: StartedWait = {
    pid: child.pid,
    state: () => ({ exited, code, stdout }),
    stop: async () => {
      child.kill();
      await closed;
    }
  };
  t.after(() => wait.stop());
  return wait;
}

/** Waits, within a bounded time, for the waiter to exit, and returns its exit code and output. */
export async function finished(wait: StartedWait): Promise<CliRun> {
  const state = await waitUntil(
    async () => wait.state(),
    (value) => value.exited,
    { timeoutMs: 60_000, intervalMs: 100 }
  );
  return { code: state.code ?? -1, stdout: state.stdout };
}

export function lineOf(run: CliRun): Record<string, unknown> {
  const lines = run.stdout.split(/\r?\n/).filter((line) => line.length > 0);
  assert.equal(lines.length, 1, `expected one stdout line, got: ${run.stdout}`);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}
