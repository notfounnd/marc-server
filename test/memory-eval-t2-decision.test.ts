import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseK,
  cutsOf,
  ratioIntervalOf,
  recallOf,
  survivedOf,
  type CaseTrials,
  type CutPair
} from "../scripts/memory-eval/t2-decision.js";

/** The same trial at depths 0, 1 and 2 of one case, with the finalists that each K keeps. */
function trialsOf(
  relevant: string[],
  keptByK: Record<number, string[]>
): CaseTrials {
  const depth = {
    relevant,
    keptByK: new Map(
      Object.entries(keptByK).map(([k, kept]) => [Number(k), kept] as const)
    )
  };
  return new Map([0, 1, 2].map((item) => [item, depth] as const));
}

test("the K of a fold is read from its training folds only: the held-out cases do not move it", () => {
  const folds = new Map([
    ["train", 1],
    ["held", 0]
  ]);
  const withHeldOut = (relevant: string[], kept: Record<number, string[]>) =>
    new Map([
      ["train", trialsOf(["a", "b"], { 8: ["a"], 10: ["a", "b"] })],
      ["held", trialsOf(relevant, kept)]
    ]);

  const before = chooseK({
    trials: withHeldOut(["x"], { 8: [], 10: [] }),
    folds,
    fold: 0,
    grid: [8, 10]
  });
  const after = chooseK({
    trials: withHeldOut(["x", "y"], { 8: ["x"], 10: ["x", "y"] }),
    folds,
    fold: 0,
    grid: [8, 10]
  });

  assert.deepEqual(after, before);
  assert.equal(
    before.k,
    10,
    "the training cases need K = 10 to keep every relevant finalist"
  );
  assert.equal(before.met, true);
});

test("the fallback cuts of a fold are read from its training folds only", () => {
  const folds = new Map([
    ["train", 1],
    ["held", 0]
  ]);
  const training: CutPair[] = [
    { caseId: "train", score: 0.9, label: 1 },
    { caseId: "train", score: 0.7, label: 1 },
    { caseId: "train", score: 0.4, label: 0 },
    { caseId: "train", score: 0.2, label: 0 }
  ];
  const heldA: CutPair[] = [{ caseId: "held", score: 0.5, label: 1 }];
  const heldB: CutPair[] = [{ caseId: "held", score: 0.05, label: 0 }];

  const withA = cutsOf({ pairs: [...training, ...heldA], folds, fold: 0 });
  const withB = cutsOf({ pairs: [...training, ...heldB], folds, fold: 0 });

  assert.deepEqual(withA, withB);
});

test("the recall of a K counts only the relevant groups that are finalists", () => {
  const trials = new Map([
    ["case", trialsOf(["a", "b", "c"], { 8: ["a", "x"] })]
  ]);
  assert.equal(recallOf(["case"], trials, 0, 8), 1 / 3);
  assert.equal(recallOf(["case"], trials, 0, 99), 0);
});

test("evidence survives when a selected passage holds the citation, and not when only another passage of the same section is selected", () => {
  const citation = ["artifacts/analise.md#c31f2fb8008bd5d7"];
  const sameSectionOtherPassage = ["artifacts/analise.md#0a1b2c3d4e5f6071"];
  assert.equal(survivedOf(sameSectionOtherPassage, citation), false);
  assert.equal(
    survivedOf([...sameSectionOtherPassage, ...citation], citation),
    true
  );
});

test("an interval of ratios is undefined without applicable rows, and lies in [0, 1] for proportions", () => {
  assert.equal(ratioIntervalOf([]), undefined);
  assert.equal(ratioIntervalOf([{ family: "f", num: 0, den: 0 }]), undefined);
  const interval = ratioIntervalOf([
    { family: "f1", num: 1, den: 1 },
    { family: "f2", num: 0, den: 1 }
  ]);
  assert.ok(interval !== undefined);
  assert.ok(
    interval.lower >= 0 &&
      interval.upper <= 1 &&
      interval.lower <= interval.upper
  );
});
