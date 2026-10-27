import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_SCOPE,
  compareEvaluations,
  evaluateVariant
} from "../scripts/memory-eval/evaluation.js";
import {
  sharedMetrics,
  type CaseInput
} from "../scripts/memory-eval/metrics.js";

/** A case the variant completed: its one admitted thread is judged. */
const COMPLETE: CaseInput = {
  caseId: "case-complete",
  family: "family-a",
  style: "direct",
  judgments: { "thread-1": 3 },
  results: [{ threadId: "thread-1", score: 1, admitted: true }]
};

/** A case a funnel variant could not run: the capture lacks the channels of some depth. */
const NO_FUNNEL: CaseInput = {
  caseId: "case-no-funnel",
  family: "family-a",
  style: "direct",
  judgments: { "thread-1": 3 },
  results: [],
  incomplete: { reason: "missing-funnel-inputs" }
};

/** A case whose variant needs a pair that the matrix does not hold. */
const MISSING_SCORE: CaseInput = {
  caseId: "case-missing-score",
  family: "family-a",
  style: "direct",
  judgments: { "thread-1": 3 },
  results: [],
  incomplete: { reason: "missing-score", recordId: "record-9" }
};

test("a variant whose every case is complete is complete, with no incomplete case", () => {
  const evaluation = evaluateVariant("M0", [COMPLETE]);
  assert.equal(evaluation.status, "complete");
  assert.deepEqual(evaluation.incompleteCaseIds, []);
});

test("one case without funnel inputs makes the variant incomplete, and its scopes are null", () => {
  const evaluation = evaluateVariant("FUNNEL_D2", [COMPLETE, NO_FUNNEL]);
  assert.equal(evaluation.status, "incomplete");
  assert.deepEqual(evaluation.incompleteCaseIds, ["case-no-funnel"]);
  for (const value of Object.values(evaluation.scopes[ALL_SCOPE] ?? {})) {
    assert.equal(value, null);
  }
});

test("a missing rerank score marks its case incomplete and is never scored as zero", () => {
  const evaluation = evaluateVariant("ALL_CANDIDATES_D0", [MISSING_SCORE]);
  assert.equal(evaluation.status, "incomplete");
  assert.deepEqual(evaluation.incompleteCaseIds, ["case-missing-score"]);
  for (const value of Object.values(evaluation.scopes[ALL_SCOPE] ?? {})) {
    assert.equal(value, null);
  }
});

test("an incomplete side yields no comparison rows: no verdict without coverage", () => {
  const baseline = evaluateVariant("M0", [COMPLETE]);
  const candidate = evaluateVariant("M0", [COMPLETE, NO_FUNNEL]);
  assert.deepEqual(
    compareEvaluations(baseline, candidate, sharedMetrics("M0", "M0")),
    []
  );
});

test("two complete sides still produce comparison rows", () => {
  const baseline = evaluateVariant("M0", [COMPLETE]);
  const candidate = evaluateVariant("M0", [COMPLETE]);
  assert.ok(
    compareEvaluations(baseline, candidate, sharedMetrics("M0", "M0")).length >
      0
  );
});
