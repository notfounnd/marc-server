import type { JudgeModelParams, JudgeName, StageDiagnostics } from "./judge-stage.js";

/**
 * Pure model of the calibrated score (H1): the logistic model, its
 * non-negative projected fit, the convergence diagnostics and the band cuts.
 * No input or output of this module touches a provider, a model or a file.
 */

/** Precision each band must reach. A cut is the smallest score that reaches it. */
export const BAND_TARGETS = { high: 0.9, medium: 0.6, low: 0.3 } as const;

export type Band = keyof typeof BAND_TARGETS;

/** Highest band first: a score belongs to the first band whose cut it reaches. */
export const BAND_ORDER: readonly Band[] = ["high", "medium", "low"];

/** A null cut means its target is unreachable, so that band is empty. */
export type BandCuts = Record<Band, number | null>;

export const LAMBDA_GRID: readonly number[] = [0.01, 0.1, 1];
export const GRADIENT_ITERATIONS = 2000;
export const LEARNING_RATE = 0.1;

/** Iterations over which the convergence diagnostics measure the loss. */
export const LOSS_WINDOW = 100;

const PROBABILITY_EPSILON = 1e-12;

export type LabelledVector = { vector: readonly number[]; label: 0 | 1 };
export type ScoredLabel = { score: number; label: 0 | 1 };
export type LogisticModel = { intercept: number; weights: number[] };

/**
 * Convergence of one fit, measured on its training rows in the standardized
 * feature space. The fit is not stopped early, so these values are evidence for
 * the approvers and do not change the fit.
 */
export type Convergence = {
  iterations: number;
  /** Norm of the projected gradient at the last iterate, bias included. */
  projectedGradientNorm: number;
  /** Mean log-loss at the last iterate minus its value LOSS_WINDOW iterations earlier. */
  lossChangeLastWindow: number;
  /** Largest minus smallest mean log-loss over the last LOSS_WINDOW iterations. */
  lossRangeLastWindow: number;
};

/** Output of fitProcedure: the model, the chosen lambda and the band cuts. */
export type ProcedureFit = LogisticModel & {
  lambda: number;
  /** True when the chosen lambda is the lowest value of the grid. */
  lambdaAtLowerEdge: boolean;
  cuts: BandCuts;
  /** Mean inner out-of-fold log-loss of each lambda, keyed by its value. */
  innerLogLoss: Record<string, number>;
  /** Convergence of the final refit on all training folds. */
  convergence: Convergence;
};

/**
 * Parameters of one fit. `fallbackCuts` are the cuts of H1_FALLBACK. `cheap` is
 * the cheap model of E2 (four features, see CHEAP_FEATURE_NAMES), fitted with
 * the same procedure on the same training folds.
 */
export type ModelParams = ProcedureFit & {
  fallbackCuts: BandCuts;
  cheap: ProcedureFit;
  /** The judge stages (H7), one entry per judge fitted on this training set. */
  judge?: Partial<Record<JudgeName, JudgeModelParams>>;
};

export type FoldModelParams = ModelParams & { fold: number };

export type GroupCount = {
  pairs: number;
  positives: number;
  precision: number | null;
};

export type BandSummary = {
  admitted: GroupCount;
  bands: Record<Band, GroupCount>;
  unbanded: GroupCount;
};

/** Content of fit.json. `folds[k]` was fitted without outer fold k. */
export type FitResult = {
  schemaVersion: 1;
  corpus: string;
  captureId: string;
  /**
   * Per judge: the nested partitions run over the outer folds and the production fit, and
   * those that stayed unfitted for lack of a pre-admitted training pair.
   */
  judgeSummary?: Partial<Record<JudgeName, StageDiagnostics>>;
  featureNames: string[];
  cheapFeatureNames: string[];
  /** Judges whose stages (H7) are in this fit. */
  judges: JudgeName[];
  lambdaGrid: number[];
  bandTargets: Record<Band, number>;
  labelled: { pairs: number; positives: number };
  folds: FoldModelParams[];
  production: ModelParams;
  external: { calibrated: BandSummary; fallback: BandSummary };
};

export function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function dot(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length) {
    throw new Error(`Vector lengths differ: ${left.length} and ${right.length}.`);
  }
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

export function probabilityOf(
  model: LogisticModel,
  vector: readonly number[]
): number {
  return sigmoid(model.intercept + dot(model.weights, vector));
}

/** Mean log-loss of the scores against their labels. */
export function logLoss(pairs: readonly ScoredLabel[]): number {
  if (pairs.length === 0) throw new Error("Log-loss needs at least one pair.");
  const total = pairs.reduce((sum, pair) => sum + pairLoss(pair), 0);
  return total / pairs.length;
}

function pairLoss({ score, label }: ScoredLabel): number {
  const probability = clampProbability(score);
  return -(
    label * Math.log(probability) +
    (1 - label) * Math.log(1 - probability)
  );
}

function clampProbability(value: number): number {
  return Math.min(
    1 - PROBABILITY_EPSILON,
    Math.max(PROBABILITY_EPSILON, value)
  );
}

/**
 * Smallest score t whose pairs (score >= t) reach the target precision, over the
 * labelled pairs. Null when no score reaches it. Sweeps the scores from the
 * highest down, so each candidate cut is checked once.
 */
export function bandCut(
  pairs: readonly ScoredLabel[],
  target: number
): number | null {
  const sorted = [...pairs].sort((left, right) => right.score - left.score);
  let count = 0;
  let positives = 0;
  let cut: number | null = null;
  let index = 0;
  while (index < sorted.length) {
    const score = sorted[index].score;
    while (index < sorted.length && sorted[index].score === score) {
      count += 1;
      positives += sorted[index].label;
      index += 1;
    }
    if (positives / count >= target) cut = score;
  }
  return cut;
}

/** The three cuts of one set of labelled scores, with BAND_TARGETS. */
export function bandCutsOf(pairs: readonly ScoredLabel[]): BandCuts {
  return {
    high: bandCut(pairs, BAND_TARGETS.high),
    medium: bandCut(pairs, BAND_TARGETS.medium),
    low: bandCut(pairs, BAND_TARGETS.low)
  };
}

/** True when the score reaches the cut. An empty cut admits nothing. */
export function admits(score: number, cut: number | null): boolean {
  if (cut === null) return false;
  return score >= cut;
}

export function bandOf(score: number, cuts: BandCuts): Band | undefined {
  return BAND_ORDER.find((band) => admits(score, cuts[band]));
}

type Scaling = { mean: number[]; scale: number[] };

/** Weights and intercept of one step of the descent, in the standardized space. */
type DescentState = { weights: number[]; bias: number };

/** Gradient of the penalized log-loss: the L2 term is included in `weights`. */
type Gradient = { weights: number[]; bias: number };

/** Result of a fit together with its convergence diagnostics. */
export type LogisticFit = { model: LogisticModel; convergence: Convergence };

/**
 * Fits the logistic model with L2 penalty lambda on the standardized features,
 * by projected gradient descent: weights are clipped to 0 after every step, so
 * they stay non-negative. The result is returned in the original feature scale.
 * The fit is deterministic: it starts from zero weights and a fixed intercept.
 */
export function fitLogistic(
  rows: readonly LabelledVector[],
  lambda: number
): LogisticModel {
  return fitLogisticWithDiagnostics(rows, lambda).model;
}

/**
 * The same fit as fitLogistic, plus its convergence diagnostics. The
 * diagnostics only read the iterates: the iterations, the rate and the weights
 * are the ones fitLogistic produces.
 */
export function fitLogisticWithDiagnostics(
  rows: readonly LabelledVector[],
  lambda: number
): LogisticFit {
  if (rows.length === 0) throw new Error("The logistic fit needs rows.");
  const scaling = scalingOf(rows);
  const inputs = rows.map((row) => standardize(row.vector, scaling));
  const labels = rows.map((row) => row.label);
  let state: DescentState = {
    weights: scaling.mean.map(() => 0),
    bias: logit(clampProbability(meanOf(labels)))
  };
  const beforeWindow = GRADIENT_ITERATIONS - LOSS_WINDOW;
  for (let iteration = 0; iteration < beforeWindow; iteration += 1) {
    state = descentStep(inputs, labels, state, lambda);
  }
  const losses: number[] = [];
  for (let iteration = beforeWindow; iteration < GRADIENT_ITERATIONS; iteration += 1) {
    losses.push(lossAt(inputs, labels, state));
    state = descentStep(inputs, labels, state, lambda);
  }
  losses.push(lossAt(inputs, labels, state));
  const gradient = gradientAt(inputs, labels, state, lambda);
  return {
    model: toOriginalScale(state.weights, state.bias, scaling),
    convergence: {
      iterations: GRADIENT_ITERATIONS,
      projectedGradientNorm: projectedNorm(state, gradient),
      lossChangeLastWindow: losses[losses.length - 1] - losses[0],
      lossRangeLastWindow: Math.max(...losses) - Math.min(...losses)
    }
  };
}

function gradientAt(
  inputs: readonly (readonly number[])[],
  labels: readonly number[],
  state: DescentState,
  lambda: number
): Gradient {
  const sums = state.weights.map(() => 0);
  let biasSum = 0;
  for (let row = 0; row < inputs.length; row += 1) {
    const input = inputs[row];
    const error = sigmoid(state.bias + dot(state.weights, input)) - labels[row];
    biasSum += error;
    for (let column = 0; column < input.length; column += 1) {
      sums[column] += error * input[column];
    }
  }
  const count = inputs.length;
  return {
    weights: state.weights.map(
      (weight, column) => sums[column] / count + lambda * weight
    ),
    bias: biasSum / count
  };
}

function descentStep(
  inputs: readonly (readonly number[])[],
  labels: readonly number[],
  state: DescentState,
  lambda: number
): DescentState {
  const gradient = gradientAt(inputs, labels, state, lambda);
  return {
    bias: state.bias - LEARNING_RATE * gradient.bias,
    weights: state.weights.map((weight, column) =>
      Math.max(0, weight - LEARNING_RATE * gradient.weights[column])
    )
  };
}

function lossAt(
  inputs: readonly (readonly number[])[],
  labels: readonly number[],
  state: DescentState
): number {
  const scores = inputs.map((input, row) => ({
    score: sigmoid(state.bias + dot(state.weights, input)),
    label: labels[row] as 0 | 1
  }));
  return logLoss(scores);
}

/**
 * Norm of the projected gradient: a weight at 0 whose descent would push it
 * below 0 contributes nothing, because the projection holds it there.
 */
function projectedNorm(state: DescentState, gradient: Gradient): number {
  const components = state.weights.map((weight, column) =>
    projectedComponent(weight, gradient.weights[column])
  );
  const squares = [...components, gradient.bias].map((value) => value * value);
  return Math.sqrt(squares.reduce((sum, value) => sum + value, 0));
}

function projectedComponent(weight: number, derivative: number): number {
  if (weight > 0) return derivative;
  if (derivative < 0) return derivative;
  return 0;
}

function scalingOf(rows: readonly LabelledVector[]): Scaling {
  const dimension = rows[0].vector.length;
  if (rows.some((row) => row.vector.length !== dimension)) {
    throw new Error("Every row needs the same number of features.");
  }
  const columns = Array.from({ length: dimension }, (_, column) =>
    rows.map((row) => row.vector[column])
  );
  return {
    mean: columns.map((values) => meanOf(values)),
    scale: columns.map((values) => safeScale(Math.sqrt(varianceOf(values))))
  };
}

/** A constant feature keeps scale 1, so its standardized value is 0. */
function safeScale(deviation: number): number {
  if (deviation > 0) return deviation;
  return 1;
}

function standardize(
  vector: readonly number[],
  scaling: Scaling
): number[] {
  return vector.map(
    (value, column) => (value - scaling.mean[column]) / scaling.scale[column]
  );
}

function toOriginalScale(
  weights: readonly number[],
  bias: number,
  scaling: Scaling
): LogisticModel {
  const original = weights.map(
    (weight, column) => weight / scaling.scale[column]
  );
  const shift = weights.reduce(
    (sum, weight, column) =>
      sum + (weight * scaling.mean[column]) / scaling.scale[column],
    0
  );
  return { intercept: bias - shift, weights: original };
}

function meanOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function varianceOf(values: readonly number[]): number {
  const center = meanOf(values);
  return meanOf(values.map((value) => (value - center) ** 2));
}

function logit(probability: number): number {
  return Math.log(probability / (1 - probability));
}
