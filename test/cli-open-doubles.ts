import type {
  AcquireRequest,
  DaemonClient,
  DaemonReply,
  LaunchedChild,
  OwnerRef,
  SessionSignals,
  SessionTimers
} from "../src/cli-open-session.js";

/**
 * Test doubles for marc open: a scripted daemon client, a child whose events the test emits, and
 * timers and signals that record what the command did. None of them starts a process or I/O.
 */

export const RENEWED: DaemonReply = {
  status: 200,
  body: { decision: "renewed" }
};

export const RELEASED: DaemonReply = {
  status: 200,
  body: { decision: "released" }
};

export function refused(reason: string): DaemonReply {
  return { status: 409, body: { decision: "refused", reason } };
}

export const STATUS_OK: DaemonReply = {
  status: 200,
  body: { status: "running" }
};

export type ClientReplies = {
  sessions: DaemonReply;
  acquire?: DaemonReply;
  release?: DaemonReply;
  heartbeats?: DaemonReply[];
  status?: DaemonReply;
};

export type Call = { method: string; body?: unknown };

/** `probes` counts the status calls that prove the token; they are kept apart from `calls`. */
export type FakeClient = DaemonClient & { calls: Call[]; probes: string[] };

/** Scripted replies. Heartbeats are consumed in order; the default list is long enough for any test. */
export function fakeClient({
  sessions,
  acquire = refused("not_scripted"),
  release = RELEASED,
  heartbeats = [RENEWED, RENEWED, RENEWED, RENEWED, RENEWED, RENEWED],
  status = STATUS_OK
}: ClientReplies): FakeClient {
  const calls: Call[] = [];
  const probes: string[] = [];
  const queue = [...heartbeats];
  return {
    calls,
    probes,
    status: async () => {
      probes.push("status");
      return status;
    },
    sessions: async (workspaceId, threadId) => {
      calls.push({ method: "sessions", body: { workspaceId, threadId } });
      return sessions;
    },
    acquire: async (body: AcquireRequest) => {
      calls.push({ method: "acquire", body });
      return acquire;
    },
    heartbeat: async (body: OwnerRef & { clientPid?: number }) => {
      calls.push({ method: "heartbeat", body });
      return queue.shift() as DaemonReply;
    },
    release: async (body: OwnerRef) => {
      calls.push({ method: "release", body });
      return release;
    }
  };
}

/** A client whose every call fails at the transport level, as a stopped daemon does. */
export function unreachableClient(): FakeClient {
  const fail = async (): Promise<DaemonReply> => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:4187");
  };
  return {
    calls: [],
    probes: [],
    status: fail,
    sessions: fail,
    acquire: fail,
    heartbeat: fail,
    release: fail
  };
}

/** A child whose events the test emits in order: spawn, then exit or error. */
export class FakeChild implements LaunchedChild {
  readonly pid: number | undefined;
  private spawnListeners: Array<() => void> = [];
  private exitListeners: Array<(code: number | null) => void> = [];
  private errorListeners: Array<(error: NodeJS.ErrnoException) => void> = [];

  constructor(pid: number | undefined) {
    this.pid = pid;
  }

  onSpawn(listener: () => void): void {
    this.spawnListeners.push(listener);
  }

  onExit(listener: (code: number | null) => void): void {
    this.exitListeners.push(listener);
  }

  onError(listener: (error: NodeJS.ErrnoException) => void): void {
    this.errorListeners.push(listener);
  }

  emitSpawn(): void {
    this.spawnListeners.forEach((listener) => listener());
  }

  emitExit(code: number | null): void {
    this.exitListeners.forEach((listener) => listener(code));
  }

  emitError(code: string): void {
    const error = Object.assign(new Error(`spawn ${code}`), { code });
    this.errorListeners.forEach((listener) => listener(error));
  }
}

export class FakeTimers implements SessionTimers {
  readonly intervals: Array<{
    callback: () => void;
    ms: number;
    cleared: boolean;
  }> = [];

  setInterval(callback: () => void, ms: number): unknown {
    const handle = { callback, ms, cleared: false };
    this.intervals.push(handle);
    return handle;
  }

  clearInterval(handle: unknown): void {
    Object.assign(handle as object, { cleared: true });
  }

  /** Fires every interval that is still running. */
  tick(): void {
    this.intervals
      .filter((interval) => !interval.cleared)
      .forEach((interval) => interval.callback());
  }
}

export class FakeSignals implements SessionSignals {
  readonly listeners = new Map<string, Set<() => void>>();

  on(signal: NodeJS.Signals, listener: () => void): void {
    const set = this.listeners.get(signal) ?? new Set<() => void>();
    set.add(listener);
    this.listeners.set(signal, set);
  }

  off(signal: NodeJS.Signals, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }

  /** The signals that still have a listener. */
  active(): string[] {
    return [...this.listeners.entries()]
      .filter(([, set]) => set.size > 0)
      .map(([signal]) => signal)
      .sort();
  }
}
