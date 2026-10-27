import type { MemorySourceType } from "./sources/contract.js";
import { memoryBandOf } from "./scoring/bands.js";
import type { RankedMemoryThread } from "./semantic-ranking.js";
import type {
  MemoryGroupKind,
  MemoryRecallHit,
  MemoryVectorRecord
} from "./types.js";

export function semanticRecallHits(
  hits: RankedMemoryThread[]
): MemoryRecallHit[] {
  return hits.map((hit) => recallHitOf(hit.evidence.record, hit.eligibility));
}

/** The group kind of each source type. Only thread sources have a thread and a summary. */
const GROUP_KIND_BY_SOURCE: Readonly<
  Record<MemorySourceType, MemoryGroupKind>
> = {
  summary: "thread",
  artifact: "thread",
  chat: "thread",
  rules: "rules",
  document: "document"
};

/** The reference of a hit, by the type of its best evidence. */
const REFERENCE_BY_SOURCE: Readonly<
  Record<MemorySourceType, (record: MemoryVectorRecord) => string>
> = {
  summary: (record) => threadReference(record.threadId),
  artifact: artifactReference,
  chat: chatReference,
  rules: (record) => record.sourcePath,
  document: (record) => record.sourcePath
};

function threadReference(threadId: string): string {
  return `marc://$${threadId}`;
}

function chatReference(record: MemoryVectorRecord): string {
  if (record.messageId === undefined) return threadReference(record.threadId);
  return `${threadReference(record.threadId)}/#${record.messageId}`;
}

function artifactReference(record: MemoryVectorRecord): string {
  if (record.messageId === undefined) return threadReference(record.threadId);
  const message = chatReference(record);
  if (record.artifactFileName === undefined) return message;
  return `${message}/!${record.artifactFileName}`;
}

function recallHitOf(
  record: MemoryVectorRecord,
  eligibility: number
): MemoryRecallHit {
  const groupKind = GROUP_KIND_BY_SOURCE[record.sourceType];
  const hit: MemoryRecallHit = {
    groupId: record.threadId,
    groupKind,
    title: record.title,
    closedAt: record.closedAt,
    reference: REFERENCE_BY_SOURCE[record.sourceType](record),
    matchedText: record.text,
    score: eligibility,
    reason: semanticMatchReason(record),
    sourceType: record.sourceType,
    sourcePath: record.sourcePath,
    authority: record.authority,
    band: memoryBandOf(eligibility)
  };
  if (groupKind !== "thread") return hit;
  return {
    ...hit,
    threadId: record.threadId,
    summaryPath: record.relativeSummaryPath
  };
}

function semanticMatchReason(record: MemoryVectorRecord): string {
  const section = record.sectionTitle ?? "summary";
  return `Matched ${section} in ${record.title}.`;
}
