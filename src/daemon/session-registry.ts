import { randomBytes, randomUUID } from "node:crypto";
import {
  type HeartbeatInput,
  type ObserveInput,
  type ObserveResult,
  type OwnerCall,
  type OwnerResult,
  type RegistryFile,
  type Refusal,
  type SessionBinding,
  type SlotKey,
  type SlotState
} from "../core/session-slots.js";
import { writeFileAtomically } from "../core/write-coordination.js";
import { migrateLegacySessions, type LegacyGate } from "./legacy-sessions.js";
import { emptyRegistryFile, type RegistryView } from "./session-file.js";
import {
  acquireIn,
  heartbeatIn,
  observeIn,
  recordConflictIn,
  releaseIn,
  type OperationContext
} from "./session-operations.js";
import { ignored, observeRefusal, refused } from "./session-transitions.js";
import {
  createThreadStore,
  type ThreadFile,
  type ThreadScope,
  type ThreadStore
} from "./thread-store.js";

/**
 * Local authority for the link between a thread/profile slot and its native
 * session. Only the daemon writes it, one state file per thread, through that
 * file's queue and an atomic rename. An unreadable, invalid or lost file fails
 * closed and is never rewritten. A closed thread (SUMMARY.md present) accepts no
 * write. Presence and slot state are derived, not stored.
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

export type RegistryDependencies = {
  writeAtomic: (filePath: string, content: string) => Promise<void>;
  newSessionId: () => string;
  newOwnerToken: () => string;
  now: () => string;
  /** Whether a thread is closed. Injected by the daemon; the default says nothing is closed. */
  isClosed?: (scope: ThreadScope) => Promise<boolean>;
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
  /** Runs the one-time split of a legacy sessions.json. Operations also wait for it. */
  prepare(): Promise<void>;
  /** A thread's view when a scope is given; otherwise every thread's slots, merged. */
  read(scope?: ThreadScope): Promise<RegistryView>;
  acquire(input: AcquireInput, probe: SessionProbe): Promise<AcquireResult>;
  observe(input: ObserveInput, probe: SessionProbe): Promise<ObserveResult>;
  heartbeat(input: HeartbeatInput): Promise<OwnerResult>;
  release(call: OwnerCall): Promise<OwnerResult>;
  recordConflict(input: {
    slot: SlotKey;
    sessionId: string;
  }): Promise<OwnerResult>;
};

const DEFAULT_DEPENDENCIES: RegistryDependencies = {
  newSessionId: () => randomUUID(),
  newOwnerToken: () => randomBytes(32).toString("base64url"),
  writeAtomic: (filePath, content) => writeFileAtomically(filePath, content),
  now: () => new Date().toISOString()
};

export function createSessionRegistry(
  dataDir: string,
  overrides: Partial<RegistryDependencies> = {},
  threads?: ThreadStore
): SessionRegistry {
  const deps: RegistryDependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const context: OperationContext = {
    threads:
      threads ??
      createThreadStore(dataDir, {
        writeAtomic: deps.writeAtomic,
        now: deps.now,
        isClosed: deps.isClosed
      }),
    deps
  };
  let gate: Promise<LegacyGate> | undefined;
  const ready = (): Promise<LegacyGate> => {
    gate ??= migrateLegacySessions(dataDir, context.threads, deps.now);
    return gate;
  };
  return {
    prepare: async () => {
      await ready();
    },
    read: async (scope) => {
      const legacy = await ready();
      if (legacy.status === "invalid") {
        return { status: "invalid", reason: legacy.reason };
      }
      if (scope) return scopedView(context.threads, scope);
      return mergedView(context.threads);
    },
    acquire: async (input, probe) => {
      const legacy = await ready();
      if (legacy.status === "invalid") return refused("registry_invalid");
      return acquireIn(context, input, probe);
    },
    observe: async (input, probe) => {
      const reason = observeRefusal(input.role);
      if (reason) return ignored(reason);
      const legacy = await ready();
      if (legacy.status === "invalid") return ignored("registry_invalid");
      return observeIn(context, input, probe);
    },
    heartbeat: async (input) => {
      const legacy = await ready();
      if (legacy.status === "invalid") return refused("registry_invalid");
      return heartbeatIn(context, input);
    },
    release: async (call) => {
      const legacy = await ready();
      if (legacy.status === "invalid") return refused("registry_invalid");
      return releaseIn(context, call);
    },
    recordConflict: async (input) => {
      const legacy = await ready();
      if (legacy.status === "invalid") return refused("registry_invalid");
      return recordConflictIn(context, input);
    }
  };
}

/** Maps a thread's view to the F2 view shape. An invalid thread keeps its reason. */
async function scopedView(
  threads: ThreadStore,
  scope: ThreadScope
): Promise<RegistryView> {
  const view = await threads.read(scope);
  if (view.status === "invalid") return view;
  return { status: "ready", file: view.file };
}

async function mergedView(threads: ThreadStore): Promise<RegistryView> {
  const views = await Promise.all(
    (await threads.scopes()).map((scope) => threads.read(scope))
  );
  const broken = views.find((view) => view.status === "invalid");
  if (broken?.status === "invalid")
    return { status: "invalid", reason: broken.reason };
  const files = views.flatMap((view) =>
    view.status === "ready" ? [view.file] : []
  );
  return { status: "ready", file: mergeSlots(files) };
}

function mergeSlots(files: ThreadFile[]): RegistryFile {
  return files.reduce<RegistryFile>(
    (merged, file) => ({
      version: 1,
      generation: Math.max(merged.generation, file.generation),
      slots: { ...merged.slots, ...file.slots }
    }),
    emptyRegistryFile()
  );
}
