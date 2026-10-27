import assert from "node:assert/strict";
import test from "node:test";
import {
  planStepPairs,
  stepAllowance,
  stepPassages,
  validateFunnelBudget
} from "../src/core/memory/funnel-budget.js";
import {
  effectiveIdentityRank,
  evidenceSurvived,
  interleaveUnique,
  selectFinalists,
  selectRerankPassages,
  type FunnelGroup,
  type FunnelRow
} from "../src/core/memory/funnel-selection.js";

test("a budget of 3K <= floor(B / 2) is accepted at the boundary", () => {
  // Scenario: B 48 gives a limit of 24, and K 8 needs 24.
  assert.doesNotThrow(() => validateFunnelBudget(48, 8));
});

test("a budget that cannot give every finalist three passages is refused", () => {
  // Scenario: B 40 gives a limit of 20, and K 8 needs 24.
  assert.throws(() => validateFunnelBudget(40, 8), /three passages/);
});

test("a step takes half of the balance when another step follows", () => {
  // Scenario: 12 pairs with 4 already spent leave 8; the next step gets 4.
  assert.equal(stepAllowance(12, 4, false), 4);
});

test("the last step takes the whole balance", () => {
  assert.equal(stepAllowance(12, 4, true), 8);
});

test("a step with no balance gets nothing", () => {
  assert.equal(stepAllowance(12, 12, false), 0);
});

test("a step plans at least three passages per finalist", () => {
  // Scenario: an allowance of 4 for K 2 would give 2 passages, but the minimum is 3.
  assert.equal(stepPassages(4, 2), 3);
});

test("a step plans the share of the allowance per finalist", () => {
  // Scenario: an allowance of 20 for K 2 gives 10 passages per finalist.
  assert.equal(stepPassages(20, 2), 10);
});

test("three steps with disjoint pairs stay within their allowances", () => {
  // Scenario: step one scores A1 and A2; step two scores B1 and B2; step three scores C1 and C2.
  const first = planStepPairs({
    finalists: [{ groupId: "A", recordIds: ["A1", "A2"] }],
    cached: new Set(),
    allowance: 2
  });
  const second = planStepPairs({
    finalists: [{ groupId: "B", recordIds: ["B1", "B2"] }],
    cached: new Set(),
    allowance: 2
  });
  const third = planStepPairs({
    finalists: [{ groupId: "C", recordIds: ["C1", "C2"] }],
    cached: new Set(),
    allowance: 2
  });
  assert.deepEqual(
    [...first.scored, ...second.scored, ...third.scored],
    ["A1", "A2", "B1", "B2", "C1", "C2"]
  );
  assert.equal(first.spent + second.spent + third.spent, 6);
});

test("a pair scored by an earlier step is reused at no cost", () => {
  // Scenario: A1 was scored earlier; the step scores only A2 with an allowance of 1.
  const plan = planStepPairs({
    finalists: [{ groupId: "A", recordIds: ["A1", "A2"] }],
    cached: new Set(["A1"]),
    allowance: 1
  });
  assert.deepEqual(plan.cached, ["A1"]);
  assert.deepEqual(plan.scored, ["A2"]);
  assert.equal(plan.spent, 1);
  assert.equal(plan.truncated, false);
});

test("the pairs scored by a step never exceed its allowance, even when truncated", () => {
  // Scenario: four pairs requested with an allowance of 2: two are scored, two are unscored.
  const plan = planStepPairs({
    finalists: [{ groupId: "A", recordIds: ["A1", "A2", "A3", "A4"] }],
    cached: new Set(),
    allowance: 2
  });
  assert.equal(plan.spent, 2);
  assert.deepEqual(plan.unscored, ["A3", "A4"]);
  assert.equal(plan.truncated, true);
});

test("a finalist with no usable pair is dropped and never kept", () => {
  // Scenario: the allowance of 2 is used by A. B gets no pair and is dropped.
  const plan = planStepPairs({
    finalists: [
      { groupId: "A", recordIds: ["A1", "A2"] },
      { groupId: "B", recordIds: ["B1"] }
    ],
    cached: new Set(),
    allowance: 2
  });
  assert.deepEqual(plan.keptFinalists, ["A"]);
  assert.deepEqual(plan.droppedFinalists, ["B"]);
});

test("an identity repeated inside one step is reused, not scored again", () => {
  // Scenario: the same record is requested by two finalists; it is scored once.
  const plan = planStepPairs({
    finalists: [
      { groupId: "A", recordIds: ["X"] },
      { groupId: "B", recordIds: ["X"] }
    ],
    cached: new Set(),
    allowance: 5
  });
  assert.deepEqual(plan.scored, ["X"]);
  assert.deepEqual(plan.cached, ["X"]);
});

test("the finalists by fusion come first, ties broken by groupId", () => {
  // Scenario: K 1 gives ceil(1/2) = 1 fusion slot; X and Y tie, and X has the smaller groupId.
  const groups: FunnelGroup[] = [
    { groupId: "Y", fusion: 0.5 },
    { groupId: "X", fusion: 0.5 }
  ];
  assert.deepEqual(selectFinalists(groups, 1), ["X"]);
});

test("the dense slots go to the best passage rank, and groups without passage come last", () => {
  // Scenario: K 4 takes A and B by fusion; C (passage 2) and D (passage 1) fill the dense slots;
  // N has no passage and comes after both.
  const groups: FunnelGroup[] = [
    { groupId: "A", fusion: 0.9, bestPassageRank: 5 },
    { groupId: "B", fusion: 0.8, bestPassageRank: 6 },
    { groupId: "C", fusion: 0.1, bestPassageRank: 2 },
    { groupId: "D", fusion: 0.05, bestPassageRank: 1 },
    { groupId: "N", fusion: 0.02 }
  ];
  assert.deepEqual(selectFinalists(groups, 4), ["A", "B", "D", "C"]);
});

test("the dense ties go to the higher fusion, then to the groupId", () => {
  // Scenario: P and Q tie on passage rank 2; Q has the higher fusion and takes the slot.
  const groups: FunnelGroup[] = [
    { groupId: "R", fusion: 0.9 },
    { groupId: "P", fusion: 0.2, bestPassageRank: 2 },
    { groupId: "Q", fusion: 0.4, bestPassageRank: 2 }
  ];
  assert.deepEqual(selectFinalists(groups, 2), ["R", "Q"]);
});

test("the passages of a finalist are chosen by cosine, ties by recordId", () => {
  // Scenario: P1 and P2 have the same vector, so P1 wins by recordId; P3 is the least similar.
  const rows: FunnelRow[] = [
    row("P2", "passage", [1, 0]),
    row("P1", "passage", [1, 0]),
    row("P3", "passage", [0, 1])
  ];
  assert.deepEqual(selectRerankPassages([1, 0], rows, 2), ["P1", "P2"]);
});

test("a group without a passage in the allowed layers uses its identity as its one slot", () => {
  // Scenario: the group has only an identity row, so the identity fills the one slot.
  const rows: FunnelRow[] = [row("I1", "identity", [1, 0])];
  assert.deepEqual(selectRerankPassages([1, 0], rows, 3), ["I1"]);
});

test("the identity does not enter when the group has a passage", () => {
  // Scenario: the identity is the closest vector, but a passage exists and is the only choice.
  const rows: FunnelRow[] = [
    row("I1", "identity", [1, 0]),
    row("P1", "passage", [0.1, 0.9])
  ];
  assert.deepEqual(selectRerankPassages([1, 0], rows, 3), ["P1"]);
});

test("the FTS recuo uses the same number of pairs as the cosine selection", () => {
  // Scenario: four passages, limit 3. Cosine picks three; the FTS interleave also picks three.
  const rows: FunnelRow[] = [
    row("P1", "passage", [1, 0]),
    row("P2", "passage", [0.9, 0.1]),
    row("P3", "passage", [0.8, 0.2]),
    row("P4", "passage", [0.1, 0.9])
  ];
  const cosine = selectRerankPassages([1, 0], rows, 3, "cosine");
  const fts = selectRerankPassages(
    [1, 0],
    rows,
    3,
    "cosine-fts",
    new Set(["P4"])
  );
  assert.equal(cosine.length, 3);
  assert.equal(fts.length, cosine.length);
});

test("the FTS recuo alternates cosine and FTS matches without repetition", () => {
  // Scenario: cosine order P1, P2, P3; FTS matches P3. The interleave gives P1, P3, P2.
  assert.deepEqual(interleaveUnique(["P1", "P2", "P3"], ["P3"], 3), [
    "P1",
    "P3",
    "P2"
  ]);
});

test("the interleave keeps going on one list when the other runs out", () => {
  assert.deepEqual(interleaveUnique(["P1", "P2", "P3"], [], 3), [
    "P1",
    "P2",
    "P3"
  ]);
});

test("a group with no identity uses the rank of its best passage", () => {
  assert.equal(effectiveIdentityRank(undefined, 4), 4);
  assert.equal(effectiveIdentityRank(2, 4), 2);
});

test("evidence survives only when a selected passage is one that holds the quote", () => {
  // Scenario: the section has two passages; P1 holds the quote and P2 does not.
  assert.equal(evidenceSurvived(["P2"], ["P1"]), false);
  assert.equal(evidenceSurvived(["P1"], ["P1"]), true);
});

function row(
  recordId: string,
  kind: FunnelRow["kind"],
  vector: number[]
): FunnelRow {
  return { recordId, kind, vector };
}
