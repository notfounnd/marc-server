import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CyclesState } from "../src/core/activation-cycles.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import type { ActivationPolicy } from "../src/core/activation-policy.js";
import type {
  RegistryFile,
  SessionBinding
} from "../src/core/session-slots.js";
import { slotKey } from "../src/core/session-slots.js";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import {
  createThreadStore,
  type ThreadStore
} from "../src/daemon/thread-store.js";
import {
  createWorkspaceStore,
  type WorkspaceStore
} from "../src/daemon/workspace-store.js";
import {
  createActivationLedger,
  type ActivationLedger
} from "../src/daemon/activation-ledger.js";

export const CLOCK_ISO = "2026-11-04T12:00:00.000Z";
export const clock = (): string => CLOCK_ISO;

/** A valid version 2 policy for the given revision. Stages are fixed and participants are computed, so neither is stored. */
export function policyFor(revision: string, enabled = true): ActivationPolicy {
  return {
    version: 2,
    revision,
    enabled,
    mode: "confirm",
    attemptCap: 2,
    pendingTtlMinutes: 1440,
    updatedAt: CLOCK_ISO
  };
}

/** The cycles setting as authorized, with the default of five. */
export const AUTHORIZED_CYCLES: CyclesState = {
  status: "authorized",
  cyclesPerStage: 5
};

/** A legacy F2 binding, shaped as sessions.json stored it. */
export function legacyBinding(
  workspaceId: string,
  threadId: string,
  profile: string,
  generation: number
): SessionBinding {
  return {
    workspaceId,
    threadId,
    profile,
    client: "claude-code",
    nativeSessionId: `native-${workspaceId}-${threadId}-${profile}`,
    hostId: "host-a",
    origin: "open",
    generation,
    owner: { ownerToken: `token-${profile}` },
    boundAt: CLOCK_ISO,
    conflicts: []
  };
}

/** A registry file with the bindings keyed the way F2 keyed them. */
export function registryOf(bindings: SessionBinding[]): RegistryFile {
  const slots = Object.fromEntries(
    bindings.map((binding) => [slotKey(binding), binding])
  );
  const generation = Math.max(
    0,
    ...bindings.map((binding) => binding.generation)
  );
  return { version: 1, generation, slots };
}

/** The stores and ledger a daemon builds, over a real temporary folder with a fixed clock. */
export type StateHarness = {
  dataDir: string;
  threads: ThreadStore;
  workspaces: WorkspaceStore;
  ledger: ActivationLedger;
  /** Every atomic write, in order, as "<file name>". */
  writes: string[];
  cleanup(): Promise<void>;
};

export async function stateHarness(): Promise<StateHarness> {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-thread-state-")
  );
  const writes: string[] = [];
  const deps = {
    now: clock,
    writeAtomic: async (filePath: string, content: string) => {
      writes.push(path.basename(filePath));
      await writeFileAtomically(filePath, content);
    }
  };
  const threads = createThreadStore(dataDir, deps);
  const workspaces = createWorkspaceStore(dataDir, deps);
  return {
    dataDir,
    threads,
    workspaces,
    ledger: createActivationLedger({ threads, workspaces }, clock),
    writes,
    cleanup: () => fs.rm(dataDir, { recursive: true, force: true })
  };
}

/** The workspace the recovery sees: a fixed id, and a marc folder with no CHAT.md, so no message is stamped. */
export function workspaceInfo(dataDir: string): WorkspaceInfo {
  return {
    id: "ws-1",
    name: "ws",
    rootPath: dataDir,
    marcPath: path.join(dataDir, "marc-without-threads")
  };
}

export function threadPath(
  dataDir: string,
  workspaceId: string,
  threadId: string
): string {
  return path.join(dataDir, "threads", workspaceId, `${threadId}.json`);
}

export function markerOf(filePath: string): string {
  return filePath.replace(/\.json$/, ".meta.json");
}

export async function listNames(directory: string): Promise<string[]> {
  return (await fs.readdir(directory)).sort();
}

export async function readJson(
  filePath: string
): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<
    string,
    unknown
  >;
}
