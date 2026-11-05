import { ancestorsOf, type ProcessTableRead } from "./process-table.js";
import type { AgentsSource, SessionBinding } from "./session-slots.js";

/** The facts a waiter's identity is judged on. Each one is read inside the thread's queue step. */
export type WaiterFacts = {
  /** The waiter's own pid, sent with the reservation. */
  pid: number | undefined;
  /** The waiter's session, which must be the native session of the slot's binding. */
  holder: string;
  binding: SessionBinding | undefined;
  table: ProcessTableRead;
  agents: AgentsSource;
};

/**
 * True when the waiter descends from the client that owns the slot, within the climb limit, and the
 * client's start instant matches the one the binding recorded. Any missing fact fails closed.
 */
export function waiterIdentityVerified(facts: WaiterFacts): boolean {
  const { pid, binding, holder, table } = facts;
  if (pid === undefined || binding === undefined) return false;
  if (binding.nativeSessionId !== holder) return false;
  const clientPid = binding.owner.clientPid;
  if (clientPid === undefined) return false;
  if (table.status !== "available") return false;
  if (!ancestorsOf(table.rows, pid).includes(clientPid)) return false;
  return startMatches(binding.owner.clientStartedAt, facts.agents, clientPid);
}

/** A binding without a recorded start asks nothing more; one with a start needs the agents to agree. */
function startMatches(
  recorded: number | undefined,
  agents: AgentsSource,
  clientPid: number
): boolean {
  if (recorded === undefined) return true;
  if (agents.status !== "available") return false;
  const listed = agents.processes.find((process) => process.pid === clientPid);
  return listed !== undefined && listed.startedAt === recorded;
}
