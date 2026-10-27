import fs from "node:fs/promises";
import path from "node:path";
import type { MemoryVectorRow } from "../../src/core/memory/types.js";
import type { CapturedVectors } from "./capture-types.js";

/** File of the vectors in a capture directory: float32, little-endian, one record after another. */
export const VECTORS_FILE = "vectors.f32";

/**
 * Writes the vector of every record of the temporary index once per capture, as float32, so that
 * the cosine of the replay is repeated over the same values. The file is replaced atomically.
 */
export async function writeVectors(
  captureDir: string,
  rows: readonly MemoryVectorRow[]
): Promise<CapturedVectors> {
  const dimension = rows[0]?.vector.length ?? 0;
  const values = new Float32Array(rows.length * dimension);
  rows.forEach((row, index) => {
    if (row.vector.length !== dimension)
      throw new Error(`Record ${row.recordId} has a vector of ${row.vector.length} values, expected ${dimension}.`);
    values.set(row.vector, index * dimension);
  });
  const finalPath = path.join(captureDir, VECTORS_FILE);
  const temporaryPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, Buffer.from(values.buffer));
  await fs.rename(temporaryPath, finalPath);
  return { file: VECTORS_FILE, dimension, recordIds: rows.map((row) => row.recordId) };
}

/** Reads the vectors of a capture back, keyed by recordId, as plain numbers. */
export async function readVectors(
  captureDir: string,
  vectors: CapturedVectors
): Promise<Map<string, number[]>> {
  const bytes = new Uint8Array(await fs.readFile(path.join(captureDir, vectors.file)));
  const values = new Float32Array(bytes.buffer);
  const dimension = vectors.dimension;
  return new Map(
    vectors.recordIds.map((recordId, index) => [
      recordId,
      Array.from(values.subarray(index * dimension, (index + 1) * dimension))
    ])
  );
}
