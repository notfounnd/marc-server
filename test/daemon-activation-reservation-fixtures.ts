import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { registerAgent } from "../src/core/workspace.js";
import type {
  ProcessRow,
  ProcessTableRead
} from "../src/core/process-table.js";
import type { ProcessTablePort } from "../src/daemon/process-table-os.js";
import { HOST, NOW } from "./daemon-session-fixtures.js";
import {
  registered,
  send,
  startDaemon,
  workspaceWithThread,
  type LiveProcess,
  type PresenceClock,
  type Reply
} from "./daemon-session-http-fixtures.js";

export const CODEX = "codex-software-architect";
export const POLICY_BODY = {
  enabled: true,
  attemptCap: 2,
  pendingTtlMinutes: 1440
};
/** The waiter's session is the bound client's native session; the waiter is a child of the client. */
export const SESSION = "session-codex";
export const CLIENT_PID = 4100;
export const WAITER_PID = 4200;
export const MCP_PID = 4300;
export const TREE: ProcessRow[] = [
  { pid: WAITER_PID, ppid: CLIENT_PID },
  { pid: CLIENT_PID, ppid: 1 }
];

/** The bound client: a live Claude session of the waiter's native session, listed with its start instant. */
const CLIENT: LiveProcess = {
  pid: CLIENT_PID,
  sessionId: SESSION,
  startedAt: 1000
};

/** A process table the test fixes: the rows it lists, or a table that cannot be read. */
export function tableOf(read: ProcessTableRead): ProcessTablePort {
  return { list: async () => read };
}

export function parse(reply: Reply): Record<string, unknown> {
  return JSON.parse(reply.text) as Record<string, unknown>;
}

export function mention(): string {
  return `marc://@${CODEX} please review the plan.`;
}

/**
 * A daemon with a workspace, the architect profile and the policy enabled; the waiter's session is bound.
 * Extra live processes join the bound client in the agents inventory, for tests that need other sessions.
 * The live list and the clock come back too, so a test can change the listing and advance the clock past
 * the agents cache window.
 */
export async function started(
  t: { after(fn: () => unknown): void },
  table: ProcessTablePort = tableOf({ status: "available", rows: TREE }),
  extra: readonly LiveProcess[] = []
) {
  const live: LiveProcess[] = [CLIENT, ...extra];
  const clock: PresenceClock = { now: NOW };
  const daemon = await startDaemon(live, table, clock);
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);
  await registerAgent(ws.root, {
    id: CODEX,
    role: "architect",
    model: "gpt-6.1-sol",
    description: "Codex architect profile for reservation route tests."
  });
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  await bindWaiter(daemon.baseUrl, ws.info, ws.threadId);
  return { daemon, ws, base, live, clock };
}

/** The waiter's session observed as the slot's binding, through the same route the MCP uses. */
async function bindWaiter(
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
      nativeSessionId: SESSION,
      pid: MCP_PID,
      ppid: CLIENT_PID,
      hostId: HOST
    }
  });
  assert.equal(reply.status, 200);
}

/**
 * Edits the thread's state file in place, the way a test needs it. The daemon reads the file again on each
 * request, so the edit is what the next route sees.
 */
export async function patchStateFile<T>(
  dataDir: string,
  workspaceId: string,
  threadId: string,
  edit: (file: T) => void
): Promise<void> {
  const filePath = path.join(
    dataDir,
    "threads",
    workspaceId,
    `${threadId}.json`
  );
  const file = JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  edit(file);
  await fs.writeFile(filePath, JSON.stringify(file));
}

export function reservationBody(
  messageId: string,
  overrides: Record<string, string | number | undefined> = {}
) {
  return {
    messageId,
    recipient: CODEX,
    holder: SESSION,
    runId: "run-1",
    pid: WAITER_PID,
    ...overrides
  };
}
