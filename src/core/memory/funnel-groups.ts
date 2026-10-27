import {
  fusionWithoutRerankerScore,
  lexicalRanksByThread,
  semanticHitsForChannels,
  type LexicalRanks
} from "./hybrid-ranking.js";
import type { FunnelRow } from "./funnel-selection.js";
import { effectiveIdentityRank } from "./funnel-selection.js";
import { denseRanksByKind, type RankedEvidence } from "./semantic-ranking.js";
import { MEMORY_DEPTH_LAYERS } from "./search-depth.js";
import type { MemoryLayer } from "./sources/contract.js";
import type {
  MemorySearchChannels,
  MemorySearchDepth,
  MemoryVectorRecord
} from "./types.js";

/**
 * One record of the catalog of a capture: every identity and passage of the index, with its group,
 * its layer and its vector. The funnel selects passages from it, so it is not limited to the channels.
 */
export type CatalogRow = {
  recordId: string;
  kind: "identity" | "passage";
  layer: MemoryLayer;
  vector: readonly number[];
};

/** The catalog rows of one group that a depth searches: the layers up to that depth. */
export function catalogRowsAt(
  catalog: ReadonlyMap<string, readonly CatalogRow[]>,
  groupId: string,
  depth: MemorySearchDepth
): CatalogRow[] {
  const layers = MEMORY_DEPTH_LAYERS[depth];
  return (catalog.get(groupId) ?? []).filter((row) =>
    layers.includes(row.layer)
  );
}

/** One candidate group of a depth: its evidence, its rows and its fusion without the reranker. */
export type DepthGroup = {
  groupId: string;
  identity?: RankedEvidence;
  passages: RankedEvidence[];
  rows: FunnelRow[];
  fusion: number;
  bestPassageRank?: number;
};

/** The candidate groups of one depth's channels, with the lexical term of their fusion. */
export function groupsOf(
  channels: MemorySearchChannels,
  vectors: ReadonlyMap<string, readonly number[]>
): DepthGroup[] {
  const evidence = denseRanksByKind(semanticHitsForChannels(channels));
  const lexicalRanks = lexicalRanksByThread(channels);
  const byThread = new Map<
    string,
    { identity?: RankedEvidence; passages: RankedEvidence[] }
  >();
  for (const item of evidence) {
    const threadId = item.record.threadId;
    const entry = byThread.get(threadId) ?? { passages: [] };
    if (item.record.kind === "identity") entry.identity = item;
    if (item.record.kind === "passage") entry.passages.push(item);
    byThread.set(threadId, entry);
  }
  return [...byThread.entries()].map(([groupId, entry]) =>
    groupOf(groupId, entry, vectors, lexicalRanks)
  );
}

function groupOf(
  groupId: string,
  entry: { identity?: RankedEvidence; passages: RankedEvidence[] },
  vectors: ReadonlyMap<string, readonly number[]>,
  lexicalRanks: LexicalRanks
): DepthGroup {
  const bestPassageRank =
    entry.passages.length > 0
      ? Math.min(...entry.passages.map((passage) => passage.denseRank))
      : undefined;
  const identityRecords = entry.identity ? [entry.identity.record] : [];
  const passageRecords = entry.passages.map((passage) => passage.record);
  const rows = [...identityRecords, ...passageRecords].map((record) =>
    rowOf(record, vectors)
  );
  return {
    groupId,
    identity: entry.identity,
    passages: entry.passages,
    rows,
    fusion: fusionWithoutRerankerScore(
      effectiveIdentityRank(entry.identity?.denseRank, bestPassageRank),
      bestPassageRank,
      lexicalRanks.get(groupId)
    ),
    bestPassageRank
  };
}

/** The evidence of a record that belongs to a group: its identity or one of its passages. */
export function evidenceOf(
  group: DepthGroup,
  recordId: string
): RankedEvidence | undefined {
  if (group.identity?.record.recordId === recordId) return group.identity;
  return group.passages.find((passage) => passage.record.recordId === recordId);
}

function rowOf(
  record: MemoryVectorRecord,
  vectors: ReadonlyMap<string, readonly number[]>
): FunnelRow {
  const vector = vectors.get(record.recordId);
  if (vector === undefined)
    throw new Error(`No vector for record ${record.recordId}.`);
  return {
    recordId: record.recordId,
    kind: record.kind === "identity" ? "identity" : "passage",
    vector
  };
}
