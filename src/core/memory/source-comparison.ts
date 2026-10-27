import { MEMORY_SOURCE_LAYERS, type MemorySource } from "./sources/contract.js";
import type { MemoryManifest, MemoryManifestRecord } from "./types.js";

/** The sources that differ from the manifest: new or changed ones, and records whose source is gone. */
export type SourceComparison = {
  changedPaths: Set<string>;
  removedPaths: Set<string>;
};

/**
 * The one comparison that status and reconcile share, by source path. A source is changed
 * when its record is missing or its hash, authority, source type or layer differs. A record
 * is removed when no current source has its path. Status is stale exactly when reconcile
 * has work to do.
 */
export function compareSourcesToManifest(
  sources: readonly MemorySource[],
  manifest: MemoryManifest
): SourceComparison {
  const previous = new Map(
    manifest.records.map((record) => [record.sourcePath, record])
  );
  const currentPaths = new Set(sources.map((source) => source.sourcePath));
  return {
    changedPaths: new Set(
      sources
        .filter((source) =>
          isChangedSource(source, previous.get(source.sourcePath))
        )
        .map((source) => source.sourcePath)
    ),
    removedPaths: new Set(
      manifest.records
        .filter((record) => !currentPaths.has(record.sourcePath))
        .map((record) => record.sourcePath)
    )
  };
}

// The hash covers only the content. Authority, layer, and source type are stored in
// every indexed record too, so a change in any of them re-indexes the source.
export function isChangedSource(
  source: MemorySource,
  record: MemoryManifestRecord | undefined
): boolean {
  if (!record) return true;
  if (record.sha256 !== source.sha256) return true;
  if (record.authority !== source.authority) return true;
  if (record.sourceType !== source.sourceType) return true;
  return record.layer !== MEMORY_SOURCE_LAYERS[source.sourceType];
}
