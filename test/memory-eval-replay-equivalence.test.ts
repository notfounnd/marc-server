import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedProductionRecall } from "../scripts/memory-eval/capture-types.js";
import {
  deltaSummary,
  equivalenceOf,
  summarizeEquivalence,
  type CaseReplay
} from "../scripts/memory-eval/replay.js";
import type { VariantResult } from "../scripts/memory-eval/variants.js";

const EPSILON = 1e-12;

function closeTo(actual: number | null, expected: number): boolean {
  return actual !== null && Math.abs(actual - expected) < EPSILON;
}

function productionOf(
  scores: Array<[string, number]>
): CapturedProductionRecall {
  return {
    effectiveQuery: "q",
    limit: 50,
    results: scores.map(([threadId, score]) => ({ threadId, score }))
  };
}

function m0Of(scores: Array<[string, number, boolean]>): VariantResult[] {
  return scores.map(([threadId, score, admitted]) => ({
    threadId,
    score,
    admitted
  }));
}

function caseOf(
  caseId: string,
  production: CapturedProductionRecall,
  m0: VariantResult[]
): CaseReplay {
  return {
    caseId,
    effectiveQuery: "q",
    variants: [],
    equivalence: equivalenceOf(production, m0)
  };
}

test("the same order with a 1e-3 score delta passes and reports the delta", () => {
  const production = productionOf([
    ["T1", 0.5],
    ["T2", 0.4]
  ]);
  const m0 = m0Of([
    ["T1", 0.501, true],
    ["T2", 0.4, true]
  ]);

  const equivalence = equivalenceOf(production, m0);
  assert.equal(equivalence.passed, true);
  assert.ok(closeTo(equivalence.maxScoreDelta, 0.001));
  assert.deepEqual(equivalence.replayThreadIds, ["T1", "T2"]);

  const verdict = summarizeEquivalence([caseOf("D1", production, m0)]);
  assert.equal(verdict.equivalence, "passed");
  assert.deepEqual(verdict.failedCaseIds, []);
});

test("a swapped order fails and lists the case, with the delta still reported", () => {
  const production = productionOf([
    ["T1", 0.5],
    ["T2", 0.4]
  ]);
  const swapped = caseOf(
    "S1",
    production,
    m0Of([
      ["T2", 0.4, true],
      ["T1", 0.5, true]
    ])
  );
  const same = caseOf(
    "P1",
    production,
    m0Of([
      ["T1", 0.5, true],
      ["T2", 0.4, true]
    ])
  );

  assert.equal(swapped.equivalence.passed, false);
  assert.ok(closeTo(swapped.equivalence.maxScoreDelta, 0.1));

  const verdict = summarizeEquivalence([same, swapped]);
  assert.equal(verdict.equivalence, "failed");
  assert.deepEqual(verdict.failedCaseIds, ["S1"]);
});

test("only admitted threads gate the sequence, cut to the production limit", () => {
  const production = productionOf([
    ["T1", 0.5],
    ["T2", 0.4]
  ]);
  const m0 = m0Of([
    ["T9", 0.9, false],
    ["T1", 0.5, true],
    ["T2", 0.4, true]
  ]);

  const equivalence = equivalenceOf(production, m0);
  assert.equal(equivalence.passed, true);
  assert.deepEqual(equivalence.replayThreadIds, ["T1", "T2"]);
});

test("delta summary matches hand-computed values for even and odd counts", () => {
  const even = deltaSummary([0, 0.001, 0.002, 0.003]);
  assert.equal(even.cases, 4);
  assert.ok(closeTo(even.median, 0.0015));
  assert.ok(closeTo(even.p95, 0.003));
  assert.ok(closeTo(even.max, 0.003));

  const odd = deltaSummary([0.5, 0.1, 0.9]);
  assert.equal(odd.cases, 3);
  assert.ok(closeTo(odd.median, 0.5));
  assert.ok(closeTo(odd.p95, 0.9));
  assert.ok(closeTo(odd.max, 0.9));
});

test("p95 is the nearest rank over twenty values, and an empty corpus has no summary", () => {
  const values = Array.from({ length: 20 }, (_, index) => (index + 1) * 0.001);
  const summary = deltaSummary(values);
  assert.equal(summary.cases, 20);
  assert.ok(closeTo(summary.median, 0.0105));
  assert.ok(closeTo(summary.p95, 0.019));
  assert.ok(closeTo(summary.max, 0.02));

  assert.deepEqual(deltaSummary([]), {
    cases: 0,
    median: null,
    p95: null,
    max: null
  });
});

test("the corpus summary carries the delta statistics of its cases", () => {
  const production = productionOf([
    ["T1", 0.5],
    ["T2", 0.4]
  ]);
  const cases = [
    caseOf(
      "A",
      production,
      m0Of([
        ["T1", 0.501, true],
        ["T2", 0.4, true]
      ])
    ),
    caseOf(
      "B",
      production,
      m0Of([
        ["T2", 0.4, true],
        ["T1", 0.5, true]
      ])
    ),
    caseOf(
      "C",
      production,
      m0Of([
        ["T1", 0.5, true],
        ["T2", 0.4, true]
      ])
    )
  ];

  const verdict = summarizeEquivalence(cases);
  assert.equal(verdict.equivalence, "failed");
  assert.deepEqual(verdict.failedCaseIds, ["B"]);
  assert.equal(verdict.scoreDelta.cases, 3);
  assert.ok(closeTo(verdict.scoreDelta.median, 0.001));
  assert.ok(closeTo(verdict.scoreDelta.p95, 0.1));
  assert.ok(closeTo(verdict.scoreDelta.max, 0.1));
});
