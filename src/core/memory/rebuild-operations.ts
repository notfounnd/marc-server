import { randomUUID } from "node:crypto";
import type { WorkspaceInfo } from "../types.js";
import {
  LanceDbMemoryVectorStore,
  readMemoryManifest,
  writeMemoryManifest
} from "./store.js";
import {
  DEFAULT_MEMORY_EMBEDDING_BATCH_SIZE,
  isMemoryEmbeddingBatchSize
} from "./settings.js";
import {
  materializeThreadSummarySources,
  scanThreadSummarySources
} from "./summaries.js";
import type {
  EmbeddingProvider,
  MemoryManifest,
  MemoryManifestRecord,
  MemoryOperationOptions,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore,
  ThreadSummarySource
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
    manifest.schemaVersion !== 6 ||
    manifest.retrievalContract !== "field-aware-hybrid-v2"
  )
    throw new Error("Memory schema changed. Run a full rebuild.");

  const sources = await materializedSources(info, options);
  const changedThreadIds = changedSourceIds(sources, manifest);
  const removedThreadIds = removedSourceIds(sources, manifest);
  if (!changedThreadIds.size && !removedThreadIds.size) return manifest;

  if (!store.readRows)
    throw new Error(
      "Memory store does not support generational reconciliation."
    );
  const currentRows = await store.readRows(info, manifest.generation);
  const preservedRows = currentRows.filter(
    (row) =>
      !changedThreadIds.has(row.threadId) && !removedThreadIds.has(row.threadId)
  );
  const changedRecords = flattenSources(
    sources.filter((source) => changedThreadIds.has(source.threadId))
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
): Promise<ThreadSummarySource[]> {
  const sources = await scanThreadSummarySources(info);
  return materializeThreadSummarySources(sources, options.reranker);
}

async function publishGeneration(
  info: WorkspaceInfo,
  options: MemoryOperationOptions,
  sources: ThreadSummarySource[],
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

function changedSourceIds(
  sources: ThreadSummarySource[],
  manifest: MemoryManifest
): Set<string> {
  const previousHashes = new Map(
    manifest.records.map((record) => [record.threadId, record.sha256])
  );
  return new Set(
    sources
      .filter((source) => previousHashes.get(source.threadId) !== source.sha256)
      .map((source) => source.threadId)
  );
}

function removedSourceIds(
  sources: ThreadSummarySource[],
  manifest: MemoryManifest
): Set<string> {
  const currentIds = new Set(sources.map((source) => source.threadId));
  return new Set(
    manifest.records
      .filter((record) => !currentIds.has(record.threadId))
      .map((record) => record.threadId)
  );
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
      text: chunk.text,
      embeddingText: chunk.embeddingText
    }))
  );
}

function buildManifest(
  provider: EmbeddingProvider,
  sources: ThreadSummarySource[],
  generation: string
): MemoryManifest {
  return {
    schemaVersion: 6,
    builtAt: new Date().toISOString(),
    generation,
    embeddingProvider: provider.describe(),
    retrievalContract: "field-aware-hybrid-v2",
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

function generationId(): string {
  const timestamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  return `${timestamp}_${randomUUID().slice(0, 8)}`;
}
