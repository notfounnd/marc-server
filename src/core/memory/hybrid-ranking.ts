import {
  rankSemanticMemoryCandidates,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  semanticRecallHits,
  type RankedMemoryThread
} from "./semantic-ranking.js";
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
  const eligible = candidates.filter(
    (thread) => thread.semanticEligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  const ineligible = candidates.filter(
    (thread) => thread.semanticEligibility < SEMANTIC_ELIGIBILITY_THRESHOLD
  );
  const lexicalRanks = lexicalRanksByThread(channels);
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

function semanticHitsForChannels(
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

type LexicalRanks = Map<string, Partial<Record<MemoryLexicalField, number>>>;

function lexicalRanksByThread(channels: MemorySearchChannels): LexicalRanks {
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

function hybridScore(
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
  const ranks = lexicalRanks.get(thread.evidence.record.threadId);
  if (!ranks) return 0;
  return Object.entries(ranks).reduce((score, [field, rank]) => {
    const weight = LEXICAL_RANK_WEIGHTS[field as MemoryLexicalField];
    return score + reciprocalRank(rank) * weight;
  }, 0);
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
