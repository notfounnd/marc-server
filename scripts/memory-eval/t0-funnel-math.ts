/**
 * Pure rules of the E3 T0 pre-study: the rerank budget B, the viable K grid, the cost of
 * one pass, the reranker input orders, and the exploratory K curve. Times are in seconds
 * and throughput is in reranker pairs per second. Nothing here loads a model or reads a file.
 *
 * The lexical and fusion terms come from src/core/memory/hybrid-ranking.ts, the same
 * functions that production uses. This module keeps no replica of them.
 */

/** Candidate K values of the T0 grid. K_max is the largest one that fits the budget. */
export const T0_K_GRID: readonly number[] = [8, 10, 12, 15, 20, 25, 30, 40];

/** Latency target of the E3 decision: 1.2 times the median of M0. */
export const T0_LATENCY_FACTOR = 1.2;

/** Passes whose fixed cost the budget reserves: depth 0, depth 1 and depth 2. */
export const T0_PASS_COUNT = 3;

/** Gain, in percent, that the size ordering must reach to enter the budget and T1. */
export const T0_ORDERING_GAIN_PERCENT = 20;

/** A group without passage evidence ranks after every group with one in the passage order. */
const NO_PASSAGE_RANK = Number.MAX_SAFE_INTEGER;

export type BudgetInput = {
  /** Reranker throughput in pairs per second, of the ordering that is adopted. */
  pairsPerSecond: number;
  /** Median end-to-end latency of M0, in seconds. */
  m0Seconds: number;
  /** Cost of one query interpretation, in seconds. */
  interpretationSeconds: number;
  /** Median fixed cost of one pass without the reranker, in seconds. */
  passSeconds: number;
};

/** B = floor(v * (1.2 * M0 - f_interp - 3 * f_passo)), and zero when the bracket is not positive. */
export function rerankBudgetOf(input: BudgetInput): number {
  const seconds =
    T0_LATENCY_FACTOR * input.m0Seconds -
    input.interpretationSeconds -
    T0_PASS_COUNT * input.passSeconds;
  if (seconds <= 0) return 0;
  return Math.floor(input.pairsPerSecond * seconds);
}

/** K values whose first pass fits in half the budget: 3K <= floor(B / 2). */
export function viableKs(
  budget: number,
  grid: readonly number[] = T0_K_GRID
): number[] {
  const limit = Math.floor(budget / 2);
  return grid.filter((k) => 3 * k <= limit);
}

/** The largest viable K, or null when no value of the grid fits. */
export function maxViableK(
  budget: number,
  grid: readonly number[] = T0_K_GRID
): number | null {
  const viable = viableKs(budget, grid);
  if (viable.length === 0) return null;
  return Math.max(...viable);
}

export type PassInput = {
  /** End-to-end latency of one case, in seconds. */
  e2eSeconds: number;
  /** Cost of one query interpretation, in seconds. */
  interpretationSeconds: number;
  /** Wall time of the reranker calls of the case, measured live, in seconds. */
  rerankSeconds: number;
};

/**
 * f_passo of one case: end-to-end minus interpretation minus the measured reranker time. It
 * takes the time that the reranker actually spent, so it does not depend on any throughput.
 */
export function passSecondsOf(input: PassInput): number {
  return input.e2eSeconds - input.interpretationSeconds - input.rerankSeconds;
}

/** Pairs per second implied by a measured reranker time: the original order's throughput check. */
export function impliedPairsPerSecond(pairs: number, rerankSeconds: number): number {
  return pairs / rerankSeconds;
}

/** Gain of the size-ordered throughput over the original order, in percent. */
export function gainPercentOf(
  originalPairsPerSecond: number,
  sortedPairsPerSecond: number
): number {
  return (sortedPairsPerSecond / originalPairsPerSecond - 1) * 100;
}

export type OrderingMode = "original" | "bySize";

/** The ordering that enters the budget: the size order only when its gain reaches the threshold. */
export function adoptedOrderingOf(gainPercent: number): OrderingMode {
  if (gainPercent >= T0_ORDERING_GAIN_PERCENT) return "bySize";
  return "original";
}

/**
 * Send orders of the throughput benchmark, as indexes of the original list. The size order
 * is the one that the production worker now uses by default.
 */
export const PAIR_ORDERINGS: Readonly<
  Record<OrderingMode, (documents: readonly string[]) => number[]>
> = {
  original: (documents) => documents.map((_, index) => index),
  bySize: (documents) =>
    documents
      .map((_, index) => index)
      .sort(
        (left, right) =>
          documents[left].length - documents[right].length || left - right
      )
};

/** Scores of a reordered call, mapped back to the original document order. */
export function scoresInOriginalOrder(
  order: readonly number[],
  scores: readonly number[]
): number[] {
  if (scores.length !== order.length)
    throw new Error("The reranker returned an unexpected score count.");
  const result: number[] = new Array(order.length).fill(0);
  order.forEach((originalIndex, position) => {
    result[originalIndex] = scores[position];
  });
  return result;
}

/** Largest absolute difference between two score lists of the same length. */
export function maxAbsoluteDifference(
  left: readonly number[],
  right: readonly number[]
): number {
  if (left.length !== right.length)
    throw new Error("The score lists have different lengths.");
  return left.reduce(
    (max, value, index) => Math.max(max, Math.abs(value - right[index])),
    0
  );
}

/** Index of the highest score; the first one wins a tie. */
export function bestIndexOf(scores: readonly number[]): number {
  return scores.reduce(
    (best, score, index) => (score > scores[best] ? index : best),
    0
  );
}

export type CurveGroup = {
  groupId: string;
  /** recordId of the group's identity, or of its best passage. The last tie-break. */
  recordId: string;
  /** Fusion without the reranker term. */
  fusion: number;
  /** Best dense rank among the group's passages; undefined when the group has none. */
  bestPassageRank?: number;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

function compareByFusion(left: CurveGroup, right: CurveGroup): number {
  return right.fusion - left.fusion || compareText(left.recordId, right.recordId);
}

function passageRankOf(group: CurveGroup): number {
  return group.bestPassageRank ?? NO_PASSAGE_RANK;
}

function compareByPassage(left: CurveGroup, right: CurveGroup): number {
  return (
    passageRankOf(left) - passageRankOf(right) ||
    compareByFusion(left, right)
  );
}

/**
 * Exploratory finalist rule of the K curve: the first ceil(K/2) groups by fusion, then the
 * remaining slots by best passage dense rank among the groups that were not chosen. It only
 * shapes the curve; it does not choose K.
 */
export function curveFinalists(groups: readonly CurveGroup[], k: number): string[] {
  const byFusion = [...groups].sort(compareByFusion);
  const chosen = byFusion.slice(0, Math.ceil(k / 2));
  const rest = byFusion.slice(chosen.length).sort(compareByPassage);
  const picked = rest.slice(0, Math.max(0, k - chosen.length));
  return [...chosen, ...picked].map((group) => group.groupId);
}

export type RecallCount = { relevantFound: number; relevantTotal: number };

/** Relevant groups among the finalists, against the relevant groups of all candidates. */
export function recallCountOf(
  relevant: ReadonlySet<string>,
  finalists: readonly string[],
  candidates: readonly string[]
): RecallCount {
  return {
    relevantFound: finalists.filter((groupId) => relevant.has(groupId)).length,
    relevantTotal: candidates.filter((groupId) => relevant.has(groupId)).length
  };
}

/** Ratio over sums: the recall of several cases is the sum of found over the sum of totals. */
export function recallRatioOf(count: RecallCount): number | null {
  if (count.relevantTotal === 0) return null;
  return count.relevantFound / count.relevantTotal;
}

/** Whether two sequences hold the same items in the same order. */
export function sameSequence<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length && left.every((item, index) => item === right[index])
  );
}
