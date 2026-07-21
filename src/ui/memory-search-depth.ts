export const MEMORY_SEARCH_UI_LIMIT = 50;
export const MAX_MEMORY_SEARCH_RETRY_DEPTH = 3;

const MEMORY_SEARCH_SCORES = [0.15, 0.1, 0.05, 0] as const;

export type MemorySearchRetryDepth = 0 | 1 | 2 | 3;

export type MemorySearchDepthState = {
  configuredDepth: MemorySearchRetryDepth;
  manualDeepRetries: number;
};

export function automaticMemorySearchScores(
  depth: MemorySearchRetryDepth
): number[] {
  return MEMORY_SEARCH_SCORES.slice(0, depth + 1);
}

export function minScoreForMemorySearchDepth(
  depth: MemorySearchRetryDepth
): number {
  return MEMORY_SEARCH_SCORES[depth];
}

export function nextMemorySearchDepth(
  state: MemorySearchDepthState
): MemorySearchRetryDepth | undefined {
  const next = state.configuredDepth + state.manualDeepRetries + 1;
  if (next > MAX_MEMORY_SEARCH_RETRY_DEPTH) return undefined;
  return next as MemorySearchRetryDepth;
}

export function isMemorySearchRetryDepth(
  value: unknown
): value is MemorySearchRetryDepth {
  if (typeof value !== "number") return false;
  if (!Number.isInteger(value)) return false;
  if (value < 0) return false;
  return value <= MAX_MEMORY_SEARCH_RETRY_DEPTH;
}
