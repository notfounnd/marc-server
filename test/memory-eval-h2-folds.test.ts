import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  foldCalibrationsOf,
  foldReferenceLogitsOf,
  syntheticCandidatesOf,
  type CalibrationModel
} from "../scripts/memory-eval/calibrate.js";
import {
  buildFit,
  labelledPairsOf,
  type LabelledPair
} from "../scripts/memory-eval/fit.js";
import {
  captureOf,
  NESTED_JUDGED_DATASET
} from "./memory-eval-nested-fixture.js";

test("altering the labels of fold k changes neither the N2 reference nor the calibration that evaluates fold k", async (t: TestContext) => {
  const capture = await captureOf(t, NESTED_JUDGED_DATASET);
  const { fit, predictions } = await buildFit({
    capture,
    dataset: NESTED_JUDGED_DATASET
  });
  const model: CalibrationModel = { fit, predictions };
  const pairs = await labelledPairsOf(capture, NESTED_JUDGED_DATASET);
  const synthetic = await syntheticCandidatesOf(capture);
  const flipLabel = (pair: LabelledPair) => ({
    ...pair,
    label: (1 - pair.label) as 0 | 1
  });
  // Fold 0 has its labels flipped in the pairs and in the external predictions; the other folds are kept.
  const flippedPairs = [
    ...pairs.filter((pair) => pair.fold === 0).map(flipLabel),
    ...pairs.filter((pair) => pair.fold !== 0)
  ];
  const flippedPredictions = {
    ...predictions,
    pairs: [
      ...predictions.pairs
        .filter((pair) => pair.fold === 0)
        .map((pair) => ({ ...pair, label: (1 - pair.label) as 0 | 1 })),
      ...predictions.pairs.filter((pair) => pair.fold !== 0)
    ]
  };
  const lambda = fit.folds[0].lambda;
  const referenceBefore = foldReferenceLogitsOf({ pairs, fold: 0, lambda });
  const referenceAfter = foldReferenceLogitsOf({
    pairs: flippedPairs,
    fold: 0,
    lambda
  });
  assert.ok(
    referenceBefore.length > 0,
    "the reference of fold 0 has training positives"
  );
  assert.deepEqual(referenceAfter, referenceBefore);
  const before = foldCalibrationsOf({
    synthetic,
    capture,
    model,
    pairs,
    fold: 0
  });
  const after = foldCalibrationsOf({
    synthetic,
    capture,
    model: { fit, predictions: flippedPredictions },
    pairs: flippedPairs,
    fold: 0
  });
  assert.deepEqual(after, before);
});
