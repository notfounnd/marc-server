import {
  rankSemanticMemoryCandidates,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  semanticFusionScore,
  type RankedMemoryThread
} from "./semantic-ranking.js";
import { semanticRecallHits } from "./recall-hits.js";
import type {
  MemoryLexicalField,
  MemorySearchChannels,
  MemorySearchHit,
  RerankingProvider
} from "./types.js";

const LEXICAL_RANK_WEIGHTS: Record<MemoryLexicalField, number> = {
  title: 2,
  summary: 0.75,
  titlePrefix: 0.5
};

export { semanticRecallHits };

export async function rankHybridMemoryHits(
  query: string,
  channels: MemorySearchChannels,
  reranker: RerankingProvider
): Promise<RankedMemoryThread[]> {
  const ranked = await rankHybridMemoryCandidates(query, channels, reranker);
  return ranked.filter(
    (thread) => thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  );
}

export async function rankHybridMemoryCandidates(
  query: string,
  channels: MemorySearchChannels,
  reranker: RerankingProvider
): Promise<RankedMemoryThread[]> {
  const semanticHits = semanticHitsForChannels(channels);
  const candidates = await rankSemanticMemoryCandidates(
    query,
    semanticHits,
    reranker
  );
  return hybridAdmissionOrder(candidates, lexicalRanksByThread(channels));
}

/**
 * The M0 admission order, shared with the funnel. The threads whose semantic eligibility reaches the threshold
 * come first, by the hybrid score (then the lexical score, then the ranking score), and the monotone ceiling is
 * applied in that order. The other threads follow in their input order. An ineligible thread never caps an
 * eligible one, because the ceiling runs over the eligible threads only.
 */
export function hybridAdmissionOrder(
  candidates: RankedMemoryThread[],
  lexicalRanks: LexicalRanks
): RankedMemoryThread[] {
  const eligible = candidates.filter(
    (thread) => thread.semanticEligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  const ineligible = candidates.filter(
    (thread) => thread.semanticEligibility < SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  const ranked = eligible.sort((left, right) => {
    const scoreDifference =
      hybridScore(right, lexicalRanks) - hybridScore(left, lexicalRanks);
    if (scoreDifference) return scoreDifference;
    const lexicalDifference =
      lexicalScore(right, lexicalRanks) - lexicalScore(left, lexicalRanks);
    if (lexicalDifference) return lexicalDifference;
    return right.rankingScore - left.rankingScore;
  });
  return [...applyMonotonicConfidence(ranked), ...ineligible];
}

export function semanticHitsForChannels(
  channels: MemorySearchChannels
): MemorySearchHit[] {
  const hits = new Map<string, MemorySearchHit>();
  for (const hit of [...channels.identities, ...channels.passages]) {
    hits.set(hit.record.recordId, hit);
  }
  for (const hit of channels.lexical) {
    const current = hits.get(hit.record.recordId);
    if (current && current.score >= hit.vectorScore) continue;
    hits.set(hit.record.recordId, {
      record: hit.record,
      score: hit.vectorScore
    });
  }
  const ranked = [...hits.values()].sort((left, right) => {
    if (left.record.kind === right.record.kind) return right.score - left.score;
    return left.record.kind === "identity" ? -1 : 1;
  });
  return ranked;
}

/** The first rank of each lexical field, per thread. */
export type ThreadLexicalRanks = Partial<Record<MemoryLexicalField, number>>;

export type LexicalRanks = Map<string, ThreadLexicalRanks>;

export function lexicalRanksByThread(
  channels: MemorySearchChannels
): LexicalRanks {
  const ranks: LexicalRanks = new Map();
  const fieldRanks = new Map<MemoryLexicalField, number>();
  for (const hit of channels.lexical) {
    const fieldRank = (fieldRanks.get(hit.field) ?? 0) + 1;
    fieldRanks.set(hit.field, fieldRank);
    const threadRanks = ranks.get(hit.record.threadId) ?? {};
    if (threadRanks[hit.field]) continue;
    threadRanks[hit.field] = fieldRank;
    ranks.set(hit.record.threadId, threadRanks);
  }
  return ranks;
}

export function hybridScore(
  thread: RankedMemoryThread,
  lexicalRanks: LexicalRanks
): number {
  const ranks = lexicalRanks.get(thread.evidence.record.threadId);
  if (!ranks) return thread.rankingScore;
  return thread.rankingScore + lexicalScore(thread, lexicalRanks);
}

function lexicalScore(
  thread: RankedMemoryThread,
  lexicalRanks: LexicalRanks
): number {
  return lexicalScoreOfRanks(lexicalRanks.get(thread.evidence.record.threadId));
}

/** The lexical term of the M0 fusion for one thread: each field's reciprocal rank, weighted. */
export function lexicalScoreOfRanks(
  ranks: ThreadLexicalRanks | undefined
): number {
  if (!ranks) return 0;
  return Object.entries(ranks).reduce((score, [field, rank]) => {
    const weight = LEXICAL_RANK_WEIGHTS[field as MemoryLexicalField];
    return score + reciprocalRank(rank) * weight;
  }, 0);
}

/**
 * The M0 fusion without the reranker term: 1/identity rank + 1/passage rank + the lexical
 * term. The production hybridScore keeps its operation order: rankingScore, which already
 * holds the reranker term, plus the lexical term. Same value, same floating-point order.
 */
export function fusionWithoutRerankerScore(
  identityRank: number | undefined,
  passageRank: number | undefined,
  ranks: ThreadLexicalRanks | undefined
): number {
  return (
    semanticFusionScore(identityRank, passageRank) + lexicalScoreOfRanks(ranks)
  );
}

function reciprocalRank(rank: number | undefined): number {
  if (!rank) return 0;
  return 1 / rank;
}

function applyMonotonicConfidence(
  ranked: RankedMemoryThread[]
): RankedMemoryThread[] {
  let ceiling = 1;
  return ranked.map((thread) => {
    const eligibility = Math.min(thread.semanticEligibility, ceiling);
    ceiling = eligibility;
    return { ...thread, eligibility };
  });
}
