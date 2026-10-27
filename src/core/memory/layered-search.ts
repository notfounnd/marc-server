import type { WorkspaceInfo } from "../types.js";
import type { MemoryLayer } from "./sources/contract.js";
import {
  IDENTITY_LAYER,
  MEMORY_LAYER_CANDIDATE_LIMIT
} from "./search-depth.js";
import type {
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorStore
} from "./types.js";

export type LayeredSearchInput = {
  info: WorkspaceInfo;
  store: MemoryVectorStore;
  generation?: string;
  vector: number[];
  /** Effective query text, used by the lexical channels. */
  queryText: string;
  fields: readonly MemoryLexicalField[];
  /** Layers to search, in layer order. */
  layers: readonly MemoryLayer[];
};

/**
 * The passage and lexical channels, searched once per layer with the same limit in each.
 * The identity channel exists only in layer 0 and runs once when that layer is searched.
 */
export async function searchChannelsByLayer(
  input: LayeredSearchInput
): Promise<MemorySearchChannels> {
  const [identities, passages, lexical] = await Promise.all([
    identityChannel(input),
    passageChannel(input),
    lexicalChannel(input)
  ]);
  return { identities, passages, lexical };
}

/**
 * One list is kept as it is, so a single-layer search equals the M0 channel. Several lists
 * are merged by score, highest first; a tie keeps the order of the lists.
 */
export function mergeByScore<T extends { score: number }>(
  lists: readonly (readonly T[])[]
): T[] {
  if (lists.length <= 1) return [...(lists[0] ?? [])];
  return lists
    .flat()
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        right.item.score - left.item.score || left.index - right.index
    )
    .map((entry) => entry.item);
}

async function identityChannel(
  input: LayeredSearchInput
): Promise<MemorySearchHit[]> {
  if (!input.layers.includes(IDENTITY_LAYER)) return [];
  return input.store.searchVector(input.info, input.vector, {
    generation: input.generation,
    kind: "identity",
    layers: [IDENTITY_LAYER],
    limit: MEMORY_LAYER_CANDIDATE_LIMIT
  });
}

async function passageChannel(
  input: LayeredSearchInput
): Promise<MemorySearchHit[]> {
  const lists = await Promise.all(
    input.layers.map((layer) =>
      input.store.searchVector(input.info, input.vector, {
        generation: input.generation,
        kind: "passage",
        layers: [layer],
        limit: MEMORY_LAYER_CANDIDATE_LIMIT
      })
    )
  );
  return mergeByScore(lists);
}

async function lexicalChannel(
  input: LayeredSearchInput
): Promise<MemoryLexicalSearchHit[]> {
  const perField = await Promise.all(
    input.fields.map((field) => lexicalFieldChannel(input, field))
  );
  return perField.flat();
}

async function lexicalFieldChannel(
  input: LayeredSearchInput,
  field: MemoryLexicalField
): Promise<MemoryLexicalSearchHit[]> {
  const lists = await Promise.all(
    input.layers.map((layer) =>
      input.store.searchLexical(input.info, input.queryText, input.vector, {
        field,
        generation: input.generation,
        layers: [layer],
        limit: MEMORY_LAYER_CANDIDATE_LIMIT
      })
    )
  );
  return mergeByScore(lists);
}
