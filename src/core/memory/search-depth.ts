import type { MemorySearchDepth } from "./types.js";

export const MEMORY_SEARCH_CANDIDATE_LIMITS = [100, 200, 300, 400] as const;

export const DEFAULT_MEMORY_SEARCH_DEPTH: MemorySearchDepth = 0;

export function isMemorySearchDepth(
  value: unknown
): value is MemorySearchDepth {
  if (typeof value !== "number") return false;
  if (!Number.isInteger(value)) return false;
  if (value < 0) return false;
  return value < MEMORY_SEARCH_CANDIDATE_LIMITS.length;
}

export function candidateLimitForMemorySearchDepth(
  depth: MemorySearchDepth
): number {
  return MEMORY_SEARCH_CANDIDATE_LIMITS[depth];
}
