import { hasPid, type ProcessTableRead } from "./process-table.js";
import { RESERVATION_TTL_MS } from "./session-state.js";
import type { AgentsSource, ClientProcess } from "./session-slots.js";

/**
 * What the sources prove about one turn process. alive: the same process. gone: the operating system shows
 * no such pid, or the agents list does and the table cannot be read. other: the pid runs another process.
 * unknown: this read cannot decide yet, so nothing is written or killed.
 */
export type ProcessView = "alive" | "gone" | "other" | "unknown";

/**
 * The presence grace of a process. A process younger than this may not be listed by the agents source yet,
 * so its absence from the list is not evidence of anything.
 */
export const PROCESS_GRACE_MS = RESERVATION_TTL_MS;

export type ProcessFacts = {
  pid: number;
  /** The start instant the agents source reported for the process, in epoch milliseconds, when it is known. */
  startedAt: number | undefined;
  /** The native session the binding names. It identifies the turn's process when no start instant is known. */
  sessionId: string | undefined;
  /** The instant the presence grace counts from: the start when known, else the instant the card went running. */
  since: number | undefined;
  /** The instant of the reading, in epoch milliseconds. */
  now: number;
  agents: AgentsSource;
  table: ProcessTableRead;
};

/** The ISO text of a start instant keeps milliseconds only, so two instants within one millisecond are one. */
export function sameStart(known: number, listed: number): boolean {
  return Math.abs(known - listed) < 1;
}

/**
 * Judges one turn process. The OS table proves death by absence of the pid. The agents list proves identity:
 * a listed pid is the turn's process when its start instant matches, or, with no start known, when its session
 * matches. A pid the table holds but the agents list does not is another process once the presence grace of
 * its start has ended, and not decided before. Without the agents source nothing is decided.
 */
export function judgeProcessView(facts: ProcessFacts): ProcessView {
  const { pid, table, agents } = facts;
  if (table.status === "available" && !hasPid(table.rows, pid)) return "gone";
  if (agents.status !== "available") return "unknown";
  const listed = agents.processes.find((process) => process.pid === pid);
  if (listed === undefined) return unlistedView(facts);
  return identityView(facts, listed);
}

export type SessionLookup =
  | { status: "found"; process: ClientProcess }
  | { status: "absent" }
  | { status: "ambiguous" }
  | { status: "unknown" };

/** The agents entry of a session. Two entries for one session are ambiguous, so none of them is chosen. */
export function lookupBySession(
  agents: AgentsSource,
  sessionId: string
): SessionLookup {
  if (agents.status !== "available") return { status: "unknown" };
  const matches = agents.processes.filter(
    (process) => process.sessionId === sessionId
  );
  return lookupOf(matches);
}

function lookupOf(matches: ClientProcess[]): SessionLookup {
  const [only] = matches;
  if (matches.length === 0) return { status: "absent" };
  if (matches.length > 1 || only === undefined) return { status: "ambiguous" };
  return { status: "found", process: only };
}

/**
 * A pid the table holds and the agents do not list. Inside the presence grace of its start it may still be
 * a fresh process that the list has not caught up with; after the grace it is another process.
 */
function unlistedView(facts: ProcessFacts): ProcessView {
  if (inPresenceGrace(facts)) return "unknown";
  return "other";
}

function inPresenceGrace(facts: ProcessFacts): boolean {
  if (facts.since === undefined) return false;
  return facts.now < facts.since + PROCESS_GRACE_MS;
}

function identityView(facts: ProcessFacts, listed: ClientProcess): ProcessView {
  if (facts.startedAt !== undefined) {
    return sameStart(facts.startedAt, listed.startedAt) ? "alive" : "other";
  }
  if (facts.sessionId === undefined) return "unknown";
  return listed.sessionId === facts.sessionId ? "alive" : "other";
}
