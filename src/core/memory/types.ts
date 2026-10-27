import type { WorkspaceInfo } from "../types.js";
import type { RerankOrder } from "./rerank-order.js";
import type {
  MEMORY_RETRIEVAL_CONTRACT,
  MEMORY_SCHEMA_VERSION,
  MemoryAuthority,
  MemoryLayer,
  MemorySourceType
} from "./sources/contract.js";

export * from "./sources/contract.js";

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
    batchSize: number,
    order?: RerankOrder
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
  sourceType: MemorySourceType;
  layer: MemoryLayer;
  sourcePath: string;
  authority: MemoryAuthority;
  lineStart: number;
  lineEnd: number;
  sourceSha256: string;
  passageOrdinal: number;
  passageSha256: string;
  passageId: string;
  messageId?: string;
  agentId?: string;
  artifactFileName?: string;
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
  sourceType: MemorySourceType;
  layer: MemoryLayer;
  authority: MemoryAuthority;
  sourcePath: string;
};

export type MemoryManifest = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  builtAt: string;
  generation: string;
  embeddingProvider: EmbeddingProviderMetadata;
  retrievalContract: typeof MEMORY_RETRIEVAL_CONTRACT;
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

/** Heuristic confidence band of a recalled hit. It orders the results; it is not a probability. */
export type MemoryBand = "high" | "medium" | "low";

export type MemoryRecallResult = {
  query: string;
  interpretation: MemoryQueryInterpretation;
  indexStatus: MemoryStatus;
  results: MemoryRecallHit[];
  nextActions: string[];
  /** True only when the search ran and admitted no thread. Recalls that did not search are false. */
  abstained: boolean;
  /** Layers that the passage and lexical channels searched, in layer order. */
  layersSearched: MemoryLayer[];
  /** Documents sent to the reranker by this recall: the pairs that M0 scores. */
  rerankPairs: number;
  /** Why an adaptive expansion stopped. Only adaptive recalls set it. */
  expansionStop?: MemoryExpansionStop;
};

/** Why an adaptive expansion stopped: a high-band result, the deepest layer, or the budget. */
export type MemoryExpansionStop = "high-band" | "deepest-layer" | "budget";

/** Kind of group a hit belongs to. Only thread groups have a thread and a summary path. */
export type MemoryGroupKind = "thread" | "rules" | "document";

export type MemoryRecallHit = {
  /** Thread id for a thread group, `@rules`, or `@document/<sourcePath>`. */
  groupId: string;
  groupKind: MemoryGroupKind;
  threadId?: string;
  title: string;
  closedAt?: string;
  summaryPath?: string;
  reference: string;
  matchedText: string;
  score: number;
  reason: string;
  sourceType?: MemorySourceType;
  sourcePath?: string;
  authority?: MemoryAuthority;
  /** Band of the eligibility in score. Its cuts are in scoring/bands.ts. */
  band: MemoryBand;
};

export type MemoryVectorStore = {
  exists(info: WorkspaceInfo, generation?: string): Promise<boolean>;
  listRecordIds(info: WorkspaceInfo, generation?: string): Promise<string[]>;
  readRows?(
    info: WorkspaceInfo,
    generation?: string,
    options?: { layers?: readonly MemoryLayer[] }
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
      layers?: readonly MemoryLayer[];
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
      layers?: readonly MemoryLayer[];
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
  indexedLayers?: readonly MemoryLayer[];
};

export type MemoryRecallOptions = MemoryOperationOptions & {
  query: string;
  queryMode?: MemoryQueryMode;
  limit?: number;
  depth?: MemorySearchDepth;
};

/** Count of corpus layers that a search reads: 0 summaries, 1 adds artifacts, rules and documents, 2 adds chat. */
export type MemorySearchDepth = 0 | 1 | 2;
