/**
 * Derives a slot's state from its binding and the live sources. The rules are
 * evaluated in order and the first match decides. Nothing here does I/O. The
 * types live in session-slots.ts, which re-exports these functions. This module
 * imports types only, so it creates no runtime cycle.
 */
import type {
  BindingConflict,
  ClientProcess,
  PresenceSources,
  SessionBinding,
  SlotState,
  SlotStateName
} from "./session-slots.js";

export const RESERVATION_TTL_MS = 45_000;

type Outcome = { state: SlotStateName; reason: string };

type Facts = {
  binding: SessionBinding;
  sources: PresenceSources;
  agentsAvailable: boolean;
  sameHost: boolean;
  processes: ClientProcess[];
  sessionCount: number;
  instanceKnown: boolean;
  ownerProcess?: ClientProcess;
  resumed?: ClientProcess;
  ownerSession: boolean;
  pidCollision: boolean;
  reserved: boolean;
  reservationExpired: boolean;
  released: boolean;
  negativeProof: boolean;
  leaseAlive: boolean;
  hasConflicts: boolean;
  liveConflict: boolean;
};

type Rule = { when: (facts: Facts) => boolean; outcome: Outcome };

const OVERLAY_STATES: SlotStateName[] = ["online", "reserved"];

function outcome(state: SlotStateName, reason: string): Outcome {
  return { state, reason };
}

/**
 * Evaluated in order; the first match decides. Conflict and unknown outrank
 * online, so an incomplete source or an unproven identity never reads as online.
 * A live reservation is reserved, even while its client's process is listed
 * but not yet claimed (the claude process of a marc open that is starting).
 * Absence needs negativeProof: the agents source is available on this host, no
 * process carries the session, and no process carries the owner's pid. A binding
 * without a verified startedAt is absent only as an expired reservation (an
 * ownerToken, rule above) or as a released binding, whose own release is the proof.
 * A live MCP lease for the same session on the same host is a positive signal
 * that the listing does not show, so it blocks the absence proof. A resumed
 * session is the exception that the listing itself proves: the owner instance is
 * absent and exactly one listed process carries the session with a verified
 * startedAt. That process is the new owner (session_resumed), and two processes
 * carrying the session still conflict first.
 */
const STATE_RULES: Rule[] = [
  { when: (f) => !f.sameHost, outcome: outcome("unknown", "other_host") },
  {
    when: (f) => !f.agentsAvailable,
    outcome: outcome("unknown", "agents_unavailable")
  },
  {
    when: (f) => f.sessionCount > 1,
    outcome: outcome("conflict", "two_processes")
  },
  {
    when: (f) => f.reserved && !f.reservationExpired,
    outcome: outcome("reserved", "reservation_active")
  },
  { when: (f) => f.ownerSession, outcome: outcome("online", "owner_listed") },
  {
    when: (f) => f.ownerProcess !== undefined,
    outcome: outcome("unknown", "session_changed")
  },
  {
    when: (f) => f.resumed !== undefined,
    outcome: outcome("online", "session_resumed")
  },
  {
    when: (f) => f.sessionCount === 1,
    outcome: outcome("unknown", "identity_unproven")
  },
  {
    when: (f) => f.leaseAlive,
    outcome: outcome("unknown", "lease_alive_unlisted")
  },
  {
    when: (f) => f.reserved && f.negativeProof,
    outcome: outcome("ended", "reservation_expired")
  },
  {
    when: (f) => f.reserved,
    outcome: outcome("unknown", "reservation_unproven")
  },
  {
    when: (f) => f.released && f.negativeProof,
    outcome: outcome("ended", "released")
  },
  {
    when: (f) => f.released,
    outcome: outcome("unknown", "released_unproven")
  },
  {
    when: (f) => f.instanceKnown && f.negativeProof,
    outcome: outcome("ended", "owner_absent")
  },
  { when: () => true, outcome: outcome("unknown", "no_proof") }
];

export function deriveSlotState(
  binding: SessionBinding | undefined,
  sources: PresenceSources,
  now: number
): SlotState {
  if (!binding) {
    return {
      state: "unbound",
      details: {
        busy: false,
        listening: false,
        reason: "no_binding",
        pastConflict: false
      }
    };
  }

  const facts = buildFacts(binding, sources, now);
  const rule = STATE_RULES.find((candidate) => candidate.when(facts));
  const result = applyConflictOverlay(
    rule?.outcome ?? outcome("unknown", "no_proof"),
    facts
  );
  const active = facts.ownerProcess ?? facts.resumed;
  const resumedBy =
    result.reason === "session_resumed" ? facts.resumed : undefined;
  return {
    state: result.state,
    details: {
      busy: result.state === "online" && active?.status === "busy",
      listening: sources.listening,
      reason: result.reason,
      pastConflict: facts.hasConflicts && !facts.liveConflict
    },
    ...(resumedBy ? { resumedBy } : {})
  };
}

/** Free means the slot may be adopted or acquired. Nothing unproven is free. */
export function isFreeState(state: SlotStateName): boolean {
  return state === "unbound" || state === "ended";
}

function buildFacts(
  binding: SessionBinding,
  sources: PresenceSources,
  now: number
): Facts {
  const agentsAvailable = sources.agents.status === "available";
  const processes =
    sources.agents.status === "available" ? sources.agents.processes : [];
  const owner = binding.owner;
  const instanceKnown =
    owner.clientPid !== undefined && owner.clientStartedAt !== undefined;
  const ownerProcess = instanceKnown
    ? processes.find(
        (entry) =>
          entry.pid === owner.clientPid &&
          entry.startedAt === owner.clientStartedAt
      )
    : undefined;
  const reserved =
    owner.ownerToken !== undefined &&
    owner.clientStartedAt === undefined &&
    binding.endedAt === undefined;
  const stamp = owner.lastHeartbeatAt ?? owner.reservedAt;
  const sessionCount = processes.filter(
    (entry) => entry.sessionId === binding.nativeSessionId
  ).length;
  const pidCollision =
    owner.clientPid !== undefined &&
    !instanceKnown &&
    processes.some((entry) => entry.pid === owner.clientPid);
  const sameHost = binding.hostId === sources.hostId;
  const leaseAlive = sources.mcpLeases.some(
    (lease) =>
      lease.nativeSessionId === binding.nativeSessionId &&
      lease.hostId === sources.hostId
  );
  const resumed = resumedProcessOf(
    binding.nativeSessionId,
    processes,
    instanceKnown && ownerProcess === undefined
  );
  const liveConflict = liveConflictOf(binding.conflicts, processes, [
    ownerProcess,
    resumed
  ]);
  return {
    binding,
    sources,
    agentsAvailable,
    sameHost,
    processes,
    sessionCount,
    instanceKnown,
    ownerProcess,
    resumed,
    ownerSession:
      ownerProcess !== undefined &&
      ownerProcess.sessionId === binding.nativeSessionId,
    pidCollision,
    reserved,
    reservationExpired:
      stamp !== undefined && now - Date.parse(stamp) > RESERVATION_TTL_MS,
    released: binding.endedAt !== undefined,
    negativeProof:
      agentsAvailable &&
      sameHost &&
      sessionCount === 0 &&
      ownerProcess === undefined &&
      !pidCollision &&
      !leaseAlive,
    leaseAlive,
    hasConflicts: binding.conflicts.length > 0,
    liveConflict
  };
}

/**
 * The one process that carries the session, when the owner instance is provably
 * absent and that process has a verified startedAt. Two processes, or a process
 * without a startedAt, yield nothing and keep the stricter rules below.
 */
function resumedProcessOf(
  sessionId: string,
  processes: ClientProcess[],
  ownerAbsent: boolean
): ClientProcess | undefined {
  if (!ownerAbsent) return undefined;
  const carrying = processes.filter((entry) => entry.sessionId === sessionId);
  if (carrying.length !== 1) return undefined;
  const [only] = carrying;
  if (typeof only.startedAt !== "number") return undefined;
  return only;
}

/**
 * The one decision on recorded conflicts, shared by the overlay and the resume candidate. A
 * recorded conflict is live only while a listed process that is neither the owner nor the resumed
 * candidate carries its session. The candidate is the bound session coming back, so a conflict
 * recorded against that same session is history, not a live rival.
 */
function liveConflictOf(
  conflicts: BindingConflict[],
  processes: ClientProcess[],
  exempt: Array<ClientProcess | undefined>
): boolean {
  return conflicts.some((conflict) =>
    processes.some(
      (entry) =>
        entry.sessionId === conflict.sessionId && !exempt.includes(entry)
    )
  );
}

/**
 * A recorded conflict overrides online or reserved only while its session is
 * still listed, as a process other than the owner and the resumed candidate.
 * Otherwise the state stays, and the history remains in the binding as past_conflict.
 */
function applyConflictOverlay(result: Outcome, facts: Facts): Outcome {
  if (!OVERLAY_STATES.includes(result.state)) return result;
  if (!facts.liveConflict) return result;
  return outcome("conflict", "recorded_conflict");
}
