export const SEMANTIC_ELIGIBILITY_THRESHOLD = 0.5;

export type ThreadSignals = {
  bestDenseScore: number;
  channelAgreement: number;
  evidenceConcentration: number;
  identityRerankerAgreement: number;
  identitySupport: number;
  passageSupport: number;
  rankingMargin: number;
  rerankerScore: number;
  rerankerSupport: number;
};

type EligibilityCandidate = {
  eligibility: number;
  rankingScore: number;
  semanticEligibility: number;
  signals: ThreadSignals;
};

export function applyEligibility<T extends EligibilityCandidate>(
  ranked: T[]
): T[] {
  const results: T[] = [];
  let eligibilityCeiling = 1;
  for (const [index, thread] of ranked.entries()) {
    const nextScore = index === 0 ? ranked[1]?.rankingScore : undefined;
    const rankingMargin = relativeRankingMargin(thread.rankingScore, nextScore);
    const signals = { ...thread.signals, rankingMargin };
    const semanticEligibility = eligibilityProbability(signals);
    const eligibility = Math.min(semanticEligibility, eligibilityCeiling);
    eligibilityCeiling = eligibility;
    results.push({
      ...thread,
      eligibility,
      semanticEligibility,
      signals
    });
  }
  return results;
}

export function identityRerankerAgreement(
  identityRank: number | undefined,
  rerankerRank: number | undefined,
  rerankerScore: number
): number {
  const rankAgreement = Math.min(
    rankSupport(identityRank),
    rankSupport(rerankerRank)
  );
  const scoreSupport = Math.max(0, Math.min(1, rerankerScore / 0.1));
  return rankAgreement * scoreSupport;
}

export function rankSupport(rank: number | undefined): number {
  if (!rank) return 0;
  return 1 / rank;
}

function relativeRankingMargin(
  score: number,
  nextScore: number | undefined
): number {
  if (nextScore === undefined) return 0;
  if (score <= 0) return 0;
  return Math.max(0, score - nextScore) / score;
}

function eligibilityProbability(signals: ThreadSignals): number {
  const logit =
    -9.25 +
    signals.bestDenseScore * 4 +
    signals.rerankerScore * 12 +
    signals.channelAgreement +
    signals.evidenceConcentration +
    signals.identityRerankerAgreement * 3 +
    signals.identitySupport +
    signals.passageSupport +
    signals.rerankerSupport +
    signals.rankingMargin * signals.identityRerankerAgreement * 12;
  return 1 / (1 + Math.exp(-logit));
}
