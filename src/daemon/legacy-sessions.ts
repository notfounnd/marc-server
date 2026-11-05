import fs from "node:fs/promises";
import path from "node:path";
import {
  slotKey,
  type RegistryFile,
  type SessionBinding
} from "../core/session-slots.js";
import { writeFileAtomically } from "../core/write-coordination.js";
import { readMarked, stampFor } from "./marked-file.js";
import {
  markerPathFor,
  parseJsonOrUnparseable,
  readOptionalFile
} from "./registry-file.js";
import { REGISTRY_FILE_NAME, REGISTRY_SPEC } from "./session-file.js";
import type { ThreadScope, ThreadStore } from "./thread-store.js";

/**
 * Splits the F2 sessions.json into one state file per thread, once. An invalid or
 * lost legacy registry is not migrated and fails closed as in F2. The original files
 * are renamed with a migration suffix, never deleted. Rerunning is harmless: a thread
 * that already has a state file is left as it is.
 *
 * The order is the per-thread files, then the completion marker, then the rename.
 * Writing the per-thread files transfers the authority; the completion marker records
 * that the transfer is done; the rename only tidies the data directory. Once the marker
 * is valid the legacy file is ignored, even if it reappears or survives a crash before
 * its rename, so a new instance never reads it as authority or fallback. The rename after
 * the marker is best effort: a persistent failure leaves the original in the data
 * directory, ignored and without a warning, and the next start tries again. A missing
 * marker with partial state reruns the migration; an unreadable marker fails closed.
 */
export const MIGRATION_MARKER_NAME = "sessions.migration.json";

export type LegacyGate =
  | { status: "ready" }
  | { status: "invalid"; reason: string };

type ThreadGroup = {
  scope: ThreadScope;
  slots: Record<string, SessionBinding>;
  generation: number;
};

type MarkerState = "absent" | "complete" | "invalid";

/** Writes the completion marker. The default is the atomic writer; tests inject a failing one. */
type MarkerWriter = (filePath: string, content: string) => Promise<void>;

export async function migrateLegacySessions(
  dataDir: string,
  threads: ThreadStore,
  now: () => string,
  writeMarker: MarkerWriter = writeFileAtomically
): Promise<LegacyGate> {
  const markerPath = path.join(dataDir, MIGRATION_MARKER_NAME);
  const legacyPath = path.join(dataDir, REGISTRY_FILE_NAME);
  const marker = await markerStateOf(markerPath);
  if (marker === "complete") {
    await retireBestEffort(legacyPath, now());
    return { status: "ready" };
  }
  if (marker === "invalid") {
    return { status: "invalid", reason: "migration_marker_invalid" };
  }
  const legacy = await readMarked(legacyPath, REGISTRY_SPEC);
  if (legacy.status === "invalid") {
    return { status: "invalid", reason: legacy.reason };
  }
  if (!legacy.file) return { status: "ready" };
  await writeGroups(threads, groupBindings(legacy.file));
  await writeMarker(markerPath, serializeMarker(now()));
  await retireBestEffort(legacyPath, now());
  return { status: "ready" };
}

async function markerStateOf(markerPath: string): Promise<MarkerState> {
  const content = await readOptionalFile(markerPath);
  if (content === undefined) return "absent";
  return isMarker(parseJsonOrUnparseable(content)) ? "complete" : "invalid";
}

function isMarker(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.completedAt === "string";
}

function serializeMarker(completedAt: string): string {
  return `${JSON.stringify({ version: 1, completedAt }, null, 2)}\n`;
}

function groupBindings(file: RegistryFile): ThreadGroup[] {
  const groups = new Map<string, ThreadGroup>();
  for (const binding of Object.values(file.slots)) {
    const key = `${binding.workspaceId}\u0000${binding.threadId}`;
    const current = groups.get(key) ?? {
      scope: { workspaceId: binding.workspaceId, threadId: binding.threadId },
      slots: {},
      generation: 0
    };
    groups.set(key, {
      scope: current.scope,
      slots: { ...current.slots, [slotKey(binding)]: binding },
      generation: Math.max(current.generation, binding.generation)
    });
  }
  return [...groups.values()];
}

async function writeGroups(
  threads: ThreadStore,
  groups: ThreadGroup[]
): Promise<void> {
  for (const group of groups) {
    await writeGroup(threads, group);
  }
}

/** The generation is the largest binding generation, so new bindings in the thread stay unique. */
async function writeGroup(
  threads: ThreadStore,
  group: ThreadGroup
): Promise<void> {
  const existing = await threads.read(group.scope);
  if (existing.status === "invalid" || existing.exists) return;
  await threads.update(group.scope, () => ({
    value: undefined,
    file: {
      version: 1,
      generation: group.generation,
      slots: group.slots,
      createdAt: new Date().toISOString()
    }
  }));
}

/**
 * Archives the F2 registry and its meta marker. The meta marker goes first. The completion
 * marker is written before this runs and is never renamed here, so a crash between the two
 * renames only leaves a legacy file that the next start ignores and archives again.
 */
async function retire(legacyPath: string, at: string): Promise<void> {
  const stamp = stampFor(at);
  const markerPath = markerPathFor(legacyPath);
  await renameIfPresent(markerPath, `${markerPath}.migrated-${stamp}`);
  await renameIfPresent(legacyPath, `${legacyPath}.migrated-${stamp}`);
}

/**
 * Best effort, and called only once the completion marker exists, so the per-thread files
 * already hold the authority. A failed rename must not block the daemon or make the legacy
 * file readable: the legacy file is never read once the marker is valid. A persistent failure
 * leaves the original in the data directory, ignored and without a warning; the next start
 * tries again. This is the only place that swallows errors in the migration.
 */
async function retireBestEffort(legacyPath: string, at: string): Promise<void> {
  await retire(legacyPath, at).catch(() => undefined);
}

async function renameIfPresent(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
