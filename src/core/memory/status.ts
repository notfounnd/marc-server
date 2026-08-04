import type {
  EmbeddingProvider,
  MemoryManifest,
  MemoryMaintenance,
  MemoryStatus,
  MemoryStatusState,
  ThreadSummarySource
} from "./types.js";

export type MemoryManifestComparison = {
  stale: boolean;
  missingSummaryIds: string[];
  staleSummaryIds: string[];
  extraSummaryIds: string[];
};

export function buildMemoryStatus(
  status: MemoryStatusState,
  sources: ThreadSummarySource[],
  manifest: MemoryManifest | undefined,
  models: {
    interpreterPrepared: boolean;
    maintenance?: MemoryMaintenance;
    rerankerPrepared: boolean;
    retrieverPrepared: boolean;
  }
): MemoryStatus {
  const modelPrepared =
    models.retrieverPrepared &&
    models.rerankerPrepared &&
    models.interpreterPrepared;
  return {
    status,
    ready: status === "ready",
    stale: status === "stale",
    modelPrepared,
    retrieverPrepared: models.retrieverPrepared,
    rerankerPrepared: models.rerankerPrepared,
    interpreterPrepared: models.interpreterPrepared,
    rebuildReady: models.retrieverPrepared && models.rerankerPrepared,
    searchReady: modelPrepared && (status === "ready" || status === "stale"),
    summaryCount: sources.length,
    indexedSummaryCount: manifest?.records.length ?? 0,
    missingSummaryIds: [],
    staleSummaryIds: [],
    extraSummaryIds: [],
    maintenance: models.maintenance,
    message: memoryStatusMessage(status, models)
  };
}

export function memoryProvidersMatch(
  manifest: MemoryManifest,
  provider: EmbeddingProvider
): boolean {
  if (manifest.schemaVersion !== 6) return false;
  if (manifest.retrievalContract !== "field-aware-hybrid-v2") return false;
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

export function compareMemoryManifestSources(
  manifest: MemoryManifest,
  sources: ThreadSummarySource[]
): MemoryManifestComparison {
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

function memoryStatusMessage(
  status: MemoryStatusState,
  models: {
    interpreterPrepared: boolean;
    rerankerPrepared: boolean;
    retrieverPrepared: boolean;
  }
): string {
  if (!models.retrieverPrepared)
    return "Local memory retrieval model is not prepared.";
  if (!models.rerankerPrepared && status === "ready")
    return "Memory index is current. Local memory reranking model is not prepared.";
  if (!models.rerankerPrepared && status === "stale")
    return "Memory index is stale. Local memory reranking model is not prepared.";
  if (!models.interpreterPrepared && status === "ready")
    return "Memory index is current. Local query interpretation model is not prepared.";
  if (!models.interpreterPrepared && status === "stale")
    return "Memory index is stale. Local query interpretation model is not prepared.";
  const messages: Record<MemoryStatusState, string> = {
    ready: "Memory index is current.",
    rebuilding: "Memory rebuild is running.",
    missing: "Memory index has not been built.",
    stale: "Memory index is stale.",
    model_missing: "Local memory retrieval model is not prepared.",
    incompatible: "Memory index was built with a different provider contract."
  };
  return messages[status];
}
