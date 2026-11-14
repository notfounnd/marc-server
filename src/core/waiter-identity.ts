import { ancestorsOf, type ProcessTableRead } from "./process-table.js";
import type {
  AgentsSource,
  ClientProcess,
  SessionBinding
} from "./session-slots.js";

/** The facts a waiter's identity is judged on. Each one is read inside the thread's queue step. */
export type WaiterFacts = {
  /** The waiter's own pid, sent with the reservation. */
  pid: number | undefined;
  /** The waiter's session, which must be the native session of the slot's binding. */
  holder: string;
  binding: SessionBinding | undefined;
  table: ProcessTableRead;
  agents: AgentsSource;
  /**
   * The process that resumed the holder's session, when the slot reads session_resumed for it. The client is
   * judged on this process instead of the recorded owner, which the resume has left behind.
   */
  resumedBy?: { pid: number; startedAt: number };
};

/** The codes of the identity table, in the order the table checks them. `verified` means every check passed. */
export const IDENTITY_CHECKS = [
  "no_pid",
  "no_binding",
  "session_mismatch",
  "no_client_pid",
  "process_table_unavailable",
  "not_descendant",
  "agents_unavailable",
  "start_mismatch",
  "verified"
] as const;

export type IdentityCheck = (typeof IDENTITY_CHECKS)[number];

type FailedCheck = Exclude<IdentityCheck, "verified">;

/** One row of the table: the code it names and the facts that make it fail. */
type CheckRow = { code: FailedCheck; fails: (facts: WaiterFacts) => boolean };

/**
 * The identity table. A row runs only after the rows above it passed, so a later row may rely on the
 * facts an earlier one checked. Any missing fact fails closed.
 */
const CHECKS: readonly CheckRow[] = [
  { code: "no_pid", fails: (facts) => facts.pid === undefined },
  { code: "no_binding", fails: (facts) => facts.binding === undefined },
  {
    code: "session_mismatch",
    fails: (facts) => facts.binding?.nativeSessionId !== facts.holder
  },
  { code: "no_client_pid", fails: (facts) => clientPidOf(facts) === undefined },
  {
    code: "process_table_unavailable",
    fails: (facts) => facts.table.status !== "available"
  },
  { code: "not_descendant", fails: (facts) => !descendsFromClient(facts) },
  {
    code: "agents_unavailable",
    fails: (facts) =>
      recordedStartOf(facts) !== undefined &&
      facts.agents.status !== "available"
  },
  {
    code: "start_mismatch",
    fails: (facts) =>
      recordedStartOf(facts) !== undefined &&
      listedStartOf(facts) !== recordedStartOf(facts)
  }
];

/**
 * The first check that fails, or `verified` when every row passes. The waiter must descend from the
 * client that owns the slot, or from the process that resumed it, within the climb limit, and that
 * client's start must match the one recorded.
 */
export function waiterIdentityCheck(facts: WaiterFacts): IdentityCheck {
  for (const row of CHECKS) {
    if (row.fails(facts)) return row.code;
  }
  return "verified";
}

/** True only when every check passes. */
export function waiterIdentityVerified(facts: WaiterFacts): boolean {
  return waiterIdentityCheck(facts) === "verified";
}

/** The client the waiter must descend from: the process that resumed the session, else the recorded owner. */
function clientPidOf(facts: WaiterFacts): number | undefined {
  return facts.resumedBy?.pid ?? facts.binding?.owner.clientPid;
}

function recordedStartOf(facts: WaiterFacts): number | undefined {
  return facts.resumedBy?.startedAt ?? facts.binding?.owner.clientStartedAt;
}

/** The waiter's pid sits under the client's pid within the climb limit, in a readable table. */
function descendsFromClient(facts: WaiterFacts): boolean {
  const clientPid = clientPidOf(facts);
  if (facts.pid === undefined || clientPid === undefined) return false;
  if (facts.table.status !== "available") return false;
  return ancestorsOf(facts.table.rows, facts.pid).includes(clientPid);
}

/** The start instant the agents source lists for the client, when that source is readable and lists it. */
function listedStartOf(facts: WaiterFacts): number | undefined {
  if (facts.agents.status !== "available") return undefined;
  const clientPid = clientPidOf(facts);
  return facts.agents.processes.find(
    (process: ClientProcess) => process.pid === clientPid
  )?.startedAt;
}
