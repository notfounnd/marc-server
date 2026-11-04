import { timingSafeEqual } from "node:crypto";
import type {
  BindingOwner,
  HeartbeatInput,
  ObserveInput,
  ObserveResult,
  OwnerCall,
  RegistryFile,
  Refusal,
  SessionBinding,
  SlotKey
} from "../core/session-slots.js";
import type { ObservationPlan } from "./session-observation.js";

/**
 * Pure ownership transitions for sessions.json. The registry does the I/O and
 * the queue. These functions decide what a request changes and return the new
 * state, and they never read or write a file.
 */
const MAX_CONFLICTS = 20;
const NON_ADOPTING_ROLES = ["developer", "user"];

export type ActionContext = {
  file: RegistryFile;
  key: string;
  slot: SlotKey;
  current: SessionBinding | undefined;
  input: ObserveInput;
  now: string;
};

type Commit<T> = { result: T; file?: RegistryFile };

const ACTIONS: Record<
  ObservationPlan,
  (context: ActionContext) => Commit<ObserveResult>
> = {
  adopt: adoptAction,
  refresh: refreshAction,
  claim: claimAction,
  reconcile: reconcileAction,
  resume: resumeAction,
  conflict: conflictAction,
  unverified: () => ({ result: ignored("identity_unverified") }),
  stale: () => ({ result: ignored("stale_observation") })
};

export function observeRefusal(role: string | undefined): string | undefined {
  if (role === undefined) return "unregistered_profile";
  if (NON_ADOPTING_ROLES.includes(role)) return "non_adopting_role";
  return undefined;
}

export function commitObservation(
  plan: ObservationPlan,
  context: ActionContext
): Commit<ObserveResult> {
  return ACTIONS[plan](context);
}

function adoptAction(context: ActionContext): Commit<ObserveResult> {
  const generation = context.file.generation + 1;
  const { identity } = context.input;
  const binding: SessionBinding = {
    ...context.slot,
    client: "claude-code",
    nativeSessionId: identity.nativeSessionId,
    envSessionId: identity.envSessionId,
    hostId: identity.hostId,
    origin: "adopted",
    generation,
    owner: {
      clientPid: identity.clientPid,
      clientStartedAt: identity.clientStartedAt
    },
    boundAt: context.now,
    observedAt: context.input.observedAt,
    conflicts: []
  };
  return {
    result: { decision: "adopted", generation },
    file: withSlot({ ...context.file, generation }, context.key, binding)
  };
}

function refreshAction(context: ActionContext): Commit<ObserveResult> {
  const current = requireCurrent(context);
  const binding: SessionBinding = {
    ...current,
    envSessionId: context.input.identity.envSessionId ?? current.envSessionId,
    observedAt: context.input.observedAt
  };
  return {
    result: { decision: "refreshed", generation: current.generation },
    file: withSlot(context.file, context.key, binding)
  };
}

/** A reservation takes its client's instance; the owner token stays with the owner. */
function claimAction(context: ActionContext): Commit<ObserveResult> {
  const current = requireCurrent(context);
  const { identity } = context.input;
  const { reservedAt: _reserved, ...rest } = current.owner;
  const binding: SessionBinding = {
    ...current,
    owner: {
      ...rest,
      clientPid: identity.clientPid,
      clientStartedAt: identity.clientStartedAt
    },
    observedAt: context.input.observedAt
  };
  return {
    result: { decision: "claimed", generation: current.generation },
    file: withSlot(context.file, context.key, binding)
  };
}

/**
 * The same verified instance moved to a new session (/clear). The generation
 * and the owner token stay, so the owner keeps heartbeating. Only the native
 * session ID changes, and the previous one is kept for diagnosis.
 */
function reconcileAction(context: ActionContext): Commit<ObserveResult> {
  const current = requireCurrent(context);
  const { identity } = context.input;
  const binding: SessionBinding = {
    ...current,
    nativeSessionId: identity.nativeSessionId,
    envSessionId: identity.envSessionId,
    previousSessionId: current.nativeSessionId,
    sessionChangedAt: context.now,
    observedAt: context.input.observedAt
  };
  return {
    result: { decision: "reconciled", generation: current.generation },
    file: withSlot(context.file, context.key, binding)
  };
}

/**
 * The single process that carries the session takes the slot after its owner is proven gone. The
 * generation moves on and the owner is replaced, so the old marc open token is refused, and the
 * release and reservation fields are cleared. The conflict history is kept, and no entry is added.
 */
function resumeAction(context: ActionContext): Commit<ObserveResult> {
  const current = requireCurrent(context);
  const { identity } = context.input;
  const generation = context.file.generation + 1;
  const { endedAt: _ended, ...open } = current;
  const binding: SessionBinding = {
    ...open,
    envSessionId: identity.envSessionId ?? current.envSessionId,
    generation,
    owner: {
      clientPid: identity.clientPid,
      clientStartedAt: identity.clientStartedAt
    },
    observedAt: context.input.observedAt
  };
  return {
    result: { decision: "resumed", generation },
    file: withSlot({ ...context.file, generation }, context.key, binding)
  };
}

function conflictAction(context: ActionContext): Commit<ObserveResult> {
  const current = requireCurrent(context);
  const binding = recordConflictBinding(
    current,
    context.input.identity.nativeSessionId,
    context.now
  );
  return {
    result: { decision: "conflict_recorded", generation: current.generation },
    file: withSlot(context.file, context.key, binding)
  };
}

/** Plans other than adopt come only from an existing binding, so this is an invariant. */
function requireCurrent(context: ActionContext): SessionBinding {
  if (context.current) return context.current;
  throw new Error("Observation plan requires an existing binding.");
}

export function reserveBinding(
  file: RegistryFile,
  key: string,
  slot: SlotKey,
  reservation: {
    hostId: string;
    nativeSessionId: string;
    ownerToken: string;
    now: string;
  }
): { file: RegistryFile; generation: number } {
  const generation = file.generation + 1;
  const binding: SessionBinding = {
    ...slot,
    client: "claude-code",
    nativeSessionId: reservation.nativeSessionId,
    hostId: reservation.hostId,
    origin: "open",
    generation,
    owner: { ownerToken: reservation.ownerToken, reservedAt: reservation.now },
    boundAt: reservation.now,
    conflicts: []
  };
  return {
    file: withSlot({ ...file, generation }, key, binding),
    generation
  };
}

/** Owner check order: a released binding, then the token, then the generation. */
export function ownerRefusal(
  binding: SessionBinding,
  call: OwnerCall
): Refusal | undefined {
  if (binding.endedAt !== undefined) return refused("ended");
  if (!tokenMatches(binding.owner.ownerToken, call.ownerToken)) {
    return refused("not_owner");
  }
  if (binding.generation !== call.generation) {
    return refused("generation_mismatch", binding.generation);
  }
  return undefined;
}

export function heartbeatBinding(
  binding: SessionBinding,
  input: HeartbeatInput,
  now: string
): SessionBinding | Refusal {
  const owner = claimOwner(binding.owner, input);
  if (!owner) return refused("instance_mismatch");
  return { ...binding, owner: { ...owner, lastHeartbeatAt: now } };
}

/** Release ends the owner and keeps the binding and its generation for resume. */
export function releaseBinding(
  binding: SessionBinding,
  endedAt: string
): SessionBinding {
  const {
    ownerToken: _token,
    reservedAt: _reserved,
    lastHeartbeatAt: _beat,
    ...owner
  } = binding.owner;
  return { ...binding, owner, endedAt };
}

export function recordConflictBinding(
  binding: SessionBinding,
  sessionId: string,
  at: string
): SessionBinding {
  return {
    ...binding,
    conflicts: [...binding.conflicts, { sessionId, at }].slice(-MAX_CONFLICTS)
  };
}

export function withSlot(
  file: RegistryFile,
  key: string,
  binding: SessionBinding
): RegistryFile {
  return { ...file, slots: { ...file.slots, [key]: binding } };
}

export function refused(reason: string, currentGeneration?: number): Refusal {
  if (currentGeneration === undefined) return { decision: "refused", reason };
  return { decision: "refused", reason, currentGeneration };
}

export function ignored(reason: string): ObserveResult {
  return { decision: "ignored", reason };
}

/** A token holder can claim the instance only where none is known, or the same one. */
function claimOwner(
  owner: BindingOwner,
  input: HeartbeatInput
): BindingOwner | undefined {
  if (!agrees(owner.clientPid, input.clientPid)) return undefined;
  if (!agrees(owner.clientStartedAt, input.clientStartedAt)) return undefined;
  return {
    ...owner,
    clientPid: input.clientPid ?? owner.clientPid,
    clientStartedAt: input.clientStartedAt ?? owner.clientStartedAt
  };
}

function agrees<T>(known: T | undefined, claimed: T | undefined): boolean {
  return known === undefined || claimed === undefined || known === claimed;
}

function tokenMatches(expected: string | undefined, actual: string): boolean {
  if (expected === undefined) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
