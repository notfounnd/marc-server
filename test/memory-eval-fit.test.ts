import assert from "node:assert/strict";
import test from "node:test";
import type { EvalCase } from "../scripts/memory-eval/dataset.js";
import {
  labelOf,
  fitProcedure,
  type LabelledPair
} from "../scripts/memory-eval/fit.js";
import {
  LAMBDA_GRID,
  admits,
  bandCut,
  bandOf,
  fitLogistic,
  fitLogisticWithDiagnostics,
  logLoss,
  probabilityOf,
  type BandCuts,
  type LabelledVector,
  type ScoredLabel
} from "../scripts/memory-eval/fit-model.js";

/** Forty deterministic rows with three features. The label follows the first two. */
function rowsFixture(): LabelledVector[] {
  return Array.from({ length: 40 }, (_, index) => {
    const vector = [
      index / 40,
      ((index * 7) % 40) / 40,
      ((index * 13) % 40) / 40
    ];
    const label = Number(vector[0] + 0.5 * vector[1] - 0.2 * vector[2] > 0.4);
    return { vector, label: label as 0 | 1 };
  });
}

/** The second feature is anti-correlated with the label: its weight must stay 0. */
function anticorrelatedRows(): LabelledVector[] {
  return Array.from({ length: 40 }, (_, index) => {
    const label = Number(index >= 20) as 0 | 1;
    const vector = [
      (index % 10) / 10,
      0.5 + (index % 3) / 10,
      1 - 0.8 * label + (index % 5) / 100
    ];
    return { vector, label };
  });
}

test("the convergence diagnostics leave the fit unchanged and are consistent", () => {
  const rows = rowsFixture();
  const diagnosed = fitLogisticWithDiagnostics(rows, 0.1);
  assert.deepEqual(diagnosed.model, fitLogistic(rows, 0.1));
  const { convergence } = diagnosed;
  assert.equal(convergence.iterations, 2000);
  assert.ok(Number.isFinite(convergence.projectedGradientNorm));
  assert.ok(convergence.projectedGradientNorm >= 0);
  assert.ok(convergence.lossRangeLastWindow >= 0);
  assert.ok(
    Math.abs(convergence.lossChangeLastWindow) <=
      convergence.lossRangeLastWindow
  );
});

test("the logistic fit is deterministic", () => {
  const rows = rowsFixture();
  assert.deepEqual(fitLogistic(rows, 0.1), fitLogistic(rows, 0.1));
});

test("the fitted weights are non-negative and the anticorrelated one is 0", () => {
  const model = fitLogistic(anticorrelatedRows(), 0.1);
  assert.ok(model.weights.every((weight) => weight >= 0));
  assert.equal(model.weights[2], 0);
  assert.ok(model.weights[0] >= 0);
});

test("rescaling a feature rescales its weight and keeps every prediction", () => {
  const rows = rowsFixture();
  const scaled = rows.map((row) => ({
    vector: [row.vector[0] * 10, row.vector[1], row.vector[2]],
    label: row.label
  }));
  const base = fitLogistic(rows, 0.1);
  const other = fitLogistic(scaled, 0.1);
  assert.ok(Math.abs(other.weights[0] * 10 - base.weights[0]) < 1e-9);
  rows.forEach((row, index) => {
    const difference = Math.abs(
      probabilityOf(base, row.vector) -
        probabilityOf(other, scaled[index].vector)
    );
    assert.ok(difference < 1e-9);
  });
});

test("every lambda of the grid produces a deterministic fit", () => {
  const rows = rowsFixture();
  LAMBDA_GRID.forEach((lambda) => {
    assert.deepEqual(fitLogistic(rows, lambda), fitLogistic(rows, lambda));
  });
});

test("band cuts follow the smallest score that reaches each precision target", () => {
  const known: ScoredLabel[] = [
    { score: 0.9, label: 1 },
    { score: 0.8, label: 1 },
    { score: 0.7, label: 0 },
    { score: 0.6, label: 1 },
    { score: 0.2, label: 0 }
  ];
  assert.equal(bandCut(known, 0.9), 0.8);
  assert.equal(bandCut(known, 0.6), 0.2);
  assert.equal(bandCut(known, 0.3), 0.2);
});

test("an unreachable precision target gives an empty band", () => {
  const known: ScoredLabel[] = [
    { score: 0.9, label: 1 },
    { score: 0.5, label: 0 }
  ];
  assert.equal(bandCut(known, 1.01), null);
  const allNegative: ScoredLabel[] = [
    { score: 0.9, label: 0 },
    { score: 0.5, label: 0 }
  ];
  assert.equal(bandCut(allNegative, 0.3), null);
});

test("tied scores are cut together", () => {
  const tied: ScoredLabel[] = [
    { score: 0.5, label: 1 },
    { score: 0.5, label: 0 }
  ];
  assert.equal(bandCut(tied, 0.5), 0.5);
  assert.equal(bandCut(tied, 0.6), null);
});

test("a score takes the highest band whose cut it reaches", () => {
  const cuts: BandCuts = { high: 0.8, medium: null, low: 0.2 };
  assert.equal(bandOf(0.85, cuts), "high");
  assert.equal(bandOf(0.5, cuts), "low");
  assert.equal(bandOf(0.1, cuts), undefined);
  assert.equal(admits(0.5, null), false);
  assert.equal(admits(0.2, 0.2), true);
});

test("log-loss of a 0.5 score is ln 2 for either label", () => {
  assert.ok(Math.abs(logLoss([{ score: 0.5, label: 1 }]) - Math.LN2) < 1e-12);
  assert.ok(Math.abs(logLoss([{ score: 0.5, label: 0 }]) - Math.LN2) < 1e-12);
});

function pairsFixture(): LabelledPair[] {
  return Array.from({ length: 60 }, (_, index) => {
    const vector = [
      (index % 7) / 7,
      ((index * 3) % 11) / 11,
      ((index * 5) % 13) / 13
    ];
    const label = Number(vector[0] + vector[1] > 1) as 0 | 1;
    return {
      caseId: `case-${index}`,
      threadId: `thread-${index}`,
      fold: index % 5,
      label,
      eligibility: vector[0],
      m0Admitted: vector[0] > 0.2,
      vector,
      semanticVector: [vector[0], vector[1], vector[2]],
      cheapVector: [vector[0], vector[1], 0, 0],
      cheapSemanticVector: [vector[0], vector[1], 0, 0],
      judges: {}
    };
  });
}

test("fitProcedure is deterministic and returns a grid lambda with the lowest inner loss", () => {
  const pairs = pairsFixture();
  const trainFolds = [0, 1, 2, 3].map((fold) =>
    pairs.filter((pair) => pair.fold === fold)
  );
  const first = fitProcedure(trainFolds);
  assert.deepEqual(first, fitProcedure(trainFolds));
  assert.ok(LAMBDA_GRID.includes(first.lambda));
  assert.deepEqual(Object.keys(first.innerLogLoss).sort(), [
    "0.01",
    "0.1",
    "1"
  ]);
  const minimum = Math.min(
    ...LAMBDA_GRID.map((lambda) => first.innerLogLoss[String(lambda)])
  );
  assert.equal(first.innerLogLoss[String(first.lambda)], minimum);
  assert.ok(first.weights.every((weight) => weight >= 0));
});

const POSITIVE_CASE: EvalCase = {
  id: "P",
  family: "family",
  style: "direct",
  query: "query",
  queryMode: "auto",
  judgments: { T3: 3, T2: 2, T1: 1, T0: 0 },
  origin: "test"
};

const NEGATIVE_CASE: EvalCase = {
  id: "N",
  family: "family",
  style: "negative",
  query: "query",
  queryMode: "auto",
  judgments: {},
  origin: "test"
};

test("grades 2 and 3 are relevant, grades 0 and 1 are not, unjudged pairs have no label", () => {
  assert.equal(labelOf(POSITIVE_CASE, "T3"), 1);
  assert.equal(labelOf(POSITIVE_CASE, "T2"), 1);
  assert.equal(labelOf(POSITIVE_CASE, "T1"), 0);
  assert.equal(labelOf(POSITIVE_CASE, "T0"), 0);
  assert.equal(labelOf(POSITIVE_CASE, "unjudged"), undefined);
});

test("every pair of a negative case is labelled 0, judged or not", () => {
  assert.equal(labelOf(NEGATIVE_CASE, "anything"), 0);
});
