import type {
  ProcessTableRead,
  ProcessRow
} from "../src/core/process-table.js";
import type {
  AgentsSource,
  SessionBinding
} from "../src/core/session-slots.js";

export const CLIENT = 100;
export const WAITER = 300;
export const HOLDER = "session-waiter";

/** A binding that names the holder's session and a client with the given pid, and start when one is given. */
export function bindingOf(owner: {
  clientPid?: number;
  clientStartedAt?: number;
}): SessionBinding {
  return {
    workspaceId: "ws",
    threadId: "thread",
    profile: "claude-software-architect",
    client: "claude-code",
    nativeSessionId: HOLDER,
    hostId: "host",
    origin: "open",
    generation: 1,
    owner: { ...owner, ownerToken: "token" },
    boundAt: "2026-11-11T00:00:00.000Z",
    conflicts: []
  };
}

/** The waiter, its parent chain to the client, and the table of a machine where nothing else runs. */
export const CHAIN_TABLE: ProcessTableRead = {
  status: "available",
  rows: [
    { pid: WAITER, ppid: 200 },
    { pid: 200, ppid: CLIENT },
    { pid: CLIENT, ppid: 1 }
  ]
};

/** The agents list the client is in, with the start instant the binding is verified against. */
export const LISTED_CLIENT: AgentsSource = {
  status: "available",
  processes: [
    { pid: CLIENT, startedAt: 1000, sessionId: HOLDER, status: "idle" }
  ]
};

/** The agents list after the client restarted: the same pid with a later start. */
export const STALE_CLIENT: AgentsSource = {
  status: "available",
  processes: [
    { pid: CLIENT, startedAt: 2000, sessionId: HOLDER, status: "idle" }
  ]
};

/** A chain of processes where the client is the given level above the waiter. */
export function deepChain(level: number): ProcessRow[] {
  return Array.from({ length: level + 1 }, (_, index) => ({
    pid: 1000 - index,
    ppid: 1000 - index - 1
  }));
}
