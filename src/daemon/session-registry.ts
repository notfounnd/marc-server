import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import {
  isFreeState,
  slotKey,
  type HeartbeatInput,
  type ObserveInput,
  type ObserveResult,
  type OwnerCall,
  type OwnerResult,
  type RegistryFile,
  type Refusal,
  type SessionBinding,
  type SlotKey,
  type SlotState,
  type SlotStateName
} from "../core/session-slots.js";
import { writeFileAtomically } from "../core/write-coordination.js";
import {
  readRegistryView,
  registryMetaExists,
  registryMetaPath,
  REGISTRY_FILE_NAME,
  serializeRegistry,
  serializeRegistryMeta,
  type RegistryView
} from "./session-file.js";
import {
  commitObservation,
  heartbeatBinding,
  ignored,
  observeRefusal,
  ownerRefusal,
  recordConflictBinding,
  refused,
  releaseBinding,
  reserveBinding,
  withSlot
} from "./session-transitions.js";
import { observationView, planObservation } from "./session-observation.js";

/**
 * Local authority for the link between a thread/profile slot and its native
 * session. Only the daemon writes it, through this serialized queue and an
 * atomic rename. An unreadable, invalid or lost file fails closed and is never
 * rewritten. Presence and slot state are derived from it, not stored in it.
 */
export { REGISTRY_FILE_NAME, readRegistryView } from "./session-file.js";
export type { RegistryView } from "./session-file.js";
export type {
  HeartbeatInput,
  ObservedClient,
  ObserveInput,
  ObserveResult,
  OwnerCall,
  OwnerResult,
  Refusal
} from "../core/session-slots.js";

const REFUSAL_BY_STATE: Partial<Record<SlotStateName, string>> = {
  online: "owner_active",
  reserved: "reserved",
  unknown: "owner_unknown",
  conflict: "conflict"
};

export type RegistryDependencies = {
  writeAtomic: (filePath: string, content: string) => Promise<void>;
  newSessionId: () => string;
  newOwnerToken: () => string;
  now: () => string;
};

export type AcquireInput = {
  slot: SlotKey;
  expectedGeneration: number;
  hostId: string;
};

export type AcquireResult =
  | {
      decision: "acquired";
      mode: "new" | "resume";
      nativeSessionId: string;
      generation: number;
      ownerToken: string;
    }
  | Refusal;

export type SessionProbe = (binding: SessionBinding) => Promise<SlotState>;

export type SessionRegistry = {
  read(): Promise<RegistryView>;
  acquire(input: AcquireInput, probe: SessionProbe): Promise<AcquireResult>;
  observe(input: ObserveInput, probe: SessionProbe): Promise<ObserveResult>;
  heartbeat(input: HeartbeatInput): Promise<OwnerResult>;
  release(call: OwnerCall): Promise<OwnerResult>;
  recordConflict(input: {
    slot: SlotKey;
    sessionId: string;
  }): Promise<OwnerResult>;
};

type Context = { filePath: string; deps: RegistryDependencies };

type OwnedLoad =
  | { file: RegistryFile; key: string; binding: SessionBinding }
  | { refusal: Refusal };

const DEFAULT_DEPENDENCIES: RegistryDependencies = {
  writeAtomic: (filePath, content) => writeFileAtomically(filePath, content),
  newSessionId: () => randomUUID(),
  newOwnerToken: () => randomBytes(32).toString("base64url"),
  now: () => new Date().toISOString()
};

export function createSessionRegistry(
  dataDir: string,
  overrides: Partial<RegistryDependencies> = {}
): SessionRegistry {
  const context: Context = {
    filePath: path.join(dataDir, REGISTRY_FILE_NAME),
    deps: { ...DEFAULT_DEPENDENCIES, ...overrides }
  };
  const serialize = createSerializer();
  return {
    read: () => readRegistryView(context.filePath),
    acquire: (input, probe) =>
      serialize(() => acquireIn(context, input, probe)),
    observe: (input, probe) =>
      serialize(() => observeIn(context, input, probe)),
    heartbeat: (input) => serialize(() => heartbeatIn(context, input)),
    release: (call) => serialize(() => releaseIn(context, call)),
    recordConflict: (input) => serialize(() => recordConflictIn(context, input))
  };
}

/** Runs each operation after the previous one, so writers never interleave. */
function createSerializer(): <T>(operation: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const run = queue.then(operation);
    queue = run.catch(() => undefined);
    return run;
  };
}

/** A released binding is free by its own proof; otherwise the owner state decides. */
async function acquireIn(
  context: Context,
  input: AcquireInput,
  probe: SessionProbe
): Promise<AcquireResult> {
  const view = await readRegistryView(context.filePath);
  if (view.status === "invalid") return refused("registry_invalid");

  const key = slotKey(input.slot);
  const current = view.file.slots[key];
  if (input.expectedGeneration !== (current?.generation ?? 0)) {
    return refused("generation_mismatch");
  }
  const reason = await acquireRefusal(current, probe);
  if (reason) return refused(reason);

  const nativeSessionId =
    current?.nativeSessionId ?? context.deps.newSessionId();
  const ownerToken = context.deps.newOwnerToken();
  const reserved = reserveBinding(view.file, key, input.slot, {
    hostId: input.hostId,
    nativeSessionId,
    ownerToken,
    now: context.deps.now()
  });
  await persist(context, reserved.file);
  return {
    decision: "acquired",
    mode: current ? "resume" : "new",
    nativeSessionId,
    generation: reserved.generation,
    ownerToken
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

async function observeIn(
  context: Context,
  input: ObserveInput,
  probe: SessionProbe
): Promise<ObserveResult> {
  const reason = observeRefusal(input.role);
  if (reason) return ignored(reason);
  const view = await readRegistryView(context.filePath);
  if (view.status === "invalid") return ignored("registry_invalid");

  const key = slotKey(input.slot);
  const current = view.file.slots[key];
  const state = current ? await probe(current) : undefined;
  const plan = planObservation(
    current,
    input,
    observationView(state, input.identity)
  );
  const commit = commitObservation(plan, {
    file: view.file,
    key,
    slot: input.slot,
    current,
    input,
    now: context.deps.now()
  });
  if (commit.file) await persist(context, commit.file);
  return commit.result;
}

async function heartbeatIn(
  context: Context,
  input: HeartbeatInput
): Promise<OwnerResult> {
  const loaded = await loadOwned(context, input);
  if ("refusal" in loaded) return loaded.refusal;
  const next = heartbeatBinding(loaded.binding, input, context.deps.now());
  if ("decision" in next) return next;
  await persist(context, withSlot(loaded.file, loaded.key, next));
  return { decision: "renewed" };
}

async function releaseIn(
  context: Context,
  call: OwnerCall
): Promise<OwnerResult> {
  const loaded = await loadOwned(context, call);
  if ("refusal" in loaded) return loaded.refusal;
  const next = releaseBinding(loaded.binding, context.deps.now());
  await persist(context, withSlot(loaded.file, loaded.key, next));
  return { decision: "released" };
}

async function recordConflictIn(
  context: Context,
  input: { slot: SlotKey; sessionId: string }
): Promise<OwnerResult> {
  const view = await readRegistryView(context.filePath);
  if (view.status === "invalid") return refused("registry_invalid");
  const key = slotKey(input.slot);
  const binding = view.file.slots[key];
  if (!binding) return refused("not_bound");
  if (binding.endedAt !== undefined) return refused("ended");
  const next = recordConflictBinding(
    binding,
    input.sessionId,
    context.deps.now()
  );
  await persist(context, withSlot(view.file, key, next));
  return { decision: "recorded" };
}

async function loadOwned(
  context: Context,
  call: OwnerCall
): Promise<OwnedLoad> {
  const view = await readRegistryView(context.filePath);
  if (view.status === "invalid") {
    return { refusal: refused("registry_invalid") };
  }
  const key = slotKey(call.slot);
  const binding = view.file.slots[key];
  if (!binding) return { refusal: refused("not_bound") };
  const refusal = ownerRefusal(binding, call);
  if (refusal) return { refusal };
  return { file: view.file, key, binding };
}

async function persist(context: Context, file: RegistryFile): Promise<void> {
  await ensureMeta(context);
  await context.deps.writeAtomic(context.filePath, serializeRegistry(file));
}

/**
 * The marker goes first, so a sessions.json that later disappears reads as lost,
 * not as a fresh registry. A crash between the two writes therefore fails closed.
 */
async function ensureMeta(context: Context): Promise<void> {
  if (await registryMetaExists(context.filePath)) return;
  await context.deps.writeAtomic(
    registryMetaPath(context.filePath),
    serializeRegistryMeta(context.deps.now())
  );
}
