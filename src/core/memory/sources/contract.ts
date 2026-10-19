import type { MemoryRecordKind } from "../types.js";

// Source-layer contract shared by the memory readers, the record builder, and
// the vector stores. src/core/memory/types.ts re-exports every name below.

export type MemorySourceType =
  | "summary"
  | "artifact"
  | "rules"
  | "document"
  | "chat";
export type MemoryLayer = 0 | 1 | 2;
export type MemoryAuthority =
  | "decision"
  | "rule"
  | "artifact"
  | "document"
  | "conversation";

export const MEMORY_SCHEMA_VERSION = 7;
export const MEMORY_RETRIEVAL_CONTRACT = "source-layers-v1";
export const DEFAULT_SEARCH_LAYERS: readonly MemoryLayer[] = [0];

export const MEMORY_SOURCE_LAYERS: Record<MemorySourceType, MemoryLayer> = {
  summary: 0,
  artifact: 1,
  rules: 1,
  document: 1,
  chat: 2
};

// The document authority depends on workspace settings; the table keeps the
// default until the document reader resolves it per source.
export const MEMORY_SOURCE_AUTHORITIES: Record<
  MemorySourceType,
  MemoryAuthority
> = {
  summary: "decision",
  artifact: "artifact",
  rules: "rule",
  document: "document",
  chat: "conversation"
};

export type MemoryChunk = {
  recordId: string;
  kind: MemoryRecordKind;
  sectionTitle?: string;
  text: string;
  embeddingText: string;
  lineStart: number;
  lineEnd: number;
  passageOrdinal: number;
  messageId?: string;
  agentId?: string;
  artifactFileName?: string;
};

export type MemorySource = {
  sourceType: MemorySourceType;
  threadId: string;
  title: string;
  closedAt?: string;
  summaryPath: string;
  relativeSummaryPath: string;
  reference: string;
  markdown: string;
  sourcePath: string;
  sourceSha256: string;
  sha256: string;
  mtimeMs: number;
  authority: MemoryAuthority;
  chunks: MemoryChunk[];
};

// status.ts still names the summary-only type; it is an alias of MemorySource.
export type ThreadSummarySource = MemorySource;
