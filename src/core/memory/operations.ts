import type { WorkspaceInfo } from "../types.js";
import {
  LanceDbMemoryVectorStore,
  readMemoryManifest,
  writeMemoryManifest
} from "./store.js";
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
  MemoryStatusState,
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
  if (!modelPrepared) return memoryStatus("model_missing", sources, manifest);
  if (!manifest || !storeExists)
    return memoryStatus("missing", sources, manifest);
  if (!providersMatch(manifest, provider)) {
    return memoryStatus("incompatible", sources, manifest);
  }

  const stale = compareManifestSources(manifest, sources);
  if (stale.stale) {
    return {
      ...memoryStatus("stale", sources, manifest),
      missingSummaryIds: stale.missingSummaryIds,
      staleSummaryIds: stale.staleSummaryIds,
      extraSummaryIds: stale.extraSummaryIds
    };
  }

  return memoryStatus("ready", sources, manifest);
}

export async function rebuildMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryManifest> {
  const provider = options.provider;
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
  const hits = await memoryStore(options.store).search(info, vector, {
    limit: options.limit ?? DEFAULT_LIMIT,
    minScore: options.minScore ?? DEFAULT_MIN_SCORE
  });
  await options.provider.dispose();
  const results = dedupeRecallHits(hitsToRecallResults(hits));
  return {
    query: options.query,
    indexStatus: status,
    results,
    nextActions: nextActionsForResults(results, status)
  };
}

function memoryStore(store?: MemoryVectorStore): MemoryVectorStore {
  return store ?? new LanceDbMemoryVectorStore();
}

function memoryStatus(
  status: MemoryStatusState,
  sources: ThreadSummarySource[],
  manifest?: MemoryManifest
): MemoryStatus {
  return {
    status,
    ready: status === "ready",
    stale: status === "stale",
    modelPrepared: status !== "model_missing",
    summaryCount: sources.length,
    indexedSummaryCount: manifest?.records.length ?? 0,
    missingSummaryIds: [],
    staleSummaryIds: [],
    extraSummaryIds: [],
    message: memoryStatusMessage(status)
  };
}

function memoryStatusMessage(status: MemoryStatusState): string {
  const messages: Record<MemoryStatusState, string> = {
    ready: "Memory index is current.",
    missing: "Memory index has not been built.",
    stale: "Memory index is stale.",
    model_missing: "Local memory embedding model is not prepared.",
    incompatible: "Memory index was built with a different provider contract."
  };
  return messages[status];
}

function providersMatch(
  manifest: MemoryManifest,
  provider: EmbeddingProvider
): boolean {
  const current = provider.describe();
  const stored = manifest.embeddingProvider;
  return (
    stored.id === current.id &&
    stored.model === current.model &&
    stored.version === current.version &&
    stored.dimensions === current.dimensions &&
    stored.distance === current.distance
  );
}

function compareManifestSources(
  manifest: MemoryManifest,
  sources: ThreadSummarySource[]
): {
  stale: boolean;
  missingSummaryIds: string[];
  staleSummaryIds: string[];
  extraSummaryIds: string[];
} {
  const sourceMap = new Map(sources.map((source) => [source.threadId, source]));
  const manifestMap = new Map(
    manifest.records.map((record) => [record.threadId, record])
  );
  const missingSummaryIds = sources
    .filter((source) => !manifestMap.has(source.threadId))
    .map((source) => source.threadId);
  const staleSummaryIds = sources
    .filter(
      (source) => manifestMap.get(source.threadId)?.sha256 !== source.sha256
    )
    .map((source) => source.threadId);
  const extraSummaryIds = manifest.records
    .filter((record) => !sourceMap.has(record.threadId))
    .map((record) => record.threadId);
  return {
    stale:
      missingSummaryIds.length > 0 ||
      staleSummaryIds.length > 0 ||
      extraSummaryIds.length > 0,
    missingSummaryIds,
    staleSummaryIds,
    extraSummaryIds
  };
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

function hitsToRecallResults(
  hits: Array<{ record: MemoryVectorRecord; score: number }>
): MemoryRecallHit[] {
  return hits.map((hit) => ({
    threadId: hit.record.threadId,
    title: hit.record.title,
    closedAt: hit.record.closedAt,
    summaryPath: hit.record.relativeSummaryPath,
    reference: hit.record.reference,
    matchedText: hit.record.text,
    score: hit.score,
    reason: reasonForHit(hit.record)
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

function reasonForHit(record: MemoryVectorRecord): string {
  const label = record.sectionTitle ?? "summary";
  return `Matched ${label} in ${record.title}.`;
}

function nextActionsForResults(
  results: MemoryRecallHit[],
  status: MemoryStatus
): string[] {
  const actions = results.map(
    (result) =>
      `Call thread_read for ${result.reference} before reopening or contradicting this historical decision.`
  );
  if (status.status !== "stale") return actions;
  return [
    "Run memory_rebuild when possible because the memory index is stale.",
    ...actions
  ];
}
