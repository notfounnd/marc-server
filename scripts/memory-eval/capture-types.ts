import type { WorkspaceInfo } from "../../src/core/types.js";
import type { MemoryQueryCandidateSet } from "../../src/core/memory/query-candidates.js";
import type { LanceDbMemoryVectorStore } from "../../src/core/memory/store.js";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  MemoryLexicalField,
  MemoryQueryInterpretation,
  MemoryVectorRecord,
  MemoryVectorRow,
  QueryInterpretationProvider,
  QueryInterpretationProviderMetadata,
  RerankingProvider,
  RerankingProviderMetadata
} from "../../src/core/memory/types.js";
import type { CaptureFingerprint } from "./capture-fingerprint.js";
import type { EvalCase } from "./dataset.js";
import type { InterpretationTrace } from "./recording-providers.js";

export type CaptureProviders = {
  embedding: EmbeddingProvider;
  reranker: RerankingProvider;
  interpreter: QueryInterpretationProvider;
};

export type CapturedHit = { recordId: string; score: number };

export type CapturedLexicalHit = {
  field: MemoryLexicalField;
  recordId: string;
  score: number;
  vectorScore: number;
};

export type CapturedChannels = {
  identities: CapturedHit[];
  passages: CapturedHit[];
  lexical: CapturedLexicalHit[];
};

export type CapturedProductionRecall = {
  effectiveQuery: string;
  limit: number;
  results: Array<{ threadId: string; score: number }>;
};

export type CapturedLatency = { warmup: number; samples: number[] };

export type CapturedCase = {
  id: string;
  queryMode: EvalCase["queryMode"];
  originalQuery: string;
  interpretation: MemoryQueryInterpretation;
  candidates: MemoryQueryCandidateSet;
  interpretationTrace: InterpretationTrace[];
  /** Query vector per distinct text, keyed by the text. */
  queryVectors: Record<string, number[]>;
  /** Production channels per distinct text, keyed by the text. */
  channels: Record<string, CapturedChannels>;
  /** Reranker score for every identity and passage record, keyed by rerankPairKey. */
  rerankScores: Record<string, number>;
  productionRecall: CapturedProductionRecall;
};

/** Provenance fields added by the source layers. Captures from E0 do not carry them. */
export type MemoryProvenanceKey =
  | "sourceType"
  | "layer"
  | "sourcePath"
  | "authority"
  | "lineStart"
  | "lineEnd"
  | "sourceSha256"
  | "passageOrdinal"
  | "passageSha256"
  | "passageId";

/** A record as stored in capture.json: provenance is optional, so E0 captures stay readable. */
export type CapturedRecord = Omit<MemoryVectorRecord, MemoryProvenanceKey> &
  Partial<Pick<MemoryVectorRecord, MemoryProvenanceKey>>;

/**
 * Reads a captured record as a search record. E0 captures carry no provenance,
 * and the ranking and the reranker documents read only identity and text fields,
 * so the cast does not change any score.
 */
export function asSearchRecord(record: CapturedRecord): MemoryVectorRecord {
  return record as MemoryVectorRecord;
}

export type ProductionCheckMode = "record-ids" | "thread-ids";

/** How the temporary rebuild was compared with the production manifest. Optional in capture.json. */
export type ProductionCheckRecord = {
  mode: ProductionCheckMode;
  productionSchemaVersion: number;
  codeSchemaVersion: number;
};

/** Content of capture.json: the replay input. Records are stored once, without vectors. */
export type CaptureFile = {
  schemaVersion: number;
  captureId: string;
  corpus: string;
  fingerprint: CaptureFingerprint;
  generation: string;
  corpusDigest: string;
  providers: {
    embedding: EmbeddingProviderMetadata;
    reranker: RerankingProviderMetadata;
    interpreter: QueryInterpretationProviderMetadata;
  };
  matrixRecordCount: number;
  productionCheck?: ProductionCheckRecord;
  records: CapturedRecord[];
  cases: CapturedCase[];
};

/** State shared by the cases of one capture run inside the temporary workspace. */
export type CaptureContext = {
  info: WorkspaceInfo;
  providers: CaptureProviders;
  store: LanceDbMemoryVectorStore;
  generation: string;
  rows: MemoryVectorRow[];
  matrixRecords: MemoryVectorRecord[];
  matrixDocuments: string[];
  productionCheck?: ProductionCheckRecord;
};
