import assert from "node:assert/strict";
import test from "node:test";
import {
  H6_FALLBACK_NOTE,
  h6FallbackVariant
} from "../scripts/memory-eval/calibrate.js";
import type { ScoredPair } from "../scripts/memory-eval/calibration.js";
import { admits, bandCutsOf } from "../scripts/memory-eval/fit-model.js";
import { FOLD_COUNT } from "../scripts/memory-eval/folds.js";

/** Fifty declared pairs spread over the five folds, with labels that follow the score. */
function pairsFixture(): ScoredPair[] {
  return Array.from({ length: FOLD_COUNT * 10 }, (_, index) => {
    const score = ((index * 37) % 100) / 100;
    return {
      score,
      label: Number(score >= 0.6) as 0 | 1,
      fold: index % FOLD_COUNT
    };
  });
}

/** The labels of one fold flipped; the other folds keep theirs. */
function flipFold(pairs: readonly ScoredPair[], fold: number): ScoredPair[] {
  return pairs.map((pair) => ({
    ...pair,
    label: ((pair.label + Number(pair.fold === fold)) % 2) as 0 | 1
  }));
}

test("the cuts of each outer fold equal bandCut on the labelled pairs of the other folds", () => {
  const pairs = pairsFixture();
  const variant = h6FallbackVariant(pairs);
  for (let fold = 0; fold < FOLD_COUNT; fold += 1) {
    assert.deepEqual(
      variant.cutsByFold[fold],
      bandCutsOf(pairs.filter((pair) => pair.fold !== fold))
    );
  }
});

test("the cuts of a fold do not change when that fold's own labels change", () => {
  const pairs = pairsFixture();
  const original = h6FallbackVariant(pairs);
  for (let fold = 0; fold < FOLD_COUNT; fold += 1) {
    const flipped = h6FallbackVariant(flipFold(pairs, fold));
    assert.deepEqual(flipped.cutsByFold[fold], original.cutsByFold[fold]);
  }
});

test("the accumulated bands count each pair under the cuts of its own fold", () => {
  const pairs = pairsFixture();
  const variant = h6FallbackVariant(pairs);
  const expectedHigh = pairs.filter((pair) =>
    admits(pair.score, variant.cutsByFold[pair.fold].high)
  );
  assert.equal(variant.bands.high.pairs, expectedHigh.length);
  assert.equal(
    variant.bands.high.positives,
    expectedHigh.reduce((sum, pair) => sum + pair.label, 0)
  );
});

test("the fallback note says that the corpus stops being an untouched validation", () => {
  assert.match(
    H6_FALLBACK_NOTE,
    /stops being an untouched external validation/
  );
});
