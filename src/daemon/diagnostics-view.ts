import type { ProcessTableRead } from "../core/process-table.js";
import type { ReservationRecord } from "../core/activation-reservation-types.js";
import type {
  SupervisionOutcome,
  SupervisionRecord,
  SupervisionTurn
} from "../core/activation-supervision-types.js";
import {
  type AgentsSource,
  type BindingConflict,
  type ClientProcess,
  type SessionBinding,
  type SlotDetails,
  type SlotState,
  type SlotStateName
} from "../core/session-slots.js";
import type { WorkspaceInfo } from "../core/types.js";
import { processesOf } from "./process-table-os.js";
import { probeFor, type SessionServices } from "./session-views.js";
import type { ThreadFile, ThreadScope, ThreadStore } from "./thread-store.js";

/** The status of one source the view reads. Its rows never leave the daemon. */
export type SourceStatus =
  | { status: "available" }
  | { status: "unavailable"; reason: string };

export type DiagnosticsRegistry =
  | { status: "ready" }
  | { status: "invalid"; reason: string };

/** The binding as the slot records it. The owner token is never copied. */
export type BindingDiagnostic = {
  origin: SessionBinding["origin"];
  generation: number;
  nativeSessionId: string;
  envSessionId?: string;
  previousSessionId?: string;
  hostId: string;
  clientPid?: number;
  clientStartedAt?: number;
  lastHeartbeatAt?: string;
  boundAt: string;
  observedAt?: string;
  endedAt?: string;
  conflicts: ConflictDiagnostic[];
};

/** A recorded conflict as the view shows it: the session it named and when. */
export type ConflictDiagnostic = Pick<BindingConflict, "sessionId" | "at">;

/** An inventory process that the binding links by its session or its client pid. */
export type ProcessDiagnostic = {
  pid: number;
  startedAt: number;
  sessionId: string;
  status: string;
};

/** The derived details of a slot, listed field by field. */
export type SlotDetailsDiagnostic = Pick<
  SlotDetails,
  "busy" | "listening" | "reason" | "pastConflict"
>;

export type SlotDiagnostic = {
  profile: string;
  binding: BindingDiagnostic;
  state: { state: SlotStateName; details: SlotDetailsDiagnostic };
  processes: ProcessDiagnostic[];
};

/** A reservation as the thread state keeps it. Its run ids never leave the daemon. */
export type ReservationDiagnostic = {
  messageId: string;
  recipient: string;
  author: string;
  origin: ReservationRecord["origin"];
  holder: string;
  stage: ReservationRecord["stage"];
  status: ReservationRecord["status"];
  reason?: string;
  identityCheck?: ReservationRecord["identityCheck"];
  granted: boolean;
  attempts: number;
  cycle?: number;
  cycleRole: ReservationRecord["cycleRole"];
  cycleState?: ReservationRecord["cycleState"];
  revision?: string;
  messageAt: string;
  answeredBy?: string;
};

/** A supervision card. Its run id never leaves the daemon. */
export type CardDiagnostic = {
  messageId: string;
  messageAt: string;
  recipient: string;
  stage: SupervisionRecord["stage"];
  status: SupervisionRecord["status"];
  reason?: string;
  createdAt: string;
  expiresAt: string;
  attempt: number;
  turn?: Pick<SupervisionTurn, "mode" | "pid" | "startedAt" | "deadlineAt">;
  outcome?: OutcomeDiagnostic;
};

/** The turn outcome as the view shows it: the permission denials and the failure code. The cost stays out. */
export type OutcomeDiagnostic = Pick<SupervisionOutcome, "denials" | "failure">;

export type ThreadDiagnostics = {
  generatedAt: string;
  hostId: string;
  registry: DiagnosticsRegistry;
  sources: { agents: SourceStatus; processes: SourceStatus };
  slots: SlotDiagnostic[];
  reservations: ReservationDiagnostic[];
  supervision: CardDiagnostic[];
};

export type DiagnosticsInput = {
  workspace: WorkspaceInfo;
  threadId: string;
  threads: ThreadStore;
  sessions: SessionServices;
};

/**
 * The diagnostic view of one thread, built field by field, so a field added later never leaves by accident.
 * The read is outside the thread's queue and writes nothing. An unreadable state answers with its reason and
 * no slots or records, and the sources still report.
 */
export async function buildThreadDiagnostics(
  input: DiagnosticsInput
): Promise<ThreadDiagnostics> {
  const scope: ThreadScope = {
    workspaceId: input.workspace.id,
    threadId: input.threadId
  };
  const view = await input.threads.read(scope);
  const agents = await input.sessions.presence.agents();
  const table = await processesOf(input.sessions.processes).list();
  const base = {
    generatedAt: new Date(input.sessions.presence.now()).toISOString(),
    hostId: input.sessions.presence.hostId,
    sources: { agents: sourceOf(agents), processes: sourceOf(table) }
  };
  if (view.status === "invalid") {
    return {
      ...base,
      registry: { status: "invalid", reason: view.reason },
      slots: [],
      reservations: [],
      supervision: []
    };
  }
  return {
    ...base,
    registry: { status: "ready" },
    slots: await slotsOf(input, view.file, agents),
    reservations: (view.file.reservations ?? []).map(reservationOf),
    supervision: (view.file.supervision?.records ?? []).map(cardOf)
  };
}

function sourceOf(read: AgentsSource | ProcessTableRead): SourceStatus {
  if (read.status === "available") return { status: "available" };
  return { status: "unavailable", reason: read.reason };
}

/** One slot per binding, sorted by profile. The derived state is read through the same probe the views use. */
async function slotsOf(
  input: DiagnosticsInput,
  file: ThreadFile,
  agents: AgentsSource
): Promise<SlotDiagnostic[]> {
  const probe = probeFor(input.sessions, input.workspace);
  const slots = await Promise.all(
    Object.values(file.slots).map(async (binding) => ({
      profile: binding.profile,
      binding: bindingOf(binding),
      state: stateViewOf(await probe(binding)),
      processes: inventoryOf(binding, agents)
    }))
  );
  return slots.sort((left, right) => left.profile.localeCompare(right.profile));
}

function bindingOf(binding: SessionBinding): BindingDiagnostic {
  return {
    origin: binding.origin,
    generation: binding.generation,
    nativeSessionId: binding.nativeSessionId,
    envSessionId: binding.envSessionId,
    previousSessionId: binding.previousSessionId,
    hostId: binding.hostId,
    clientPid: binding.owner.clientPid,
    clientStartedAt: binding.owner.clientStartedAt,
    lastHeartbeatAt: binding.owner.lastHeartbeatAt,
    boundAt: binding.boundAt,
    observedAt: binding.observedAt,
    endedAt: binding.endedAt,
    conflicts: binding.conflicts.map(conflictOf)
  };
}

/** The derived state, with its details listed field by field. */
export function stateViewOf(state: SlotState): SlotDiagnostic["state"] {
  return { state: state.state, details: detailsOf(state.details) };
}

function detailsOf(details: SlotDetails): SlotDetailsDiagnostic {
  return {
    busy: details.busy,
    listening: details.listening,
    reason: details.reason,
    pastConflict: details.pastConflict
  };
}

function conflictOf(conflict: BindingConflict): ConflictDiagnostic {
  return { sessionId: conflict.sessionId, at: conflict.at };
}

/** The inventory processes that the binding links. Every other process of the machine stays out. */
function inventoryOf(
  binding: SessionBinding,
  agents: AgentsSource
): ProcessDiagnostic[] {
  if (agents.status !== "available") return [];
  return agents.processes
    .filter((item) => linksTo(binding, item))
    .map(processOf);
}

function linksTo(binding: SessionBinding, item: ClientProcess): boolean {
  return (
    item.sessionId === binding.nativeSessionId ||
    item.pid === binding.owner.clientPid
  );
}

function processOf(item: ClientProcess): ProcessDiagnostic {
  return {
    pid: item.pid,
    startedAt: item.startedAt,
    sessionId: item.sessionId,
    status: item.status
  };
}

function reservationOf(record: ReservationRecord): ReservationDiagnostic {
  return {
    messageId: record.messageId,
    recipient: record.recipient,
    author: record.author,
    origin: record.origin,
    holder: record.holder,
    stage: record.stage,
    status: record.status,
    reason: record.reason,
    identityCheck: record.identityCheck,
    granted: record.granted,
    attempts: record.attempts,
    cycle: record.cycle,
    cycleRole: record.cycleRole,
    cycleState: record.cycleState,
    revision: record.revision,
    messageAt: record.messageAt,
    answeredBy: record.answeredBy
  };
}

function cardOf(record: SupervisionRecord): CardDiagnostic {
  return {
    messageId: record.messageId,
    messageAt: record.messageAt,
    recipient: record.recipient,
    stage: record.stage,
    status: record.status,
    reason: record.reason,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    attempt: record.attempt,
    turn: turnOf(record.turn),
    outcome: outcomeOf(record.outcome)
  };
}

function outcomeOf(
  outcome: SupervisionOutcome | undefined
): OutcomeDiagnostic | undefined {
  if (outcome === undefined) return undefined;
  return { denials: outcome.denials, failure: outcome.failure };
}

function turnOf(
  turn: SupervisionRecord["turn"]
): CardDiagnostic["turn"] | undefined {
  if (turn === undefined) return undefined;
  return {
    mode: turn.mode,
    pid: turn.pid,
    startedAt: turn.startedAt,
    deadlineAt: turn.deadlineAt
  };
}
