import assert from "node:assert/strict";
import test from "node:test";
import {
  adoptedOrderingOf,
  bestIndexOf,
  curveFinalists,
  gainPercentOf,
  impliedPairsPerSecond,
  maxAbsoluteDifference,
  maxViableK,
  PAIR_ORDERINGS,
  passSecondsOf,
  recallCountOf,
  recallRatioOf,
  rerankBudgetOf,
  sameSequence,
  scoresInOriginalOrder,
  viableKs,
  type CurveGroup
} from "../scripts/memory-eval/t0-funnel-math.js";

const APPROXIMATE_TOLERANCE = 1e-9;

function group(
  groupId: string,
  fusion: number,
  bestPassageRank?: number,
  recordId = `${groupId}-record`
): CurveGroup {
  return { groupId, recordId, fusion, bestPassageRank };
}

test("B follows v * (1.2 * M0 - f_interp - 3 * f_passo), floored", () => {
  // Scenario: v 7 pairs/s, M0 18.2 s, f_interp 0.5 s, f_passo 0.6 s. 7 * 19.54 = 136.78.
  assert.equal(
    rerankBudgetOf({
      pairsPerSecond: 7,
      m0Seconds: 18.2,
      interpretationSeconds: 0.5,
      passSeconds: 0.6
    }),
    136
  );
});

test("B is exact when the product is an integer", () => {
  // Scenario: v 10 pairs/s, M0 10 s, no interpretation and no pass cost. 10 * 12 = 120.
  assert.equal(
    rerankBudgetOf({
      pairsPerSecond: 10,
      m0Seconds: 10,
      interpretationSeconds: 0,
      passSeconds: 0
    }),
    120
  );
});

test("B is zero when the bracket is not positive", () => {
  // Scenario: M0 1 s cannot pay for the interpretation and three passes. 1.2 - 0.5 - 1.5 < 0.
  assert.equal(
    rerankBudgetOf({
      pairsPerSecond: 7,
      m0Seconds: 1,
      interpretationSeconds: 0.5,
      passSeconds: 0.5
    }),
    0
  );
});

test("the viable grid keeps K with 3K <= floor(B / 2)", () => {
  // Scenario B 136: the limit is 68, so K <= 22.67 and the grid keeps 8 to 20.
  assert.deepEqual(viableKs(136), [8, 10, 12, 15, 20]);
});

test("the viable grid keeps K = 8 at the exact boundary", () => {
  // Scenario B 48: the limit is 24, and 3 * 8 = 24 fits.
  assert.deepEqual(viableKs(48), [8]);
});

test("no K is viable below the boundary", () => {
  // Scenario B 47: the limit is 23, and 3 * 8 = 24 does not fit.
  assert.deepEqual(viableKs(47), []);
});

test("K_max is the largest viable K", () => {
  assert.equal(maxViableK(136), 20);
});

test("K_max is null when the grid is empty", () => {
  assert.equal(maxViableK(47), null);
});

test("f_passo of one case removes interpretation and the measured reranker time", () => {
  // Scenario: end-to-end 18 s, f_interp 0.5 s, reranker measured at 17 s. 18 - 0.5 - 17 = 0.5.
  const value = passSecondsOf({
    e2eSeconds: 18,
    interpretationSeconds: 0.5,
    rerankSeconds: 17
  });
  assert.ok(Math.abs(value - 0.5) < APPROXIMATE_TOLERANCE);
});

test("the implied original throughput is pairs over measured reranker time", () => {
  // Scenario: 120 pairs in 18.75 s measured live, which implies 6.4 pairs/s.
  const value = impliedPairsPerSecond(120, 18.75);
  assert.ok(Math.abs(value - 6.4) < APPROXIMATE_TOLERANCE);
});

test("the gain of the size order is measured in percent", () => {
  // Scenario: 10 pairs/s in the original order, 12 pairs/s sorted by size, a 20 percent gain.
  const gain = gainPercentOf(10, 12);
  assert.ok(Math.abs(gain - 20) < APPROXIMATE_TOLERANCE);
});

test("the size order enters the budget below the 20 percent threshold", () => {
  assert.equal(adoptedOrderingOf(19.9), "original");
});

test("the size order enters the budget at the 20 percent threshold", () => {
  assert.equal(adoptedOrderingOf(20), "bySize");
});

test("the original order keeps the input indexes", () => {
  assert.deepEqual(PAIR_ORDERINGS.original(["aaaa", "a", "aa"]), [0, 1, 2]);
});

test("the size order sends the shortest document first", () => {
  assert.deepEqual(PAIR_ORDERINGS.bySize(["aaaa", "a", "aa"]), [1, 2, 0]);
});

test("the size order keeps the input order on equal lengths", () => {
  assert.deepEqual(PAIR_ORDERINGS.bySize(["ab", "cd"]), [0, 1]);
});

test("scores of a reordered call return to the original order", () => {
  assert.deepEqual(
    scoresInOriginalOrder([2, 0, 1], [0.3, 0.1, 0.2]),
    [0.1, 0.2, 0.3]
  );
});

test("a reordered call with a missing score is refused", () => {
  assert.throws(
    () => scoresInOriginalOrder([0, 1], [0.1]),
    /unexpected score count/
  );
});

test("the largest absolute difference between two score lists", () => {
  assert.equal(maxAbsoluteDifference([1, 2], [1.5, 2]), 0.5);
});

test("the best index takes the first of equal scores", () => {
  assert.equal(bestIndexOf([0.2, 0.9, 0.9, 0.1]), 1);
});

test("finalists take ceil(K/2) by fusion, then the best passage ranks", () => {
  // Scenario K 4: A and B by fusion; then E (passage 1) and C (passage 2) from the rest.
  const groups = [
    group("A", 0.9, 1),
    group("B", 0.8),
    group("C", 0.1, 2),
    group("D", 0.05, 3),
    group("E", 0.01, 1)
  ];
  assert.deepEqual(curveFinalists(groups, 4), ["A", "B", "E", "C"]);
});

test("an odd K gives the extra fusion slot to fusion", () => {
  // Scenario K 5: three by fusion (A, B, C); then E (passage 1) and D (passage 3).
  const groups = [
    group("A", 0.9, 1),
    group("B", 0.8),
    group("C", 0.1, 2),
    group("D", 0.05, 3),
    group("E", 0.01, 1)
  ];
  assert.deepEqual(curveFinalists(groups, 5), ["A", "B", "C", "E", "D"]);
});

test("a K above the candidate count keeps every candidate", () => {
  // Scenario K 8 with three candidates: all three, in fusion order.
  const groups = [group("A", 0.9, 1), group("B", 0.8), group("C", 0.1, 2)];
  assert.deepEqual(curveFinalists(groups, 8), ["A", "B", "C"]);
});

test("a fusion tie goes to the smaller recordId", () => {
  // Scenario K 1: X and Y tie on fusion; Y has the smaller recordId.
  const groups = [
    group("X", 0.5, undefined, "r2"),
    group("Y", 0.5, undefined, "r1")
  ];
  assert.deepEqual(curveFinalists(groups, 1), ["Y"]);
});

test("a passage tie goes to the higher fusion", () => {
  // Scenario K 2: R takes the fusion slot; Q and P tie on passage rank 2, and Q has more fusion.
  const groups = [group("R", 0.9), group("P", 0.2, 2), group("Q", 0.4, 2)];
  assert.deepEqual(curveFinalists(groups, 2), ["R", "Q"]);
});

test("a group without passage evidence comes after every group with one", () => {
  // Scenario K 4: N has no passage, so it is picked after C in the passage stage.
  const groups = [
    group("A", 0.9, 1),
    group("B", 0.8, 2),
    group("N", 0.7),
    group("C", 0.1, 3)
  ];
  assert.deepEqual(curveFinalists(groups, 4), ["A", "B", "C", "N"]);
});

test("recall counts relevant finalists against relevant candidates", () => {
  // Scenario: relevant A and C; finalists A, B, E, C; candidates A to E.
  const count = recallCountOf(
    new Set(["A", "C"]),
    ["A", "B", "E", "C"],
    ["A", "B", "C", "D", "E"]
  );
  assert.deepEqual(count, { relevantFound: 2, relevantTotal: 2 });
});

test("recall reports the missed relevant candidate", () => {
  // Scenario: relevant A and C; finalists A and B. C is a candidate that the cut missed.
  const count = recallCountOf(
    new Set(["A", "C"]),
    ["A", "B"],
    ["A", "B", "C", "D", "E"]
  );
  assert.equal(recallRatioOf(count), 0.5);
});

test("recall is null when no candidate is relevant", () => {
  assert.equal(recallRatioOf({ relevantFound: 0, relevantTotal: 0 }), null);
});

test("equal sequences are the same and different ones are not", () => {
  assert.equal(sameSequence(["a", "b"], ["a", "b"]), true);
  assert.equal(sameSequence(["a"], ["a", "b"]), false);
  assert.equal(sameSequence([], []), true);
});
