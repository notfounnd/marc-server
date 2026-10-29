import type { MemoryStatus } from "./types.js";

// The conditions and messages mirror the readiness checks of recallMemoryInWorkspace in operations.ts,
// which is excluded from this change. The parity test in core-memory-deep-parity.test.ts protects them.
const READINESS_CHECKS: ReadonlyArray<{
  blocks: (status: MemoryStatus) => boolean;
  action: string;
}> = [
  {
    blocks: (status) => !status.rebuildReady,
    action: "Run memory_prepare before using memory_deep."
  },
  {
    blocks: (status) => status.status === "missing",
    action: "Run memory_rebuild before using memory_deep."
  },
  {
    blocks: (status) => status.status === "incompatible",
    action: "Run memory_rebuild because the embedding provider changed."
  },
  {
    blocks: (status) => !status.searchReady,
    action: "Run memory_prepare before using memory_deep."
  }
];

/** The next action that blocks memory_deep, or undefined when the index is ready to search. */
export function deepReadinessAction(status: MemoryStatus): string | undefined {
  return READINESS_CHECKS.find((check) => check.blocks(status))?.action;
}
