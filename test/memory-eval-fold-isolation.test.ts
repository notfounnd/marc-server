import assert from "node:assert/strict";
import test from "node:test";
import {
  modelParams,
  nestedFolds,
  pairsByFold,
  type LabelledPair,
  type ProcedureFitter
} from "../scripts/memory-eval/fit.js";
import { bandCutsOf, type BandCuts } from "../scripts/memory-eval/fit-model.js";
import { caseFolds } from "../scripts/memory-eval/folds.js";

const NO_CUTS: BandCuts = { high: null, medium: null, low: null };

const NO_CONVERGENCE = {
  iterations: 2000,
  projectedGradientNorm: 0,
  lossChangeLastWindow: 0,
  lossRangeLastWindow: 0
};

/** Five folds of four pairs each, with distinct eligibility per pair. */
function pairsFixture(): LabelledPair[] {
  return Array.from({ length: 20 }, (_, index) => {
    const vector = [index / 20, 1, 0];
    return {
      caseId: `case-${index % 5}`,
      threadId: `thread-${index}`,
      fold: index % 5,
      label: Number(index % 3 === 0) as 0 | 1,
      eligibility: index / 20,
      m0Admitted: true,
      vector,
      semanticVector: vector,
      cheapVector: vector,
      cheapSemanticVector: vector,
      judges: {}
    };
  });
}

/**
 * A fitter that records the folds it receives. Its lambda is its call number,
 * so each returned parameter set can be traced back to its call.
 */
function recordingFitter(calls: LabelledPair[][][]): ProcedureFitter {
  return (trainFolds) => {
    const lambda = calls.length + 1;
    calls.push(trainFolds.map((group) => [...group]));
    return {
      lambda,
      lambdaAtLowerEdge: false,
      intercept: 0,
      weights: [0, 0, 0],
      cuts: NO_CUTS,
      innerLogLoss: {},
      convergence: NO_CONVERGENCE
    };
  };
}

test("an outer fold never reaches the fitter that evaluates it", () => {
  const pairs = pairsFixture();
  const calls: LabelledPair[][][] = [];
  const folds = nestedFolds(pairs, recordingFitter(calls));
  assert.equal(calls.length, 5);
  folds.forEach((params, fold) => {
    const trained = calls[fold].flat();
    assert.equal(calls[fold].length, 4);
    assert.ok(trained.every((pair) => pair.fold !== fold));
    assert.equal(
      trained.length,
      pairs.length - pairsByFold(pairs)[fold].length
    );
    assert.equal(params.fold, fold);
    assert.equal(params.lambda, fold + 1);
  });
});

test("the fallback cuts of an outer fold come only from the other folds", () => {
  const pairs = pairsFixture();
  const folds = nestedFolds(pairs, recordingFitter([]));
  folds.forEach((params, fold) => {
    const others = pairs.filter((pair) => pair.fold !== fold);
    const eligibility = others.map((pair) => ({
      score: pair.eligibility,
      label: pair.label
    }));
    assert.deepEqual(params.fallbackCuts, bandCutsOf(eligibility));
  });
});

test("the production fit receives all five folds", () => {
  const pairs = pairsFixture();
  const calls: LabelledPair[][][] = [];
  const production = modelParams(pairsByFold(pairs), recordingFitter(calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 5);
  assert.equal(calls[0].flat().length, pairs.length);
  assert.equal(production.lambda, 1);
});

test("the cases of one family share one fold", () => {
  const folds = caseFolds([
    { id: "A1", family: "alpha" },
    { id: "A2", family: "alpha" },
    { id: "B1", family: "beta" }
  ]);
  assert.equal(folds.get("A1"), folds.get("A2"));
  assert.ok([0, 1, 2, 3, 4].includes(folds.get("B1") ?? -1));
});
