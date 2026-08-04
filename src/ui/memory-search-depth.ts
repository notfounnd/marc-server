export const MEMORY_SEARCH_UI_LIMIT = 50;
export const MAX_MEMORY_SEARCH_RETRY_DEPTH = 3;

const MEMORY_SEARCH_DEPTHS = [0, 1, 2, 3] as const;

export type MemorySearchRetryDepth = 0 | 1 | 2 | 3;

export type MemorySearchDepthState = {
  configuredDepth: MemorySearchRetryDepth;
  lastExecutedDepth: MemorySearchRetryDepth;
};

export function automaticMemorySearchDepths(
  depth: MemorySearchRetryDepth
): MemorySearchRetryDepth[] {
  return MEMORY_SEARCH_DEPTHS.slice(0, depth + 1) as MemorySearchRetryDepth[];
}

export function nextMemorySearchDepth(
  state: MemorySearchDepthState
): MemorySearchRetryDepth | undefined {
  if (state.lastExecutedDepth >= MAX_MEMORY_SEARCH_RETRY_DEPTH)
    return undefined;
  return (state.lastExecutedDepth + 1) as MemorySearchRetryDepth;
}

export function isMemorySearchRetryDepth(
  value: unknown
): value is MemorySearchRetryDepth {
  if (typeof value !== "number") return false;
  if (!Number.isInteger(value)) return false;
  if (value < 0) return false;
  return value <= MAX_MEMORY_SEARCH_RETRY_DEPTH;
}
