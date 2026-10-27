import assert from "node:assert/strict";
import test from "node:test";
import { withCommonReference } from "../scripts/memory-eval/evaluation.js";
import {
  caseContribution,
  type CaseInput
} from "../scripts/memory-eval/metrics.js";
import type { EvalCase, EvalDataset } from "../scripts/memory-eval/dataset.js";
import { dataset } from "./memory-eval-capture-fixtures.js";

/** A group that only the depth-2 layer grades: it is relevant for the reference, and not for depth 0. */
const DEEP_GROUP = "deep-only-group-cccc3333";
/** A group that the depth-0 variant admits with grade 0. */
const SHALLOW_GROUP = "shallow-admitted-group-dddd4444";

test("the common reference fixes one relevant set for both variants and limits each numerator to its depth", () => {
  const source = caseOf("A1");
  const deep = withDeepGrade(source);
  const shallow: CaseInput = {
    caseId: "A1",
    family: "family",
    style: "implicit",
    judgments: {},
    results: [{ threadId: SHALLOW_GROUP, score: 0.9, admitted: true }],
    judgedDepth: 0,
    gradesByLayer: { 0: {}, 1: {}, 2: {} }
  };
  const deepInput: CaseInput = {
    caseId: "A1",
    family: "family",
    style: "implicit",
    judgments: { [DEEP_GROUP]: 3 },
    results: [{ threadId: DEEP_GROUP, score: 0.9, admitted: true }],
    judgedDepth: 2,
    gradesByLayer: { 0: {}, 1: {}, 2: { [DEEP_GROUP]: 3 } }
  };

  const referenced = withCommonReference(deep, [shallow], [deepInput]);
  const base = referenced.baseline[0];
  const cand = referenced.candidate[0];
  assert.ok(base !== undefined && cand !== undefined);
  assert.equal(
    base.referenceDepth,
    2,
    "both sides use the largest depth of the comparison"
  );
  assert.equal(cand.referenceDepth, 2);

  const baseRecall = caseContribution(base).admissionRecall;
  const candRecall = caseContribution(cand).admissionRecall;
  assert.equal(
    baseRecall.den,
    candRecall.den,
    "one denominator for both variants"
  );
  assert.ok(candRecall.den >= 1, "the deep group is part of the relevant set");
  assert.equal(
    baseRecall.num,
    0,
    "depth 0 cannot count the evidence of layer 2"
  );
  assert.equal(candRecall.num, 1, "depth 2 counts its own admitted evidence");
});

function caseOf(caseId: string): EvalCase {
  const found = dataset.cases.find((item) => item.id === caseId);
  if (found === undefined)
    throw new Error(`The fixture has no case ${caseId}.`);
  return found;
}

/** The fixture dataset with the deep group graded in layer 2 of case A1. */
function withDeepGrade(source: EvalCase): EvalDataset {
  return {
    ...dataset,
    cases: dataset.cases.map((evalCase) =>
      evalCase.id === source.id
        ? { ...evalCase, layerJudgments: { 2: { [DEEP_GROUP]: 3 } } }
        : evalCase
    )
  };
}
