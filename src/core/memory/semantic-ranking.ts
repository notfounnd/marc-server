import { DEFAULT_RERANK_BATCH_SIZE } from "./model-config.js";
import {
  applyEligibility,
  identityRerankerAgreement,
  rankSupport,
  SEMANTIC_ELIGIBILITY_THRESHOLD,
  type ThreadSignals
} from "./semantic-eligibility.js";
import type {
  MemorySearchHit,
  MemoryVectorRecord,
  RerankingProvider
} from "./types.js";

const RRF_K = 0;
const IDENTITY_RANK_WEIGHT = 1;
const MAX_RERANK_PASSAGES_PER_THREAD = 3;
const PASSAGE_RANK_WEIGHT = 1;
const RERANKER_RANK_WEIGHT = 2;

export type RankedEvidence = {
  denseRank: number;
  record: MemoryVectorRecord;
  vectorScore: number;
};

export type RankedMemoryThread = {
  eligibility: number;
  evidence: RankedEvidence;
  identityRank?: number;
  passageRank?: number;
  rankingScore: number;
  relevance: number;
  rerankerRank: number;
  semanticEligibility: number;
  score: number;
  signals: ThreadSignals;
};

export { SEMANTIC_ELIGIBILITY_THRESHOLD } from "./semantic-eligibility.js";
export type { ThreadSignals } from "./semantic-eligibility.js";

export type ThreadCandidate = {
  identity?: RankedEvidence;
  passages: RankedEvidence[];
  rerankerEvidence?: RankedEvidence;
  rerankerRank: number;
  rerankerScore: number;
};

export type PassageRerankEntry = {
  candidate: ThreadCandidate;
  evidence: RankedEvidence;
};

type ScoredPassage = PassageRerankEntry & {
  rank: number;
  score: number;
};

export async function rankSemanticMemoryHits(
  query: string,
  hits: MemorySearchHit[],
  reranker: RerankingProvider
): Promise<RankedMemoryThread[]> {
  const ranked = await rankSemanticMemoryCandidates(query, hits, reranker);
  return ranked.filter(
    (thread) => thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  );
}

export async function rankSemanticMemoryCandidates(
  query: string,
  hits: MemorySearchHit[],
  reranker: RerankingProvider
): Promise<RankedMemoryThread[]> {
  const evidence = denseRanksByKind(hits);
  const candidates = consolidateThreads(evidence);
  const reranked = await rerankPassages(query, candidates, reranker);
  const ranked = rankThreads(reranked);
  return applyEligibility(ranked);
}

export function denseRanksByKind(hits: MemorySearchHit[]): RankedEvidence[] {
  const ranks = new Map<MemoryVectorRecord["kind"], number>();
  return hits.map((hit) => {
    const denseRank = (ranks.get(hit.record.kind) ?? 0) + 1;
    ranks.set(hit.record.kind, denseRank);
    return {
      denseRank,
      record: hit.record,
      vectorScore: hit.score
    };
  });
}

export function consolidateThreads(
  evidence: RankedEvidence[]
): ThreadCandidate[] {
  const candidates = new Map<string, ThreadCandidate>();
  for (const item of evidence) {
    const threadId = item.record.threadId;
    const candidate = candidates.get(threadId) ?? {
      passages: [],
      rerankerRank: evidence.length,
      rerankerScore: 0
    };
    if (item.record.kind === "identity") candidate.identity = item;
    if (item.record.kind === "passage") candidate.passages.push(item);
    candidates.set(threadId, candidate);
  }
  return [...candidates.values()].map((candidate) => ({
    ...candidate,
    passages: passagesByDenseRank(candidate.passages).slice(
      0,
      MAX_RERANK_PASSAGES_PER_THREAD
    )
  }));
}

async function rerankPassages(
  query: string,
  candidates: ThreadCandidate[],
  reranker: RerankingProvider
): Promise<ThreadCandidate[]> {
  if (!candidates.length) return [];
  const entries = rerankingEntriesOf(candidates);
  if (!entries.length) return candidates;
  const scores = await reranker.rerank(
    query,
    entries.map((entry) => semanticRerankingDocument(entry.evidence.record)),
    DEFAULT_RERANK_BATCH_SIZE
  );
  if (scores.length !== entries.length)
    throw new Error("Memory reranker returned an unexpected score count.");
  return applyRerankScores(candidates, entries, scores);
}

/** The reranker input of M0 for these candidates: the evidence each one sends, in candidate order. */
export function rerankingEntriesOf(
  candidates: ThreadCandidate[]
): PassageRerankEntry[] {
  return candidates.flatMap((candidate) =>
    rerankingEvidence(candidate).map((evidence) => ({ candidate, evidence }))
  );
}

/**
 * The M0 rerank step once the scores of the entries are known: the global rank of each entry (numericRanks), and
 * the best entry of each candidate, which gives its reranker rank, evidence and score.
 */
export function applyRerankScores(
  candidates: ThreadCandidate[],
  entries: PassageRerankEntry[],
  scores: number[]
): ThreadCandidate[] {
  const ranks = numericRanks(scores);
  const scored = entries.map((entry, index) => ({
    ...entry,
    rank: ranks[index] ?? entries.length,
    score: scores[index] ?? 0
  }));
  return candidates.map((candidate) => applyBestPassage(candidate, scored));
}

/** The evidence that M0 sends to the reranker for a candidate: its passages, or its identity alone. */
export function rerankingEvidence(
  candidate: ThreadCandidate
): RankedEvidence[] {
  if (candidate.passages.length) return candidate.passages;
  if (candidate.identity) return [candidate.identity];
  return [];
}

function applyBestPassage(
  candidate: ThreadCandidate,
  scored: ScoredPassage[]
): ThreadCandidate {
  const best = scored
    .filter((item) => item.candidate === candidate)
    .sort(compareScoredPassages)[0];
  if (!best) return candidate;
  return {
    ...candidate,
    rerankerEvidence: best.evidence,
    rerankerRank: best.rank,
    rerankerScore: best.score
  };
}

function compareScoredPassages(left: ScoredPassage, right: ScoredPassage) {
  const scoreDifference = right.score - left.score;
  if (scoreDifference !== 0) return scoreDifference;
  return left.evidence.denseRank - right.evidence.denseRank;
}

/** The global ordinal position of each value, higher first; a tie keeps the order of the values (M0's rule). */
export function numericRanks(values: number[]): number[] {
  const sorted = values
    .map((value, index) => ({ index, value }))
    .sort((left, right) => right.value - left.value);
  const ranks = Array.from({ length: values.length }, () => values.length);
  sorted.forEach((item, index) => {
    ranks[item.index] = index + 1;
  });
  return ranks;
}

function rankThreads(candidates: ThreadCandidate[]): RankedMemoryThread[] {
  return candidates
    .map((candidate) => {
      const evidence = preferredEvidence(candidate);
      const identityRank = candidate.identity?.denseRank;
      const passageRank = minimumPassageRank(candidate.passages);
      const rankingScore =
        semanticFusionScore(identityRank, passageRank) +
        rerankerFusionScore(candidate.rerankerRank);
      const signals = threadSignals(candidate, identityRank, passageRank);
      return {
        eligibility: 0,
        evidence,
        identityRank,
        passageRank,
        rankingScore,
        relevance: candidate.rerankerScore,
        rerankerRank: candidate.rerankerRank,
        semanticEligibility: 0,
        score: rankingScore,
        signals
      };
    })
    .sort(compareRankedThreads);
}

function preferredEvidence(candidate: ThreadCandidate): RankedEvidence {
  if (candidate.rerankerEvidence) return candidate.rerankerEvidence;
  const passage = passagesByDenseRank(candidate.passages)[0];
  if (passage) return passage;
  if (candidate.identity) return candidate.identity;
  throw new Error("Memory thread candidate has no evidence.");
}

function passagesByDenseRank(passages: RankedEvidence[]): RankedEvidence[] {
  return [...passages].sort((left, right) => {
    const rankDifference = left.denseRank - right.denseRank;
    if (rankDifference !== 0) return rankDifference;
    return left.record.recordId.localeCompare(right.record.recordId);
  });
}

function minimumPassageRank(passages: RankedEvidence[]): number | undefined {
  return passagesByDenseRank(passages)[0]?.denseRank;
}

function threadSignals(
  candidate: ThreadCandidate,
  identityRank: number | undefined,
  passageRank: number | undefined
): ThreadSignals {
  const evidence = [candidate.identity, ...candidate.passages].filter(
    (item): item is RankedEvidence => Boolean(item)
  );
  return {
    bestDenseScore: Math.max(...evidence.map((item) => item.vectorScore), 0),
    channelAgreement: identityRank && passageRank ? 1 : 0,
    evidenceConcentration: concentratedPassageRatio(candidate.passages),
    identityRerankerAgreement: identityRerankerAgreement(
      identityRank,
      candidate.rerankerRank,
      candidate.rerankerScore
    ),
    identitySupport: rankSupport(identityRank),
    passageSupport: rankSupport(passageRank),
    rankingMargin: 0,
    rerankerScore: candidate.rerankerScore,
    rerankerSupport: rankSupport(candidate.rerankerRank)
  };
}

function concentratedPassageRatio(passages: RankedEvidence[]): number {
  if (!passages.length) return 0;
  const concentrated = passages.filter((passage) => passage.denseRank <= 10);
  return concentrated.length / passages.length;
}

function reciprocalRank(rank: number | undefined): number {
  if (!rank) return 0;
  return 1 / (RRF_K + rank);
}

/**
 * Ranks thread candidates with the production eligibility, without a reranker call. The
 * funnel scores only some passages, so it builds its own candidates and uses this rule.
 */
export function rankThreadCandidates(
  candidates: ThreadCandidate[]
): RankedMemoryThread[] {
  return applyEligibility(rankThreads(candidates));
}

/** The M0 fusion without the reranker term: the identity and passage ranks, weighted. */
export function semanticFusionScore(
  identityRank: number | undefined,
  passageRank: number | undefined
): number {
  return (
    reciprocalRank(identityRank) * IDENTITY_RANK_WEIGHT +
    reciprocalRank(passageRank) * PASSAGE_RANK_WEIGHT
  );
}

/** The reranker term of the M0 fusion: the reciprocal of the group's rank under the reranker. */
export function rerankerFusionScore(rerankerRank: number): number {
  return reciprocalRank(rerankerRank) * RERANKER_RANK_WEIGHT;
}

function compareRankedThreads(
  left: RankedMemoryThread,
  right: RankedMemoryThread
): number {
  const scoreDifference = right.rankingScore - left.rankingScore;
  if (scoreDifference !== 0) return scoreDifference;
  const relevanceDifference = right.relevance - left.relevance;
  if (relevanceDifference !== 0) return relevanceDifference;
  return left.evidence.record.recordId.localeCompare(
    right.evidence.record.recordId
  );
}

export function semanticRerankingDocument(
  record: MemorySearchHit["record"]
): string {
  const section = record.sectionTitle
    ? `\nSection: ${record.sectionTitle}`
    : "";
  return `Title: ${record.title}${section}\nContent: ${record.text}`;
}
