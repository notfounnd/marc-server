import { rankHybridMemoryCandidates } from "../../src/core/memory/hybrid-ranking.js";
import { SEMANTIC_ELIGIBILITY_THRESHOLD } from "../../src/core/memory/semantic-eligibility.js";
import type {
  MemorySearchChannels,
  RerankingProvider
} from "../../src/core/memory/types.js";
import type { RelevanceGrade } from "./dataset.js";
import type { CapturedProductionRecall } from "./capture-types.js";
import { candidateFeaturesOf } from "./candidate-pairs.js";
import {
  admits,
  bandOf,
  probabilityOf,
  type FitResult,
  type ModelParams
} from "./fit-model.js";
import {
  calibratedProbability,
  type CalibrationParams,
  type CalibrationResult,
  type CalibrationSet
} from "./calibration.js";
import {
  judgeChainRanking,
  judgeFallbackRanking,
  type JudgeModelParams,
  type JudgeName
} from "./judge-stage.js";
import {
  featureVectorOf,
  semanticOnlyVectorOf,
  type ThreadFeatures
} from "../../src/core/memory/scoring/features.js";

export type VariantInput = {
  query: string;
  channels: MemorySearchChannels;
  reranker: RerankingProvider;
  judgments: Record<string, RelevanceGrade>;
  /** Captured production recall of the same case. Only PRODUCTION_RECALL reads it. */
  production: CapturedProductionRecall;
  /** Outer fold of the case. Only the H1 variants read it. */
  fold?: number;
  /** Fit of this capture. Only the H1 variants read it. */
  fit?: FitResult;
  /** Calibrations of this capture (H2). Only the H2 variants read it. */
  calibrations?: CalibrationSet;
  /** Judge scores of this case, by threadId (H7). Only the H7 variants read it. */
  judge?: Partial<Record<JudgeName, ReadonlyMap<string, number>>>;
};

export type VariantResult = {
  threadId: string;
  score: number;
  admitted: boolean;
  band?: "high" | "medium" | "low";
};

export type RankingVariant = (input: VariantInput) => Promise<VariantResult[]>;

/** Smallest grade that the oracle admits: the threads a perfect cut would keep. */
const ORACLE_MIN_GRADE: RelevanceGrade = 2;

type ProductionOrderItem = {
  threadId: string;
  score: number;
  eligible: boolean;
};

/**
 * Production order of rankHybridMemoryCandidates. `eligible` is the production
 * admission rule: eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD.
 */
async function productionOrder(input: VariantInput): Promise<ProductionOrderItem[]> {
  const ranked = await rankHybridMemoryCandidates(
    input.query,
    input.channels,
    input.reranker
  );
  return ranked.map((thread) => ({
    threadId: thread.evidence.record.threadId,
    score: thread.eligibility,
    eligible: thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  }));
}

/** M0: production order and production admission. Never reads judgments. */
export const M0: RankingVariant = async (input) =>
  (await productionOrder(input)).map((item) => ({
    threadId: item.threadId,
    score: item.score,
    admitted: item.eligible
  }));

/** D0: production order with every candidate admitted. Diagnostic only. Never reads judgments. */
export const D0: RankingVariant = async (input) =>
  (await productionOrder(input)).map((item) => ({
    threadId: item.threadId,
    score: item.score,
    admitted: true
  }));

/** ORACLE_ADMISSION: D0 order, admitting exactly the threads with grade >= 2. */
export const ORACLE_ADMISSION: RankingVariant = async (input) =>
  (await productionOrder(input)).map((item) => ({
    threadId: item.threadId,
    score: item.score,
    admitted: (input.judgments[item.threadId] ?? 0) >= ORACLE_MIN_GRADE
  }));

/**
 * The parameters fitted without the case's outer fold. A replay without the fit
 * of the capture cannot run the H1 variants, and says so.
 */
export function foldParamsOf(input: VariantInput): ModelParams {
  if (input.fit === undefined || input.fold === undefined) {
    throw new Error("The H1 variants need the capture's fit and the case fold.");
  }
  const params = input.fit.folds[input.fold];
  if (params === undefined) {
    throw new Error(`The fit has no parameters for fold ${input.fold}.`);
  }
  return params;
}

type CalibratedItem = {
  threadId: string;
  probability: number;
  semanticOnly: number;
  bestRerankerScore: number;
};

/**
 * H1_CALIBRATED ranking. A thread is admitted when its semanticOnly score reaches
 * the low cut, so lexical evidence alone never admits a thread (D6). The order is
 * p descending, then the best reranker score descending, then threadId ascending.
 * An admitted thread takes the band of its full p.
 */
export function calibratedRanking(
  features: readonly ThreadFeatures[],
  params: ModelParams
): VariantResult[] {
  const scored: CalibratedItem[] = features.map((item) => ({
    threadId: item.threadId,
    probability: probabilityOf(params, featureVectorOf(item)),
    semanticOnly: probabilityOf(params, semanticOnlyVectorOf(item)),
    bestRerankerScore: item.bestRerankerScore
  }));
  return scored.sort(compareCalibrated).map((item) => {
    const admitted = admits(item.semanticOnly, params.cuts.low);
    return {
      threadId: item.threadId,
      score: item.probability,
      admitted,
      band: admitted ? bandOf(item.probability, params.cuts) : undefined
    };
  });
}

function compareCalibrated(left: CalibratedItem, right: CalibratedItem): number {
  const byProbability = right.probability - left.probability;
  if (byProbability !== 0) return byProbability;
  const byReranker = right.bestRerankerScore - left.bestRerankerScore;
  if (byReranker !== 0) return byReranker;
  if (left.threadId === right.threadId) return 0;
  return left.threadId < right.threadId ? -1 : 1;
}

/**
 * H1_FALLBACK ranking: the M0 order and admission. An admitted thread takes the
 * band of its M0 eligibility, with the cuts fitted on the training eligibility.
 */
export function fallbackRanking(
  m0: readonly VariantResult[],
  params: ModelParams
): VariantResult[] {
  return m0.map((item) => ({
    ...item,
    band: item.admitted ? bandOf(item.score, params.fallbackCuts) : undefined
  }));
}

/** H1_CALIBRATED: calibratedRanking over the case's channels. Never reads judgments. */
export const H1_CALIBRATED: RankingVariant = async (input) => {
  const params = foldParamsOf(input);
  const features = await candidateFeaturesOf(
    input.query,
    input.channels,
    input.reranker
  );
  return calibratedRanking(features, params);
};

/** H1_FALLBACK: fallbackRanking over the M0 list. Never reads judgments. */
export const H1_FALLBACK: RankingVariant = async (input) =>
  fallbackRanking(await M0(input), foldParamsOf(input));

/**
 * H2 ranking: the admission and the order of H1_CALIBRATED, with the band taken
 * from p' = sigmoid(a logit(p) + b) under the same fold cuts. The score stays p.
 */
export function h2Ranking(
  features: readonly ThreadFeatures[],
  params: ModelParams,
  calibration: CalibrationParams
): VariantResult[] {
  return calibratedRanking(features, params).map((item) => {
    if (!item.admitted) return item;
    const pPrime = calibratedProbability(item.score, calibration);
    return { ...item, band: bandOf(pPrime, params.cuts) };
  });
}

/** The parameters of one calibration; an invalid or missing one stops the variant. */
function calibrationParamsOf(
  input: VariantInput,
  name: keyof CalibrationSet
): CalibrationParams {
  const result: CalibrationResult | undefined = input.calibrations?.[name];
  if (result === undefined) {
    throw new Error(`The ${name} calibration is missing: run memory:eval calibrate first.`);
  }
  if (!result.valid || result.a === null || result.b === null) {
    throw new Error(`The ${name} calibration is invalid: ${result.reason ?? "no reason recorded"}.`);
  }
  return { a: result.a, b: result.b };
}

/** H2_N1: h2Ranking with the N1 calibration. Never reads judgments. */
export const H2_N1: RankingVariant = async (input) => {
  const params = foldParamsOf(input);
  const calibration = calibrationParamsOf(input, "N1");
  const features = await candidateFeaturesOf(input.query, input.channels, input.reranker);
  return h2Ranking(features, params, calibration);
};

/** H2_N2: h2Ranking with the N2 calibration. Never reads judgments. */
export const H2_N2: RankingVariant = async (input) => {
  const params = foldParamsOf(input);
  const calibration = calibrationParamsOf(input, "N2");
  const features = await candidateFeaturesOf(input.query, input.channels, input.reranker);
  return h2Ranking(features, params, calibration);
};

/** The judge stage of one judge in the fold's fit. */
function judgeStageOf(input: VariantInput, name: JudgeName): JudgeModelParams {
  const stage = foldParamsOf(input).judge?.[name];
  if (stage === undefined) {
    throw new Error(
      `The fit has no ${name} judge stage. Run \`judge --model ${name}\` on the fitted capture (marc) and fit it again; a capture without judge scores cannot evaluate H7.`
    );
  }
  return stage;
}

/** The judge scores of one judge for this case. */
function judgeTableOf(input: VariantInput, name: JudgeName): ReadonlyMap<string, number> {
  const table = input.judge?.[name];
  if (table === undefined) {
    throw new Error(`The ${name} judge scores are missing: run memory:eval judge first.`);
  }
  return table;
}

/** H7_JUDGE_<J>: the judge chain on the H1 fold parameters. Never reads judgments. */
function judgeChainVariant(name: JudgeName): RankingVariant {
  return async (input) => {
    const features = await candidateFeaturesOf(input.query, input.channels, input.reranker);
    return judgeChainRanking(
      features,
      foldParamsOf(input),
      judgeStageOf(input, name).chain,
      judgeTableOf(input, name)
    );
  };
}

/** H7_JUDGE_<J>_FALLBACK: the judge chain on the M0 admission and eligibility. Never reads judgments. */
function judgeFallbackVariant(name: JudgeName): RankingVariant {
  return async (input) =>
    judgeFallbackRanking(
      await M0(input),
      judgeStageOf(input, name).fallback,
      judgeTableOf(input, name)
    );
}

export const H7_JUDGE_QWEN: RankingVariant = judgeChainVariant("qwen");
export const H7_JUDGE_KEV: RankingVariant = judgeChainVariant("kev");
export const H7_JUDGE_QWEN_FALLBACK: RankingVariant = judgeFallbackVariant("qwen");
export const H7_JUDGE_KEV_FALLBACK: RankingVariant = judgeFallbackVariant("kev");

export const PRODUCTION_RECALL_ID = "PRODUCTION_RECALL";

/**
 * Pseudo-variant: the captured production recall as the admitted list, in captured
 * order, cut at the production limit that the replay uses. It reads no judgments.
 * It is not a decision variant; it lets the report show M0 against production order.
 */
export const PRODUCTION_RECALL: RankingVariant = async (input) =>
  input.production.results.slice(0, input.production.limit).map((hit) => ({
    threadId: hit.threadId,
    score: hit.score,
    admitted: true
  }));

/** Dispatch table of the ranking variants that the replay can run. */
export const rankingVariants: Readonly<Record<string, RankingVariant>> = {
  M0,
  D0,
  ORACLE_ADMISSION,
  H1_CALIBRATED,
  H1_FALLBACK,
  H2_N1,
  H2_N2,
  H7_JUDGE_QWEN,
  H7_JUDGE_KEV,
  H7_JUDGE_QWEN_FALLBACK,
  H7_JUDGE_KEV_FALLBACK,
  [PRODUCTION_RECALL_ID]: PRODUCTION_RECALL
};

export function isRankingVariantId(id: string): boolean {
  return Object.hasOwn(rankingVariants, id);
}
