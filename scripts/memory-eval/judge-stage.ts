import type { ThreadFeatures } from "../../src/core/memory/scoring/features.js";
import {
  featureVectorOf,
  semanticOnlyVectorOf
} from "../../src/core/memory/scoring/features.js";
import { logitOf } from "./calibration.js";
import {
  admits,
  bandOf,
  probabilityOf,
  type ModelParams,
  type ProcedureFit
} from "./fit-model.js";
import type { VariantResult } from "./variants.js";

/**
 * H7: the judge stage, a second stage over the calibrated score of H1. The chain
 * is p2 = sigmoid(v0 + v1 logit(p) + v2 judge), with v1, v2 >= 0, fitted with the
 * same procedure as H1 on the pairs that pass the pre-admission. The fallback
 * chain (H7_JUDGE_<J>_FALLBACK) uses the M0 admission and eligibility instead.
 */

/** The two judges of the study. */
export const JUDGE_NAMES = ["qwen", "kev"] as const;
export type JudgeName = (typeof JUDGE_NAMES)[number];

/** The chain and the fallback chain of one judge, fitted on one training set. */
/**
 * What the nested fit of one judge did: the partitions it ran, and the partitions whose
 * stage had no pre-admitted training pair and so stayed unfitted (nothing admitted, D6).
 */
export type StageDiagnostics = {
  partitions: number;
  unfittedChain: number;
  unfittedFallback: number;
};

export type JudgeModelParams = {
  chain: ProcedureFit;
  fallback: ProcedureFit;
  diagnostics: StageDiagnostics;
};

/** Clip of the eligibility before the logit in the fallback chain (plan H7). */
export const FALLBACK_CLIP = 1e-6;

/** A training row of a judge chain: the fold, the label and the stage vector. */
export type StageRow = { fold: number; label: 0 | 1; vector: number[] };

/** logit of the H1 score, as the chain reads it. */
export function chainStageVector(p: number, judge: number): number[] {
  return [logitOf(p), judge];
}

/** logit of the eligibility, clipped to [FALLBACK_CLIP, 1 - FALLBACK_CLIP] first. */
export function fallbackStageVector(eligibility: number, judge: number): number[] {
  const clipped = Math.min(1 - FALLBACK_CLIP, Math.max(FALLBACK_CLIP, eligibility));
  return [Math.log(clipped / (1 - clipped)), judge];
}

/**
 * Training rows of the H1 chain: the pairs whose inner semanticOnly reaches the H1
 * low cut (the pre-admission), with the inner p of H1 and the judge score.
 */
export function chainTrainingRows(
  pairs: ReadonlyArray<{
    fold: number;
    label: 0 | 1;
    p: number;
    semanticOnly: number;
    judge: number;
  }>,
  lowCut: number | null
): StageRow[] {
  return pairs
    .filter((pair) => admits(pair.semanticOnly, lowCut))
    .map((pair) => ({
      fold: pair.fold,
      label: pair.label,
      vector: chainStageVector(pair.p, pair.judge)
    }));
}

/** Training rows of the fallback chain: the pairs that M0 admits, with the eligibility and the judge score. */
export function fallbackTrainingRows(
  pairs: ReadonlyArray<{
    fold: number;
    label: 0 | 1;
    eligibility: number;
    m0Admitted: boolean;
    judge: number;
  }>
): StageRow[] {
  return pairs
    .filter((pair) => pair.m0Admitted)
    .map((pair) => ({
      fold: pair.fold,
      label: pair.label,
      vector: fallbackStageVector(pair.eligibility, pair.judge)
    }));
}

/** Score of the H1 chain: p2 for a calibrated p and a judge probability. */
export function chainScore(chain: ProcedureFit, p: number, judge: number): number {
  return probabilityOf(chain, chainStageVector(p, judge));
}

/** Score of the fallback chain: p2 for an eligibility and a judge probability. */
export function fallbackScore(
  fallback: ProcedureFit,
  eligibility: number,
  judge: number
): number {
  return probabilityOf(fallback, fallbackStageVector(eligibility, judge));
}

function judgeOf(judge: ReadonlyMap<string, number>, threadId: string): number {
  const score = judge.get(threadId);
  if (score === undefined) {
    throw new Error(`The judge has no score for thread ${threadId}.`);
  }
  return score;
}

type ChainItem = {
  threadId: string;
  p: number;
  p2: number;
  admitted: boolean;
};

/**
 * H7_JUDGE chain ranking. A thread is pre-admitted when its semanticOnly reaches
 * the H1 low cut (D6: lexical evidence alone never admits it); it is admitted when
 * its p2 reaches the chain's low cut. Ordered by p2, then p, then threadId.
 */
export function judgeChainRanking(
  features: readonly ThreadFeatures[],
  h1: ModelParams,
  chain: ProcedureFit,
  judge: ReadonlyMap<string, number>
): VariantResult[] {
  const items: ChainItem[] = features.map((item) => {
    const p = probabilityOf(h1, featureVectorOf(item));
    const semanticOnly = probabilityOf(h1, semanticOnlyVectorOf(item));
    const p2 = chainScore(chain, p, judgeOf(judge, item.threadId));
    const preAdmitted = admits(semanticOnly, h1.cuts.low);
    return {
      threadId: item.threadId,
      p,
      p2,
      admitted: preAdmitted && admits(p2, chain.cuts.low)
    };
  });
  return items.sort(compareChain).map((item) => ({
    threadId: item.threadId,
    score: item.p2,
    admitted: item.admitted,
    band: item.admitted ? bandOf(item.p2, chain.cuts) : undefined
  }));
}

/**
 * H7_JUDGE fallback ranking. The pre-admission is the M0 admission, and the score
 * is the M0 eligibility under the fallback chain. Ordered by p2, then eligibility,
 * then threadId.
 */
export function judgeFallbackRanking(
  m0: readonly VariantResult[],
  fallback: ProcedureFit,
  judge: ReadonlyMap<string, number>
): VariantResult[] {
  const items = m0.map((item) => {
    const p2 = fallbackScore(fallback, item.score, judgeOf(judge, item.threadId));
    return {
      threadId: item.threadId,
      p: item.score,
      p2,
      admitted: item.admitted && admits(p2, fallback.cuts.low)
    };
  });
  return items.sort(compareChain).map((item) => ({
    threadId: item.threadId,
    score: item.p2,
    admitted: item.admitted,
    band: item.admitted ? bandOf(item.p2, fallback.cuts) : undefined
  }));
}

function compareChain(left: ChainItem, right: ChainItem): number {
  const byScore = right.p2 - left.p2;
  if (byScore !== 0) return byScore;
  const byH1 = right.p - left.p;
  if (byH1 !== 0) return byH1;
  if (left.threadId === right.threadId) return 0;
  return left.threadId < right.threadId ? -1 : 1;
}
