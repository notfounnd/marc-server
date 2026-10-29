import { memoryReferenceOf } from "./recall-hits.js";
import { literalMemoryQueryInterpretation } from "./query-interpretation.js";
import type {
  MemoryDeepHit,
  MemoryDeepInput,
  MemoryDeepResult
} from "./deep-types.js";
import type { MemorySourceType } from "./sources/contract.js";
import type {
  MemoryAuthority,
  MemoryBand,
  MemoryGroupKind,
  MemoryStatus,
  MemoryVectorRecord
} from "./types.js";

// Mirrors GROUP_KIND_BY_SOURCE in recall-hits.ts, which is not exported. The parity test in
// core-memory-deep-parity.test.ts protects the two tables.
const GROUP_KIND_BY_SOURCE: Readonly<
  Record<MemorySourceType, MemoryGroupKind>
> = {
  summary: "thread",
  artifact: "thread",
  chat: "thread",
  rules: "rules",
  document: "document"
};

/** The next action of a hit by its authority. Each action names the source to read before relying on it. */
const NEXT_ACTION_BY_AUTHORITY: Readonly<
  Record<MemoryAuthority, (hit: MemoryDeepHit) => string>
> = {
  decision: (hit) =>
    `Call thread_read for ${hit.reference} before reopening or contradicting this decision.`,
  rule: (hit) =>
    `Review ${hit.sourcePath} at lines ${hit.lineStart}-${hit.lineEnd} before applying this rule.`,
  artifact: (hit) =>
    `Open the artifact ${hit.reference} before relying on this evidence.`,
  document: (hit) =>
    `Open the document ${hit.sourcePath} before relying on it.`,
  conversation: (hit) =>
    `Treat ${hit.reference} as intermediate context and confirm it in the thread SUMMARY.md or the final message.`
};

// Same text as the stale prefix in recall-actions.ts, which is not exported. The parity test in
// core-memory-deep-parity.test.ts and the stale case in core-memory-deep-output.test.ts protect it.
const STALE_INDEX_ACTION =
  "Run memory_rebuild when possible because the memory index is stale.";

/** One hit per passage: the input is ordered best first, so the first occurrence keeps the best score. */
export function firstPerPassage<T extends { passageId: string }>(
  hits: readonly T[]
): T[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const duplicate = seen.has(hit.passageId);
    seen.add(hit.passageId);
    return !duplicate;
  });
}

export function isSourceTypeAllowed(
  sourceType: MemorySourceType,
  sourceTypes: readonly MemorySourceType[] | undefined
): boolean {
  return sourceTypes === undefined || sourceTypes.includes(sourceType);
}

export function deepHitOf(
  record: MemoryVectorRecord,
  score: number,
  groupBand?: MemoryBand
): MemoryDeepHit {
  const groupKind = GROUP_KIND_BY_SOURCE[record.sourceType];
  return withoutUndefined({
    groupId: record.threadId,
    groupKind,
    threadId: groupKind === "thread" ? record.threadId : undefined,
    sourceType: record.sourceType,
    authority: record.authority,
    passageId: record.passageId,
    recordId: record.recordId,
    reference: memoryReferenceOf(record),
    sourcePath: record.sourcePath,
    lineStart: record.lineStart,
    lineEnd: record.lineEnd,
    passageOrdinal: record.passageOrdinal,
    sectionTitle: record.sectionTitle,
    messageId: record.messageId,
    agentId: record.agentId,
    artifactFileName: record.artifactFileName,
    matchedText: record.text,
    score,
    groupBand
  });
}

/** One action per distinct authority among the hits, with the stale prefix when the index is stale. */
export function nextActionsFor(
  results: MemoryDeepHit[],
  status: MemoryStatus
): string[] {
  const actions = [
    ...new Set(
      results.map((hit) => NEXT_ACTION_BY_AUTHORITY[hit.authority](hit))
    )
  ];
  if (status.status !== "stale") return actions;
  return [STALE_INDEX_ACTION, ...actions];
}

/** The result of a call that did not search: not ready, locked, or an index without records. */
export function emptyDeepResult(
  input: MemoryDeepInput,
  status: MemoryStatus,
  nextActions: string[],
  threadId?: string
): MemoryDeepResult {
  const common = {
    query: input.query,
    interpretation: literalMemoryQueryInterpretation(
      input.query,
      input.queryMode ?? "auto"
    ),
    indexStatus: status,
    results: [],
    nextActions,
    layersSearched: [],
    rerankPairs: 0
  };
  if (threadId !== undefined) return { ...common, mode: "scoped", threadId };
  return { ...common, mode: "unscoped", abstained: false };
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined)
  ) as T;
}
