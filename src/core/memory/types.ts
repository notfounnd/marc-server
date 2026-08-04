import type { WorkspaceInfo } from "../types.js";

export type MemoryDistance = "cosine";
export type MemoryRuntime = "local" | "external";
export type MemoryRecordKind = "identity" | "summary" | "section" | "passage";

export type MemoryRebuildMode = "incremental" | "full";

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

export type RerankingProviderMetadata = {
  id: string;
  name: string;
  model: string;
  version: string;
  quantized: boolean;
  runtime: MemoryRuntime;
};

export type RerankingProvider = {
  describe(): RerankingProviderMetadata;
  isPrepared(): Promise<boolean>;
  prepare(): Promise<void>;
  rerank(
    query: string,
    documents: string[],
    batchSize: number
  ): Promise<number[]>;
  splitPassages(
    texts: string[],
    options: { maxTokens: number; overlapTokens: number }
  ): Promise<string[][]>;
  dispose(): Promise<void>;
};

export type QueryInterpretationProviderMetadata = {
  id: string;
  name: string;
  model: string;
  version: string;
  quantized: boolean;
  runtime: MemoryRuntime;
};

export type QueryInterpretationProvider = {
  describe(): QueryInterpretationProviderMetadata;
  isPrepared(): Promise<boolean>;
  prepare(): Promise<void>;
  selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string>;
  dispose(): Promise<void>;
};

export type MemoryQueryMode = "auto" | "literal";

export type MemoryQueryInterpretation = {
  originalQuery: string;
  effectiveQuery: string;
  suggestedQuery?: string;
  mode: MemoryQueryMode;
  correctionApplied: boolean;
};

export type MemoryChunk = {
  recordId: string;
  kind: MemoryRecordKind;
  sectionTitle?: string;
  text: string;
  embeddingText: string;
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
  embeddingText: string;
};

export type MemoryVectorRow = MemoryVectorRecord & {
  vector: number[];
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
  schemaVersion: 6;
  builtAt: string;
  generation: string;
  embeddingProvider: EmbeddingProviderMetadata;
  retrievalContract: "field-aware-hybrid-v2";
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
  retrieverPrepared: boolean;
  rerankerPrepared: boolean;
  interpreterPrepared: boolean;
  rebuildReady: boolean;
  searchReady: boolean;
  summaryCount: number;
  indexedSummaryCount: number;
  missingSummaryIds: string[];
  staleSummaryIds: string[];
  extraSummaryIds: string[];
  maintenance?: MemoryMaintenance;
  message: string;
};

export type MemorySearchHit = {
  record: MemoryVectorRecord;
  score: number;
};

export type MemoryLexicalField = "title" | "summary" | "titlePrefix";

export type MemoryLexicalSearchHit = {
  field: MemoryLexicalField;
  record: MemoryVectorRecord;
  score: number;
  vectorScore: number;
};

export type MemorySearchChannels = {
  identities: MemorySearchHit[];
  passages: MemorySearchHit[];
  lexical: MemoryLexicalSearchHit[];
};

export type MemoryRecallResult = {
  query: string;
  interpretation: MemoryQueryInterpretation;
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
  exists(info: WorkspaceInfo, generation?: string): Promise<boolean>;
  listRecordIds(info: WorkspaceInfo, generation?: string): Promise<string[]>;
  readRows?(
    info: WorkspaceInfo,
    generation?: string
  ): Promise<MemoryVectorRow[]>;
  rebuild(
    info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation?: string
  ): Promise<void>;
  reconcile(
    info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void>;
  validateGeneration(info: WorkspaceInfo, generation: string): Promise<void>;
  searchVector(
    info: WorkspaceInfo,
    vector: number[],
    options: {
      generation?: string;
      kind?: "identity" | "passage";
      limit: number;
    }
  ): Promise<MemorySearchHit[]>;
  searchLexical(
    info: WorkspaceInfo,
    query: string,
    vector: number[],
    options: {
      field: MemoryLexicalField;
      generation?: string;
      limit: number;
    }
  ): Promise<MemoryLexicalSearchHit[]>;
  purgeUnused?(
    info: WorkspaceInfo,
    activeGeneration?: string
  ): Promise<MemoryStorePurgeResult>;
};

export type MemoryStorePurgeResult = {
  bytesRemoved: number;
  generationsRemoved: string[];
  oldVersionsRemoved: number;
};

export type MemoryInferenceModelRole =
  | "interpreter"
  | "retriever"
  | "reranker"
  | "unused";

export type MemoryModelInventoryItem = {
  active: boolean;
  bytes: number;
  model: string;
  prepared: boolean;
  role: MemoryInferenceModelRole;
  variant: string;
};

export type MemoryMaintenance = {
  models: MemoryModelInventoryItem[];
  recoverableBytes: number;
  usedBytes: number;
};

export type MemoryPurgeResult = {
  bytesRemoved: number;
  filesRemoved: number;
  generationsRemoved: string[];
  modelsRemoved: string[];
  oldVersionsRemoved: number;
};

export type MemoryOperationOptions = {
  provider: EmbeddingProvider;
  reranker: RerankingProvider;
  interpreter?: QueryInterpretationProvider;
  store?: MemoryVectorStore;
  batchSize?: number;
};

export type MemoryRecallOptions = MemoryOperationOptions & {
  query: string;
  queryMode?: MemoryQueryMode;
  limit?: number;
  depth?: MemorySearchDepth;
};

export type MemorySearchDepth = 0 | 1 | 2 | 3;
