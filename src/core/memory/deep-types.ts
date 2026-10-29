import type { MemorySourceType } from "./sources/contract.js";
import type {
  MemoryAuthority,
  MemoryBand,
  MemoryGroupKind,
  MemoryLayer,
  MemoryOperationOptions,
  MemoryQueryInterpretation,
  MemoryQueryMode,
  MemoryStatus
} from "./types.js";

/** The request of memory_deep. Without threadId it searches the depth-2 pool; with it, one closed thread. */
export type MemoryDeepInput = {
  query: string;
  threadId?: string;
  sourceTypes?: MemorySourceType[];
  queryMode?: MemoryQueryMode;
  limit?: number;
};

export type MemoryDeepOptions = MemoryOperationOptions & MemoryDeepInput;

/** One passage with its provenance. `score` is the reranker relevance, not a probability. */
export type MemoryDeepHit = {
  groupId: string;
  groupKind: MemoryGroupKind;
  threadId?: string;
  sourceType: MemorySourceType;
  authority: MemoryAuthority;
  passageId: string;
  recordId: string;
  reference: string;
  sourcePath: string;
  lineStart: number;
  lineEnd: number;
  passageOrdinal: number;
  sectionTitle?: string;
  messageId?: string;
  agentId?: string;
  artifactFileName?: string;
  matchedText: string;
  score: number;
  /** Band of the group eligibility. Only the unscoped mode sets it. */
  groupBand?: MemoryBand;
};

export type MemoryDeepResult = {
  query: string;
  interpretation: MemoryQueryInterpretation;
  indexStatus: MemoryStatus;
  mode: "scoped" | "unscoped";
  threadId?: string;
  results: MemoryDeepHit[];
  nextActions: string[];
  /** True only in the unscoped mode, when the search ran and admitted no group. */
  abstained?: boolean;
  layersSearched: MemoryLayer[];
  /** Documents sent to the reranker by this call. */
  rerankPairs: number;
  /** Passages of the thread before the reranker budget. Only the scoped mode sets it. */
  scopePassages?: number;
  /** True when the thread had more passages than the reranker budget. Only the scoped mode sets it. */
  scopeTruncated?: boolean;
};
