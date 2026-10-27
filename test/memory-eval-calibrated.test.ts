import assert from "node:assert/strict";
import test from "node:test";
import {
  admits,
  probabilityOf,
  type FitResult,
  type FoldModelParams,
  type ModelParams
} from "../scripts/memory-eval/fit-model.js";
import {
  calibratedRanking,
  fallbackRanking,
  foldParamsOf,
  type VariantInput
} from "../scripts/memory-eval/variants.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";
import {
  featureVectorOf,
  semanticOnlyVectorOf,
  type ThreadFeatures
} from "../scripts/memory-eval/features.js";

/**
 * Hand-set parameters. Weights follow the feature order: identityCosine,
 * bestPassageCosine, bestRerankerScore, secondRerankerScore,
 * identityRerankerScore, lexicalTitleMatch, lexicalContentMatch.
 */
const PARAMS: ModelParams = {
  lambda: 0.1,
  lambdaAtLowerEdge: false,
  intercept: -4,
  weights: [3, 2, 2, 0.5, 1, 6, 0.5],
  cuts: { high: 0.9, medium: 0.6, low: 0.3 },
  fallbackCuts: { high: 0.8, medium: null, low: 0.2 },
  cheap: {
    lambda: 0.1,
    lambdaAtLowerEdge: false,
    intercept: -4,
    weights: [3, 2, 6, 0.5],
    cuts: { high: 0.9, medium: 0.6, low: 0.3 },
    innerLogLoss: {},
    convergence: {
      iterations: 2000,
      projectedGradientNorm: 0,
      lossChangeLastWindow: 0,
      lossRangeLastWindow: 0
    }
  },
  innerLogLoss: {},
  convergence: {
    iterations: 2000,
    projectedGradientNorm: 0,
    lossChangeLastWindow: 0,
    lossRangeLastWindow: 0
  }
};

function features(
  threadId: string,
  identity: number,
  passage: number,
  best: number,
  second: number,
  identityReranker: number,
  title: number,
  content: number
): ThreadFeatures {
  return {
    threadId,
    identityCosine: identity,
    bestPassageCosine: passage,
    bestRerankerScore: best,
    secondRerankerScore: second,
    identityRerankerScore: identityReranker,
    lexicalTitleMatch: title,
    lexicalContentMatch: content
  };
}

test("H1_CALIBRATED admits on semanticOnly, orders by p, and bands the admitted", () => {
  const ranked = calibratedRanking(
    [
      features("X", 0, 0, 0, 0, 0, 1, 1),
      features("Y", 0.9, 0.8, 0.9, 0.5, 0.6, 0, 0),
      features("Z", 0.1, 0.1, 0.1, 0.1, 0.1, 1, 1)
    ],
    PARAMS
  );
  assert.deepEqual(
    ranked.map((item) => [item.threadId, item.admitted, item.band]),
    [
      ["Z", false, undefined],
      ["Y", true, "high"],
      ["X", false, undefined]
    ]
  );
});

test("lexical evidence alone never admits a thread (D6), whatever its value", () => {
  const semanticLevels = [0, 0.1, 0.5, 0.9];
  const lexicalCombinations: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ];
  const probes = lexicalCombinations.flatMap(([title, content]) =>
    semanticLevels.map((level) =>
      features(
        `t-${title}-${content}-${level}`,
        level,
        level,
        level,
        level,
        level,
        title,
        content
      )
    )
  );
  const ranked = new Map(
    calibratedRanking(probes, PARAMS).map((item) => [item.threadId, item])
  );
  for (const probe of probes) {
    const semanticOnly = probabilityOf(PARAMS, semanticOnlyVectorOf(probe));
    const full = probabilityOf(PARAMS, featureVectorOf(probe));
    const result = ranked.get(probe.threadId);
    assert.equal(result?.admitted, admits(semanticOnly, PARAMS.cuts.low));
    assert.ok(full >= semanticOnly);
  }
});

test("ties on p are broken by the best reranker score, then by threadId", () => {
  const noRerankerWeight: ModelParams = {
    ...PARAMS,
    weights: [3, 2, 0, 0.5, 1, 6, 0.5]
  };
  const ranked = calibratedRanking(
    [
      features("T2", 0.5, 0.5, 0.2, 0, 0, 0, 0),
      features("T1", 0.5, 0.5, 0.2, 0, 0, 0, 0),
      features("T3", 0.5, 0.5, 0.5, 0, 0, 0, 0)
    ],
    noRerankerWeight
  );
  assert.deepEqual(
    ranked.map((item) => item.threadId),
    ["T3", "T1", "T2"]
  );
});

test("H1_FALLBACK keeps the M0 order and bands only the M0-admitted threads", () => {
  const m0 = [
    { threadId: "M", score: 0.85, admitted: true },
    { threadId: "N", score: 0.4, admitted: true },
    { threadId: "O", score: 0.1, admitted: true },
    { threadId: "Q", score: 0.9, admitted: false }
  ];
  assert.deepEqual(
    fallbackRanking(m0, PARAMS).map((item) => [item.threadId, item.band]),
    [
      ["M", "high"],
      ["N", "low"],
      ["O", undefined],
      ["Q", undefined]
    ]
  );
});

const EMPTY_INPUT: VariantInput = {
  query: "query",
  channels: { identities: [], passages: [], lexical: [] },
  reranker: new FakeRerankingProvider(),
  judgments: {},
  production: { effectiveQuery: "query", limit: 5, results: [] }
};

test("the H1 variants need the capture fit and the case fold", () => {
  const fit = {
    folds: [{ ...PARAMS, fold: 0 } satisfies FoldModelParams]
  } as unknown as FitResult;
  assert.throws(
    () => foldParamsOf(EMPTY_INPUT),
    /need the capture's fit and the case fold/
  );
  assert.throws(
    () => foldParamsOf({ ...EMPTY_INPUT, fit }),
    /need the capture's fit and the case fold/
  );
  assert.deepEqual(
    foldParamsOf({ ...EMPTY_INPUT, fit, fold: 0 }),
    fit.folds[0]
  );
  assert.throws(
    () => foldParamsOf({ ...EMPTY_INPUT, fit, fold: 3 }),
    /no parameters for fold 3/
  );
});
