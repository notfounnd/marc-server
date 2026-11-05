import fs from "node:fs/promises";
import path from "node:path";
import type { RecoveryRecord } from "./activation-file.js";
import {
  createSerializer,
  ensureMarker,
  markerPathFor,
  parseJsonOrUnparseable,
  readOptionalFile,
  UNPARSEABLE,
  type AtomicWriter,
  type Serializer
} from "./registry-file.js";

/**
 * Reads one data file with its marker. A missing data file with a marker is lost,
 * and a missing pair is "never existed". Unparseable or misshapen content is
 * invalid and is never rewritten by a reader.
 */
export type MarkedSpec<T> = {
  validate: (value: unknown) => value is T;
  lostReason: string;
};

export type MarkedRead<T> =
  | { status: "ready"; file: T | undefined; exists: boolean }
  | { status: "invalid"; reason: string };

export type RecoverOutcome =
  | { kind: "healthy" }
  | { kind: "recovered"; reason: string; movedAside?: string }
  | { kind: "conflict" }
  | { kind: "closed" };

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/** Ids become file names, so anything that could leave its folder is refused. */
export function isSafeSegment(value: string): boolean {
  return SEGMENT.test(value) && !value.endsWith(".meta");
}

export async function readMarked<T>(
  filePath: string,
  spec: MarkedSpec<T>
): Promise<MarkedRead<T>> {
  const content = await readOptionalFile(filePath);
  if (content !== undefined) return parseMarked(content, spec);
  const marker = await readOptionalFile(markerPathFor(filePath));
  if (marker !== undefined)
    return { status: "invalid", reason: spec.lostReason };
  return { status: "ready", file: undefined, exists: false };
}

function parseMarked<T>(content: string, spec: MarkedSpec<T>): MarkedRead<T> {
  const parsed = parseJsonOrUnparseable(content);
  if (parsed === UNPARSEABLE) {
    return { status: "invalid", reason: "unreadable_json" };
  }
  if (!spec.validate(parsed)) {
    return { status: "invalid", reason: "invalid_shape" };
  }
  return { status: "ready", file: parsed, exists: true };
}

export function serializeMarked(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export type MarkedWriter = {
  /** Serializes all work on one data file, so writers of the same file never interleave. */
  run<T>(filePath: string, operation: () => Promise<T>): Promise<T>;
  /** Writes the marker first, then the data file, atomically. */
  persist(filePath: string, content: string): Promise<void>;
  /** Removes the data file, then its marker. A crash in between leaves a marker that cleanup removes. */
  remove(filePath: string): Promise<void>;
};

export function createMarkedWriter(
  writeAtomic: AtomicWriter,
  now: () => string
): MarkedWriter {
  const queues = new Map<string, Serializer>();
  return {
    run: (filePath, operation) => queueFor(queues, filePath)(operation),
    persist: async (filePath, content) => {
      await ensureMarker(markerPathFor(filePath), writeAtomic, now);
      await writeAtomic(filePath, content);
    },
    remove: async (filePath) => {
      await fs.rm(filePath, { force: true });
      await fs.rm(markerPathFor(filePath), { force: true });
    }
  };
}

function queueFor(
  queues: Map<string, Serializer>,
  filePath: string
): Serializer {
  const existing = queues.get(filePath);
  if (existing) return existing;
  const created = createSerializer();
  queues.set(filePath, created);
  return created;
}

/**
 * Human recovery of one data file. A healthy file is left alone. Invalid content is
 * moved aside under a timestamped name and never deleted; a lost file has nothing to
 * move. The recreated file is written through the marker-first path.
 */
export async function recoverMarked<T>(
  writer: MarkedWriter,
  filePath: string,
  spec: MarkedSpec<T>,
  at: string,
  fresh: (recovery: RecoveryRecord) => T
): Promise<RecoverOutcome> {
  return writer.run(filePath, async (): Promise<RecoverOutcome> => {
    const view = await readMarked(filePath, spec);
    if (view.status === "ready") return { kind: "healthy" };
    const moved = await MOVE_ASIDE[moveKind(view.reason, spec)](filePath, at);
    if (!moved.ok) return { kind: "conflict" };
    const recovery: RecoveryRecord = {
      at,
      reason: view.reason,
      movedAside: moved.name
    };
    await writer.persist(filePath, serializeMarked(fresh(recovery)));
    return { kind: "recovered", reason: view.reason, movedAside: moved.name };
  });
}

type MoveOutcome = { ok: true; name?: string } | { ok: false };

const MOVE_ASIDE: Record<
  "lost" | "invalid",
  (filePath: string, at: string) => Promise<MoveOutcome>
> = {
  lost: async () => ({ ok: true }),
  invalid: async (filePath, at) => {
    const name = await moveAside(filePath, stampFor(at));
    return name ? { ok: true, name } : { ok: false };
  }
};

function moveKind(
  reason: string,
  spec: { lostReason: string }
): "lost" | "invalid" {
  return reason === spec.lostReason ? "lost" : "invalid";
}

/**
 * Moves invalid content aside under a timestamped name. An existing name is never
 * overwritten: the caller gets undefined and must stop.
 */
async function moveAside(
  filePath: string,
  stamp: string
): Promise<string | undefined> {
  const name = `${path.basename(filePath)}.invalid-${stamp}`;
  const target = path.join(path.dirname(filePath), name);
  const taken = await readOptionalFile(target);
  if (taken !== undefined) return undefined;
  await fs.rename(filePath, target);
  return name;
}

/** Path-safe stamp for file names, derived from an ISO time. */
export function stampFor(at: string): string {
  return at.replace(/[:.]/g, "-");
}
