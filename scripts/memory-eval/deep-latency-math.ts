import { isValidDeepBudget } from "./deep-protocol.js";
import { latencySummary } from "./metrics.js";

/** The gate of a path: its median in at most this factor times the median of its M0 reference (plan, Critério 4). */
export const LATENCY_FACTOR = 1.2;

/** The informative reference of the p95, in milliseconds. It is reported and does not gate. */
export const REFERENCE_P95_MS = 5000;

/** The limit of each live call, as the E3 latency measurement used it. */
export const LATENCY_LIMIT = 5;

/** Timed calls per path and case, after one warm-up of each path. */
export const TIMED_PER_CASE = 3;

/** One timed live call: the end-to-end time, the reranker time and the documents sent to the reranker. */
export type TimedSample = { e2eMs: number; rerankMs: number; pairs: number };

/** The gate of one path: the limit in milliseconds, and whether the median is within it. Null without a reference. */
export function gateOfPath(input: {
  medianMs: number | null;
  referenceMedianMs: number | null;
}): { limitMs: number | null; passed: boolean | null } {
  if (input.medianMs === null || input.referenceMedianMs === null) return { limitMs: null, passed: null };
  const limitMs = LATENCY_FACTOR * input.referenceMedianMs;
  return { limitMs, passed: input.medianMs <= limitMs };
}

/** The overhead of the scoped path: the median of (total time − reranker time) over its samples, in ms. */
export function overheadMsOf(samples: readonly TimedSample[]): number | null {
  return latencySummary(samples.map((item) => item.e2eMs - item.rerankMs)).medianMs;
}

/** The rate of the reranker in the run: the pairs over the reranker seconds, over the samples. Null without reranker time. */
export function pairsPerSecondOf(samples: readonly TimedSample[]): number | null {
  const seconds = samples.reduce((total, item) => total + item.rerankMs, 0) / 1000;
  if (seconds <= 0) return null;
  return samples.reduce((total, item) => total + item.pairs, 0) / seconds;
}

/**
 * The recuo budget of the plan: B' = floor(((1,2 × M0 − overhead) ÷ 1000) × r), with the M0 and the overhead of the
 * scoped samples, and r the reranker rate of the same execution. Null when an input is missing.
 */
export function budgetOf(input: {
  referenceMedianMs: number | null;
  overheadMs: number | null;
  pairsPerSecond: number | null;
}): number | null {
  if (input.referenceMedianMs === null || input.overheadMs === null || input.pairsPerSecond === null) return null;
  const milliseconds = LATENCY_FACTOR * input.referenceMedianMs - input.overheadMs;
  return Math.floor((milliseconds / 1000) * input.pairsPerSecond);
}

/** A recuo budget is usable only inside its domain, 1 <= B' < 232. Outside it the plan reports a failure, with no ceiling. */
export function isUsableBudget(budget: number | null): boolean {
  return budget !== null && isValidDeepBudget(budget);
}

/** The pairs a scoped run sends: its scope, up to the budget. The replay of DEEP uses the core budget of 232. */
export function expectedScopedPairs(scopePassages: number, budget: number): number {
  return Math.min(scopePassages, budget);
}

/** True when every sample sent exactly the expected number of pairs. */
export function pairsMatch(samples: readonly { pairs: number }[], expected: number): boolean {
  return samples.every((item) => item.pairs === expected);
}

/** True when every sample of one case sent the same number of pairs. Used for the M0 path, which has no replay here. */
export function pairsStable(samples: readonly { pairs: number }[]): boolean {
  return samples.every((item) => item.pairs === (samples[0]?.pairs ?? item.pairs));
}

/**
 * The order of the paths in one round of the interleaving. Round 0 keeps the order; each later round starts one
 * path further on, so that no path always runs first or last.
 */
export function rotatedOrder<T>(order: readonly T[], round: number): T[] {
  const shift = round % order.length;
  return [...order.slice(shift), ...order.slice(0, shift)];
}
