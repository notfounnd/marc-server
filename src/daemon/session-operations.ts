import {
  isFreeState,
  slotKey,
  type BindingOrigin,
  type HeartbeatInput,
  type ObserveInput,
  type ObserveResult,
  type OwnerCall,
  type OwnerResult,
  type Refusal,
  type SessionBinding,
  type SlotKey,
  type SlotStateName
} from "../core/session-slots.js";
import type {
  AcquireInput,
  AcquireResult,
  RegistryDependencies,
  SessionProbe
} from "./session-registry.js";
import type {
  ThreadFile,
  ThreadScope,
  ThreadStep,
  ThreadStore,
  ThreadUpdate
} from "./thread-store.js";
import {
  commitObservation,
  heartbeatBinding,
  ignored,
  ownerRefusal,
  recordConflictBinding,
  refused,
  releaseBinding,
  reserveBinding,
  withSlot
} from "./session-transitions.js";
import { observationView, planObservation } from "./session-observation.js";

/**
 * The slot operations of the registry. Each one runs as one step inside the queue of
 * its thread's state file, so a closed thread, an invalid file and a concurrent write
 * are all decided against the same snapshot.
 */
export type OperationContext = {
  threads: ThreadStore;
  deps: RegistryDependencies;
};

const REFUSAL_BY_STATE: Partial<Record<SlotStateName, string>> = {
  online: "owner_active",
  reserved: "reserved",
  unknown: "owner_unknown",
  conflict: "conflict"
};

type OwnedLoad =
  | { key: string; binding: SessionBinding }
  | { refusal: Refusal };

export function scopeOf(slot: SlotKey): ThreadScope {
  return { workspaceId: slot.workspaceId, threadId: slot.threadId };
}

/** An invalid or closed thread yields the operation's own refusal; otherwise the step's value is returned. */
export function settle<T>(
  result: ThreadUpdate<T>,
  refusals: { invalid: T; closed: T }
): T {
  if (result.status === "invalid") return refusals.invalid;
  if (result.status === "closed") return refusals.closed;
  return result.value;
}

/** A released binding is free by its own proof; otherwise the owner state decides. */
export async function acquireIn(
  context: OperationContext,
  input: AcquireInput,
  probe: SessionProbe
): Promise<AcquireResult> {
  const result = await context.threads.update<AcquireResult>(
    scopeOf(input.slot),
    (file) => acquireStep(file, input, probe, context.deps)
  );
  return settle<AcquireResult>(result, closedOrInvalid(refused));
}

/** The dependencies the acquire judgment draws its ids and instant from. */
export type AcquireDependencies = Pick<
  RegistryDependencies,
  "newSessionId" | "newOwnerToken" | "now"
>;

/**
 * The acquire judgment and its write as one step of a thread's queue. The caller must already be inside
 * that queue (the supervisor's approval does this); nothing here enters the queue again.
 */
export async function acquireStep(
  file: ThreadFile,
  input: AcquireInput,
  probe: SessionProbe,
  deps: AcquireDependencies,
  origin: BindingOrigin = "open"
): Promise<ThreadStep<AcquireResult>> {
  const key = slotKey(input.slot);
  const current = file.slots[key];
  if (input.expectedGeneration !== (current?.generation ?? 0)) {
    return { value: refused("generation_mismatch") };
  }
  const reason = await acquireRefusal(current, probe);
  if (reason) return { value: refused(reason) };

  const nativeSessionId = current?.nativeSessionId ?? deps.newSessionId();
  const ownerToken = deps.newOwnerToken();
  const reserved = reserveBinding(
    file,
    key,
    input.slot,
    { hostId: input.hostId, nativeSessionId, ownerToken, now: deps.now() },
    origin
  );
  return {
    value: {
      decision: "acquired",
      mode: current ? "resume" : "new",
      nativeSessionId,
      generation: reserved.generation,
      ownerToken
    },
    file: reserved.file
  };
}

async function acquireRefusal(
  binding: SessionBinding | undefined,
  probe: SessionProbe
): Promise<string | undefined> {
  if (!binding) return undefined;
  const state = await probe(binding);
  if (isFreeState(state.state)) return undefined;
  return REFUSAL_BY_STATE[state.state] ?? "not_free";
}

export async function observeIn(
  context: OperationContext,
  input: ObserveInput,
  probe: SessionProbe
): Promise<ObserveResult> {
  const key = slotKey(input.slot);
  const result = await context.threads.update<ObserveResult>(
    scopeOf(input.slot),
    async (file) => {
      const current = file.slots[key];
      const state = current ? await probe(current) : undefined;
      const plan = planObservation(
        current,
        input,
        observationView(state, input.identity)
      );
      const commit = commitObservation(plan, {
        file,
        key,
        slot: input.slot,
        current,
        input,
        now: context.deps.now()
      });
      return {
        value: commit.result,
        file: commit.file,
        quiet:
          current !== undefined && quietRefresh(plan, current, input.identity)
      };
    }
  );
  return settle<ObserveResult>(result, {
    invalid: ignored("registry_invalid"),
    closed: ignored("thread_closed")
  });
}

/**
 * A refresh moves only the instant the session was last seen, and its native identifier when it is unchanged.
 * Nothing a panel shows changes, so such an observation is quiet. Adopt, claim, resume, conflict and stale
 * observations change the slot, and they always announce.
 */
function quietRefresh(
  plan: string,
  current: SessionBinding,
  identity: { envSessionId?: string }
): boolean {
  if (plan !== "refresh") return false;
  return (
    identity.envSessionId === undefined ||
    identity.envSessionId === current.envSessionId
  );
}

export async function heartbeatIn(
  context: OperationContext,
  input: HeartbeatInput
): Promise<OwnerResult> {
  const result = await context.threads.update<OwnerResult>(
    scopeOf(input.slot),
    (file) => {
      const loaded = loadOwned(file, input);
      if ("refusal" in loaded) return { value: loaded.refusal };
      const next = heartbeatBinding(loaded.binding, input, context.deps.now());
      if ("decision" in next) return { value: next };
      // A heartbeat moves only the owner's last beat, which no panel shows: the write is quiet.
      return {
        value: { decision: "renewed" },
        file: withSlot(file, loaded.key, next),
        quiet: true
      };
    }
  );
  return settle<OwnerResult>(result, closedOrInvalid(refused));
}

export async function releaseIn(
  context: OperationContext,
  call: OwnerCall
): Promise<OwnerResult> {
  const result = await context.threads.update<OwnerResult>(
    scopeOf(call.slot),
    (file) => {
      const loaded = loadOwned(file, call);
      if ("refusal" in loaded) return { value: loaded.refusal };
      const next = releaseBinding(loaded.binding, context.deps.now());
      return {
        value: { decision: "released" },
        file: withSlot(file, loaded.key, next)
      };
    }
  );
  return settle<OwnerResult>(result, closedOrInvalid(refused));
}

export async function recordConflictIn(
  context: OperationContext,
  input: { slot: SlotKey; sessionId: string }
): Promise<OwnerResult> {
  const key = slotKey(input.slot);
  const result = await context.threads.update<OwnerResult>(
    scopeOf(input.slot),
    (file) => {
      const binding = file.slots[key];
      if (!binding) return { value: refused("not_bound") };
      if (binding.endedAt !== undefined) return { value: refused("ended") };
      const next = recordConflictBinding(
        binding,
        input.sessionId,
        context.deps.now()
      );
      return {
        value: { decision: "recorded" },
        file: withSlot(file, key, next)
      };
    }
  );
  return settle<OwnerResult>(result, closedOrInvalid(refused));
}

/** Both refusal kinds for an operation that answers with a refusal object. */
function closedOrInvalid<R extends Refusal>(
  make: (reason: string) => R
): { invalid: R; closed: R } {
  return { invalid: make("registry_invalid"), closed: make("thread_closed") };
}

function loadOwned(file: ThreadFile, call: OwnerCall): OwnedLoad {
  const key = slotKey(call.slot);
  const binding = file.slots[key];
  if (!binding) return { refusal: refused("not_bound") };
  const refusal = ownerRefusal(binding, call);
  if (refusal) return { refusal };
  return { key, binding };
}
