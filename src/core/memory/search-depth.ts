import type { MemoryLayer } from "./sources/contract.js";
import type { MemorySearchDepth } from "./types.js";

/** The deepest depth. Depth is a count of corpus layers, so the range is 0 to 2. */
export const MAX_MEMORY_SEARCH_DEPTH = 2;

/** Each depth searches every layer up to its own number. Depth 0 is the M0 corpus. */
export const MEMORY_DEPTH_LAYERS: Readonly<
  Record<MemorySearchDepth, readonly MemoryLayer[]>
> = {
  0: [0],
  1: [0, 1],
  2: [0, 1, 2]
};

/** Identity records exist only in layer 0, so the identity channel searches that layer alone. */
export const IDENTITY_LAYER: MemoryLayer = 0;

/** Layers that query interpretation reads. The vocabulary of depth 0 must not change with the chat. */
export const INTERPRETATION_LAYERS: readonly MemoryLayer[] = [0];

/** Candidates that the passage and each lexical field return from each layer. */
export const MEMORY_LAYER_CANDIDATE_LIMIT = 100;

export const DEFAULT_MEMORY_SEARCH_DEPTH: MemorySearchDepth = 0;

export const MEMORY_SEARCH_DEPTH_RANGE_MESSAGE =
  "Memory search depth counts corpus layers: 0 searches summaries, 1 adds artifacts, rules and documents, and 2 adds chat messages. Depth 3 is not available.";

export function isMemorySearchDepth(
  value: unknown
): value is MemorySearchDepth {
  if (typeof value !== "number") return false;
  return (
    Number.isInteger(value) && value >= 0 && value <= MAX_MEMORY_SEARCH_DEPTH
  );
}

/**
 * The layers a depth searches in an index that holds `presentLayers`: the depth's layers
 * that the index actually contains, in layer order.
 */
export function layersForDepth(
  depth: MemorySearchDepth,
  presentLayers: readonly MemoryLayer[]
): MemoryLayer[] {
  return MEMORY_DEPTH_LAYERS[depth].filter((layer) =>
    presentLayers.includes(layer)
  );
}

/** The layers that some record of the index belongs to, in layer order. */
export function presentLayersOf(
  records: readonly { layer: MemoryLayer }[]
): MemoryLayer[] {
  return ([0, 1, 2] as MemoryLayer[]).filter((layer) =>
    records.some((record) => record.layer === layer)
  );
}
