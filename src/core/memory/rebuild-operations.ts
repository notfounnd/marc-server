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
import { scanThreadSummarySources } from "./summaries.js";
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
  const sources = await scanThreadSummarySources(info);
  const records = flattenSources(sources);
  const vectors = await embedRecords(records, options);
  const manifest = buildManifest(options.provider, sources);
  await memoryStore(options.store).rebuild(info, records, vectors);
  await writeMemoryManifest(info, manifest);
  return manifest;
}

export async function reconcileMemory(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryManifest> {
  const store = memoryStore(options.store);
  const [manifest, sources, storeExists] = await Promise.all([
    readMemoryManifest(info),
    scanThreadSummarySources(info),
    store.exists(info)
  ]);
  const existingRecordIds = await existingMemoryRecordIds(
    store,
    info,
    manifest,
    storeExists
  );
  const reconciliation = planMemoryReconciliation(
    sources,
    manifest,
    existingRecordIds
  );
  if (!reconciliationHasChanges(reconciliation))
    return manifest ?? buildManifest(options.provider, sources);

  const vectors = await embedRecords(reconciliation.rowsToEmbed, options);
  const rows = vectorRows(reconciliation.rowsToEmbed, vectors);
  await store.reconcile(info, rows, reconciliation.removeRecordIds);
  const nextManifest = buildManifest(options.provider, sources);
  await writeMemoryManifest(info, nextManifest);
  return nextManifest;
}

function memoryStore(store?: MemoryVectorStore): MemoryVectorStore {
  return store ?? new LanceDbMemoryVectorStore();
}

async function existingMemoryRecordIds(
  store: MemoryVectorStore,
  info: WorkspaceInfo,
  manifest: MemoryManifest | undefined,
  storeExists: boolean
): Promise<string[]> {
  if (manifest) return [];
  if (!storeExists) return [];
  return store.listRecordIds(info);
}

function reconciliationHasChanges(
  reconciliation: MemoryReconciliation
): boolean {
  return Boolean(
    reconciliation.rowsToEmbed.length || reconciliation.removeRecordIds.length
  );
}

function planMemoryReconciliation(
  sources: ThreadSummarySource[],
  manifest: MemoryManifest | undefined,
  existingRecordIds: string[]
): MemoryReconciliation {
  if (!manifest)
    return planMissingMemoryReconciliation(sources, existingRecordIds);

  const sourcesByThreadId = new Map(
    sources.map((source) => [source.threadId, source])
  );
  const changedSources = sources.filter((source) =>
    sourceNeedsEmbedding(source, manifest)
  );
  const rowsToEmbed = flattenSources(changedSources);
  const currentRecordIds = new Set(
    rowsToEmbed.map((record) => record.recordId)
  );
  const previousRecordIds = manifest.records
    .filter((record) => manifestRecordNeedsRemoval(record, sourcesByThreadId))
    .flatMap((record) => record.recordIds);
  return {
    rowsToEmbed,
    removeRecordIds: removedRecordIds(previousRecordIds, currentRecordIds)
  };
}

function planMissingMemoryReconciliation(
  sources: ThreadSummarySource[],
  existingRecordIds: string[]
): MemoryReconciliation {
  const rowsToEmbed = flattenSources(sources);
  const currentRecordIds = new Set(
    rowsToEmbed.map((record) => record.recordId)
  );
  return {
    rowsToEmbed,
    removeRecordIds: removedRecordIds(existingRecordIds, currentRecordIds)
  };
}

function sourceNeedsEmbedding(
  source: ThreadSummarySource,
  manifest: MemoryManifest
): boolean {
  const previous = manifest.records.find(
    (record) => record.threadId === source.threadId
  );
  if (!previous) return true;
  return previous.sha256 !== source.sha256;
}

function manifestRecordNeedsRemoval(
  record: MemoryManifestRecord,
  sourcesByThreadId: Map<string, ThreadSummarySource>
): boolean {
  const source = sourcesByThreadId.get(record.threadId);
  if (!source) return true;
  return source.sha256 !== record.sha256;
}

function removedRecordIds(
  recordIds: string[],
  currentRecordIds: Set<string>
): string[] {
  return [...new Set(recordIds)].filter(
    (recordId) => !currentRecordIds.has(recordId)
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
      batch.map((record) => record.text)
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

type MemoryReconciliation = {
  rowsToEmbed: MemoryVectorRecord[];
  removeRecordIds: string[];
};

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
