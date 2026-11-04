/**
 * Slot model for the daemon. The binding in sessions.json is the local
 * authority that links a thread and a profile to a native session. Presence
 * and state are derived from it and from live sources. The types and the key
 * live here; the state derivation lives in session-state.ts and is re-exported.
 * Nothing here does I/O.
 */

export {
  RESERVATION_TTL_MS,
  deriveSlotState,
  isFreeState
} from "./session-state.js";

export type SlotKey = {
  workspaceId: string;
  threadId: string;
  profile: string;
};

export type BindingOrigin = "open" | "adopted";

/** A reservation holds an ownerToken and no clientStartedAt; a heartbeat may already carry clientPid. */
export type BindingOwner = {
  clientPid?: number;
  clientStartedAt?: number;
  ownerToken?: string;
  reservedAt?: string;
  lastHeartbeatAt?: string;
};

export type BindingConflict = {
  sessionId: string;
  at: string;
};

export type SessionBinding = {
  workspaceId: string;
  threadId: string;
  profile: string;
  client: "claude-code";
  nativeSessionId: string;
  envSessionId?: string;
  previousSessionId?: string;
  sessionChangedAt?: string;
  hostId: string;
  origin: BindingOrigin;
  generation: number;
  owner: BindingOwner;
  boundAt: string;
  observedAt?: string;
  endedAt?: string;
  conflicts: BindingConflict[];
};

export type RegistryFile = {
  version: 1;
  generation: number;
  slots: Record<string, SessionBinding>;
};

/**
 * One entry per Claude Code session the user has on this host, interactive or
 * background, from `claude agents --json` (no --all, no folder filter). Entries
 * without a pid are not live processes and are dropped by the reader. An entry
 * with a pid that does not validate makes the whole source unavailable.
 */
export type ClientProcess = {
  pid: number;
  startedAt: number;
  sessionId: string;
  status: string;
};

export type AgentsSource =
  | { status: "available"; processes: ClientProcess[] }
  | { status: "unavailable"; reason: string };

export type McpLeaseSource = {
  nativeSessionId: string;
  pid: number;
  hostId: string;
};

export type PresenceSources = {
  hostId: string;
  agents: AgentsSource;
  mcpLeases: McpLeaseSource[];
  listening: boolean;
};

export type SlotStateName =
  | "unbound"
  | "online"
  | "reserved"
  | "ended"
  | "unknown"
  | "conflict";

/** pastConflict is true when a recorded conflict no longer has a live session behind it. */
export type SlotDetails = {
  busy: boolean;
  listening: boolean;
  reason: string;
  pastConflict: boolean;
};

/**
 * resumedBy is set only for session_resumed: the single listed process that took the
 * bound session over from an owner that is provably gone. Observation matches it by
 * pid, startedAt and session, so a different verified instance cannot take the slot.
 */
export type SlotState = {
  state: SlotStateName;
  details: SlotDetails;
  resumedBy?: ClientProcess;
};

/** Request and result shapes of slot operations: observe, acquire and owner calls. */
export type Refusal = {
  decision: "refused";
  reason: string;
  currentGeneration?: number;
};

export type ObservedClient = {
  nativeSessionId: string;
  envSessionId?: string;
  clientPid: number;
  clientStartedAt?: number;
  hostId: string;
};

export type ObserveInput = {
  slot: SlotKey;
  role: string | undefined;
  observedAt: string;
  identity: ObservedClient;
};

export type ObserveResult =
  | { decision: "ignored"; reason: string }
  | {
      decision:
        | "adopted"
        | "refreshed"
        | "claimed"
        | "reconciled"
        | "resumed"
        | "conflict_recorded";
      generation: number;
    };

export type OwnerCall = {
  slot: SlotKey;
  generation: number;
  ownerToken: string;
};

export type HeartbeatInput = OwnerCall & {
  clientPid?: number;
  clientStartedAt?: number;
};

export type OwnerResult =
  | { decision: "renewed" | "released" | "recorded" }
  | Refusal;

export function slotKey(slot: SlotKey): string {
  return `${slot.workspaceId}:${slot.threadId}:${slot.profile}`;
}
