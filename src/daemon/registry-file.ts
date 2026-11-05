import fs from "node:fs/promises";
import path from "node:path";

/**
 * Primitives shared by the daemon's local state files. Each data file has a meta
 * marker written before it. Readers never rewrite content they cannot parse, and
 * the marker lets a missing data file read as lost instead of as a fresh start.
 */
export const UNPARSEABLE = Symbol("unparseable");

export type AtomicWriter = (filePath: string, content: string) => Promise<void>;
export type Serializer = <T>(operation: () => Promise<T>) => Promise<T>;

export async function readOptionalFile(
  filePath: string
): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function parseJsonOrUnparseable(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return UNPARSEABLE;
  }
}

/** The marker sits beside its data file and takes the data file's stem: sessions.json -> sessions.meta.json. */
export function markerPathFor(filePath: string): string {
  const stem = path.basename(filePath, path.extname(filePath));
  return path.join(path.dirname(filePath), `${stem}.meta.json`);
}

export function serializeMarker(initializedAt: string): string {
  return `${JSON.stringify({ version: 1, initializedAt }, null, 2)}\n`;
}

/** Writes the marker only when it is missing. It goes first, so a crash fails closed. */
export async function ensureMarker(
  markerPath: string,
  writeAtomic: AtomicWriter,
  now: () => string
): Promise<void> {
  const existing = await readOptionalFile(markerPath);
  if (existing !== undefined) return;
  await writeAtomic(markerPath, serializeMarker(now()));
}

/** Runs each operation after the previous one, so writers never interleave. */
export function createSerializer(): Serializer {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const run = queue.then(operation);
    queue = run.catch(() => undefined);
    return run;
  };
}
