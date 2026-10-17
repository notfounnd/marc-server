import assert from "node:assert/strict";
import test from "node:test";
import {
  caseContribution,
  interpretationContribution,
  latencySummary,
  metricValue,
  pendingPairs,
  sumContributions,
  type CaseInput
} from "../scripts/memory-eval/metrics.js";
import { evaluateVariant } from "../scripts/memory-eval/evaluation.js";

/** One row of a scenario: thread, admission, and the score the variant gives it. */
type Row = [threadId: string, admitted: boolean, score: number];

function input(
  caseId: string,
  style: CaseInput["style"],
  judgments: CaseInput["judgments"],
  order: Row[]
): CaseInput {
  return {
    caseId,
    family: `family-${caseId}`,
    style,
    judgments,
    results: order.map(([threadId, admitted, score]) => ({
      threadId,
      score,
      admitted
    }))
  };
}

test("nDCG@10 and MRR match the hand-computed values", () => {
  const item = input("N1", "direct", { A: 3, B: 0, C: 2 }, [
    ["B", true, 1],
    ["A", true, 1],
    ["C", true, 1]
  ]);
  const contribution = caseContribution(item);
  // Grades in admitted order: 0, 3, 2. DCG = 7/log2(3) + 3/log2(4).
  const dcg = 7 / Math.log2(3) + 3 / Math.log2(4);
  // Ideal order: 3, 2. IDCG = 7/log2(2) + 3/log2(3).
  const idcg = 7 / Math.log2(2) + 3 / Math.log2(3);
  assert.ok(
    Math.abs((metricValue(contribution.ndcg10) ?? NaN) - dcg / idcg) < 1e-12
  );
  assert.equal(metricValue(contribution.mrr), 0.5);
  assert.equal(metricValue(contribution.top1Target), 0);
  assert.equal(metricValue(contribution.top1Relevant), 0);
  assert.equal(metricValue(contribution.top3Target), 1);
});

test("nDCG leaves out a case without any judged grade above zero", () => {
  const item = input("N2", "negative", {}, [["X", false, 0.1]]);
  assert.equal(caseContribution(item).ndcg10.den, 0);
});

test("admission precision, recall, exposure and abstention", () => {
  const positive = input("P1", "indirect", { C: 2, D: 3, B: 0 }, [
    ["C", true, 1],
    ["B", true, 1],
    ["D", false, 0.1]
  ]);
  const contribution = caseContribution(positive);
  assert.equal(metricValue(contribution.admissionPrecision), 0.5);
  assert.equal(metricValue(contribution.admissionRecall), 0.5);
  assert.equal(metricValue(contribution.incidentalExposure), 1);

  const negative = input("Q1", "negative", {}, [["E", false, 0.1]]);
  const silent = caseContribution(negative);
  assert.equal(metricValue(silent.abstentionCorrect), 1);
  assert.equal(silent.admissionPrecision.den, 0);

  const noisy = input("Q2", "negative", {}, [["E", true, 1]]);
  assert.equal(metricValue(caseContribution(noisy).abstentionCorrect), 0);
});

test("full-list diagnostics count relevant threads in the first ten positions", () => {
  const item = input("F1", "direct", { C: 2, D: 3 }, [
    ["D", false, 0.1],
    ["C", true, 1]
  ]);
  const contribution = caseContribution(item);
  assert.equal(metricValue(contribution.fullRecall10), 1);
  // The first relevant thread of the full list is in first place.
  assert.equal(metricValue(contribution.fullMrr10), 1);
});

test("an unjudged thread admitted at 11th place leaves M0 incomplete with a pending pair", () => {
  const admitted: Row[] = Array.from(
    { length: 11 },
    (_, index): Row => [`T${index + 1}`, true, 1]
  );
  const judgments = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [`T${index + 1}`, 0] as const)
  );
  const item = input("L1", "direct", judgments, admitted);

  assert.deepEqual(pendingPairs([item], true), [
    { caseId: "L1", threadId: "T11", reach: "admittedList" }
  ]);
  const evaluation = evaluateVariant("M0", [item]);
  assert.equal(evaluation.status, "incomplete");
  assert.equal(evaluation.scopes.total?.top1Target, null);
});

test("D0 requires only the first ten positions of the full list", () => {
  const admitted: Row[] = Array.from(
    { length: 11 },
    (_, index): Row => [`T${index + 1}`, true, 1]
  );
  const judgments = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [`T${index + 1}`, 0] as const)
  );
  const eleventhOnly = input("D1", "direct", judgments, admitted);
  assert.equal(evaluateVariant("D0", [eleventhOnly]).status, "complete");

  const fifthUnjudged = input("D2", "direct", { T1: 0 }, [
    ["T1", true, 1],
    ["T2", true, 1],
    ["T3", true, 1],
    ["T4", true, 1],
    ["T5", true, 1]
  ]);
  const pending = evaluateVariant("D0", [fifthUnjudged]);
  assert.equal(pending.status, "incomplete");
  assert.equal(pending.pending[0]?.reach, "fullTop10");
});

test("revision 2: an unjudged thread in first place keeps M0 without a verdict until it is judged", () => {
  const before = input("R1", "direct", { T: 3 }, [
    ["U", true, 1],
    ["T", true, 1]
  ]);
  assert.equal(evaluateVariant("M0", [before]).status, "incomplete");
  assert.equal(evaluateVariant("M0", [before]).scopes.total?.top1Target, null);

  const after = input("R1", "direct", { T: 3, U: 0 }, [
    ["U", true, 1],
    ["T", true, 1]
  ]);
  const evaluation = evaluateVariant("M0", [after]);
  assert.equal(evaluation.status, "complete");
  assert.equal(evaluation.scopes.total?.top1Target, 0);
});

test("interpretation counts follow the five definitions", () => {
  const corrected = interpretationContribution(
    {
      originalQuery: "brutalismp",
      interpretation: {
        effectiveQuery: "brutalism",
        suggestedQuery: "brutalism"
      }
    },
    { effectiveQuery: "brutalism", suggestedQuery: "brutalism" }
  );
  assert.deepEqual(corrected.correctionCorrect, { num: 1, den: 1 });
  assert.deepEqual(corrected.correctionUndue, { num: 0, den: 0 });
  assert.deepEqual(corrected.suggestionCorrect, { num: 1, den: 1 });
  assert.deepEqual(corrected.suggestionMissing, { num: 0, den: 1 });

  const undue = interpretationContribution(
    { originalQuery: "toogle", interpretation: { effectiveQuery: "toogle" } },
    { effectiveQuery: "toogle", suggestedQuery: "toggle" }
  );
  assert.deepEqual(undue.correctionUndue, { num: 0, den: 1 });
  assert.deepEqual(undue.suggestionMissing, { num: 1, den: 1 });
  assert.deepEqual(undue.suggestionUndue, { num: 0, den: 0 });
});

test("latency median and nearest-rank p95", () => {
  assert.deepEqual(latencySummary([1, 2, 3, 4, 5]), {
    samples: 5,
    medianMs: 3,
    p95Ms: 5
  });
  assert.deepEqual(latencySummary([1, 2, 3, 4]), {
    samples: 4,
    medianMs: 2.5,
    p95Ms: 4
  });
  assert.deepEqual(latencySummary([]), {
    samples: 0,
    medianMs: null,
    p95Ms: null
  });
});

test("contributions add up across cases", () => {
  const first = caseContribution(
    input("S1", "direct", { A: 3 }, [["A", true, 1]])
  );
  const second = caseContribution(
    input("S2", "direct", { B: 3 }, [["A", true, 1]])
  );
  assert.equal(sumContributions([first, second]).top1Target.num, 1);
  assert.equal(sumContributions([first, second]).top1Target.den, 2);
});
