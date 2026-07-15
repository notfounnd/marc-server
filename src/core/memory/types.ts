import type { WorkspaceInfo } from "../types.js";

export type MemoryDistance = "cosine";
export type MemoryRuntime = "local" | "external";
export type MemoryRecordKind = "summary" | "section";

export type EmbeddingProviderMetadata = {
  id: string;
  name: string;
  model: string;
  version: string;
  dimensions: number;
  distance: MemoryDistance;
  quantized: boolean;
  runtime: MemoryRuntime;
};

export type EmbeddingProvider = {
  describe(): EmbeddingProviderMetadata;
  isPrepared(): Promise<boolean>;
  prepare(): Promise<void>;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
  dispose(): Promise<void>;
};

export type MemoryChunk = {
  recordId: string;
  kind: MemoryRecordKind;
  sectionTitle?: string;
  text: string;
};

export type ThreadSummarySource = {
  threadId: string;
  title: string;
  closedAt?: string;
  summaryPath: string;
  relativeSummaryPath: string;
  reference: string;
  markdown: string;
  sha256: string;
  mtimeMs: number;
  chunks: MemoryChunk[];
};

export type MemoryVectorRecord = {
  recordId: string;
  threadId: string;
  title: string;
  closedAt?: string;
  summaryPath: string;
  relativeSummaryPath: string;
  reference: string;
  kind: MemoryRecordKind;
  sectionTitle?: string;
  text: string;
};

export type MemoryManifestRecord = {
  threadId: string;
  title: string;
  closedAt?: string;
  summaryPath: string;
  relativeSummaryPath: string;
  reference: string;
  sha256: string;
  mtimeMs: number;
  recordIds: string[];
};

export type MemoryManifest = {
  schemaVersion: 1;
  builtAt: string;
  embeddingProvider: EmbeddingProviderMetadata;
  records: MemoryManifestRecord[];
};

export type MemoryStatusState =
  | "ready"
  | "rebuilding"
  | "missing"
  | "stale"
  | "model_missing"
  | "incompatible";

export type MemoryStatus = {
  status: MemoryStatusState;
  ready: boolean;
  stale: boolean;
  modelPrepared: boolean;
  summaryCount: number;
  indexedSummaryCount: number;
  missingSummaryIds: string[];
  staleSummaryIds: string[];
  extraSummaryIds: string[];
  message: string;
};

export type MemorySearchHit = {
  record: MemoryVectorRecord;
  score: number;
};

export type MemoryRecallResult = {
  query: string;
  indexStatus: MemoryStatus;
  results: MemoryRecallHit[];
  nextActions: string[];
};

export type MemoryRecallHit = {
  threadId: string;
  title: string;
  closedAt?: string;
  summaryPath: string;
  reference: string;
  matchedText: string;
  score: number;
  reason: string;
};

export type MemoryVectorStore = {
  exists(info: WorkspaceInfo): Promise<boolean>;
  rebuild(
    info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][]
  ): Promise<void>;
  search(
    info: WorkspaceInfo,
    vector: number[],
    options: { limit: number; minScore: number }
  ): Promise<MemorySearchHit[]>;
};

export type MemoryOperationOptions = {
  provider: EmbeddingProvider;
  store?: MemoryVectorStore;
};

export type MemoryRecallOptions = MemoryOperationOptions & {
  query: string;
  limit?: number;
  minScore?: number;
};
