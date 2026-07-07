import type { MemoryRecallHit, MemoryStatus } from "./types.js";

export function nextActionsForRecallResults(
  results: MemoryRecallHit[],
  status: MemoryStatus
): string[] {
  const actions = results.map(
    (result) =>
      `Call thread_read for ${result.reference} before reopening or contradicting this historical decision.`
  );
  if (status.status !== "stale") return actions;
  return [
    "Run memory_rebuild when possible because the memory index is stale.",
    ...actions
  ];
}
