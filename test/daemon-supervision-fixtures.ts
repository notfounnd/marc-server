import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer, type DaemonServer } from "../src/daemon/server.js";
import type { ProcessTablePort } from "../src/daemon/process-table-os.js";
import type { SupervisionOptions } from "../src/daemon/supervision-runner.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import { recallMemory } from "../src/core/workspace-memory.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { registerAgent } from "../src/core/workspace.js";
import type { ChatMessage, WorkspaceInfo } from "../src/core/types.js";
import type { ThreadFile } from "../src/daemon/thread-store.js";
import {
  ARCHITECT,
  registered,
  send,
  TOKEN,
  workspaceWithThread,
  type Reply
} from "./daemon-session-http-fixtures.js";

/** A second architect the mentions wake, on the same Claude client as the first. */
export const SECOND = "claude-second-architect";
/** A developer profile: never a recipient. */
export const DEVELOPER = "claude-dev";
/** A user profile: its messages only count when a UI records them. */
export const USER = "ui-user";
export const MINUTE_MS = 60_000;
export const START_MS = Date.parse("2026-11-10T12:00:00.000Z");
const POLICY_BODY = { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 };

export type Clock = { ms: number };

/** Every start the daemon hands to the runner, in order. The fake runner launches nothing. */
export type Runs = { starts: SupervisionRecord[] };

/** What a test may replace in a supervision daemon: the supervisor's options, and the process table it reads. */
export type SupervisedExtra = {
  supervision?: Partial<SupervisionOptions>;
  processes?: ProcessTablePort;
};

export type Supervised = {
  baseUrl: string;
  dataDir: string;
  close: () => Promise<void>;
  server: DaemonServer;
};

/** A thread with the policy enabled, two architects and a developer, under a daemon with a fixed clock. */
export type Thread = {
  daemon: Supervised;
  info: WorkspaceInfo;
  root: string;
  threadId: string;
  base: string;
  clock: Clock;
  runs: Runs;
};

export function isoOf(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * A daemon whose supervisor reads the injected clock, starts at the clock's instant, and hands its
 * starts to the fake runner. Presence reports no live process, and the CLI is never run.
 */
export async function startSupervised(
  clock: Clock,
  runs: Runs,
  extra: SupervisedExtra = {}
): Promise<Supervised> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "marc-supervision-"));
  const config = await loadDaemonConfig({ dataDir, token: TOKEN, port: 0 });
  const server = await createDaemonServer(config, {
    memoryRecall: recallMemory,
    presence: {
      hostId: "supervision-host",
      now: () => clock.ms,
      runAgents: async () => "[]"
    },
    registry: {
      newOwnerToken: () => "supervision-owner",
      newSessionId: () => "supervision-session"
    },
    processes: extra.processes,
    supervision: {
      now: () => isoOf(clock.ms),
      startedAt: clock.ms,
      runner: { start: (_scope, record) => void runs.starts.push(record) },
      ...extra.supervision
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    dataDir,
    server,
    close: () =>
      new Promise<void>((resolve) => server.close(() => resolve())).then(() =>
        server.drainBackground()
      )
  };
}

/**
 * The thread every supervision test starts from. The clock is moved past the presence grace window, so
 * a test that does not name the window is judged as a running daemon would judge it.
 */
export async function supervisedThread(
  t: { after(fn: () => unknown): void },
  extra: SupervisedExtra = {}
): Promise<Thread> {
  const clock = { ms: START_MS };
  const runs: Runs = { starts: [] };
  const daemon = await startSupervised(clock, runs, extra);
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() =>
    fs.rm(ws.root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100
    })
  );
  await registered(daemon, ws.info);
  await registerAgent(ws.root, {
    id: SECOND,
    role: "architect",
    model: "claude-opus-5-5",
    description: "Second Claude architect for supervision tests."
  });
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  clock.ms = START_MS + 2 * MINUTE_MS;
  return {
    daemon,
    info: ws.info,
    root: ws.root,
    threadId: ws.threadId,
    base,
    clock,
    runs
  };
}

/** A message in the thread, written the way the UI or an agent writes it. Returns the stored message. */
export function postIn(
  thread: Thread,
  agentId: string,
  body: string,
  role: string = "architect"
): Promise<ChatMessage> {
  return appendMessageInWorkspace(thread.info, thread.threadId, {
    agentId,
    body,
    role
  });
}

export function stateFileOf(thread: Thread): string {
  return path.join(
    thread.daemon.dataDir,
    "threads",
    thread.info.id,
    `${thread.threadId}.json`
  );
}

export async function stateOf(thread: Thread): Promise<ThreadFile> {
  return JSON.parse(
    await fs.readFile(stateFileOf(thread), "utf8")
  ) as ThreadFile;
}

/** The key of the second architect's slot in the thread state. */
export function slotKeyOf(thread: Thread): string {
  return `${thread.info.id}:${thread.threadId}:${SECOND}`;
}

/**
 * Edits the thread state through the daemon's own store. The edit is one step of the same per-file queue
 * the supervisor's passes and the watcher's passes use, so it never interleaves with them and no pass can
 * write back a snapshot taken before it. No wait is needed.
 */
export async function editState(
  thread: Thread,
  edit: (file: ThreadFile) => void
): Promise<void> {
  const result = await thread.daemon.server.threads.update<boolean>(
    { workspaceId: thread.info.id, threadId: thread.threadId },
    (file) => {
      const next = structuredClone(file);
      edit(next);
      return { value: true, file: next };
    }
  );
  assert.equal(result.status, "done");
}

/** The supervision cards of the thread, read from its state file. */
export async function cardsOf(thread: Thread): Promise<SupervisionRecord[]> {
  return (await stateOf(thread)).supervision?.records ?? [];
}

/**
 * The mention of the second architect, passed once, so its card is awaiting confirmation. The pass is
 * awaited directly; a pass that the watcher starts for the same append is idempotent and queued behind it.
 */
export async function awaitingCard(thread: Thread): Promise<string> {
  const message = await postIn(
    thread,
    ARCHITECT,
    `Please review marc://@${SECOND} now.`
  );
  await pass(thread);
  return message.id;
}

/** Runs the supervisor's pass over every thread now, as the startup would. */
export async function pass(thread: Thread): Promise<void> {
  await thread.daemon.server.supervision.passAll();
}

export function cardPost(
  thread: Thread,
  action: string,
  messageId: string,
  recipient: string = SECOND
): Promise<Reply> {
  return send(
    thread.daemon.baseUrl,
    "POST",
    `${thread.base}/supervision/${action}`,
    {
      messageId,
      recipient
    }
  );
}

/** The marc open path: an acquire of the second architect's slot, answered by the session route. */
export function acquireSlot(
  thread: Thread,
  expectedGeneration: number
): Promise<Reply> {
  return send(thread.daemon.baseUrl, "POST", "/api/sessions/acquire", {
    workspaceId: thread.info.id,
    threadId: thread.threadId,
    profile: SECOND,
    expectedGeneration
  });
}

export function parseReply(reply: Reply): Record<string, unknown> {
  return JSON.parse(reply.text) as Record<string, unknown>;
}
