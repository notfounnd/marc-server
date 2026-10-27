import { rankHybridMemoryCandidates } from "../../src/core/memory/hybrid-ranking.js";
import { SEMANTIC_ELIGIBILITY_THRESHOLD } from "../../src/core/memory/semantic-eligibility.js";
import type {
  MemorySearchChannels,
  MemorySearchDepth,
  RerankingProvider
} from "../../src/core/memory/types.js";
import type { MemoryLayer } from "../../src/core/memory/sources/contract.js";
import { runFunnel, type FunnelConfig, type FunnelStop } from "../../src/core/memory/funnel-run.js";
import { VARIANT_PLANS, reachEntries } from "./metrics.js";
import type { CatalogRow } from "../../src/core/memory/funnel-groups.js";
import type { RerankSelectionMode } from "../../src/core/memory/funnel-selection.js";
import {
  ADAPTIVE_FUNNEL_NAMES,
  FUNNEL_VARIANT_NAMES,
  deepestSearchedDepth,
  funnelConfigOf,
  type FunnelVariantName
} from "./funnel-variants.js";
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
} from "./features.js";

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
  /** The funnel inputs of the case: channels per depth, vectors and captured scores (E3). */
  funnel?: FunnelVariantInput;
  /** The parameters of the funnel runs. Never defaulted: a run without them is missing-funnel-params. */
  funnelParams?: FunnelParams;
};

/** What the funnel and the per-depth variants read, on top of the M0 inputs. */
export type FunnelVariantInput = {
  channelsByDepth: Partial<Record<MemorySearchDepth, MemorySearchChannels>>;
  vectors: ReadonlyMap<string, readonly number[]>;
  /** The catalog of the capture: every identity and passage of each group, with its layer and vector. */
  catalog: ReadonlyMap<string, readonly CatalogRow[]>;
  queryVector: readonly number[];
  /** Captured reranker score of each pair of the effective query, keyed by recordId. */
  scores: ReadonlyMap<string, number>;
  ftsRecordIds: ReadonlySet<string>;
};

/**
 * The parameters of a funnel run, given by the replay command. Budget B, K and the selection mode
 * are required for every funnel variant; the band cuts only for the variants that stop on a band.
 */
export type FunnelParams = {
  budget: number;
  k: number;
  mode: RerankSelectionMode;
  cuts?: { high: number; medium: number };
  /**
   * Worksheet only: the run takes every step and never stops early, so no band cuts are needed. The
   * replay parser never sets it, so a replay of an adaptive variant still requires the cuts.
   */
  exhaustiveSteps?: boolean;
};

export type VariantResult = {
  threadId: string;
  score: number;
  admitted: boolean;
  band?: "high" | "medium" | "low";
  /** Funnel detail of the admitted group. Only the funnel variants set it. */
  funnel?: {
    chosenPassages: string[];
    layersSearched: MemoryLayer[];
    pairsRequested: number;
    pairsUnique: number;
    stopReason: FunnelStop;
  };
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

/**
 * The capture does not hold the channels of every depth for this case. Not an error: the
 * replay records the variant as incomplete, so it cannot be approved on this capture.
 */
export class MissingFunnelInputs extends Error {
  constructor() {
    super("The case has no funnel inputs: the capture does not hold the channels of every depth.");
  }
}

/**
 * A funnel run without its parameters. They are never defaulted here: the replay command gives the
 * budget, K and the selection mode, and the band cuts for the adaptive variants.
 */
export class MissingFunnelParams extends Error {
  constructor() {
    super("The funnel run has no parameters: give the budget, K and the selection mode, and the band cuts for ADAPTIVE.");
  }
}

/** The funnel input of a case. A funnel variant without it is incomplete, never zero. */
function requireFunnel(input: Pick<VariantInput, "funnel">): FunnelVariantInput {
  if (input.funnel === undefined) throw new MissingFunnelInputs();
  return input.funnel;
}

/**
 * The parameters of one funnel variant. A variant that stops on a band also needs the band cuts,
 * unless the run is exhaustive: then it takes every step and no cut is read.
 */
function requireParams(name: FunnelVariantName, input: Pick<VariantInput, "funnelParams">): FunnelParams {
  const params = input.funnelParams;
  if (params === undefined) throw new MissingFunnelParams();
  if (funnelConfigOf(name).stopOn !== "none" && params.cuts === undefined && params.exhaustiveSteps !== true)
    throw new MissingFunnelParams();
  return params;
}

/** The funnel config of a run. An exhaustive run never stops early, whatever the variant's stop rule. */
function configOf(name: FunnelVariantName, params: FunnelParams): FunnelConfig {
  const config = funnelConfigOf(name);
  if (params.exhaustiveSteps !== true) return config;
  return { ...config, stopOn: "none" };
}

/**
 * The reach of an exhaustive run, step by step. Each step reaches the groups that the reach rule of its
 * variant reads from the groups it admitted (the same rule as the replay). Each group keeps the deepest
 * step that reaches it. The run takes every step, so every stop point is covered.
 */
export function exhaustiveReachOf(
  name: FunnelVariantName,
  input: Pick<VariantInput, "funnel" | "funnelParams">
): Map<string, MemorySearchDepth> {
  const funnel = requireFunnel(input);
  const params = requireParams(name, input);
  const config: FunnelConfig = { ...funnelConfigOf(name), stopOn: "none" };
  const result = runFunnel({ ...funnel, ...params }, config);
  const plan = VARIANT_PLANS[name];
  if (plan === undefined) throw new Error(`Unknown ranking variant: ${name}`);
  const depths = new Map<string, MemorySearchDepth>();
  for (const step of result.steps) {
    const results: VariantResult[] = step.admitted.map((item) => ({
      threadId: item.groupId,
      score: item.eligibility,
      admitted: true
    }));
    for (const entry of reachEntries({ results }, plan.requireAdmitted)) {
      depths.set(entry.threadId, Math.max(depths.get(entry.threadId) ?? 0, step.depth) as MemorySearchDepth);
    }
  }
  return depths;
}

/** The M0 algorithm at one depth: the production order and admission over that depth's channels. */
function depthVariant(depth: MemorySearchDepth): RankingVariant {
  return async (input) => {
    const channels = requireFunnel(input).channelsByDepth[depth];
    if (channels === undefined)
      throw new Error(`The case has no channels for depth ${depth}.`);
    return (await productionOrder({ ...input, channels })).map((item) => ({
      threadId: item.threadId,
      score: item.score,
      admitted: item.eligible
    }));
  };
}

/** The result of one funnel run: its admitted groups and the depth that grades it, from the same run. */
export type FunnelRanking = { results: VariantResult[]; judgedDepth: MemorySearchDepth };

/**
 * Runs one funnel variant once. The judged depth is the deepest layer that this run searched, so no
 * variant is run again only to measure it. The results carry the funnel detail of each admitted group.
 */
export function runFunnelRanking(name: FunnelVariantName, input: VariantInput): FunnelRanking {
  const funnel = requireFunnel(input);
  const params = requireParams(name, input);
  const result = runFunnel({ ...funnel, ...params }, configOf(name, params));
  return {
    results: result.admitted.map((item) => ({
      threadId: item.groupId,
      score: item.eligibility,
      admitted: true,
      band: item.band,
      funnel: {
        chosenPassages: item.chosenPassages,
        layersSearched: result.layersSearched,
        pairsRequested: result.pairsRequested,
        pairsUnique: result.pairsUnique,
        stopReason: result.stopReason
      }
    })),
    judgedDepth: deepestSearchedDepth(result)
  };
}

/** One funnel variant as a ranking variant: the admitted groups of its run. */
function funnelVariant(name: FunnelVariantName): RankingVariant {
  return async (input) => runFunnelRanking(name, input).results;
}

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
  [PRODUCTION_RECALL_ID]: PRODUCTION_RECALL,
  DEPTH0: depthVariant(0),
  DEPTH1: depthVariant(1),
  DEPTH2: depthVariant(2),
  ...Object.fromEntries(
    FUNNEL_VARIANT_NAMES.map((name) => [name, funnelVariant(name)] as const)
  )
};

export function isRankingVariantId(id: string): boolean {
  return Object.hasOwn(rankingVariants, id);
}

const FIXED_DEPTH_VARIANTS: Readonly<Record<string, MemorySearchDepth>> = {
  DEPTH0: 0,
  DEPTH1: 1,
  DEPTH2: 2
};

const DEPTH_SUFFIX = /_D([012])$/;

/**
 * The deepest layer whose judgments grade a variant on a case. DEPTHd and the `_Dd` funnel variants
 * are graded at d. Every other fixed variant is graded at layer 0. The adaptive variants have no fixed
 * depth: their judged depth is the deepest layer of their own run (runFunnelRanking), never a second run.
 */
export function judgedDepthOfVariant(id: string): MemorySearchDepth {
  if ((ADAPTIVE_FUNNEL_NAMES as readonly string[]).includes(id))
    throw new Error(`The judged depth of ${id} comes from its funnel run, not from its id.`);
  if (Object.hasOwn(FIXED_DEPTH_VARIANTS, id)) return FIXED_DEPTH_VARIANTS[id] ?? 0;
  const suffix = DEPTH_SUFFIX.exec(id);
  if (suffix !== null) return Number(suffix[1]) as MemorySearchDepth;
  return 0;
}
