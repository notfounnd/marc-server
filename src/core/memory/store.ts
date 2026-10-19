import fs from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "../write-coordination.js";
import type { WorkspaceInfo } from "../types.js";
import { memoryManifestPath } from "./storage-paths.js";
import { DEFAULT_SEARCH_LAYERS } from "./types.js";
import type {
  MemoryLayer,
  MemoryLexicalSearchHit,
  MemoryManifest,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "./types.js";
import { cosineSimilarity } from "./vector-math.js";

const LEGACY_TABLE_NAME = "summary_embeddings";

export { LanceDbMemoryVectorStore } from "./lancedb-store.js";
export { memoryManifestPath, memoryRootPath } from "./storage-paths.js";

export async function readMemoryManifest(
  info: WorkspaceInfo
): Promise<MemoryManifest | undefined> {
  const content = await fs
    .readFile(memoryManifestPath(info), "utf8")
    .catch(() => undefined);
  if (!content) return undefined;
  return JSON.parse(content) as MemoryManifest;
}

export async function writeMemoryManifest(
  info: WorkspaceInfo,
  manifest: MemoryManifest
): Promise<void> {
  const manifestPath = memoryManifestPath(info);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFileAtomically(manifestPath, JSON.stringify(manifest, null, 2));
}

export class InMemoryMemoryVectorStore implements MemoryVectorStore {
  private readonly generations = new Map<string, MemoryVectorRow[]>();
  private latestGeneration = LEGACY_TABLE_NAME;

  async exists(_info?: WorkspaceInfo, generation?: string): Promise<boolean> {
    return this.rowsForGeneration(generation).length > 0;
  }

  async listRecordIds(
    _info?: WorkspaceInfo,
    generation?: string
  ): Promise<string[]> {
    return this.rowsForGeneration(generation).map((record) => record.recordId);
  }

  async readRows(
    _info?: WorkspaceInfo,
    generation?: string
  ): Promise<MemoryVectorRow[]> {
    return this.rowsForGeneration(generation).map((record) => ({
      ...record,
      vector: [...record.vector]
    }));
  }

  async rebuild(
    _info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation?: string
  ): Promise<void> {
    const key = generation ?? LEGACY_TABLE_NAME;
    const rows = records.map((record, index) => ({
      ...record,
      vector: vectors[index] ?? []
    }));
    this.generations.set(key, rows);
    this.latestGeneration = key;
  }

  async reconcile(
    _info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    const recordsById = new Map(
      this.rowsForGeneration().map((record) => [record.recordId, record])
    );
    for (const row of rows) recordsById.set(row.recordId, row);
    for (const recordId of removeRecordIds) recordsById.delete(recordId);
    this.generations.set(this.latestGeneration, [...recordsById.values()]);
  }

  async validateGeneration(
    _info: WorkspaceInfo,
    _generation: string
  ): Promise<void> {}

  async searchVector(
    _info: WorkspaceInfo,
    vector: number[],
    options: {
      generation?: string;
      kind?: "identity" | "passage";
      layers?: readonly MemoryLayer[];
      limit: number;
    }
  ): Promise<MemorySearchHit[]> {
    const layers = options.layers ?? DEFAULT_SEARCH_LAYERS;
    return this.rowsForGeneration(options.generation)
      .filter((record) => !options.kind || record.kind === options.kind)
      .filter((record) => layers.includes(record.layer))
      .map((record) => ({
        record,
        score: cosineSimilarity(vector, record.vector)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);
  }

  async searchLexical(): Promise<MemoryLexicalSearchHit[]> {
    return [];
  }

  private rowsForGeneration(generation?: string): MemoryVectorRow[] {
    const key = generation ?? this.latestGeneration;
    return this.generations.get(key) ?? [];
  }
}
