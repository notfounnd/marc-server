import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetOf,
  expectedScopedPairs,
  gateOfPath,
  isUsableBudget,
  LATENCY_FACTOR,
  overheadMsOf,
  pairsMatch,
  pairsPerSecondOf,
  pairsStable,
  REFERENCE_P95_MS,
  rotatedOrder,
  TIMED_PER_CASE
} from "../scripts/memory-eval/deep-latency-math.js";
import { REFERENCE_LAYERS } from "../scripts/memory-eval/t0-funnel-prestudy.js";

test("the gate allows the median up to 1.2 times the M0 reference of the same queries, and no further", () => {
  assert.equal(LATENCY_FACTOR, 1.2);
  assert.deepEqual(gateOfPath({ medianMs: 12000, referenceMedianMs: 10000 }), {
    limitMs: 12000,
    passed: true
  });
  assert.deepEqual(gateOfPath({ medianMs: 12001, referenceMedianMs: 10000 }), {
    limitMs: 12000,
    passed: false
  });
  assert.deepEqual(gateOfPath({ medianMs: null, referenceMedianMs: 10000 }), {
    limitMs: null,
    passed: null
  });
  assert.deepEqual(gateOfPath({ medianMs: 5000, referenceMedianMs: null }), {
    limitMs: null,
    passed: null
  });
});

test("the informative p95 reference is 5 seconds, and it gates nothing", () => {
  assert.equal(REFERENCE_P95_MS, 5000);
});

test("the overhead is the median of total time minus reranker time, over the scoped samples", () => {
  const samples = [
    { e2eMs: 1000, rerankMs: 400, pairs: 10 },
    { e2eMs: 2000, rerankMs: 500, pairs: 10 },
    { e2eMs: 1500, rerankMs: 700, pairs: 10 }
  ];
  assert.equal(overheadMsOf(samples), 800);
});

test("the reranker rate is the pairs over the reranker seconds, over the same samples", () => {
  const samples = [
    { e2eMs: 900, rerankMs: 500, pairs: 100 },
    { e2eMs: 1500, rerankMs: 1000, pairs: 200 }
  ];
  assert.equal(pairsPerSecondOf(samples), 200);
  assert.equal(pairsPerSecondOf([{ e2eMs: 10, rerankMs: 0, pairs: 0 }]), null);
});

test("B' is the floor of ((1.2 x M0 - overhead) / 1000) x rate, from the same run", () => {
  assert.equal(
    budgetOf({
      referenceMedianMs: 10000,
      overheadMs: 2000,
      pairsPerSecond: 20
    }),
    200
  );
  assert.equal(
    budgetOf({
      referenceMedianMs: 10000,
      overheadMs: 2500,
      pairsPerSecond: 20
    }),
    190
  );
  assert.equal(
    budgetOf({
      referenceMedianMs: 10000,
      overheadMs: 2000,
      pairsPerSecond: 20.5
    }),
    205
  );
  assert.equal(
    budgetOf({ referenceMedianMs: null, overheadMs: 2000, pairsPerSecond: 20 }),
    null
  );
  assert.equal(
    budgetOf({
      referenceMedianMs: 10000,
      overheadMs: null,
      pairsPerSecond: 20
    }),
    null
  );
  assert.equal(
    budgetOf({
      referenceMedianMs: 10000,
      overheadMs: 2000,
      pairsPerSecond: null
    }),
    null
  );
});

test("a recuo budget is usable only from 1 to 231: 0, 232 and no budget are refused", () => {
  assert.equal(isUsableBudget(1), true);
  assert.equal(isUsableBudget(231), true);
  assert.equal(isUsableBudget(0), false);
  assert.equal(isUsableBudget(232), false);
  assert.equal(isUsableBudget(-5), false);
  assert.equal(isUsableBudget(null), false);
});

test("the scoped pairs of a budget are the scope up to the budget", () => {
  assert.equal(expectedScopedPairs(408, 232), 232);
  assert.equal(expectedScopedPairs(9, 232), 9);
});

test("the pairs of a path match the replay only when every sample sent the expected count", () => {
  assert.equal(pairsMatch([{ pairs: 9 }, { pairs: 9 }], 9), true);
  assert.equal(pairsMatch([{ pairs: 9 }, { pairs: 8 }], 9), false);
  assert.equal(pairsStable([{ pairs: 161 }, { pairs: 161 }]), true);
  assert.equal(pairsStable([{ pairs: 161 }, { pairs: 160 }]), false);
});

test("the interleaving rotates the order by one path per round, and the rounds are three", () => {
  const order = ["m0", "scoped", "unscoped"] as const;
  assert.equal(TIMED_PER_CASE, 3);
  assert.deepEqual(rotatedOrder(order, 0), ["m0", "scoped", "unscoped"]);
  assert.deepEqual(rotatedOrder(order, 1), ["scoped", "unscoped", "m0"]);
  assert.deepEqual(rotatedOrder(order, 2), ["unscoped", "m0", "scoped"]);
  assert.deepEqual(rotatedOrder(order, 3), ["m0", "scoped", "unscoped"]);
});

test("the M0 of the latency study is the E3 reference: layer 0 only", () => {
  assert.deepEqual([...REFERENCE_LAYERS], [0]);
});
