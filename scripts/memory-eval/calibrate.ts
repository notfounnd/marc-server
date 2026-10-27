import type { CaptureFile } from "./capture-types.js";
import type { EvalDataset } from "./dataset.js";
import { CachedRerankingProvider } from "./cached-providers.js";
import { candidateFeaturesOf } from "./candidate-pairs.js";
import {
  accumulatedBands,
  calibratedProbability,
  exclusiveBandOf,
  fitN1,
  fitN2,
  h2Verdict,
  h6Verdict,
  logitOf,
  medianOf,
  n1ExcludedThreads,
  percentileOf,
  type CalibrationDiagnostics,
  type CalibrationParams,
  type CalibrationResult,
  type CalibrationSet,
  type GroupPrecision,
  type LogitRow,
  type ScoredPair,
  type Verdict
} from "./calibration.js";
import {
  bandCutsOf,
  probabilityOf,
  type Band,
  type BandCuts,
  type FitResult,
  type ModelParams
} from "./fit-model.js";
import {
  innerPairPredictions,
  labelledPairsOf,
  pairsByFold,
  type FitPredictionsFile,
  type LabelledPair,
  type PairPrediction
} from "./fit.js";
import { FOLD_COUNT } from "./folds.js";
import { channelsOfCaptured, recordsById } from "./replay.js";
import {
  featureVectorOf,
  type ThreadFeatures
} from "./features.js";

/** Name of the calibration file, in the capture directory. */
export function calibrationFileName(corpus: string): string {
  return `calibrate-${corpus}.json`;
}

/** The model that the calibration reads: the marc fit and its external predictions. */
export type CalibrationModel = { fit: FitResult; predictions: FitPredictionsFile };

/** Criteria of one calibration: H2 band differences, or H6 distances to the targets. */
export type CalibrationVariant = {
  calibration: CalibrationResult;
  bands: Record<Band, GroupPrecision>;
  sameBandFraction: number | null;
  verdict: Verdict;
  criteria: Record<Band, number | null> | null;
};

export type CalibrationFile = {
  schemaVersion: 1;
  corpus: string;
  captureId: string;
  modelCaptureId: string;
  /** The exact rule of the synthetic queries, as stored in the capture. */
  syntheticRule: string;
  synthetic: { queries: number; used: number; dropped: number };
  n1: CalibrationResult & CalibrationDiagnostics & { rows: number; positives: number; negatives: number };
  n2: CalibrationResult & {
    reference: { positives: number; ref50: number | null; ref90: number | null };
    synthetic: { positives: number; syn50: number | null; syn90: number | null };
  };
  /**
   * Per outer fold k: the N1 and N2 that evaluate fold k on marc (H2). Written for every
   * corpus; the replay reads them only on marc without --model, and the others use n1/n2.
   */
  folds: CalibrationSet[];
  evaluation: {
    kind: "H2" | "H6";
    pairs: number;
    positives: number;
    base: { bands: Record<Band, GroupPrecision>; verdict: Verdict | null; criteria: Record<Band, number | null> | null };
    variants: { N1: CalibrationVariant; N2: CalibrationVariant };
  };
  /** H6 only: the fallback of the plan, with cut points chosen on this corpus's own labels. */
  h6Fallback?: H6Fallback;
};

/**
 * Note that every h6Fallback carries. Adopting the fallback makes the corpus
 * stop being an untouched external validation, so the report must say so.
 */
export const H6_FALLBACK_NOTE =
  "If this fallback is adopted, the corpus stops being an untouched external validation: its cut points are chosen on its own labels.";

/** One variant of the fallback: the cuts of each outer fold, and the accumulated bands of the external folds. */
export type FallbackVariant = {
  /** cutsByFold[k] was chosen on the labelled pairs of the folds other than k. */
  cutsByFold: BandCuts[];
  bands: Record<Band, GroupPrecision>;
  verdict: Verdict;
  distances: Record<Band, number | null>;
};

export type H6Fallback = {
  note: string;
  base: FallbackVariant;
  /** null when the calibration is invalid: the variant is then not computed. */
  N1: FallbackVariant | null;
  N2: FallbackVariant | null;
};

/** The synthetic queries of a capture with their candidates, scored by the production model's features. */
export async function syntheticCandidatesOf(
  capture: CaptureFile
): Promise<Array<{ origin: string; candidates: ThreadFeatures[] }>> {
  const records = recordsById(capture.records);
  return Promise.all(
    requireSynthetic(capture).map(async (query) => {
      const reranker = new CachedRerankingProvider(
        capture.providers.reranker,
        new Map(Object.entries(query.rerankScores))
      );
      const candidates = await candidateFeaturesOf(
        query.text,
        channelsOfCaptured(query.channels, records),
        reranker
      );
      return { origin: query.sourceThreadId, candidates };
    })
  );
}

function requireSynthetic(capture: CaptureFile) {
  if (capture.syntheticQueries === undefined || capture.identityVectors === undefined) {
    throw new Error(
      `Capture ${capture.captureId} has no synthetic queries or identity vectors: capture it again with the E2 channels.`
    );
  }
  return capture.syntheticQueries;
}

/**
 * The N1 rows and the N2 positive logits, from the synthetic candidates, with the
 * production p of every thread. A synthetic query whose source thread is not
 * among its candidates has no positive pair, so it is dropped and not labelled.
 * The negatives excluded by n1ExcludedThreads leave the pool; they are not 0.
 */
export function syntheticRows(
  synthetic: ReadonlyArray<{ origin: string; candidates: ThreadFeatures[] }>,
  production: ModelParams,
  edges: ReadonlyArray<readonly [string, string]>,
  identityVectors: Readonly<Record<string, readonly number[]>>
): { n1: LogitRow[]; positiveLogits: number[]; used: number; dropped: number } {
  const n1: LogitRow[] = [];
  const positiveLogits: number[] = [];
  let used = 0;
  let dropped = 0;
  for (const item of synthetic) {
    const origin = item.candidates.find((candidate) => candidate.threadId === item.origin);
    if (origin === undefined) {
      dropped += 1;
      continue;
    }
    used += 1;
    const excluded = n1ExcludedThreads(item.origin, edges, identityVectors);
    const originLogit = logitOf(productionP(origin, production));
    positiveLogits.push(originLogit);
    n1.push({ x: originLogit, label: 1 });
    for (const candidate of item.candidates) {
      if (candidate.threadId === item.origin) continue;
      if (excluded.has(candidate.threadId)) continue;
      n1.push({ x: logitOf(productionP(candidate, production)), label: 0 });
    }
  }
  return { n1, positiveLogits, used, dropped };
}

function productionP(item: ThreadFeatures, production: ModelParams): number {
  return probabilityOf(production, featureVectorOf(item));
}

/**
 * The calibrations of one capture (N1 and N2) and their evaluation: H2 on marc,
 * from the external predictions, and H6 on the other corpora, from the labelled
 * pairs with the production model. The synthetic fit reads no judgment.
 */
export async function calibrateCapture(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  corpus: string;
  model: CalibrationModel;
}): Promise<{ file: CalibrationFile; calibrations: CalibrationSet }> {
  const { capture, model } = input;
  const synthetic = await syntheticCandidatesOf(capture);
  const rows = syntheticRows(
    synthetic,
    model.fit.production,
    capture.threadReferences ?? [],
    capture.identityVectors ?? {}
  );
  const n1 = fitN1(rows.n1);
  const referenceLogits = model.predictions.pairs
    .filter((pair) => pair.label === 1)
    .map((pair) => logitOf(pair.p));
  const reference = quantilesOf(referenceLogits);
  const synthetics = quantilesOf(rows.positiveLogits);
  const n2 = n2Of(reference, synthetics);
  const calibrations: CalibrationSet = { N1: n1, N2: n2 };
  const pairs = await labelledPairsOf(capture, input.dataset);
  const foldCalibrations = model.fit.folds.map((_, fold) =>
    foldCalibrationsOf({ synthetic, capture, model, pairs, fold })
  );
  const h6 =
    input.corpus === "marc" ? undefined : await h6Evaluation(input, calibrations);
  const evaluation =
    h6 === undefined ? h2Evaluation(model, calibrations, foldCalibrations) : h6.evaluation;
  const file: CalibrationFile = {
    schemaVersion: 1,
    corpus: input.corpus,
    captureId: capture.captureId,
    modelCaptureId: model.fit.captureId,
    syntheticRule: capture.syntheticRule ?? "",
    synthetic: { queries: synthetic.length, used: rows.used, dropped: rows.dropped },
    n1: {
      ...n1,
      rows: rows.n1.length,
      positives: rows.n1.filter((row) => row.label === 1).length,
      negatives: rows.n1.filter((row) => row.label === 0).length
    },
    n2: {
      ...n2,
      reference: { positives: referenceLogits.length, ref50: reference.p50, ref90: reference.p90 },
      synthetic: { positives: rows.positiveLogits.length, syn50: synthetics.p50, syn90: synthetics.p90 }
    },
    folds: foldCalibrations,
    evaluation,
    h6Fallback: h6?.fallback
  };
  return { file, calibrations };
}

type SyntheticCandidates = Awaited<ReturnType<typeof syntheticCandidatesOf>>;

/**
 * The N2 reference of fold k: the logit of every positive of the four training folds,
 * predicted inside those folds with the lambda of the fit of fold k. Each prediction
 * comes from a model that never saw fold k, so the reference reads no label or
 * prediction of fold k.
 */
export function foldReferenceLogitsOf(input: {
  pairs: readonly LabelledPair[];
  fold: number;
  lambda: number;
}): number[] {
  const trainFolds = pairsByFold(input.pairs).filter((_, index) => index !== input.fold);
  const inner = innerPairPredictions(trainFolds, input.lambda);
  return trainFolds.flat().flatMap((pair) => {
    const prediction = inner.get(pair);
    if (pair.label !== 1 || prediction === undefined) return [];
    return [logitOf(prediction.p)];
  });
}

/**
 * The calibrations that evaluate fold k on marc (H2). N1 is fitted on the synthetic rows
 * scored by the H1 of fold k, and N2 takes its reference from foldReferenceLogitsOf. No
 * label of fold k is read, so the calibration of fold k does not depend on fold k. The
 * production calibrations, the ones T3 uses, are kept apart.
 */
export function foldCalibrationsOf(input: {
  synthetic: SyntheticCandidates;
  capture: CaptureFile;
  model: CalibrationModel;
  pairs: readonly LabelledPair[];
  fold: number;
}): CalibrationSet {
  const rows = syntheticRows(
    input.synthetic,
    input.model.fit.folds[input.fold],
    input.capture.threadReferences ?? [],
    input.capture.identityVectors ?? {}
  );
  const reference = quantilesOf(
    foldReferenceLogitsOf({
      pairs: input.pairs,
      fold: input.fold,
      lambda: input.model.fit.folds[input.fold].lambda
    })
  );
  const synthetics = quantilesOf(rows.positiveLogits);
  return { N1: fitN1(rows.n1), N2: n2Of(reference, synthetics) };
}

/**
 * N2 from the quantiles. A missing quantile (no reference or synthetic positive)
 * makes N2 invalid with its reason; no default value is substituted.
 */
function n2Of(
  reference: { p50: number | null; p90: number | null },
  synthetics: { p50: number | null; p90: number | null }
): CalibrationResult {
  const quantiles = [reference.p50, reference.p90, synthetics.p50, synthetics.p90];
  if (quantiles.includes(null)) {
    return { valid: false, reason: "no reference or synthetic positives to take the quantiles from.", a: null, b: null };
  }
  return fitN2(
    { ref50: reference.p50 as number, ref90: reference.p90 as number },
    { syn50: synthetics.p50 as number, syn90: synthetics.p90 as number }
  );
}

/** Median and nearest-rank 90th percentile; null when there are no values. */
function quantilesOf(values: readonly number[]): { p50: number | null; p90: number | null } {
  if (values.length === 0) return { p50: null, p90: null };
  return { p50: medianOf(values), p90: percentileOf(values, 0.9) };
}

/** H2 on marc: the external p of every labelled pair, banded with its own fold cuts. */
function h2Evaluation(
  model: CalibrationModel,
  calibrations: CalibrationSet,
  foldCalibrations: readonly CalibrationSet[]
): CalibrationFile["evaluation"] {
  const pairs = model.predictions.pairs;
  const cutsOf = (fold: number): BandCuts => model.fit.folds[fold].cuts;
  const base = accumulatedBands(scoredOf(pairs, (pair) => pair.p), cutsOf);
  return {
    kind: "H2",
    pairs: pairs.length,
    positives: pairs.filter((pair) => pair.label === 1).length,
    base: { bands: base, verdict: null, criteria: null },
    variants: {
      N1: h2Variant({
        calibrationOf: (fold) => foldCalibrations[fold].N1,
        production: calibrations.N1,
        pairs,
        cutsOf,
        base
      }),
      N2: h2Variant({
        calibrationOf: (fold) => foldCalibrations[fold].N2,
        production: calibrations.N2,
        pairs,
        cutsOf,
        base
      })
    }
  };
}

function scoredOf(
  pairs: readonly PairPrediction[],
  scoreOf: (pair: PairPrediction) => number
): ScoredPair[] {
  return pairs.map((pair) => ({ score: scoreOf(pair), label: pair.label, fold: pair.fold }));
}

/** An H2 variant: p' bands under the fold cuts, and the share of admitted pairs that keep their band. */
function h2Variant(input: {
  calibrationOf: (fold: number) => CalibrationResult;
  production: CalibrationResult;
  pairs: readonly PairPrediction[];
  cutsOf: (fold: number) => BandCuts;
  base: Record<Band, GroupPrecision>;
}): CalibrationVariant {
  const { pairs, cutsOf, base } = input;
  const paramsByFold = new Map<number, CalibrationParams>();
  for (const fold of new Set(pairs.map((pair) => pair.fold))) {
    const params = paramsOf(input.calibrationOf(fold));
    if (params === undefined) return invalidVariant(input.calibrationOf(fold));
    paramsByFold.set(fold, params);
  }
  const paramsAt = (fold: number): CalibrationParams => {
    const params = paramsByFold.get(fold);
    if (params === undefined) throw new Error(`No calibration for fold ${fold}.`);
    return params;
  };
  const primes = pairs.map((pair) => calibratedProbability(pair.p, paramsAt(pair.fold)));
  const transformed: ScoredPair[] = pairs.map((pair, index) => ({
    score: primes[index],
    label: pair.label,
    fold: pair.fold
  }));
  const bands = accumulatedBands(transformed, cutsOf);
  const admitted = pairs.flatMap((pair, index) =>
    pair.calibratedAdmitted ? [{ pair, prime: primes[index] }] : []
  );
  const sameBand =
    admitted.length === 0
      ? null
      : admitted.filter(({ pair, prime }) => {
          const before = exclusiveBandOf({ score: pair.p, label: pair.label, fold: pair.fold }, cutsOf);
          const after = exclusiveBandOf({ score: prime, label: pair.label, fold: pair.fold }, cutsOf);
          return before === after;
        }).length / admitted.length;
  const verdict = h2Verdict(base, bands, sameBand);
  return {
    calibration: input.production,
    bands,
    sameBandFraction: sameBand,
    verdict: verdict.verdict,
    criteria: verdict.differences
  };
}

/**
 * The H2 band of one pair: p' under the calibration of its own fold, banded with the
 * cuts of that fold. It is the band that h2Variant accumulates for the pair, and the
 * replay of H2 on marc must give the same band to every admitted pair.
 */
export function h2PairBandOf(
  pair: PairPrediction,
  calibration: CalibrationResult,
  cuts: BandCuts
): Band | undefined {
  const params = { a: calibration.a ?? Number.NaN, b: calibration.b ?? Number.NaN };
  return exclusiveBandOf(
    { score: calibratedProbability(pair.p, params), label: pair.label, fold: pair.fold },
    () => cuts
  );
}

/** H6 on the other corpora: the production p of every labelled pair, banded with the production cuts. */
async function h6Evaluation(
  input: { capture: CaptureFile; dataset: EvalDataset; model: CalibrationModel },
  calibrations: CalibrationSet
): Promise<{ evaluation: CalibrationFile["evaluation"]; fallback: H6Fallback }> {
  const production = input.model.fit.production;
  const labelled = await labelledPairsOf(input.capture, input.dataset);
  const scored: ScoredPair[] = labelled.map((pair) => ({
    score: probabilityOf(production, pair.vector),
    label: pair.label,
    fold: 0
  }));
  const cutsOf = (): BandCuts => production.cuts;
  const base = accumulatedBands(scored, cutsOf);
  const baseVerdict = h6Verdict(base);
  return {
    evaluation: {
      kind: "H6",
      pairs: labelled.length,
      positives: labelled.filter((pair) => pair.label === 1).length,
      base: { bands: base, verdict: baseVerdict.verdict, criteria: baseVerdict.distances },
      variants: {
        N1: h6Variant(calibrations.N1, scored, cutsOf),
        N2: h6Variant(calibrations.N2, scored, cutsOf)
      }
    },
    fallback: h6FallbackOf(labelled, production, calibrations)
  };
}

/**
 * The H6 fallback of the plan: for each variant (base p, N1, N2), the cuts of each
 * outer fold are chosen on the labelled pairs of the other folds, with the same
 * targets and the same bandCut rule. The accumulated precision of each band comes
 * from the external folds only, each pair under the cuts of its own fold.
 */
export function h6FallbackOf(
  labelled: readonly LabelledPair[],
  production: ModelParams,
  calibrations: CalibrationSet
): H6Fallback {
  const base: ScoredPair[] = labelled.map((pair) => ({
    score: probabilityOf(production, pair.vector),
    label: pair.label,
    fold: pair.fold
  }));
  return {
    note: H6_FALLBACK_NOTE,
    base: h6FallbackVariant(base),
    N1: fallbackVariantOf(calibrations.N1, base),
    N2: fallbackVariantOf(calibrations.N2, base)
  };
}

function fallbackVariantOf(
  calibration: CalibrationResult,
  base: readonly ScoredPair[]
): FallbackVariant | null {
  const params = paramsOf(calibration);
  if (params === undefined) return null;
  return h6FallbackVariant(
    base.map((pair) => ({ ...pair, score: calibratedProbability(pair.score, params) }))
  );
}

/** One fallback variant over pairs that carry their fold: nested cuts per fold, external accumulation. */
export function h6FallbackVariant(pairs: readonly ScoredPair[]): FallbackVariant {
  const cutsByFold = Array.from({ length: FOLD_COUNT }, (_, fold) =>
    bandCutsOf(pairs.filter((pair) => pair.fold !== fold))
  );
  const bands = accumulatedBands(pairs, (fold) => cutsByFold[fold]);
  const verdict = h6Verdict(bands);
  return {
    cutsByFold,
    bands,
    verdict: verdict.verdict,
    distances: verdict.distances
  };
}

function h6Variant(
  calibration: CalibrationResult,
  scored: ScoredPair[],
  cutsOf: (fold: number) => BandCuts
): CalibrationVariant {
  const params = paramsOf(calibration);
  if (params === undefined) return invalidVariant(calibration);
  const bands = accumulatedBands(
    scored.map((pair) => ({ ...pair, score: calibratedProbability(pair.score, params) })),
    cutsOf
  );
  const verdict = h6Verdict(bands);
  return {
    calibration,
    bands,
    sameBandFraction: null,
    verdict: verdict.verdict,
    criteria: verdict.distances
  };
}

/** The slope and intercept of a valid calibration; undefined when it is invalid or missing values. */
function paramsOf(calibration: CalibrationResult): CalibrationParams | undefined {
  if (!calibration.valid || calibration.a === null || calibration.b === null) return undefined;
  return { a: calibration.a, b: calibration.b };
}

/** An invalid calibration is recorded as such, with no bands and an inconclusive verdict. */
function invalidVariant(calibration: CalibrationResult): CalibrationVariant {
  const empty: GroupPrecision = { pairs: 0, positives: 0, precision: null };
  return {
    calibration,
    bands: { high: empty, medium: empty, low: empty },
    sameBandFraction: null,
    verdict: "inconclusive",
    criteria: null
  };
}
