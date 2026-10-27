import type {
  MemoryGroupKind,
  MemoryRecallHit,
  MemoryStatus
} from "./types.js";

/** The next action of a hit, by its group kind. Only thread groups point to thread_read. */
const NEXT_ACTION_BY_GROUP: Readonly<
  Record<MemoryGroupKind, (hit: MemoryRecallHit) => string>
> = {
  thread: (hit) =>
    `Call thread_read for ${hit.reference} before reopening or contradicting this historical decision.`,
  rules: (hit) =>
    `Read ${hit.sourcePath ?? hit.reference} before applying this rule.`,
  document: (hit) =>
    `Read ${hit.sourcePath ?? hit.reference} before relying on this document.`
};

export function nextActionsForRecallResults(
  results: MemoryRecallHit[],
  status: MemoryStatus
): string[] {
  const actions = results.map((result) =>
    NEXT_ACTION_BY_GROUP[result.groupKind](result)
  );
  if (status.status !== "stale") return actions;
  return [
    "Run memory_rebuild when possible because the memory index is stale.",
    ...actions
  ];
}
