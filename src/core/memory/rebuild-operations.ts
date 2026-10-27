import { randomUUID } from "node:crypto";
import type { WorkspaceInfo } from "../types.js";
import {
  LanceDbMemoryVectorStore,
  readMemoryManifest,
  writeMemoryManifest
} from "./store.js";
import {
  DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE,
  isMemoryEmbeddingBatchSize,
  readWorkspaceSettingsInWorkspace
} from "./settings.js";
import { memoryProvidersMatch } from "./status.js";
import { chunkOrigin } from "./sources/chunks.js";
import { sha256Hex } from "./sources/files.js";
import { INDEXED_LAYERS, readIndexedSources } from "./sources/index.js";
import { materializeSources } from "./sources/materialize.js";
import {
  MEMORY_RETRIEVAL_CONTRACT,
  MEMORY_SCHEMA_VERSION,
  MEMORY_SOURCE_LAYERS
} from "./types.js";
import { compareSourcesToManifest } from "./source-comparison.js";
import type {
  EmbeddingProvider,
  MemoryChunk,
  MemoryManifest,
  MemoryManifestRecord,
  MemoryOperationOptions,
  MemorySource,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "./types.js";

export async function rebuildAllMemory(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryManifest> {
  const sources = await materializedSources(info, options);
  const records = flattenSources(sources);
  const vectors = await embedRecords(records, options);
  return publishGeneration(
    info,
    options,
    sources,
    vectorRows(records, vectors)
  );
}

export async function reconcileMemory(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryManifest> {
  const store = memoryStore(options.store);
  const manifest = await readMemoryManifest(info);
  if (
    !manifest ||
    manifest.schemaVersion !== MEMORY_SCHEMA_VERSION ||
    manifest.retrievalContract !== MEMORY_RETRIEVAL_CONTRACT
  )
    throw new Error("Memory schema changed. Run a full rebuild.");

  if (!memoryProvidersMatch(manifest, options.provider))
    throw new Error(
      "Embedding provider is incompatible with the memory manifest. Run a full rebuild."
    );

  const sources = await materializedSources(info, options);
  const { changedPaths, removedPaths } = compareSourcesToManifest(
    sources,
    manifest
  );
  if (!changedPaths.size && !removedPaths.size) return manifest;

  if (!store.readRows)
    throw new Error(
      "Memory store does not support generational reconciliation."
    );
  const currentRows = await store.readRows(info, manifest.generation);
  const preservedRows = currentRows.filter(
    (row) =>
      !changedPaths.has(row.sourcePath) && !removedPaths.has(row.sourcePath)
  );
  const changedRecords = flattenSources(
    sources.filter((source) => changedPaths.has(source.sourcePath))
  );
  const changedVectors = await embedRecords(changedRecords, options);
  const rows = [
    ...preservedRows,
    ...vectorRows(changedRecords, changedVectors)
  ];
  return publishGeneration(info, options, sources, rows);
}

async function materializedSources(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemorySource[]> {
  const settings = await readWorkspaceSettingsInWorkspace(info);
  const sources = await readIndexedSources(
    info,
    settings,
    options.indexedLayers ?? INDEXED_LAYERS
  );
  return materializeSources(sources, options.reranker);
}

async function publishGeneration(
  info: WorkspaceInfo,
  options: MemoryOperationOptions,
  sources: MemorySource[],
  rows: MemoryVectorRow[]
): Promise<MemoryManifest> {
  const store = memoryStore(options.store);
  const generation = generationId();
  validateRows(rows, options.provider);
  await store.rebuild(
    info,
    rows.map(recordWithoutVector),
    rows.map((row) => row.vector),
    generation
  );
  await validateStoredGeneration(store, info, generation, rows);
  const manifest = buildManifest(options.provider, sources, generation);
  await writeMemoryManifest(info, manifest);
  return manifest;
}

function memoryStore(store?: MemoryVectorStore): MemoryVectorStore {
  return store ?? new LanceDbMemoryVectorStore();
}

async function embedRecords(
  records: MemoryVectorRecord[],
  options: MemoryOperationOptions
): Promise<number[][]> {
  const vectors: number[][] = [];
  const batchSize = embeddingBatchSize(options.batchSize);
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    const batchVectors = await options.provider.embedDocuments(
      batch.map((record) => record.embeddingText)
    );
    if (batchVectors.length !== batch.length)
      throw new Error(
        "Embedding provider returned an unexpected vector count."
      );
    vectors.push(...batchVectors);
  }
  return vectors;
}

function embeddingBatchSize(batchSize: number | undefined): number {
  if (isMemoryEmbeddingBatchSize(batchSize)) return batchSize;
  return DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE;
}

function vectorRows(
  records: MemoryVectorRecord[],
  vectors: number[][]
): MemoryVectorRow[] {
  return records.map((record, index) => ({
    ...record,
    vector: vectors[index] ?? []
  }));
}

function recordWithoutVector(row: MemoryVectorRow): MemoryVectorRecord {
  const { vector: _vector, ...record } = row;
  return record;
}

function validateRows(
  rows: MemoryVectorRow[],
  provider: EmbeddingProvider
): void {
  const dimensions = provider.describe().dimensions;
  const invalid = rows.find((row) => row.vector.length !== dimensions);
  if (!invalid) return;
  throw new Error(
    `Memory record ${invalid.recordId} has an invalid vector dimension.`
  );
}

async function validateStoredGeneration(
  store: MemoryVectorStore,
  info: WorkspaceInfo,
  generation: string,
  rows: MemoryVectorRow[]
): Promise<void> {
  if (!rows.length) return;
  const exists = await store.exists(info, generation);
  if (!exists) throw new Error("Memory generation was not persisted.");
  const recordIds = await store.listRecordIds(info, generation);
  if (recordIds.length !== rows.length)
    throw new Error("Memory generation record count is inconsistent.");
  await store.validateGeneration(info, generation);
}

function flattenSources(sources: MemorySource[]): MemoryVectorRecord[] {
  return sources.flatMap((source) =>
    source.chunks.map((chunk) => vectorRecordFromChunk(source, chunk))
  );
}

function vectorRecordFromChunk(
  source: MemorySource,
  chunk: MemoryChunk
): MemoryVectorRecord {
  const passageSha256 = sha256Hex(chunk.text);
  return {
    recordId: chunk.recordId,
    threadId: source.threadId,
    title: source.title,
    closedAt: source.closedAt,
    summaryPath: source.summaryPath,
    relativeSummaryPath: source.relativeSummaryPath,
    reference: source.reference,
    kind: chunk.kind,
    sectionTitle: chunk.sectionTitle,
    text: chunk.text,
    embeddingText: chunk.embeddingText,
    sourceType: source.sourceType,
    layer: MEMORY_SOURCE_LAYERS[source.sourceType],
    sourcePath: source.sourcePath,
    authority: source.authority,
    lineStart: chunk.lineStart,
    lineEnd: chunk.lineEnd,
    sourceSha256: source.sourceSha256,
    passageOrdinal: chunk.passageOrdinal,
    passageSha256,
    passageId: `${source.sourcePath}#${passageSha256.slice(0, 16)}`,
    ...chunkOrigin(chunk)
  };
}

function buildManifest(
  provider: EmbeddingProvider,
  sources: MemorySource[],
  generation: string
): MemoryManifest {
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    builtAt: new Date().toISOString(),
    generation,
    embeddingProvider: provider.describe(),
    retrievalContract: MEMORY_RETRIEVAL_CONTRACT,
    records: sources.map(sourceToManifestRecord)
  };
}

function sourceToManifestRecord(source: MemorySource): MemoryManifestRecord {
  return {
    threadId: source.threadId,
    title: source.title,
    closedAt: source.closedAt,
    summaryPath: source.summaryPath,
    relativeSummaryPath: source.relativeSummaryPath,
    reference: source.reference,
    sha256: source.sha256,
    mtimeMs: source.mtimeMs,
    recordIds: source.chunks.map((chunk) => chunk.recordId),
    sourceType: source.sourceType,
    layer: MEMORY_SOURCE_LAYERS[source.sourceType],
    authority: source.authority,
    sourcePath: source.sourcePath
  };
}

function generationId(): string {
  const timestamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  return `${timestamp}_${randomUUID().slice(0, 8)}`;
}
