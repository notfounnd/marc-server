import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer, type DaemonServer } from "../src/daemon/server.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import { recallMemory } from "../src/core/workspace-memory.js";
import { registerAgent } from "../src/core/workspace.js";
import type { ThreadFile } from "../src/daemon/thread-store.js";
import type { ProcessTablePort } from "../src/daemon/process-table-os.js";
import type {
  SupervisionOptions,
  SupervisionRunner
} from "../src/daemon/supervision-runner.js";
import type {
  TimerHandle,
  TurnPorts
} from "../src/daemon/supervision-turn-process.js";
import {
  ARCHITECT,
  registered,
  send,
  TOKEN,
  workspaceWithThread,
  type Reply
} from "./daemon-session-http-fixtures.js";
import {
  isoOf,
  MINUTE_MS,
  SECOND,
  START_MS
} from "./daemon-supervision-fixtures.js";

/** The stand-in for `claude -p`, run with the node executable and no shell. */
export const FAKE_CLIENT = fileURLToPath(
  new URL("./fixtures/supervision-fake-claude.mjs", import.meta.url)
);
/** The continue prompt, as the adapter sends it. */
export const CONTINUE_PROMPT =
  "you were stopped by the time limit; check what was left half done and continue";
/** The owner heartbeat of the tests. Longer than the default, so a long fake clock jump stays cheap. */
export const TEST_HEARTBEAT_MS = 5 * MINUTE_MS;
/** The default time limit of a turn, in minutes. */
export const TURN_MINUTES = 60;
const POLICY_BODY = { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 };

/**
 * The fake clock: the instant, the timers scheduled on it, and the processes launched. onLaunch runs just
 * before each launch, so a test can change the state the turn's next step reads.
 */
export type Clock = {
  ms: number;
  timers: ScheduledTimer[];
  launches: number;
  children: ChildProcess[];
  onLaunch?: () => void;
};

type ScheduledTimer = { at: number; fire: () => void; cleared: boolean };

export function turnPorts(clock: Clock): TurnPorts {
  return {
    spawn: (_command, args, options) => {
      clock.launches += 1;
      clock.onLaunch?.();
      const child = spawn(process.execPath, [FAKE_CLIENT, ...args], options);
      clock.children.push(child);
      return child;
    },
    now: () => clock.ms,
    setTimer: (fire, ms) => {
      const timer: ScheduledTimer = { at: clock.ms + ms, fire, cleared: false };
      clock.timers.push(timer);
      return timer;
    },
    clearTimer: (handle: TimerHandle) => {
      (handle as ScheduledTimer).cleared = true;
    },
    heartbeatMs: TEST_HEARTBEAT_MS
  };
}

/** Moves the fake clock forward, firing every timer that comes due on the way, in order. */
export function advance(clock: Clock, ms: number): void {
  const target = clock.ms + ms;
  let due = nextDue(clock, target);
  while (due !== undefined) {
    clock.timers = clock.timers.filter((timer) => timer !== due);
    clock.ms = due.at;
    due.fire();
    due = nextDue(clock, target);
  }
  clock.ms = target;
}

function nextDue(clock: Clock, target: number): ScheduledTimer | undefined {
  return clock.timers
    .filter((timer) => !timer.cleared && timer.at <= target)
    .sort((left, right) => left.at - right.at)[0];
}

export type TurnDaemon = {
  baseUrl: string;
  dataDir: string;
  server: DaemonServer;
  close: () => Promise<void>;
};

/** The launch each daemon of a test starts with: the production runner, or a runner that only records. */
const LAUNCH: Record<
  "production" | "held",
  (held: SupervisionRecord[]) => Partial<SupervisionOptions>
> = {
  production: () => ({}),
  held: (held) => ({
    runner: {
      start: (_scope, record) => {
        held.push(record);
      }
    } satisfies SupervisionRunner
  })
};

async function startWith(
  clock: Clock,
  extra: Partial<SupervisionOptions>,
  processes?: ProcessTablePort
): Promise<TurnDaemon> {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-supervision-turn-")
  );
  const config = await loadDaemonConfig({ dataDir, token: TOKEN, port: 0 });
  const server = await createDaemonServer(config, {
    memoryRecall: recallMemory,
    processes,
    presence: {
      hostId: "supervision-host",
      now: () => clock.ms,
      runAgents: async () => "[]"
    },
    registry: {
      now: () => isoOf(clock.ms),
      newOwnerToken: () => "turn-owner",
      newSessionId: () => "supervision-session"
    },
    supervision: {
      now: () => isoOf(clock.ms),
      startedAt: clock.ms,
      turn: turnPorts(clock),
      ...extra
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

/** A thread with the policy enabled and the second architect registered, under a daemon with a fake clock. */
export type TurnThread = {
  daemon: TurnDaemon;
  clock: Clock;
  info: WorkspaceInfo;
  root: string;
  threadId: string;
  base: string;
  /** The launches the daemon held instead of starting, when the thread was opened as held. */
  held: SupervisionRecord[];
};

export async function turnThread(
  t: { after(fn: () => unknown): void },
  launch: "production" | "held",
  processes?: ProcessTablePort
): Promise<TurnThread> {
  const clock: Clock = { ms: START_MS, timers: [], launches: 0, children: [] };
  const held: SupervisionRecord[] = [];
  const daemon = await startWith(clock, LAUNCH[launch](held), processes);
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
    description: "Second Claude architect for supervised turn tests."
  });
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  clock.ms = START_MS + 2 * MINUTE_MS;
  return {
    daemon,
    clock,
    info: ws.info,
    root: ws.root,
    threadId: ws.threadId,
    base,
    held
  };
}

/**
 * Sets the fake client's scenario and its files, through the environment of the test process. The fake
 * client gets no daemon address and no token: the obedient scenario waits for the stop file alone.
 */
export function fakeClient(
  thread: TurnThread,
  scenario: string,
  totalCostUsd: string
): void {
  process.env.FAKE_SCENARIO = scenario;
  process.env.FAKE_TOTAL_COST_USD = totalCostUsd;
  process.env.FAKE_ARGV_FILE = path.join(thread.daemon.dataDir, "argv.json");
  process.env.FAKE_GRANDCHILD_PID_FILE = path.join(
    thread.daemon.dataDir,
    "grandchild.pid"
  );
  process.env.FAKE_STOP_FILE = stopFileOf(thread);
}

/** The file the test writes to tell an obedient fake client to end, after it has seen the stop notice. */
export function stopFileOf(thread: TurnThread): string {
  return path.join(thread.daemon.dataDir, "stop.flag");
}

/** The argv the last launch of the fake client recorded. */
export async function launchedArgv(thread: TurnThread): Promise<{
  argv: string[];
  prompt: string;
  mode: string;
  sessionId: string;
  runId: string;
}> {
  const text = await fs.readFile(
    path.join(thread.daemon.dataDir, "argv.json"),
    "utf8"
  );
  return JSON.parse(text);
}

export function stateFileOf(thread: TurnThread): string {
  return path.join(
    thread.daemon.dataDir,
    "threads",
    thread.info.id,
    `${thread.threadId}.json`
  );
}

export async function stateOf(thread: TurnThread): Promise<ThreadFile> {
  return JSON.parse(
    await fs.readFile(stateFileOf(thread), "utf8")
  ) as ThreadFile;
}

export function slotKeyOf(thread: TurnThread): string {
  return `${thread.info.id}:${thread.threadId}:${SECOND}`;
}

export async function cardsOf(
  thread: TurnThread
): Promise<SupervisionRecord[]> {
  return (await stateOf(thread)).supervision?.records ?? [];
}

/** Polls the cards until the test's condition holds. The condition is the test's, the wait is only a poll. */
export async function waitForCards(
  thread: TurnThread,
  done: (records: SupervisionRecord[]) => boolean
): Promise<SupervisionRecord[]> {
  const deadline = Date.now() + 20_000;
  let records = await cardsOf(thread);
  while (!done(records) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    records = await cardsOf(thread);
  }
  assert.ok(
    done(records),
    "the cards did not reach the expected state in time"
  );
  return records;
}

export function cardFor(
  records: SupervisionRecord[],
  messageId: string
): SupervisionRecord {
  const card = records.find((record) => record.messageId === messageId);
  assert.ok(card, `no card for message ${messageId}`);
  return card;
}

/** A mention of the second architect, passed once, so its card is awaiting confirmation. */
export async function mention(thread: TurnThread): Promise<string> {
  const message = await appendMessageInWorkspace(thread.info, thread.threadId, {
    agentId: ARCHITECT,
    body: `Please review marc://@${SECOND} now.`,
    role: "architect"
  });
  await thread.daemon.server.supervision.passAll();
  return message.id;
}

/** A card action on the second architect's card. */
export function cardAction(
  thread: TurnThread,
  action: "approve" | "retry" | "continue" | "decline",
  messageId: string
): Promise<Reply> {
  return send(
    thread.daemon.baseUrl,
    "POST",
    `${thread.base}/supervision/${action}`,
    {
      messageId,
      recipient: SECOND
    }
  );
}
