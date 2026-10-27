import { searchChannelsByLayer } from "../../src/core/memory/layered-search.js";
import type { RerankOrder } from "../../src/core/memory/rerank-order.js";
import { layersForDepth, presentLayersOf } from "../../src/core/memory/search-depth.js";
import type { MemoryLayer } from "../../src/core/memory/sources/contract.js";
import type {
  MemorySearchChannels,
  MemorySearchDepth
} from "../../src/core/memory/types.js";
import { lexicalFieldsForQueryReplica } from "./capture-channels.js";
import type { CaptureContext } from "./capture-types.js";

/** Depths captured in every E3 capture. Each depth searches the layers up to it. */
export const CAPTURE_DEPTHS: readonly MemorySearchDepth[] = [0, 1, 2];

/** Layers of the temporary index of an E3 capture. */
export const E3_INDEXED_LAYERS: readonly MemoryLayer[] = [0, 1, 2];

/**
 * Version of the channels written by E3 captures. "e3-v2" adds the passage catalog: the records of every
 * layer with their vectors, which the funnel reads. "e3-v1" captures have no catalog and cannot replay.
 * E0 and E2 captures keep their own version.
 */
export const E3_CAPTURE_CHANNELS = "e3-v2";

/** The reranker receives the documents sorted by length. The order is part of the fingerprint. */
export const E3_RERANK_ORDER: RerankOrder = "length";

/**
 * The live channels of every captured depth for one text, with the production passage and
 * lexical channels searched layer by layer. Depth d searches the layers up to d.
 */
export async function searchChannelsByDepth(
  context: CaptureContext,
  text: string,
  vector: readonly number[]
): Promise<Partial<Record<MemorySearchDepth, MemorySearchChannels>>> {
  const present = presentLayersOf(context.rows);
  const channels = await Promise.all(
    CAPTURE_DEPTHS.map((depth) => channelsAt(context, text, vector, layersForDepth(depth, present)))
  );
  return Object.fromEntries(
    CAPTURE_DEPTHS.map((depth, index) => [depth, channels[index]])
  ) as Partial<Record<MemorySearchDepth, MemorySearchChannels>>;
}

function channelsAt(
  context: CaptureContext,
  text: string,
  vector: readonly number[],
  layers: readonly MemoryLayer[]
): Promise<MemorySearchChannels> {
  return searchChannelsByLayer({
    info: context.info,
    store: context.store,
    generation: context.generation,
    vector: [...vector],
    queryText: text,
    fields: lexicalFieldsForQueryReplica(text),
    layers
  });
}
