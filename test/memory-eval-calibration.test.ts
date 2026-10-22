import assert from "node:assert/strict";
import test from "node:test";
import {
  accumulatedBands,
  calibratedProbability,
  fitN1,
  fitN2,
  h2Verdict,
  h6Verdict,
  logitOf,
  medianOf,
  n1ExcludedThreads,
  percentileOf,
  type GroupPrecision,
  type LogitRow,
  type ScoredPair
} from "../scripts/memory-eval/calibration.js";
import type { BandCuts } from "../scripts/memory-eval/fit-model.js";

test("N1 leaves out the threads that reference the source or are referenced by it, and the close ones", () => {
  const identityVectors = {
    A: [1, 0],
    B: [0, 1],
    C: [1, 0.1],
    D: [0.6, 0.8],
    E: [0, 1],
    F: [0.99, 0.14]
  };
  const edges: Array<[string, string]> = [
    ["A", "B"],
    ["C", "A"],
    ["D", "E"]
  ];
  const excluded = n1ExcludedThreads("A", edges, identityVectors);
  assert.deepEqual([...excluded].sort(), ["B", "C", "F"]);
});

test("N1 keeps a thread below the identity cosine threshold", () => {
  const excluded = n1ExcludedThreads("A", [], {
    A: [1, 0],
    G: [0.5, 0.8660254]
  });
  assert.equal(excluded.has("G"), false);
});

test("N1 with positives and negatives gives a positive slope and a convergence record", () => {
  const rows: LogitRow[] = Array.from({ length: 40 }, (_, index) => ({
    x: index / 4 - 5,
    label: Number(index >= 20) as 0 | 1
  }));
  const fit = fitN1(rows);
  assert.equal(fit.valid, true);
  assert.ok((fit.a ?? 0) > 0);
  assert.equal(fit.convergence?.iterations, 2000);
  assert.ok(
    Number.isFinite(fit.convergence?.projectedGradientNorm ?? Number.NaN)
  );
  assert.deepEqual(fitN1(rows), fit);
});

test("N1 without negatives is invalid and says why", () => {
  const fit = fitN1([
    { x: 1, label: 1 },
    { x: 2, label: 1 }
  ]);
  assert.equal(fit.valid, false);
  assert.equal(fit.a, null);
  assert.match(fit.reason ?? "", /needs positives and negatives/);
});

test("N2 follows the quantile formula with known data", () => {
  const fit = fitN2({ ref50: 0, ref90: 2 }, { syn50: -1, syn90: 1 });
  assert.equal(fit.valid, true);
  assert.equal(fit.a, 1);
  assert.equal(fit.b, 1);
});

test("N2 with syn90 equal to syn50 is invalid, with no default value", () => {
  const fit = fitN2({ ref50: 0, ref90: 2 }, { syn50: 1, syn90: 1 });
  assert.equal(fit.valid, false);
  assert.equal(fit.a, null);
  assert.equal(fit.b, null);
  assert.match(fit.reason ?? "", /slope is undefined/);
});

test("N2 with a non-positive slope is invalid and keeps the computed value", () => {
  const fit = fitN2({ ref50: 1, ref90: 0.5 }, { syn50: 0, syn90: 1 });
  assert.equal(fit.valid, false);
  assert.equal(fit.a, -0.5);
  assert.match(fit.reason ?? "", /is not positive/);
});

test("median is the mean of the two central values, and the 90th percentile is nearest-rank", () => {
  assert.equal(medianOf([4, 1, 3, 2]), 2.5);
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(percentileOf([1, 2, 3, 4], 0.9), 4);
  assert.equal(percentileOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9);
});

test("the logit clamps the probability, and the identity calibration keeps p", () => {
  assert.ok(Number.isFinite(logitOf(0)));
  assert.ok(Number.isFinite(logitOf(1)));
  assert.ok(Math.abs(calibratedProbability(0.3, { a: 1, b: 0 }) - 0.3) < 1e-12);
});

const CUTS: BandCuts = { high: 0.8, medium: 0.5, low: 0.2 };

test("accumulated bands count the pairs at or above each cut", () => {
  const pairs: ScoredPair[] = [
    { score: 0.9, label: 1, fold: 0 },
    { score: 0.6, label: 0, fold: 0 },
    { score: 0.3, label: 1, fold: 0 },
    { score: 0.1, label: 0, fold: 0 }
  ];
  const bands = accumulatedBands(pairs, () => CUTS);
  assert.deepEqual(bands.high, { pairs: 1, positives: 1, precision: 1 });
  assert.deepEqual(bands.medium, { pairs: 2, positives: 1, precision: 0.5 });
  assert.deepEqual(bands.low, { pairs: 3, positives: 2, precision: 2 / 3 });
});

function group(precision: number | null): GroupPrecision {
  return { pairs: 10, positives: 0, precision };
}

test("the H2 verdict passes within the margin and the agreement, and is inconclusive without precision", () => {
  const base = { high: group(0.9), medium: group(0.6), low: group(0.3) };
  const close = { high: group(0.95), medium: group(0.6), low: group(0.25) };
  assert.equal(h2Verdict(base, close, 0.9).verdict, "pass");
  const far = { high: group(0.5), medium: group(0.6), low: group(0.3) };
  assert.equal(h2Verdict(base, far, 0.9).verdict, "fail");
  assert.equal(h2Verdict(base, close, 0.5).verdict, "fail");
  const empty = { high: group(null), medium: group(0.6), low: group(0.3) };
  assert.equal(h2Verdict(base, empty, 0.9).verdict, "inconclusive");
  assert.equal(h2Verdict(base, close, null).verdict, "inconclusive");
});

test("the H6 verdict compares each accumulated precision with its target", () => {
  assert.equal(
    h6Verdict({ high: group(0.85), medium: group(0.65), low: group(0.35) })
      .verdict,
    "pass"
  );
  assert.equal(
    h6Verdict({ high: group(0.7), medium: group(0.65), low: group(0.35) })
      .verdict,
    "fail"
  );
  assert.equal(
    h6Verdict({ high: group(null), medium: group(0.65), low: group(0.35) })
      .verdict,
    "inconclusive"
  );
});
