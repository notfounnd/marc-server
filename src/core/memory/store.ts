import fs from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "../paths.js";
import { writeFileAtomically } from "../write-coordination.js";
import type { WorkspaceInfo } from "../types.js";
import type {
  MemoryManifest,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorStore
} from "./types.js";

const MEMORY_DIR = "memory";
const MANIFEST_FILE = "manifest.json";
const TABLE_NAME = "summary_embeddings";

export function memoryRootPath(info: WorkspaceInfo): string {
  return safeJoin(info.marcPath, MEMORY_DIR);
}

export function memoryManifestPath(info: WorkspaceInfo): string {
  return safeJoin(memoryRootPath(info), MANIFEST_FILE);
}

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
  private records: Array<MemoryVectorRecord & { vector: number[] }> = [];

  async exists(): Promise<boolean> {
    return this.records.length > 0;
  }

  async rebuild(
    _info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][]
  ): Promise<void> {
    this.records = records.map((record, index) => ({
      ...record,
      vector: vectors[index] ?? []
    }));
  }

  async search(
    _info: WorkspaceInfo,
    vector: number[],
    options: { limit: number; minScore: number }
  ): Promise<MemorySearchHit[]> {
    return this.records
      .map((record) => ({
        record,
        score: cosineSimilarity(vector, record.vector)
      }))
      .filter((hit) => hit.score >= options.minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);
  }
}

export class LanceDbMemoryVectorStore implements MemoryVectorStore {
  async exists(info: WorkspaceInfo): Promise<boolean> {
    const root = memoryRootPath(info);
    const entries = await fs.readdir(root).catch(() => []);
    return entries.some((entry) => entry !== MANIFEST_FILE);
  }

  async rebuild(
    info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][]
  ): Promise<void> {
    const db = await connectLanceDb(info);
    const rows = records.map((record, index) => ({
      ...record,
      vector: vectors[index] ?? []
    }));
    await db.createTable(TABLE_NAME, rows, { mode: "overwrite" });
  }

  async search(
    info: WorkspaceInfo,
    vector: number[],
    options: { limit: number; minScore: number }
  ): Promise<MemorySearchHit[]> {
    const db = await connectLanceDb(info);
    const table = await db.openTable(TABLE_NAME);
    const rows = (await table
      .vectorSearch(vector)
      .distanceType("cosine")
      .limit(options.limit)
      .toArray()) as Array<MemoryVectorRecord & { _distance?: number }>;
    return (rows ?? [])
      .map((row) => ({
        record: row,
        score: distanceToScore(row._distance)
      }))
      .filter((hit) => hit.score >= options.minScore);
  }
}

async function connectLanceDb(info: WorkspaceInfo): Promise<{
  createTable(
    name: string,
    data: unknown[],
    options: { mode: "overwrite" }
  ): Promise<unknown>;
  openTable(name: string): Promise<{
    vectorSearch(vector: number[]): {
      distanceType(distanceType: "cosine"): {
        limit(limit: number): { toArray(): Promise<unknown[]> };
      };
    };
    search?(vector: number[]): {
      limit(limit: number): { toArray(): Promise<unknown[]> };
    };
  }>;
}> {
  const lancedb = (await import("@lancedb/lancedb")) as {
    connect(uri: string): Promise<{
      createTable(
        name: string,
        data: unknown[],
        options: { mode: "overwrite" }
      ): Promise<unknown>;
      openTable(name: string): Promise<{
        vectorSearch(vector: number[]): {
          distanceType(distanceType: "cosine"): {
            limit(limit: number): { toArray(): Promise<unknown[]> };
          };
        };
        search?(vector: number[]): {
          limit(limit: number): { toArray(): Promise<unknown[]> };
        };
      }>;
    }>;
  };
  await fs.mkdir(memoryRootPath(info), { recursive: true });
  return lancedb.connect(memoryRootPath(info));
}

function cosineSimilarity(left: number[], right: number[]): number {
  const dot = left.reduce(
    (total, value, index) => total + value * right[index]!,
    0
  );
  const leftNorm = Math.sqrt(
    left.reduce((total, value) => total + value * value, 0)
  );
  const rightNorm = Math.sqrt(
    right.reduce((total, value) => total + value * value, 0)
  );
  if (!leftNorm) return 0;
  if (!rightNorm) return 0;
  return dot / (leftNorm * rightNorm);
}

function distanceToScore(distance?: number): number {
  if (typeof distance !== "number") return 0;
  return Math.max(0, 1 - distance);
}
