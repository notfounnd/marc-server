import assert from "node:assert/strict";
import { loadDaemonConfig } from "../src/daemon/config.js";
import { createDaemonServer, type DaemonServer } from "../src/daemon/server.js";
import type { ProcessTablePort } from "../src/daemon/process-table-os.js";
import type {
  ProcessRow,
  ProcessTableRead
} from "../src/core/process-table.js";
import type {
  SupervisionRecord,
  SupervisionTurn
} from "../src/core/activation-supervision-types.js";
import {
  slotKey,
  type ClientProcess,
  type SessionBinding
} from "../src/core/session-slots.js";
import { recallMemory } from "../src/core/workspace-memory.js";
import { isoOf } from "../src/daemon/supervision-turn-helpers.js";
import { SECOND } from "./daemon-supervision-fixtures.js";
import {
  turnPorts,
  type Clock,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";

const TOKEN = "reconcile-secret";

export const MESSAGE = "msg_reconcile_turn";
export const RUN = "run-reconcile";
export const SESSION = "session-reconcile";
export const PID = 4242;
export const OTHER_PID = 4343;
/** The start instant the agents source reports for the turn's process, in epoch milliseconds. */
export const STARTED = 1000;
export const TURN_MS = 60 * 60_000;

/**
 * What the sources of one daemon report. The test changes it between the daemon's lives. Every read of the
 * agents source advances the presence clock past its cache window, so no read answers for an earlier state.
 */
export type World = {
  agents: ClientProcess[];
  rows: ProcessRow[];
  agentsDown: boolean;
  tableDown: boolean;
  presenceMs: number;
};

export function worldOf(input: {
  agents?: ClientProcess[];
  rows?: ProcessRow[];
  startMs: number;
}): World {
  return {
    agents: input.agents ?? [],
    rows: input.rows ?? [],
    agentsDown: false,
    tableDown: false,
    presenceMs: input.startMs
  };
}

/** The process table the world reports, read at each call. */
function tableOf(world: World): ProcessTablePort {
  return {
    list: async (): Promise<ProcessTableRead> => {
      if (world.tableDown) {
        return { status: "unavailable", reason: "command_failed" };
      }
      return {
        status: "available",
        rows: world.rows.map((row) => ({ ...row }))
      };
    }
  };
}

export type Restarted = { server: DaemonServer; close: () => Promise<void> };

/**
 * A daemon on an existing data directory, with the world's sources and the thread's clock. The grace window
 * starts at the given instant, so a test chooses whether the presence grace is still open.
 */
export async function startOn(
  dataDir: string,
  world: World,
  clock: Clock,
  startedAt: number
): Promise<Restarted> {
  const config = await loadDaemonConfig({ dataDir, token: TOKEN, port: 0 });
  const server = await createDaemonServer(config, {
    memoryRecall: recallMemory,
    presence: {
      hostId: "supervision-host",
      now: () => {
        world.presenceMs += 10_000;
        return world.presenceMs;
      },
      runAgents: async () => {
        if (world.agentsDown) throw new Error("agents unavailable");
        return JSON.stringify(world.agents);
      }
    },
    processes: tableOf(world),
    registry: {
      now: () => isoOf(clock.ms) ?? "",
      newOwnerToken: () => "turn-owner",
      newSessionId: () => "supervision-session"
    },
    supervision: {
      now: () => isoOf(clock.ms) ?? "",
      startedAt,
      turn: turnPorts(clock)
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    close: () =>
      new Promise<void>((resolve) => server.close(() => resolve())).then(() =>
        server.drainBackground()
      )
  };
}

/** Closes the thread's first daemon and starts a new one on the same data directory: the restart under test. */
export async function restart(
  thread: TurnThread,
  world: World,
  startedAt: number
): Promise<Restarted> {
  await thread.daemon.close();
  const next = await startOn(
    thread.daemon.dataDir,
    world,
    thread.clock,
    startedAt
  );
  assert.ok(next.server.address());
  return next;
}

export type Seed = {
  status: "starting" | "running";
  pid?: number;
  startedAt?: string;
  deadlineAt?: string;
  runningAt?: string;
};

/** Writes the card and the binding of the turn into the thread's state, as the approval would have left them. */
export async function seedCard(thread: TurnThread, seed: Seed): Promise<void> {
  const scope = { workspaceId: thread.info.id, threadId: thread.threadId };
  await thread.daemon.server.threads.update(scope, (file) => {
    const next = structuredClone(file);
    next.generation = 1;
    next.slots[keyOf(thread)] = bindingOf(thread);
    next.supervision = { records: [recordOf(thread, seed)], floors: {} };
    return { value: true, file: next };
  });
}

export function keyOf(thread: TurnThread): string {
  return slotKey({
    workspaceId: thread.info.id,
    threadId: thread.threadId,
    profile: SECOND
  });
}

function bindingOf(thread: TurnThread): SessionBinding {
  const at = isoOf(thread.clock.ms) ?? "";
  return {
    workspaceId: thread.info.id,
    threadId: thread.threadId,
    profile: SECOND,
    client: "claude-code",
    nativeSessionId: SESSION,
    hostId: "supervision-host",
    origin: "supervisor",
    generation: 1,
    owner: { ownerToken: "turn-owner", reservedAt: at },
    boundAt: at,
    conflicts: []
  };
}

function recordOf(thread: TurnThread, seed: Seed): SupervisionRecord {
  const at = isoOf(thread.clock.ms) ?? "";
  const turn: SupervisionTurn = {
    generation: 1,
    mode: "resume",
    fingerprint: "reconcile-fingerprint",
    continuation: false,
    pid: seed.pid,
    startedAt: seed.startedAt,
    deadlineAt: seed.deadlineAt,
    runningAt: seed.runningAt
  };
  return {
    messageId: MESSAGE,
    messageAt: at,
    recipient: SECOND,
    stage: "planning",
    status: seed.status,
    createdAt: at,
    expiresAt: at,
    attempt: 1,
    runId: RUN,
    turn
  };
}
