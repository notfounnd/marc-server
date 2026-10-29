import { rerankRecords } from "./deep-rerank.js";
import {
  hybridAdmissionOrder,
  lexicalRanksByThread,
  semanticHitsForChannels
} from "./hybrid-ranking.js";
import {
  applyRerankScores,
  consolidateThreads,
  denseRanksByKind,
  rankThreadCandidates,
  rerankingEntriesOf,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  type PassageRerankEntry,
  type RankedMemoryThread,
  type ThreadCandidate
} from "./semantic-ranking.js";
import { memoryBandOf } from "./scoring/bands.js";
import type {
  MemoryBand,
  MemoryLexicalField,
  MemorySearchChannels,
  MemoryVectorRecord,
  RerankingProvider
} from "./types.js";

/** The M0 pool of one search: the admission order, the scored entries and their scores. */
export type DepthPool = {
  ranked: RankedMemoryThread[];
  entries: PassageRerankEntry[];
  /** Reranker score of every scored record, passages and identities alike, by recordId. */
  passageScores: ReadonlyMap<string, number>;
};

/** A passage of an admitted group, with its score and the band of its group. */
export type DepthPassage = {
  record: MemoryVectorRecord;
  denseRank: number;
  score: number;
  groupBand: MemoryBand;
};

/**
 * The pool that depth 2 of recall builds, with the same calls in the same order: the M0 candidates,
 * one reranker call over the same documents, and the M0 admission order. The scores are kept per
 * record, because recall discards them. The parity test in core-memory-deep-pool.test.ts protects it.
 */
export async function rankDepthPoolPassages(
  query: string,
  channels: MemorySearchChannels,
  reranker: RerankingProvider
): Promise<DepthPool> {
  const candidates = consolidateThreads(
    denseRanksByKind(semanticHitsForChannels(channels))
  );
  const entries = rerankingEntriesOf(candidates);
  const scores = await rerankRecords(
    query,
    entries.map((entry) => entry.evidence.record),
    reranker
  );
  const reranked = withRerankScores(candidates, entries, scores);
  const ranked = hybridAdmissionOrder(
    rankThreadCandidates(reranked),
    lexicalRanksByThread(channels)
  );
  return {
    ranked,
    entries,
    passageScores: new Map(
      entries.map((entry, index) => [
        entry.evidence.record.recordId,
        scores[index] ?? 0
      ])
    )
  };
}

/** Passages of the admitted groups (eligibility at or above the threshold), best first. Identities are excluded. */
export function admittedDepthPassages(pool: DepthPool): DepthPassage[] {
  const bandByThread = new Map(
    pool.ranked
      .filter((thread) => isAdmitted(thread))
      .map(
        (thread) =>
          [
            thread.evidence.record.threadId,
            memoryBandOf(thread.eligibility)
          ] as const
      )
  );
  return pool.entries
    .flatMap((entry) => passageOf(entry, bandByThread, pool.passageScores))
    .sort(compareDepthPassages);
}

/** True when the search ran and admitted at least one group. Recall's abstained uses this rule. */
export function admitsAnyGroup(pool: DepthPool): boolean {
  return pool.ranked.some((thread) => isAdmitted(thread));
}

// Copied from lexicalFieldsForQuery in operations.ts, which is excluded from this change. The parity
// test in core-memory-deep-parity.test.ts protects the two copies.
export function lexicalFieldsForDeep(query: string): MemoryLexicalField[] {
  const fields: MemoryLexicalField[] = ["title", "summary"];
  if (query.trim().split(/\s+/).length !== 1) return fields;
  return [...fields, "titlePrefix"];
}

function withRerankScores(
  candidates: ThreadCandidate[],
  entries: PassageRerankEntry[],
  scores: number[]
): ThreadCandidate[] {
  if (entries.length === 0) return candidates;
  return applyRerankScores(candidates, entries, scores);
}

function isAdmitted(thread: RankedMemoryThread): boolean {
  return thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD;
}

function passageOf(
  entry: PassageRerankEntry,
  bandByThread: ReadonlyMap<string, MemoryBand>,
  passageScores: ReadonlyMap<string, number>
): DepthPassage[] {
  const record = entry.evidence.record;
  const groupBand = bandByThread.get(record.threadId);
  if (record.kind !== "passage" || groupBand === undefined) return [];
  return [
    {
      record,
      denseRank: entry.evidence.denseRank,
      score: passageScores.get(record.recordId) ?? 0,
      groupBand
    }
  ];
}

function compareDepthPassages(left: DepthPassage, right: DepthPassage): number {
  return (
    right.score - left.score ||
    left.denseRank - right.denseRank ||
    left.record.recordId.localeCompare(right.record.recordId)
  );
}
