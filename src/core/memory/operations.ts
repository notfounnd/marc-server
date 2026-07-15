import type { WorkspaceInfo } from "../types.js";
import {
  LanceDbMemoryVectorStore,
  readMemoryManifest,
  writeMemoryManifest
} from "./store.js";
import {
  memoryRecallCandidateOptions,
  rankMemoryHits,
  type RankedMemoryHit
} from "./ranking.js";
import { nextActionsForRecallResults } from "./recall-actions.js";
import {
  tryWithMemoryRebuildLock,
  type MemoryRebuildAttempt
} from "./rebuild-coordination.js";
import {
  buildMemoryStatus,
  compareMemoryManifestSources,
  memoryProvidersMatch
} from "./status.js";
import { scanThreadSummarySources } from "./summaries.js";
import type {
  EmbeddingProvider,
  MemoryManifest,
  MemoryManifestRecord,
  MemoryOperationOptions,
  MemoryRecallHit,
  MemoryRecallOptions,
  MemoryRecallResult,
  MemoryStatus,
  MemoryVectorRecord,
  MemoryVectorStore,
  ThreadSummarySource
} from "./types.js";

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SCORE = 0.15;

export async function prepareMemoryInWorkspace(
  provider: EmbeddingProvider
): Promise<{
  prepared: true;
  provider: ReturnType<EmbeddingProvider["describe"]>;
}> {
  await provider.prepare();
  return { prepared: true, provider: provider.describe() };
}

export async function readMemoryStatusInWorkspace(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryStatus> {
  const store = memoryStore(options.store);
  const provider = options.provider;
  const [manifest, sources, modelPrepared, storeExists] = await Promise.all([
    readMemoryManifest(info),
    scanThreadSummarySources(info),
    provider.isPrepared(),
    store.exists(info)
  ]);
  if (!modelPrepared)
    return buildMemoryStatus("model_missing", sources, manifest);
  if (!manifest || !storeExists)
    return buildMemoryStatus("missing", sources, manifest);
  if (!memoryProvidersMatch(manifest, provider)) {
    return buildMemoryStatus("incompatible", sources, manifest);
  }

  const stale = compareMemoryManifestSources(manifest, sources);
  if (stale.stale) {
    return {
      ...buildMemoryStatus("stale", sources, manifest),
      missingSummaryIds: stale.missingSummaryIds,
      staleSummaryIds: stale.staleSummaryIds,
      extraSummaryIds: stale.extraSummaryIds
    };
  }

  return buildMemoryStatus("ready", sources, manifest);
}

export async function rebuildMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryRebuildAttempt> {
  const provider = options.provider;
  const attempt = await tryWithMemoryRebuildLock(info, async () => {
    const sources = await scanThreadSummarySources(info);
    const records = flattenSources(sources);
    const vectors = await provider.embedDocuments(
      records.map((record) => record.text)
    );
    const manifest = buildManifest(provider, sources);
    await memoryStore(options.store).rebuild(info, records, vectors);
    await writeMemoryManifest(info, manifest);
    await provider.dispose();
    return manifest;
  });

  if (!attempt.acquired) {
    await provider.dispose();
    return attempt;
  }

  return { acquired: true, manifest: attempt.value };
}

export async function recallMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryRecallOptions
): Promise<MemoryRecallResult> {
  const status = await readMemoryStatusInWorkspace(info, options);
  if (status.status === "model_missing") {
    return recallWithoutResults(options.query, status, [
      "Run memory_prepare before using memory_recall."
    ]);
  }
  if (status.status === "missing") {
    return recallWithoutResults(options.query, status, [
      "Run memory_rebuild before using memory_recall."
    ]);
  }
  if (status.status === "incompatible") {
    return recallWithoutResults(options.query, status, [
      "Run memory_rebuild because the embedding provider changed."
    ]);
  }

  const vector = await options.provider.embedQuery(options.query);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const hits = await memoryStore(options.store).search(
    info,
    vector,
    memoryRecallCandidateOptions(limit, minScore)
  );
  const results = dedupeRecallHits(
    hitsToRecallResults(
      rankMemoryHits(options.query, hits).filter((hit) => hit.score >= minScore)
    )
  ).slice(0, limit);
  return {
    query: options.query,
    indexStatus: status,
    results,
    nextActions: nextActionsForRecallResults(results, status)
  };
}

function memoryStore(store?: MemoryVectorStore): MemoryVectorStore {
  return store ?? new LanceDbMemoryVectorStore();
}

function flattenSources(sources: ThreadSummarySource[]): MemoryVectorRecord[] {
  return sources.flatMap((source) =>
    source.chunks.map((chunk) => ({
      recordId: chunk.recordId,
      threadId: source.threadId,
      title: source.title,
      closedAt: source.closedAt,
      summaryPath: source.summaryPath,
      relativeSummaryPath: source.relativeSummaryPath,
      reference: source.reference,
      kind: chunk.kind,
      sectionTitle: chunk.sectionTitle,
      text: chunk.text
    }))
  );
}

function buildManifest(
  provider: EmbeddingProvider,
  sources: ThreadSummarySource[]
): MemoryManifest {
  return {
    schemaVersion: 1,
    builtAt: new Date().toISOString(),
    embeddingProvider: provider.describe(),
    records: sources.map(sourceToManifestRecord)
  };
}

function sourceToManifestRecord(
  source: ThreadSummarySource
): MemoryManifestRecord {
  return {
    threadId: source.threadId,
    title: source.title,
    closedAt: source.closedAt,
    summaryPath: source.summaryPath,
    relativeSummaryPath: source.relativeSummaryPath,
    reference: source.reference,
    sha256: source.sha256,
    mtimeMs: source.mtimeMs,
    recordIds: source.chunks.map((chunk) => chunk.recordId)
  };
}

function recallWithoutResults(
  query: string,
  status: MemoryStatus,
  nextActions: string[]
): MemoryRecallResult {
  return { query, indexStatus: status, results: [], nextActions };
}

function hitsToRecallResults(hits: RankedMemoryHit[]): MemoryRecallHit[] {
  return hits.map((hit) => ({
    threadId: hit.record.threadId,
    title: hit.record.title,
    closedAt: hit.record.closedAt,
    summaryPath: hit.record.relativeSummaryPath,
    reference: hit.record.reference,
    matchedText: hit.record.text,
    score: hit.score,
    reason: hit.reason
  }));
}

function dedupeRecallHits(hits: MemoryRecallHit[]): MemoryRecallHit[] {
  const seen = new Set<string>();
  const results: MemoryRecallHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.threadId)) continue;
    seen.add(hit.threadId);
    results.push(hit);
  }
  return results;
}
