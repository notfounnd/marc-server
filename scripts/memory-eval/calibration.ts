import {
  BAND_ORDER,
  BAND_TARGETS,
  admits,
  bandOf,
  dot,
  logLoss,
  sigmoid,
  type Band,
  type BandCuts,
  type Convergence
} from "./fit-model.js";

/**
 * Calibration of the scores of H2 and H6: p' = sigmoid(a * logit(p) + b), with
 * a > 0. Pure math. Nothing here reads a judgment or loads a model.
 */

/** Projection floor of the slope, in the raw scale: a >= CALIBRATION_EPSILON. */
export const CALIBRATION_EPSILON = 1e-6;
export const CALIBRATION_ITERATIONS = 2000;
export const CALIBRATION_LEARNING_RATE = 0.1;
/** Iterations over which the convergence diagnostics measure the loss. */
export const CALIBRATION_WINDOW = 100;
/** Clamp of p before the logit, so that logit stays finite. */
export const LOGIT_CLAMP = 1e-12;
/** N1 excludes the threads whose identity cosine with the source reaches this value. */
export const N1_IDENTITY_COSINE = 0.85;
/** Tolerance of the H2 and H6 criteria, in precision points. */
export const CALIBRATION_MARGIN = 0.1;
/** Share of admitted pairs that must stay in the same band under p' (H2). */
export const SAME_BAND_AGREEMENT = 0.8;

export type CalibrationParams = { a: number; b: number };

/** A calibration: valid or not, with the reason when it is not. */
export type CalibrationResult = {
  valid: boolean;
  reason: string | null;
  a: number | null;
  b: number | null;
};

/** The two calibrations of one corpus. N1 and N2 are both kept; the H2 decision picks among them. */
export type CalibrationSet = { N1: CalibrationResult; N2: CalibrationResult };

export type LogitRow = { x: number; label: 0 | 1 };

export function logitOf(probability: number): number {
  const clamped = Math.min(1 - LOGIT_CLAMP, Math.max(LOGIT_CLAMP, probability));
  return Math.log(clamped / (1 - clamped));
}

/** p' for one probability under calibration params. */
export function calibratedProbability(
  probability: number,
  params: CalibrationParams
): number {
  return sigmoid(params.a * logitOf(probability) + params.b);
}

/** Median of the values; the mean of the two central values when the count is even. */
export function medianOf(values: readonly number[]): number {
  const sorted = sortedValues(values);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Nearest-rank percentile: the value at rank ceil(fraction * n). */
export function percentileOf(values: readonly number[], fraction: number): number {
  const sorted = sortedValues(values);
  const rank = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

function sortedValues(values: readonly number[]): number[] {
  if (values.length === 0) throw new Error("Quantiles need at least one value.");
  return [...values].sort((left, right) => left - right);
}

function norm(vector: readonly number[]): number {
  return Math.sqrt(dot(vector, vector));
}

/** Cosine of two vectors; 0 when either has no length. */
export function cosine(left: readonly number[], right: readonly number[]): number {
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return 0;
  return dot(left, right) / denominator;
}

/**
 * The threads that N1 leaves out of the negatives of a source thread: those that
 * reference it or are referenced by it, and those whose identity cosine with it
 * reaches N1_IDENTITY_COSINE. Excluded threads are left out of the pool; they are
 * not labelled 0.
 */
export function n1ExcludedThreads(
  origin: string,
  edges: readonly (readonly [string, string])[],
  identityVectors: Readonly<Record<string, readonly number[]>>
): Set<string> {
  const excluded = new Set<string>();
  for (const [from, to] of edges) {
    if (from === origin) excluded.add(to);
    if (to === origin) excluded.add(from);
  }
  const originVector = identityVectors[origin];
  if (originVector === undefined) {
    throw new Error(`No identity vector for thread ${origin}.`);
  }
  for (const [threadId, vector] of Object.entries(identityVectors)) {
    if (threadId === origin) continue;
    if (cosine(vector, originVector) >= N1_IDENTITY_COSINE) excluded.add(threadId);
  }
  excluded.delete(origin);
  return excluded;
}

/**
 * N1: maximum likelihood of (a, b) in p' = sigmoid(a x + b), x = logit(p), with
 * the positive synthetic query as 1 and the N1 negatives as 0. Projected gradient
 * descent in the standardized x, with the slope floored at CALIBRATION_EPSILON in
 * the raw scale, 2000 iterations, rate 0.1 and no regularization. The start is
 * the identity, a = 1 and b = 0. The result is returned in the raw scale.
 */
/** Diagnostics of N1: the convergence of its descent, and whether the slope ended at the floor. */
export type CalibrationDiagnostics = { convergence: Convergence | null; atFloor: boolean };

export function fitN1(
  rows: readonly LogitRow[]
): CalibrationResult & CalibrationDiagnostics {
  const positives = rows.filter((row) => row.label === 1).length;
  const negatives = rows.length - positives;
  if (positives === 0 || negatives === 0) {
    return unfitted(`N1 needs positives and negatives (positives=${positives}, negatives=${negatives}).`);
  }
  const mean = meanOf(rows.map((row) => row.x));
  const deviation = Math.sqrt(varianceOf(rows.map((row) => row.x)));
  if (deviation === 0) return unfitted("N1 logit values have no variance.");
  const standardized = rows.map((row) => ({
    z: (row.x - mean) / deviation,
    label: row.label
  }));
  const floor = CALIBRATION_EPSILON * deviation;
  let state = { slope: deviation, intercept: mean };
  const beforeWindow = CALIBRATION_ITERATIONS - CALIBRATION_WINDOW;
  for (let iteration = 0; iteration < beforeWindow; iteration += 1) {
    state = calibrationStep(standardized, state, floor);
  }
  const losses: number[] = [];
  for (let iteration = beforeWindow; iteration < CALIBRATION_ITERATIONS; iteration += 1) {
    losses.push(standardizedLoss(standardized, state));
    state = calibrationStep(standardized, state, floor);
  }
  losses.push(standardizedLoss(standardized, state));
  const gradient = calibrationGradient(standardized, state);
  const a = state.slope / deviation;
  return {
    valid: a > 0 && Number.isFinite(a),
    reason: null,
    a,
    b: state.intercept - a * mean,
    convergence: {
      iterations: CALIBRATION_ITERATIONS,
      projectedGradientNorm: projectedNorm(state, gradient, floor),
      lossChangeLastWindow: losses[losses.length - 1] - losses[0],
      lossRangeLastWindow: Math.max(...losses) - Math.min(...losses)
    },
    atFloor: state.slope <= floor
  };
}

type StandardState = { slope: number; intercept: number };
type StandardRow = { z: number; label: 0 | 1 };

function calibrationGradient(
  rows: readonly StandardRow[],
  state: StandardState
): { slope: number; intercept: number } {
  let slope = 0;
  let intercept = 0;
  for (const row of rows) {
    const error = sigmoid(state.slope * row.z + state.intercept) - row.label;
    slope += error * row.z;
    intercept += error;
  }
  return { slope: slope / rows.length, intercept: intercept / rows.length };
}

function calibrationStep(
  rows: readonly StandardRow[],
  state: StandardState,
  floor: number
): StandardState {
  const gradient = calibrationGradient(rows, state);
  return {
    slope: Math.max(floor, state.slope - CALIBRATION_LEARNING_RATE * gradient.slope),
    intercept: state.intercept - CALIBRATION_LEARNING_RATE * gradient.intercept
  };
}

function standardizedLoss(rows: readonly StandardRow[], state: StandardState): number {
  return logLoss(
    rows.map((row) => ({
      score: sigmoid(state.slope * row.z + state.intercept),
      label: row.label
    }))
  );
}

/** Norm of the projected gradient; a slope held at the floor contributes nothing when descent would push it lower. */
function projectedNorm(
  state: StandardState,
  gradient: { slope: number; intercept: number },
  floor: number
): number {
  const slopeComponent = state.slope > floor || gradient.slope < 0 ? gradient.slope : 0;
  return Math.sqrt(slopeComponent ** 2 + gradient.intercept ** 2);
}

/**
 * N2: the quantile match. a = (ref90 − ref50) / (syn90 − syn50) and
 * b = ref50 − a · syn50. The reference quantiles are those of the logit of the
 * real positive pairs of marc; the synthetic ones are those of the logit of the
 * synthetic positives. An undefined or non-positive slope is recorded as invalid,
 * with its reason, and never replaced by a default.
 */
export function fitN2(
  reference: { ref50: number; ref90: number },
  synthetic: { syn50: number; syn90: number }
): CalibrationResult {
  const denominator = synthetic.syn90 - synthetic.syn50;
  if (denominator === 0) {
    return { valid: false, reason: "syn90 equals syn50: the slope is undefined.", a: null, b: null };
  }
  const a = (reference.ref90 - reference.ref50) / denominator;
  const b = reference.ref50 - a * synthetic.syn50;
  if (a <= 0) {
    return { valid: false, reason: `the slope a=${a} is not positive.`, a, b };
  }
  return { valid: true, reason: null, a, b };
}

/** A band of a labelled pair: its score, its label and the fold whose cuts apply. */
export type ScoredPair = { score: number; label: 0 | 1; fold: number };

/** Count of pairs, positives and precision of one group (null when empty). */
export type GroupPrecision = { pairs: number; positives: number; precision: number | null };

/**
 * Accumulated precision of each band: the pairs whose score reaches the band's
 * cut, as the cuts are defined (smallest score whose pairs reach the target).
 * A band whose cut is null has no pairs.
 */
export function accumulatedBands(
  pairs: readonly ScoredPair[],
  cutsOf: (fold: number) => BandCuts
): Record<Band, GroupPrecision> {
  return {
    high: groupPrecision(pairs.filter((pair) => admits(pair.score, cutsOf(pair.fold).high))),
    medium: groupPrecision(pairs.filter((pair) => admits(pair.score, cutsOf(pair.fold).medium))),
    low: groupPrecision(pairs.filter((pair) => admits(pair.score, cutsOf(pair.fold).low)))
  };
}

/** Exclusive band of each pair: the highest band whose cut it reaches, or undefined. */
export function exclusiveBandOf(pair: ScoredPair, cutsOf: (fold: number) => BandCuts): Band | undefined {
  return bandOf(pair.score, cutsOf(pair.fold));
}

function groupPrecision(pairs: readonly ScoredPair[]): GroupPrecision {
  const positives = pairs.reduce((sum, pair) => sum + pair.label, 0);
  return {
    pairs: pairs.length,
    positives,
    precision: pairs.length === 0 ? null : positives / pairs.length
  };
}

export type Verdict = "pass" | "fail" | "inconclusive";

/**
 * H2 criterion. Each band's accumulated precision under p' differs from the one
 * under p by at most CALIBRATION_MARGIN, and at least SAME_BAND_AGREEMENT of the
 * admitted pairs stay in the same exclusive band. A band with no precision, or
 * no admitted pair, makes the verdict inconclusive rather than a pass.
 */
export function h2Verdict(
  base: Record<Band, GroupPrecision>,
  candidate: Record<Band, GroupPrecision>,
  sameBandFraction: number | null
): { verdict: Verdict; differences: Record<Band, number | null> } {
  const differences = Object.fromEntries(
    BAND_ORDER.map((band) => [band, differenceOf(base[band], candidate[band])])
  ) as Record<Band, number | null>;
  const values = BAND_ORDER.map((band) => differences[band]);
  if (values.includes(null) || sameBandFraction === null) {
    return { verdict: "inconclusive", differences };
  }
  const bandsHold = values.every((value) => value !== null && value <= CALIBRATION_MARGIN);
  const agreementHolds = sameBandFraction >= SAME_BAND_AGREEMENT;
  return { verdict: bandsHold && agreementHolds ? "pass" : "fail", differences };
}

/** H6 criterion: each band's accumulated precision lies within CALIBRATION_MARGIN of its target. */
export function h6Verdict(bands: Record<Band, GroupPrecision>): {
  verdict: Verdict;
  distances: Record<Band, number | null>;
} {
  const distances = Object.fromEntries(
    BAND_ORDER.map((band) => {
      const precision = bands[band].precision;
      return [band, precision === null ? null : Math.abs(precision - BAND_TARGETS[band])];
    })
  ) as Record<Band, number | null>;
  const values = BAND_ORDER.map((band) => distances[band]);
  if (values.includes(null)) return { verdict: "inconclusive", distances };
  const holds = values.every((value) => value !== null && value <= CALIBRATION_MARGIN);
  return { verdict: holds ? "pass" : "fail", distances };
}

function differenceOf(base: GroupPrecision, candidate: GroupPrecision): number | null {
  if (base.precision === null || candidate.precision === null) return null;
  return Math.abs(candidate.precision - base.precision);
}

function unfitted(reason: string): CalibrationResult & { convergence: null; atFloor: false } {
  return { valid: false, reason, a: null, b: null, convergence: null, atFloor: false };
}

function meanOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function varianceOf(values: readonly number[]): number {
  const center = meanOf(values);
  return meanOf(values.map((value) => (value - center) ** 2));
}
