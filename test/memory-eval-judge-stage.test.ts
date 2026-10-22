import assert from "node:assert/strict";
import test from "node:test";
import { fitProcedure } from "../scripts/memory-eval/fit.js";
import {
  probabilityOf,
  type BandCuts,
  type ModelParams,
  type ProcedureFit
} from "../scripts/memory-eval/fit-model.js";
import {
  FALLBACK_CLIP,
  chainScore,
  chainStageVector,
  chainTrainingRows,
  fallbackStageVector,
  fallbackTrainingRows,
  judgeChainRanking,
  judgeFallbackRanking,
  type StageRow
} from "../scripts/memory-eval/judge-stage.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";
import type {
  FeatureVector,
  ThreadFeatures
} from "../src/core/memory/scoring/features.js";

const NO_CUTS: BandCuts = { high: null, medium: null, low: null };

const CONVERGENCE = {
  iterations: 1,
  projectedGradientNorm: 0,
  lossChangeLastWindow: 0,
  lossRangeLastWindow: 0
};

/** A procedure fit with fixed weights and cuts (high 0.9, medium 0.7, low as given). */
function procedure(
  intercept: number,
  weights: number[],
  low: number | null
): ProcedureFit {
  return {
    intercept,
    weights,
    lambda: 0.1,
    lambdaAtLowerEdge: false,
    cuts: { high: 0.9, medium: 0.7, low },
    innerLogLoss: {},
    convergence: CONVERGENCE
  };
}

const ZERO: FeatureVector = {
  identityCosine: 0,
  bestPassageCosine: 0,
  bestRerankerScore: 0,
  secondRerankerScore: 0,
  identityRerankerScore: 0,
  lexicalTitleMatch: 0,
  lexicalContentMatch: 0
};

function featuresOf(
  threadId: string,
  values: Partial<FeatureVector>
): ThreadFeatures {
  return { ...ZERO, ...values, threadId };
}

/**
 * H1 weights in FEATURE_NAMES order: the identity cosine alone admits a thread at
 * the low cut 0.5; the lexical title match raises p without any semantic evidence.
 */
const H1: ModelParams = {
  ...procedure(-2, [1, 0, 0, 0, 0, 10, 0], 0.5),
  fallbackCuts: NO_CUTS,
  cheap: procedure(0, [0, 0, 0, 0], null),
  judge: {}
};

/** Chain weights: the judge alone, with a large weight, and the H1 logit at 0. */
const CHAIN = procedure(-5, [0, 10], 0.5);

test("the chain stage reads the logit of p and the judge score", () => {
  const [logit, judge] = chainStageVector(0.5, 0.25);
  assert.ok(Math.abs(logit) < 1e-12);
  assert.equal(judge, 0.25);
});

test("the fallback stage clips the eligibility before its logit", () => {
  // 1 - FALLBACK_CLIP is not exact in binary, so the upper side differs by about 1e-10.
  const clip = Math.log(FALLBACK_CLIP / (1 - FALLBACK_CLIP));
  assert.ok(Math.abs(fallbackStageVector(0, 0)[0] - clip) < 1e-9);
  assert.ok(Math.abs(fallbackStageVector(1, 0)[0] + clip) < 1e-9);
});

test("the chain training rows are the pairs that the H1 low cut pre-admits", () => {
  const pairs: Parameters<typeof chainTrainingRows>[0] = [
    { fold: 0, label: 1, p: 0.9, semanticOnly: 0.7, judge: 0.8 },
    { fold: 1, label: 0, p: 0.2, semanticOnly: 0.3, judge: 0.1 }
  ];
  // A null low cut admits nothing, as in H1, so no pair is pre-admitted.
  assert.deepEqual(chainTrainingRows(pairs, null), []);
  assert.deepEqual(
    chainTrainingRows(pairs, 0.5).map((row) => row.fold),
    [0]
  );
});

test("the fallback training rows are the pairs that M0 admits", () => {
  const pairs: Parameters<typeof fallbackTrainingRows>[0] = [
    { fold: 0, label: 1, eligibility: 0.9, m0Admitted: true, judge: 0.8 },
    { fold: 1, label: 0, eligibility: 0.4, m0Admitted: false, judge: 0.1 }
  ];
  const rows = fallbackTrainingRows(pairs);
  assert.deepEqual(
    rows.map((row) => row.fold),
    [0]
  );
  assert.equal(rows[0].vector[1], 0.8);
});

test("the chain score is the chain of the H1 score and the judge", () => {
  assert.equal(
    chainScore(CHAIN, 0.5, 1),
    probabilityOf(CHAIN, chainStageVector(0.5, 1))
  );
});

test("the H7 chain never admits a thread that H1 does not pre-admit, whatever the judge says", () => {
  const features = [
    featuresOf("A", { lexicalTitleMatch: 1 }),
    featuresOf("B", { identityCosine: 3 })
  ];
  const judge = new Map([
    ["A", 1],
    ["B", 1]
  ]);
  const results = judgeChainRanking(features, H1, CHAIN, judge);
  assert.deepEqual(
    results.map((item) => [item.threadId, item.admitted, item.band]),
    [
      ["A", false, undefined],
      ["B", true, "high"]
    ]
  );
});

test("the H7 chain orders by p2, then by H1 p, and needs a judge score for every thread", () => {
  const features = [
    featuresOf("A", { lexicalTitleMatch: 1 }),
    featuresOf("B", { identityCosine: 3 })
  ];
  const judge = new Map([
    ["A", 1],
    ["B", 1]
  ]);
  const ordered = judgeChainRanking(features, H1, CHAIN, judge);
  assert.deepEqual(
    ordered.map((item) => item.threadId),
    ["A", "B"]
  );
  assert.throws(
    () => judgeChainRanking(features, H1, CHAIN, new Map([["A", 1]])),
    /The judge has no score for thread B/
  );
});

test("the H7 fallback admits only the threads that M0 admits", () => {
  const m0: VariantResult[] = [
    { threadId: "A", score: 0.9, admitted: false, band: undefined },
    { threadId: "B", score: 0.2, admitted: true, band: undefined }
  ];
  const judge = new Map([
    ["A", 1],
    ["B", 1]
  ]);
  const results = judgeFallbackRanking(m0, CHAIN, judge);
  assert.deepEqual(
    results.map((item) => [item.threadId, item.admitted, item.band]),
    [
      ["A", false, undefined],
      ["B", true, "high"]
    ]
  );
});

/** The base judge score of each label; the spread of 0 to 0.2 is added to it. */
const JUDGE_BASE_BY_LABEL: Readonly<Record<0 | 1, number>> = {
  0: 0.05,
  1: 0.75
};

/**
 * Five folds of forty rows with a judge that separates the labels (0.75 to 0.95 for
 * relevant rows, 0.05 to 0.25 for the others) and an H1 logit that does not.
 */
function separableRows(): StageRow[][] {
  return Array.from({ length: 5 }, (_, fold) =>
    Array.from({ length: 40 }, (_, index) => {
      const n = fold * 40 + index;
      const label = (n % 2) as 0 | 1;
      const spread = ((n % 4) / 3) * 0.2;
      const judge = JUDGE_BASE_BY_LABEL[label] + spread;
      return { fold, label, vector: [(((n * 7) % 11) - 5) / 5, judge] };
    })
  );
}

test("the judge chain fit on separable data has non-negative weights and a positive judge weight", () => {
  const rows = separableRows();
  const fit = fitProcedure(rows);
  assert.equal(fit.weights.length, 2);
  assert.ok(fit.weights.every((weight) => weight >= 0));
  assert.ok(fit.weights[1] > 0);
  assert.deepEqual(fitProcedure(rows), fit);
});
