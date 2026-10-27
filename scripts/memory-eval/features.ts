import { semanticHitsForChannels } from "../../src/core/memory/hybrid-ranking.js";
import {
  consolidateThreads,
  denseRanksByKind,
  type RankedEvidence,
  type ThreadCandidate
} from "../../src/core/memory/semantic-ranking.js";
import type {
  MemoryLexicalSearchHit,
  MemorySearchChannels,
  MemoryVectorRecord
} from "../../src/core/memory/types.js";

/**
 * Feature order of every vector of the calibrated score. The weights, the
 * standardization and the semantic-only mask follow this order, so changing it
 * requires a refit.
 */
export const FEATURE_NAMES = [
  "identityCosine",
  "bestPassageCosine",
  "bestRerankerScore",
  "secondRerankerScore",
  "identityRerankerScore",
  "lexicalTitleMatch",
  "lexicalContentMatch"
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export type FeatureVector = Record<FeatureName, number>;

export type ThreadFeatures = FeatureVector & { threadId: string };

/** Reranker score of each record, keyed by recordId, for one effective query. */
export type RerankScores = ReadonlyMap<string, number>;

/** Multiplier that keeps a feature in the semantic-only model input. */
const SEMANTIC_MASK: Readonly<Record<FeatureName, number>> = {
  identityCosine: 1,
  bestPassageCosine: 1,
  bestRerankerScore: 1,
  secondRerankerScore: 1,
  identityRerankerScore: 1,
  lexicalTitleMatch: 0,
  lexicalContentMatch: 0
};

const TITLE_FIELDS: ReadonlySet<string> = new Set(["title", "titlePrefix"]);
const CONTENT_FIELDS: ReadonlySet<string> = new Set(["summary"]);

/** The feature values in FEATURE_NAMES order. */
export function featureVectorOf(features: FeatureVector): number[] {
  return FEATURE_NAMES.map((name) => features[name]);
}

/**
 * The feature values in FEATURE_NAMES order with the lexical features set to 0.
 * Because the weights are non-negative, the model on this input never exceeds
 * the model on the full vector.
 */
export function semanticOnlyVectorOf(features: FeatureVector): number[] {
  return FEATURE_NAMES.map((name) => features[name] * SEMANTIC_MASK[name]);
}

/**
 * The evidence that consolidation keeps for each thread: its identity record and
 * the passages the reranker scores (up to three, the production selection).
 * It reads the same production functions as threadFeatures, with no change.
 */
export function selectedEvidenceOf(
  channels: MemorySearchChannels
): Map<
  string,
  { identity: MemoryVectorRecord | undefined; passages: MemoryVectorRecord[] }
> {
  const evidence = denseRanksByKind(semanticHitsForChannels(channels));
  return new Map(
    consolidateThreads(evidence).map((candidate) => [
      threadIdOf(candidate),
      {
        identity: candidate.identity?.record,
        passages: candidate.passages.map((item) => item.record)
      }
    ])
  );
}

/**
 * The cheap model (E2, H3_C): the same logistic model on the four features that
 * need no reranker score, the two identity-passage cosines and the two lexical
 * matches. It is fitted with the same procedure, on its own lambda and cuts.
 */
export const CHEAP_FEATURE_NAMES = [
  "identityCosine",
  "bestPassageCosine",
  "lexicalTitleMatch",
  "lexicalContentMatch"
] as const;

/** The cheap model's values in CHEAP_FEATURE_NAMES order. */
export function cheapVectorOf(features: FeatureVector): number[] {
  return CHEAP_FEATURE_NAMES.map((name) => features[name]);
}

/** The cheap values with the lexical features set to 0: the cheap semanticOnly input. */
export function cheapSemanticOnlyVectorOf(features: FeatureVector): number[] {
  return CHEAP_FEATURE_NAMES.map(
    (name) => features[name] * SEMANTIC_MASK[name]
  );
}

/**
 * Features of every thread present in any channel, sorted by threadId.
 *
 * The passages scored by the reranker are the ones selected by the production
 * consolidation (up to three per thread), built from the production hit list
 * and dense ranks. Each value depends only on the thread's own evidence and on
 * the reranker scores of its selected passages, so it does not change when other
 * candidates are permuted, removed or added.
 *
 * Exact score ties between passages of different threads are broken by the
 * production insertion order. The selection is per thread, so that order does
 * not change any feature.
 *
 * bestRerankerScore is 0 when the thread has no selected passage. Production
 * then uses the identity score as its relevance. That difference is deliberate:
 * the identity evidence stays in identityRerankerScore, and counting it twice
 * would double-count one signal in a monotonic model.
 *
 * Throws when a selected record has no reranker score.
 */
export function threadFeatures(
  channels: MemorySearchChannels,
  rerankScores: RerankScores
): ThreadFeatures[] {
  const evidence = denseRanksByKind(semanticHitsForChannels(channels));
  const passages = passagesByThread(evidence);
  return consolidateThreads(evidence)
    .map((candidate) =>
      threadFeaturesOf(candidate, passages, channels.lexical, rerankScores)
    )
    .sort(compareThreadIds);
}

function passagesByThread(
  evidence: readonly RankedEvidence[]
): Map<string, RankedEvidence[]> {
  const groups = new Map<string, RankedEvidence[]>();
  evidence
    .filter((item) => item.record.kind === "passage")
    .forEach((item) => {
      const group = groups.get(item.record.threadId) ?? [];
      group.push(item);
      groups.set(item.record.threadId, group);
    });
  return groups;
}

function threadFeaturesOf(
  candidate: ThreadCandidate,
  passages: ReadonlyMap<string, readonly RankedEvidence[]>,
  lexical: readonly MemoryLexicalSearchHit[],
  rerankScores: RerankScores
): ThreadFeatures {
  const threadId = threadIdOf(candidate);
  const selectedScores = candidate.passages.map((item) =>
    rerankScoreOf(rerankScores, item.record)
  );
  const threadPassages = passages.get(threadId) ?? [];
  return {
    threadId,
    identityCosine: candidate.identity?.vectorScore ?? 0,
    bestPassageCosine: nthValue(
      threadPassages.map((item) => item.vectorScore),
      0
    ),
    bestRerankerScore: nthValue(selectedScores, 0),
    secondRerankerScore: nthValue(selectedScores, 1),
    identityRerankerScore: identityRerankerScoreOf(
      candidate.identity,
      rerankScores
    ),
    lexicalTitleMatch: Number(lexicalMatch(lexical, threadId, TITLE_FIELDS)),
    lexicalContentMatch: Number(lexicalMatch(lexical, threadId, CONTENT_FIELDS))
  };
}

function threadIdOf(candidate: ThreadCandidate): string {
  const threadId =
    candidate.identity?.record.threadId ??
    candidate.passages[0]?.record.threadId;
  if (threadId === undefined) {
    throw new Error("Thread candidate has no evidence.");
  }
  return threadId;
}

function rerankScoreOf(
  scores: RerankScores,
  record: MemoryVectorRecord
): number {
  const score = scores.get(record.recordId);
  if (score === undefined) {
    throw new Error(`Missing rerank score for record ${record.recordId}.`);
  }
  return score;
}

function identityRerankerScoreOf(
  identity: RankedEvidence | undefined,
  scores: RerankScores
): number {
  if (identity === undefined) return 0;
  return rerankScoreOf(scores, identity.record);
}

/** The n-th largest value (0-based), or 0 when there are not n+1 values. */
function nthValue(values: readonly number[], index: number): number {
  const sorted = [...values].sort((left, right) => right - left);
  return sorted[index] ?? 0;
}

function lexicalMatch(
  lexical: readonly MemoryLexicalSearchHit[],
  threadId: string,
  fields: ReadonlySet<string>
): boolean {
  return lexical.some(
    (hit) => hit.record.threadId === threadId && fields.has(hit.field)
  );
}

function compareThreadIds(left: ThreadFeatures, right: ThreadFeatures): number {
  if (left.threadId === right.threadId) return 0;
  return left.threadId < right.threadId ? -1 : 1;
}
