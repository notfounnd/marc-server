import type {
  EmbeddingProvider,
  MemoryManifest,
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

export function memoryProvidersMatch(
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

function memoryStatusMessage(status: MemoryStatusState): string {
  const messages: Record<MemoryStatusState, string> = {
    ready: "Memory index is current.",
    rebuilding: "Memory rebuild is running.",
    missing: "Memory index has not been built.",
    stale: "Memory index is stale.",
    model_missing: "Local memory embedding model is not prepared.",
    incompatible: "Memory index was built with a different provider contract."
  };
  return messages[status];
}
