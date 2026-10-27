import { candidateFeaturesOf } from "./candidate-pairs.js";
import type { CaptureFile } from "./capture-types.js";
import type { EvalCase, EvalDataset } from "./dataset.js";
import {
  BAND_TARGETS,
  LAMBDA_GRID,
  admits,
  bandCutsOf,
  bandOf,
  fitLogistic,
  fitLogisticWithDiagnostics,
  logLoss,
  probabilityOf,
  type Band,
  type BandSummary,
  type Convergence,
  type FitResult,
  type FoldModelParams,
  type LabelledVector,
  type ModelParams,
  type ProcedureFit,
  type ScoredLabel
} from "./fit-model.js";
import { FOLD_COUNT, caseFolds } from "./folds.js";
import { RELEVANT_GRADE } from "./metrics.js";
import { cachedReplayProviders, recordsById, variantInputOf } from "./replay.js";
import {
  CHEAP_FEATURE_NAMES,
  cheapSemanticOnlyVectorOf,
  cheapVectorOf,
  featureVectorOf,
  semanticOnlyVectorOf,
  FEATURE_NAMES,
  type ThreadFeatures
} from "./features.js";
import { M0, type VariantResult } from "./variants.js";
import { cheapScoresOf } from "./cheap.js";
import {
  JUDGE_NAMES,
  chainScore,
  chainTrainingRows,
  fallbackScore,
  fallbackTrainingRows,
  type JudgeModelParams,
  type JudgeName,
  type StageDiagnostics,
  type StageRow
} from "./judge-stage.js";

/** Judge scores of the labelled pairs, keyed by judgeKeyOf(caseId, threadId). */
export type JudgeTable = ReadonlyMap<string, number>;

export function judgeKeyOf(caseId: string, threadId: string): string {
  return `${caseId}\0${threadId}`;
}

/** The judges that have a table, in JUDGE_NAMES order. */
export function judgeNamesOf(
  tables: Partial<Record<JudgeName, JudgeTable>>
): JudgeName[] {
  return JUDGE_NAMES.filter((name) => tables[name] !== undefined);
}

/** Attaches the judge scores to each labelled pair. A missing score stops the fit. */
export function attachJudges(
  pairs: readonly LabelledPair[],
  tables: Partial<Record<JudgeName, JudgeTable>>
): LabelledPair[] {
  const names = judgeNamesOf(tables);
  return pairs.map((pair) => ({
    ...pair,
    judges: Object.fromEntries(
      names.map((name) => [name, scoreOfPair(tables, name, pair)])
    )
  }));
}

function scoreOfPair(
  tables: Partial<Record<JudgeName, JudgeTable>>,
  name: JudgeName,
  pair: LabelledPair
): number {
  const table = tables[name];
  const score = table?.get(judgeKeyOf(pair.caseId, pair.threadId));
  if (score === undefined) {
    throw new Error(`The ${name} judge has no score for ${pair.caseId}/${pair.threadId}.`);
  }
  return score;
}

/** Name of the fit result inside the capture directory. */
export const FIT_FILE = "fit.json";

/** Name of the external predictions of every labelled pair, in the capture directory. */
export const FIT_PREDICTIONS_FILE = "fit-predictions.json";

/**
 * One labelled candidate pair (case, thread) of a capture. `eligibility` is the
 * M0 score after the monotonic ceiling, which is the score H1_FALLBACK bands.
 */
export type LabelledPair = {
  caseId: string;
  threadId: string;
  fold: number;
  label: 0 | 1;
  eligibility: number;
  /** Whether M0 admits the thread. */
  m0Admitted: boolean;
  vector: number[];
  semanticVector: number[];
  /** The cheap model's vector and its semanticOnly vector (lexical features at 0). */
  cheapVector: number[];
  cheapSemanticVector: number[];
  /** Judge scores of this pair, one per judge that the fit uses (H7). */
  judges: Partial<Record<JudgeName, number>>;
};

/** External prediction of one labelled pair, under the parameters fitted without its outer fold. */
export type PairPrediction = {
  caseId: string;
  threadId: string;
  fold: number;
  label: 0 | 1;
  /** Calibrated score p of H1_CALIBRATED. */
  p: number;
  /** p with the lexical features zeroed. Admission compares it with the low cut. */
  semanticOnly: number;
  calibratedAdmitted: boolean;
  /** Band of p, for every labelled pair. The replay shows it for admitted threads only. */
  calibratedBand: Band | null;
  /** M0 eligibility: the score of H1_FALLBACK. */
  eligibility: number;
  fallbackAdmitted: boolean;
  /** Band of the eligibility under the fallback cuts. The replay shows it for admitted threads only. */
  fallbackBand: Band | null;
  /** Cheap model (four features): p, semanticOnly, admission and band under its own cuts. */
  cheapP: number;
  cheapSemanticOnly: number;
  cheapAdmitted: boolean;
  cheapBand: Band | null;
  /** H7 per judge: the chain and fallback chain scores, admission and band of each pair. */
  judges: Partial<Record<JudgeName, JudgePrediction>>;
};

export type JudgePrediction = {
  chainP2: number;
  chainAdmitted: boolean;
  chainBand: Band | null;
  fallbackP2: number;
  fallbackAdmitted: boolean;
  fallbackBand: Band | null;
};

/** Content of fit-predictions.json: the labelled pairs with their external predictions. */
export type FitPredictionsFile = {
  schemaVersion: 1;
  captureId: string;
  pairs: PairPrediction[];
};

/** Output of buildFit: the fit and the external predictions of its labelled pairs. */
export type FitBundle = {
  fit: FitResult;
  predictions: FitPredictionsFile;
};

/** A fitting procedure over training folds. `fitProcedure` is the production one. */
export type ProcedureFitter = (
  trainFolds: readonly (readonly LabelledPair[])[]
) => ProcedureFit;

/**
 * Label of a candidate pair. Grades 2 and 3 are relevant (1), grades 0 and 1 are
 * not (0), and an unjudged thread has no label. Every pair of a negative case is 0.
 */
export function labelOf(evalCase: EvalCase, threadId: string): 0 | 1 | undefined {
  if (evalCase.style === "negative") return 0;
  const grade = evalCase.judgments[threadId];
  if (grade === undefined) return undefined;
  return grade >= RELEVANT_GRADE ? 1 : 0;
}

/**
 * The labelled candidate pairs of a capture, in capture order. Unjudged pairs of
 * positive cases are left out. Uses only the captured channels, the rerank
 * scores and the dataset judgments; no model is loaded.
 */
export async function labelledPairsOf(
  capture: CaptureFile,
  dataset: EvalDataset
): Promise<LabelledPair[]> {
  const folds = caseFolds(dataset.cases);
  const records = recordsById(capture.records);
  const groups: LabelledPair[][] = [];
  for (const captured of capture.cases) {
    const evalCase = caseOf(dataset, captured.id);
    const fold = foldOf(folds, captured.id);
    const input = variantInputOf({
      captured,
      judgments: evalCase.judgments,
      records,
      providers: cachedReplayProviders(captured, capture),
      fold
    });
    const features = await candidateFeaturesOf(
      input.query,
      input.channels,
      input.reranker
    );
    const m0 = await M0(input);
    groups.push(pairsOfCase(evalCase, fold, features, m0));
  }
  return groups.flat();
}

function caseOf(dataset: EvalDataset, caseId: string): EvalCase {
  const evalCase = dataset.cases.find((item) => item.id === caseId);
  if (evalCase === undefined) throw new Error(`Dataset has no case ${caseId}.`);
  return evalCase;
}

function foldOf(folds: ReadonlyMap<string, number>, caseId: string): number {
  const fold = folds.get(caseId);
  if (fold === undefined) throw new Error(`No fold for case ${caseId}.`);
  return fold;
}

function pairsOfCase(
  evalCase: EvalCase,
  fold: number,
  features: readonly ThreadFeatures[],
  m0: readonly VariantResult[]
): LabelledPair[] {
  const m0ByThread = new Map(m0.map((item) => [item.threadId, item] as const));
  return features.flatMap((item) => {
    const label = labelOf(evalCase, item.threadId);
    if (label === undefined) return [];
    const m0Item = m0ByThread.get(item.threadId);
    if (m0Item === undefined) {
      throw new Error(`M0 has no entry for thread ${item.threadId}.`);
    }
    return [
      {
        caseId: evalCase.id,
        threadId: item.threadId,
        fold,
        label,
        eligibility: m0Item.score,
        m0Admitted: m0Item.admitted,
        vector: featureVectorOf(item),
        semanticVector: semanticOnlyVectorOf(item),
        cheapVector: cheapVectorOf(item),
        cheapSemanticVector: cheapSemanticOnlyVectorOf(item),
        judges: {}
      }
    ];
  });
}

/** The pairs of each outer fold, indexed by fold number. */
export function pairsByFold(pairs: readonly LabelledPair[]): LabelledPair[][] {
  return Array.from({ length: FOLD_COUNT }, (_, fold) =>
    pairs.filter((pair) => pair.fold === fold)
  );
}

/**
 * fitProcedure of plan section 2, over the training folds only:
 *   1. inner cross-validation: each training fold is held out once and the model
 *      is fitted on the others, for every lambda of the grid;
 *   2. lambda with the lowest mean inner out-of-fold log-loss (first in grid order
 *      on a tie);
 *   3. band cuts on those inner out-of-fold predictions;
 *   4. refit on all training folds with the chosen lambda;
 *   5. return the weights, lambda, cuts, the inner losses and the convergence of
 *      the refit.
 * The function reads only the folds it receives, so it cannot see an outer fold
 * that it is not given. The convergence diagnostics do not change the fit.
 */
export function fitProcedure<T extends LabelledVector>(
  trainFolds: readonly (readonly T[])[]
): ProcedureFit {
  const inner = LAMBDA_GRID.map((lambda) => {
    const pairs = innerOutOfFold(trainFolds, lambda);
    return { lambda, pairs, loss: logLoss(pairs) };
  });
  const chosen = inner.reduce((best, item) =>
    item.loss < best.loss ? item : best
  );
  const refit = fitLogisticWithDiagnostics(trainFolds.flat(), chosen.lambda);
  return {
    ...refit.model,
    lambda: chosen.lambda,
    lambdaAtLowerEdge: chosen.lambda === Math.min(...LAMBDA_GRID),
    cuts: bandCutsOf(chosen.pairs),
    innerLogLoss: Object.fromEntries(
      inner.map((item) => [String(item.lambda), item.loss])
    ),
    convergence: refit.convergence
  };
}

function innerOutOfFold<T extends LabelledVector>(
  trainFolds: readonly (readonly T[])[],
  lambda: number
): ScoredLabel[] {
  return trainFolds.flatMap((holdout, index) => {
    const training = trainFolds.filter((_, other) => other !== index).flat();
    const model = fitLogistic(training, lambda);
    return holdout.map((pair) => ({
      score: probabilityOf(model, pair.vector),
      label: pair.label
    }));
  });
}

/**
 * The parameters of one fit: the procedure over the given folds, plus the
 * H1_FALLBACK cuts. The fallback cuts are chosen on the M0 eligibility of the
 * same folds over every labelled pair, the same universe as the calibrated cuts.
 * No model is fitted for them, so the eligibility is its own prediction.
 */
export function modelParams(
  trainFolds: readonly (readonly LabelledPair[])[],
  fitter: ProcedureFitter,
  judges: readonly JudgeName[] = []
): ModelParams {
  const procedure = fitter(trainFolds);
  const eligibility = trainFolds.flat().map((pair) => ({
    score: pair.eligibility,
    label: pair.label
  }));
  return {
    ...procedure,
    fallbackCuts: bandCutsOf(eligibility),
    cheap: fitProcedure(cheapFolds(trainFolds)),
    judge: Object.fromEntries(
      judges.map((name) => [name, judgeParamsOf(trainFolds, procedure, name)])
    )
  };
}

/** The inner predictions of H1 for each training pair: p, and semanticOnly from the same inner models. */
export function innerPairPredictions(
  trainFolds: readonly (readonly LabelledPair[])[],
  lambda: number
): Map<LabelledPair, { p: number; semanticOnly: number }> {
  const predictions = new Map<LabelledPair, { p: number; semanticOnly: number }>();
  trainFolds.forEach((holdout, index) => {
    const training = trainFolds.filter((_, other) => other !== index).flat();
    const model = fitLogistic(training, lambda);
    holdout.forEach((pair) => {
      predictions.set(pair, {
        p: probabilityOf(model, pair.vector),
        semanticOnly: probabilityOf(model, pair.semanticVector)
      });
    });
  });
  return predictions;
}

/**
 * One held-out fold j of the nested H7 chain. The H1 model, its admission cut and the
 * chain v are fitted on the other folds only, and fold j is scored with that H1 and
 * that v. No parameter that predicts fold j has seen fold j.
 */
export type NestedChainFit = {
  holdout: number;
  h1: ProcedureFit;
  chain: ProcedureFit;
  /** Chain scores and labels of the pairs of fold j that this H1 pre-admits. */
  scores: ScoredLabel[];
  /** True when no training pair was pre-admitted: the chain is the unfitted stage. */
  unfitted: boolean;
};

/**
 * The H1 of one held-out fold j, fitted on the other folds with its inner predictions.
 * It does not depend on the lambda of the chain, so it is fitted once and shared by
 * every lambda that the chain selection tries.
 */
export type H1Partition = {
  holdout: readonly LabelledPair[];
  rest: readonly (readonly LabelledPair[])[];
  h1: ProcedureFit;
  inner: Map<LabelledPair, { p: number; semanticOnly: number }>;
};

export function h1PartitionsOf(
  trainFolds: readonly (readonly LabelledPair[])[]
): H1Partition[] {
  return trainFolds.map((holdout, index) => {
    const rest = trainFolds.filter((_, other) => other !== index);
    const h1 = fitProcedure(rest);
    return { holdout, rest, h1, inner: innerPairPredictions(rest, h1.lambda) };
  });
}

/**
 * The nested chains of one judge with one lambda for v. Each partition refits its
 * chain on the other folds, with the pre-admission of its own H1, and scores its
 * held-out fold with that chain.
 */
export function nestedChainFitsOf(
  partitions: readonly H1Partition[],
  name: JudgeName,
  lambda: number
): NestedChainFit[] {
  return partitions.map(({ holdout, rest, h1, inner }, index) => {
    const rows = chainTrainingRows(
      rest.flat().map((pair) => {
        const prediction = innerOf(inner, pair);
        return {
          fold: pair.fold,
          label: pair.label,
          p: prediction.p,
          semanticOnly: prediction.semanticOnly,
          judge: judgeOf(pair, name)
        };
      }),
      h1.cuts.low
    );
    const chain = refitStage(rows, lambda);
    const scores = holdout.flatMap((pair) => {
      const semanticOnly = probabilityOf(h1, pair.semanticVector);
      if (!admits(semanticOnly, h1.cuts.low)) return [];
      const p = probabilityOf(h1, pair.vector);
      return [{ score: chainScore(chain, p, judgeOf(pair, name)), label: pair.label }];
    });
    return { holdout: index, h1, chain, scores, unfitted: rows.length === 0 };
  });
}

/** One held-out fold j of the nested fallback chain: fitted on the other folds, scored on fold j. */
export type NestedFallbackFit = {
  holdout: number;
  fallback: ProcedureFit;
  scores: ScoredLabel[];
  /** True when no training pair is admitted by M0: the fallback is the unfitted stage. */
  unfitted: boolean;
};

/** The nested fallback chains of one judge with one lambda, as nestedChainFitsOf does for H7. */
export function nestedFallbackFitsOf(
  trainFolds: readonly (readonly LabelledPair[])[],
  name: JudgeName,
  lambda: number
): NestedFallbackFit[] {
  return trainFolds.map((holdout, index) => {
    const rest = trainFolds.filter((_, other) => other !== index);
    const rows = fallbackTrainingRows(
      rest.flat().map((pair) => ({
        fold: pair.fold,
        label: pair.label,
        eligibility: pair.eligibility,
        m0Admitted: pair.m0Admitted,
        judge: judgeOf(pair, name)
      }))
    );
    const fallback = refitStage(rows, lambda);
    const scores = holdout.flatMap((pair) =>
      pair.m0Admitted
        ? [{ score: fallbackScore(fallback, pair.eligibility, judgeOf(pair, name)), label: pair.label }]
        : []
    );
    return { holdout: index, fallback, scores, unfitted: rows.length === 0 };
  });
}

/**
 * The H7 stages of one judge on a training set. The lambda of each stage is chosen by
 * the nested log-loss of its whole chain (stageChoiceOf), and v is then refit on the
 * training rows with that lambda, with no lambda choice of its own. The cuts come from
 * the nested out-of-fold scores of the chosen lambda, never from the inner predictions
 * of the training rows, so the cut of a fold does not depend on that fold's labels.
 */
function judgeParamsOf(
  trainFolds: readonly (readonly LabelledPair[])[],
  procedure: ProcedureFit,
  name: JudgeName
): JudgeModelParams {
  const pairs = trainFolds.flat();
  const inner = innerPairPredictions(trainFolds, procedure.lambda);
  const chainRows = chainTrainingRows(
    pairs.map((pair) => {
      const prediction = innerOf(inner, pair);
      return {
        fold: pair.fold,
        label: pair.label,
        p: prediction.p,
        semanticOnly: prediction.semanticOnly,
        judge: judgeOf(pair, name)
      };
    }),
    procedure.cuts.low
  );
  const fallbackRows = fallbackTrainingRows(
    pairs.map((pair) => ({
      fold: pair.fold,
      label: pair.label,
      eligibility: pair.eligibility,
      m0Admitted: pair.m0Admitted,
      judge: judgeOf(pair, name)
    }))
  );
  const partitions = h1PartitionsOf(trainFolds);
  const chainChoice = stageChoiceOf((lambda) =>
    nestedChainFitsOf(partitions, name, lambda)
  );
  const fallbackChoice = stageChoiceOf((lambda) =>
    nestedFallbackFitsOf(trainFolds, name, lambda)
  );
  return {
    chain: finalStageOf(chainRows, chainChoice),
    fallback: finalStageOf(fallbackRows, fallbackChoice),
    diagnostics: {
      partitions: chainChoice.fits.length,
      unfittedChain: chainChoice.fits.filter((fit) => fit.unfitted).length,
      unfittedFallback: fallbackChoice.fits.filter((fit) => fit.unfitted).length
    }
  };
}

function innerOf(
  inner: Map<LabelledPair, { p: number; semanticOnly: number }>,
  pair: LabelledPair
): { p: number; semanticOnly: number } {
  const prediction = inner.get(pair);
  if (prediction === undefined) throw new Error(`No inner prediction for ${pair.caseId}/${pair.threadId}.`);
  return prediction;
}

function judgeOf(pair: LabelledPair, name: JudgeName): number {
  const score = pair.judges[name];
  if (score === undefined) {
    throw new Error(`The ${name} judge has no score for ${pair.caseId}/${pair.threadId}.`);
  }
  return score;
}

/**
 * A stage with no training row: its weights are zero and its cuts are null, so it
 * admits nothing. With no pre-admitted pair, the chain cannot admit either (D6).
 */
function unfittedStage(): ProcedureFit {
  return {
    intercept: 0,
    weights: [0, 0],
    lambda: 0,
    lambdaAtLowerEdge: false,
    cuts: { high: null, medium: null, low: null },
    innerLogLoss: {},
    convergence: { iterations: 0, projectedGradientNorm: 0, lossChangeLastWindow: 0, lossRangeLastWindow: 0 }
  };
}

/**
 * The refit of the rows with one lambda, without cuts. The rows are refit in fold
 * order, as fitProcedure refits them. With no row the stage is the unfitted one.
 */
function refitStage(rows: readonly StageRow[], lambda: number): ProcedureFit {
  if (rows.length === 0) return unfittedStage();
  const refit = fitLogisticWithDiagnostics(byFold(rows).flat(), lambda);
  return {
    ...refit.model,
    lambda,
    lambdaAtLowerEdge: lambda === Math.min(...LAMBDA_GRID),
    cuts: { high: null, medium: null, low: null },
    innerLogLoss: {},
    convergence: refit.convergence
  };
}

/** The lambda of one stage, with the nested fits it was chosen on. */
type StageChoice<F> = {
  lambda: number;
  fits: F[];
  /** Mean log-loss of the nested scores of each lambda, keyed by its value. */
  innerLogLoss: Record<string, number>;
};

/**
 * Chooses the lambda of a judge stage. For each lambda of the grid the whole nested
 * chain is run with that lambda, and the mean log-loss of its out-of-fold scores is
 * taken. The lowest loss wins, the first in grid order on a tie. A lambda without any
 * nested score has no loss to compare, so it is never preferred.
 */
function stageChoiceOf<F extends { scores: ScoredLabel[] }>(
  fitsOf: (lambda: number) => F[]
): StageChoice<F> {
  const candidates = LAMBDA_GRID.map((lambda) => {
    const fits = fitsOf(lambda);
    const scores = fits.flatMap((fit) => fit.scores);
    return { lambda, fits, loss: scores.length === 0 ? Infinity : logLoss(scores) };
  });
  const chosen = candidates.reduce((best, item) =>
    item.loss < best.loss ? item : best
  );
  return {
    lambda: chosen.lambda,
    fits: chosen.fits,
    innerLogLoss: Object.fromEntries(
      candidates.map((item) => [String(item.lambda), item.loss])
    )
  };
}

/**
 * The final stage of one judge: v is refit on the training rows with the chosen lambda,
 * and its cuts come from the nested scores of that lambda. With no training row the
 * stage stays unfitted, with null cuts, and the nested cuts do not overwrite it.
 */
function finalStageOf(
  rows: readonly StageRow[],
  choice: StageChoice<{ scores: ScoredLabel[] }>
): ProcedureFit {
  const stage = refitStage(rows, choice.lambda);
  if (rows.length === 0) return stage;
  return {
    ...stage,
    cuts: bandCutsOf(choice.fits.flatMap((fit) => fit.scores)),
    innerLogLoss: choice.innerLogLoss
  };
}

/** Rows grouped by their outer fold, one group per fold, empty folds included. */
function byFold<T extends { fold: number }>(rows: readonly T[]): T[][] {
  return Array.from({ length: FOLD_COUNT }, (_, fold) =>
    rows.filter((row) => row.fold === fold)
  );
}

/**
 * The training folds with the cheap model's vectors in place of the full ones.
 * The same fitProcedure runs on them, so the cheap model gets its own lambda,
 * cuts and convergence.
 */
function cheapFolds(
  trainFolds: readonly (readonly LabelledPair[])[]
): LabelledPair[][] {
  return trainFolds.map((group) =>
    group.map((pair) => ({
      ...pair,
      vector: pair.cheapVector,
      semanticVector: pair.cheapSemanticVector
    }))
  );
}

/**
 * Outer loop of the nested validation. For each outer fold k, the fitter receives
 * only the other folds, and its parameters score the pairs of fold k. No pair of
 * fold k reaches the fitter that evaluates it.
 */
export function nestedFolds(
  pairs: readonly LabelledPair[],
  fitter: ProcedureFitter = fitProcedure,
  judges: readonly JudgeName[] = []
): FoldModelParams[] {
  const byFold = pairsByFold(pairs);
  return byFold.map((_, fold) => ({
    fold,
    ...modelParams(
      byFold.filter((_group, index) => index !== fold),
      fitter,
      judges
    )
  }));
}

/**
 * External predictions of every labelled pair. Each pair is scored with the
 * parameters of its own outer fold, so no pair is scored by a fit that saw it.
 * The replay of H1_CALIBRATED and H1_FALLBACK must reproduce these values.
 */
export function predictionsOf(
  pairs: readonly LabelledPair[],
  folds: readonly FoldModelParams[]
): PairPrediction[] {
  return pairs.map((pair) => {
    const params = folds[pair.fold];
    const p = probabilityOf(params, pair.vector);
    const semanticOnly = probabilityOf(params, pair.semanticVector);
    const cheap = cheapScoresOf(pair.cheapVector, pair.cheapSemanticVector, params.cheap);
    return {
      caseId: pair.caseId,
      threadId: pair.threadId,
      fold: pair.fold,
      label: pair.label,
      p,
      semanticOnly,
      calibratedAdmitted: admits(semanticOnly, params.cuts.low),
      calibratedBand: bandOf(p, params.cuts) ?? null,
      eligibility: pair.eligibility,
      fallbackAdmitted: pair.m0Admitted,
      fallbackBand: bandOf(pair.eligibility, params.fallbackCuts) ?? null,
      cheapP: cheap.p,
      cheapSemanticOnly: cheap.semanticOnly,
      cheapAdmitted: cheap.admitted,
      cheapBand: cheap.band,
      judges: judgePredictionsOf(pair, params, p, semanticOnly)
    };
  });
}

/** H7 predictions of one pair for each judge in the fit. */
function judgePredictionsOf(
  pair: LabelledPair,
  params: ModelParams,
  p: number,
  semanticOnly: number
): Partial<Record<JudgeName, JudgePrediction>> {
  const judges = params.judge ?? {};
  return Object.fromEntries(
    JUDGE_NAMES.flatMap((name) => {
      const stage = judges[name];
      if (stage === undefined) return [];
      const judge = judgeOf(pair, name);
      const chainP2 = chainScore(stage.chain, p, judge);
      const fallbackP2 = fallbackScore(stage.fallback, pair.eligibility, judge);
      return [
        [
          name,
          {
            chainP2,
            chainAdmitted: admits(semanticOnly, params.cuts.low) && admits(chainP2, stage.chain.cuts.low),
            chainBand: bandOf(chainP2, stage.chain.cuts) ?? null,
            fallbackP2,
            fallbackAdmitted: pair.m0Admitted && admits(fallbackP2, stage.fallback.cuts.low),
            fallbackBand: bandOf(fallbackP2, stage.fallback.cuts) ?? null
          }
        ]
      ];
    })
  );
}

type Outcome = { band: Band | null; admitted: boolean; label: 0 | 1 };

function bandSummaryOf(outcomes: readonly Outcome[]): BandSummary {
  const countOf = (selected: readonly Outcome[]) => {
    const positives = selected.reduce((sum, item) => sum + item.label, 0);
    return {
      pairs: selected.length,
      positives,
      precision: selected.length === 0 ? null : positives / selected.length
    };
  };
  return {
    admitted: countOf(outcomes.filter((item) => item.admitted)),
    bands: {
      high: countOf(outcomes.filter((item) => item.band === "high")),
      medium: countOf(outcomes.filter((item) => item.band === "medium")),
      low: countOf(outcomes.filter((item) => item.band === "low"))
    },
    unbanded: countOf(outcomes.filter((item) => item.band === null))
  };
}

/** The nested-fit diagnostics of each judge, summed over the outer folds and the production fit. */
function judgeSummaryOf(
  folds: readonly FoldModelParams[],
  production: ModelParams,
  names: readonly JudgeName[]
): Partial<Record<JudgeName, StageDiagnostics>> {
  const all = [...folds, production];
  return Object.fromEntries(
    names.map((name) => [name, sumDiagnostics(all.map((params) => params.judge?.[name]?.diagnostics))])
  );
}

function sumDiagnostics(items: ReadonlyArray<StageDiagnostics | undefined>): StageDiagnostics {
  return items.reduce<StageDiagnostics>(
    (total, item) => ({
      partitions: total.partitions + (item?.partitions ?? 0),
      unfittedChain: total.unfittedChain + (item?.unfittedChain ?? 0),
      unfittedFallback: total.unfittedFallback + (item?.unfittedFallback ?? 0)
    }),
    { partitions: 0, unfittedChain: 0, unfittedFallback: 0 }
  );
}

/**
 * The full fit of a capture: the nested folds, the production parameters fitted
 * on all five folds, the external predictions and the band summaries. Only the
 * marc corpus is fitted; ledgerline-en is never passed here.
 */
export async function buildFit(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  /** Judge tables (H7). Each judge given here adds its stages to the fit. */
  judges?: Partial<Record<JudgeName, JudgeTable>>;
}): Promise<FitBundle> {
  const tables = input.judges ?? {};
  const names = judgeNamesOf(tables);
  const pairs = attachJudges(
    await labelledPairsOf(input.capture, input.dataset),
    tables
  );
  const folds = nestedFolds(pairs, fitProcedure, names);
  const production = modelParams(pairsByFold(pairs), fitProcedure, names);
  const predictions = predictionsOf(pairs, folds);
  const fit: FitResult = {
    schemaVersion: 1,
    corpus: input.capture.corpus,
    captureId: input.capture.captureId,
    featureNames: [...FEATURE_NAMES],
    cheapFeatureNames: [...CHEAP_FEATURE_NAMES],
    judges: names,
    judgeSummary: judgeSummaryOf(folds, production, names),
    lambdaGrid: [...LAMBDA_GRID],
    bandTargets: { ...BAND_TARGETS },
    labelled: {
      pairs: pairs.length,
      positives: pairs.reduce((sum, pair) => sum + pair.label, 0)
    },
    folds,
    production,
    external: {
      calibrated: bandSummaryOf(
        predictions.map((item) => ({
          band: item.calibratedBand,
          admitted: item.calibratedAdmitted,
          label: item.label
        }))
      ),
      fallback: bandSummaryOf(
        predictions.map((item) => ({
          band: item.fallbackBand,
          admitted: item.fallbackAdmitted,
          label: item.label
        }))
      )
    }
  };
  return {
    fit,
    predictions: {
      schemaVersion: 1,
      captureId: input.capture.captureId,
      pairs: predictions
    }
  };
}

/** Lines of the fit summary, for the command output. */
export function fitSummaryLines(result: FitResult): string[] {
  const lines = [
    `labelled=${result.labelled.pairs} positives=${result.labelled.positives}`,
    `production ${edgeNote(result.production)}intercept=${result.production.intercept.toFixed(4)} ${convergenceText(result.production.convergence)}`,
    `production weights=${result.production.weights.map((value) => value.toFixed(4)).join(",")}`,
    `production cuts=${formatCuts(result.production.cuts)} fallbackCuts=${formatCuts(result.production.fallbackCuts)}`,
    `production cheap ${edgeNote(result.production.cheap)}weights=${result.production.cheap.weights.map((value) => value.toFixed(4)).join(",")} cuts=${formatCuts(result.production.cheap.cuts)} ${convergenceText(result.production.cheap.convergence)}`
  ];
  const folds = result.folds.map(
    (params) =>
      `fold ${params.fold}: ${edgeNote(params)}cuts=${formatCuts(params.cuts)} ${convergenceText(params.convergence)}`
  );
  const bands = [
    `external calibrated: ${formatBands(result.external.calibrated)}`,
    `external fallback: ${formatBands(result.external.fallback)}`
  ];
  return [...lines, ...folds, ...bands];
}

/** The chosen lambda, with a note when it sits on the lower edge of the grid. */
function edgeNote(params: ProcedureFit): string {
  const note = params.lambdaAtLowerEdge ? " (lower grid edge)" : "";
  return `lambda=${params.lambda}${note} `;
}

/** Projected gradient norm and the loss change and range over the last window. */
function convergenceText(convergence: Convergence): string {
  return [
    `grad=${convergence.projectedGradientNorm.toExponential(3)}`,
    `dLoss100=${convergence.lossChangeLastWindow.toExponential(3)}`,
    `rangeLoss100=${convergence.lossRangeLastWindow.toExponential(3)}`
  ].join(" ");
}

const BAND_NAMES: readonly Band[] = ["high", "medium", "low"];

function formatCuts(cuts: Record<Band, number | null>): string {
  return BAND_NAMES.map((band) => `${band}=${formatCut(cuts[band])}`).join(" ");
}

function formatCut(cut: number | null): string {
  if (cut === null) return "empty";
  return cut.toFixed(4);
}

/** Pairs/positives per band, then the admitted and unbanded counts. */
function formatBands(summary: BandSummary): string {
  const bands = BAND_NAMES.map(
    (band) => `${band}=${summary.bands[band].pairs}/${summary.bands[band].positives}`
  );
  const admitted = `admitted=${summary.admitted.pairs}/${summary.admitted.positives}`;
  return `${admitted} ${bands.join(" ")} unbanded=${summary.unbanded.pairs}`;
}
