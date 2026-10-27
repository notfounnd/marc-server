import { MEMORY_RETRIEVAL_CONTRACT, MEMORY_SCHEMA_VERSION } from "./types.js";
import type { MemorySource } from "./sources/contract.js";
import { compareSourcesToManifest } from "./source-comparison.js";
import type {
  EmbeddingProvider,
  MemoryManifest,
  MemoryMaintenance,
  MemoryStatus,
  MemoryStatusState
} from "./types.js";

export type MemoryManifestComparison = {
  stale: boolean;
  missingSummaryIds: string[];
  staleSummaryIds: string[];
  extraSummaryIds: string[];
};

export function buildMemoryStatus(
  status: MemoryStatusState,
  sources: readonly MemorySource[],
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
    summaryCount: sources.filter((source) => source.sourceType === "summary")
      .length,
    indexedSummaryCount:
      manifest?.records.filter((record) => record.sourceType === "summary")
        .length ?? 0,
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
  if (manifest.schemaVersion !== MEMORY_SCHEMA_VERSION) return false;
  if (manifest.retrievalContract !== MEMORY_RETRIEVAL_CONTRACT) return false;
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

/**
 * Status comparison over every indexed layer, by source path, with the rule of reconcile.
 * Stale means reconcile has work to do. The summary ids report the summary part of it.
 */
export function compareMemoryManifestSources(
  manifest: MemoryManifest,
  sources: readonly MemorySource[]
): MemoryManifestComparison {
  const { changedPaths, removedPaths } = compareSourcesToManifest(
    sources,
    manifest
  );
  const manifestPaths = new Set(
    manifest.records.map((record) => record.sourcePath)
  );
  const summarySources = sources.filter(
    (source) => source.sourceType === "summary"
  );
  const missingSummaryIds = summarySources
    .filter((source) => !manifestPaths.has(source.sourcePath))
    .map((source) => source.threadId);
  const staleSummaryIds = summarySources
    .filter(
      (source) =>
        manifestPaths.has(source.sourcePath) &&
        changedPaths.has(source.sourcePath)
    )
    .map((source) => source.threadId);
  const extraSummaryIds = manifest.records
    .filter(
      (record) =>
        record.sourceType === "summary" && removedPaths.has(record.sourcePath)
    )
    .map((record) => record.threadId);
  return {
    stale: changedPaths.size > 0 || removedPaths.size > 0,
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
