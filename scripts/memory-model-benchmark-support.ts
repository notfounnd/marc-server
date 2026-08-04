import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { WorkspaceInfo } from "../src/core/types.js";
import { defaultMemoryInferenceManager } from "../src/core/memory/inference-manager.js";
import {
  activeMemoryModelSelection,
  localModelCachePath,
  MEMORY_MODEL_BENCHMARK_PROFILE_ENV,
  type MemoryInferenceRole,
  type MemoryModelSelection
} from "../src/core/memory/model-config.js";
import { InMemoryMemoryVectorStore } from "../src/core/memory/store.js";
import type {
  EmbeddingProvider,
  MemoryVectorRow,
  MemoryVectorStore,
  RerankingProvider
} from "../src/core/memory/types.js";

const BENCHMARK_EMBEDDING_BATCH_SIZE = 4;

export type MemoryModelBenchmarkContext = {
  embeddingDurationMs: number;
  generation?: string;
  profile?: MemoryModelSelection;
  sourceStore: MemoryVectorStore;
  store: MemoryVectorStore;
  workerRssBytes: Partial<Record<MemoryInferenceRole, number>>;
};

export async function prepareMemoryModelBenchmark(input: {
  generation: string;
  info: WorkspaceInfo;
  provider: EmbeddingProvider;
  reranker: RerankingProvider;
  rows: MemoryVectorRow[];
  sourceStore: MemoryVectorStore;
}): Promise<MemoryModelBenchmarkContext> {
  const profileId = process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV];
  if (!profileId) {
    return {
      embeddingDurationMs: 0,
      generation: input.generation,
      sourceStore: input.sourceStore,
      store: input.sourceStore,
      workerRssBytes: {}
    };
  }

  const profile = activeMemoryModelSelection();
  await input.provider.prepare();
  await input.reranker.prepare();
  const store = new InMemoryMemoryVectorStore();
  const startedAt = performance.now();
  const vectors = await embedRows(input.rows, input.provider);
  await store.rebuild(input.info, input.rows, vectors);
  const context: MemoryModelBenchmarkContext = {
    embeddingDurationMs: performance.now() - startedAt,
    profile,
    sourceStore: input.sourceStore,
    store,
    workerRssBytes: {}
  };
  await sampleMemoryModelWorkers(input.info, context);
  return context;
}

export async function memoryModelBenchmarkReport(
  info: WorkspaceInfo,
  context: MemoryModelBenchmarkContext
) {
  if (!context.profile) return undefined;
  await sampleMemoryModelWorkers(info, context);
  const cacheBytes = await selectedModelCacheBytes(info);
  return {
    cacheBytes,
    embeddingDurationMs: Math.round(context.embeddingDurationMs),
    models: {
      embedding: context.profile.embedding,
      reranking: context.profile.reranking
    },
    parentRssBytes: process.memoryUsage().rss,
    profile: context.profile.id,
    workerRssBytes: context.workerRssBytes,
    totalSampledRssBytes:
      process.memoryUsage().rss +
      Object.values(context.workerRssBytes).reduce(
        (total, value) => total + value,
        0
      )
  };
}

async function embedRows(
  rows: MemoryVectorRow[],
  provider: EmbeddingProvider
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (
    let index = 0;
    index < rows.length;
    index += BENCHMARK_EMBEDDING_BATCH_SIZE
  ) {
    const batch = rows.slice(index, index + BENCHMARK_EMBEDDING_BATCH_SIZE);
    const embedded = await provider.embedDocuments(
      batch.map((row) => row.embeddingText)
    );
    if (embedded.length !== batch.length)
      throw new Error("Benchmark embedding returned an invalid vector count.");
    vectors.push(...embedded);
  }
  return vectors;
}

async function sampleMemoryModelWorkers(
  info: WorkspaceInfo,
  context: MemoryModelBenchmarkContext
): Promise<void> {
  const workers = defaultMemoryInferenceManager.activeWorkers(info);
  for (const worker of workers) {
    const result = await defaultMemoryInferenceManager.run(
      info,
      worker.role,
      { action: "memoryUsage" }
    );
    if (!("memoryUsage" in result)) continue;
    const previous = context.workerRssBytes[worker.role] ?? 0;
    context.workerRssBytes[worker.role] = Math.max(
      previous,
      result.memoryUsage.rss
    );
  }
}

async function selectedModelCacheBytes(info: WorkspaceInfo): Promise<number> {
  const paths = new Set([
    localModelCachePath(info, "embedding"),
    localModelCachePath(info, "reranking")
  ]);
  const sizes = await Promise.all([...paths].map(directoryBytes));
  return sizes.reduce((total, size) => total + size, 0);
}

async function directoryBytes(root: string): Promise<number> {
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  let total = 0;
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) total += await directoryBytes(entryPath);
    if (!entry.isFile()) continue;
    const stat = await fs.stat(entryPath);
    total += stat.size;
  }
  return total;
}
