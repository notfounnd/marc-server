import {
  isFreeState,
  type BindingOwner,
  type ClientProcess,
  type ObservedClient,
  type ObserveInput,
  type SessionBinding,
  type SlotState
} from "../core/session-slots.js";

/**
 * Plans what an observation does to a slot, from its binding and the derived state. The plan is
 * pure: session-transitions.ts applies it to the registry file. It is split out so each module
 * stays within the max-lines rule.
 */
export type ObservationPlan =
  | "adopt"
  | "refresh"
  | "claim"
  | "reconcile"
  | "resume"
  | "conflict"
  | "unverified"
  | "stale";

/** What the derived state says about the slot: free for adoption, and whether this observation resumes it. */
export type ObservationView = { free: boolean; resumes: boolean };

/**
 * Adoption needs a verified identity: the start time was found in the agents source. An unverified
 * observation writes nothing on a free slot. Against an active owner it can only record a conflict,
 * and only when its session differs. Older observations never replace newer state. The single
 * process that the derived state resumed takes the slot, and nothing else does.
 */
export function planObservation(
  current: SessionBinding | undefined,
  input: ObserveInput,
  view: ObservationView
): ObservationPlan {
  const verified = input.identity.clientStartedAt !== undefined;
  if (!current) return verified ? "adopt" : "unverified";
  const latest = Date.parse(current.observedAt ?? current.boundAt);
  if (Date.parse(input.observedAt) < latest) return "stale";
  if (view.resumes) return "resume";
  if (view.free) return verified ? "adopt" : "unverified";
  return classifyActive(current, input.identity);
}

/** The observation view comes from the same derivation the GET view uses; no state means no resume. */
export function observationView(
  state: SlotState | undefined,
  identity: ObservedClient
): ObservationView {
  if (!state) return { free: false, resumes: false };
  return {
    free: isFreeState(state.state),
    resumes: resumesOwner(state.resumedBy, identity)
  };
}

/** Same pid, startedAt and session as the resumed process: the observer is that process. */
function resumesOwner(
  resumed: ClientProcess | undefined,
  identity: ObservedClient
): boolean {
  if (!resumed) return false;
  return (
    resumed.pid === identity.clientPid &&
    resumed.startedAt === identity.clientStartedAt &&
    resumed.sessionId === identity.nativeSessionId
  );
}

/** Same owner means the verified instance: same pid and startedAt, not only the same UUID. */
function classifyActive(
  binding: SessionBinding,
  identity: ObserveInput["identity"]
): ObservationPlan {
  const verified = identity.clientStartedAt !== undefined;
  const sameSession = binding.nativeSessionId === identity.nativeSessionId;
  if (verified && sameInstance(binding.owner, identity)) {
    return sameSession ? "refresh" : "reconcile";
  }
  if (!verified) return sameSession ? "unverified" : "conflict";
  const owner = binding.owner;
  const instanceOpen =
    owner.clientStartedAt === undefined &&
    (owner.clientPid === undefined || owner.clientPid === identity.clientPid);
  return sameSession && instanceOpen ? "claim" : "conflict";
}

function sameInstance(
  owner: BindingOwner,
  identity: ObserveInput["identity"]
): boolean {
  return (
    owner.clientPid !== undefined &&
    owner.clientStartedAt !== undefined &&
    owner.clientPid === identity.clientPid &&
    owner.clientStartedAt === identity.clientStartedAt
  );
}
