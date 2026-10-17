import assert from "node:assert/strict";
import test from "node:test";
import type { RelevanceGrade } from "../scripts/memory-eval/dataset.js";
import {
  evaluateVariant,
  variantDifferences,
  type VariantDifference
} from "../scripts/memory-eval/evaluation.js";
import { DECISION_METRICS } from "../scripts/memory-eval/report.js";
import type { CaseInput } from "../scripts/memory-eval/metrics.js";
import type {
  MemorySearchChannels,
  RerankingProvider
} from "../src/core/memory/types.js";
import {
  PRODUCTION_RECALL,
  type VariantInput,
  type VariantResult
} from "../scripts/memory-eval/variants.js";

const CASE_ID = "P9";
const NON_RELEVANT = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"];

function admittedList(threadIds: readonly string[]): VariantResult[] {
  return threadIds.map((threadId, index) => ({
    threadId,
    score: 1 - index / 100,
    admitted: true
  }));
}

function caseOf(
  results: VariantResult[],
  judgments: Record<string, RelevanceGrade>
): CaseInput {
  return { caseId: CASE_ID, family: "F9", style: "direct", judgments, results };
}

function differenceOf(
  rows: VariantDifference[],
  metric: string
): VariantDifference {
  const row = rows.find((item) => item.metric === metric);
  assert.ok(row !== undefined);
  return row;
}

const fullyJudged: Record<string, RelevanceGrade> = {
  ...Object.fromEntries(NON_RELEVANT.map((id) => [id, 0 as RelevanceGrade])),
  T: 3,
  S: 0
};

test("identical lists give zero difference on every decision metric", () => {
  const list = admittedList([...NON_RELEVANT, "T", "S"]);
  const m0 = evaluateVariant("M0", [caseOf(list, fullyJudged)]);
  const production = evaluateVariant("PRODUCTION_RECALL", [
    caseOf(list, fullyJudged)
  ]);

  const rows = variantDifferences(m0, production, DECISION_METRICS);
  assert.equal(rows.length, DECISION_METRICS.length);
  for (const row of rows) {
    assert.equal(row.other, row.baseline);
    assert.equal(row.difference ?? 0, 0);
    assert.deepEqual(row.caseIds, []);
  }
});

test("a swap at positions 9 and 10 gives the expected MRR and nDCG difference and lists the case", () => {
  const production = admittedList([...NON_RELEVANT, "T", "S"]);
  const m0Order = admittedList([...NON_RELEVANT, "S", "T"]);
  const m0 = evaluateVariant("M0", [caseOf(m0Order, fullyJudged)]);
  const prodEvaluation = evaluateVariant("PRODUCTION_RECALL", [
    caseOf(production, fullyJudged)
  ]);

  const rows = variantDifferences(m0, prodEvaluation, DECISION_METRICS);

  // Production: T (grade 3) at rank 9 gives 1/9. M0: rank 10 gives 1/10.
  const mrr = differenceOf(rows, "mrr");
  assert.ok(Math.abs((mrr.difference ?? NaN) - (1 / 9 - 1 / 10)) < 1e-12);
  assert.deepEqual(mrr.caseIds, [CASE_ID]);

  // nDCG with one grade-3 thread, ideal gain 7: production 1/log2(10), M0 1/log2(11).
  const ndcg = differenceOf(rows, "ndcg10");
  assert.ok(
    Math.abs(
      (ndcg.difference ?? NaN) - (1 / Math.log2(10) - 1 / Math.log2(11))
    ) < 1e-12
  );
  assert.deepEqual(ndcg.caseIds, [CASE_ID]);

  // The top-1 outcome is the same N1 in both orders, so it is not listed.
  const top1 = differenceOf(rows, "top1Target");
  assert.equal(top1.difference, 0);
  assert.deepEqual(top1.caseIds, []);
});

test("PRODUCTION_RECALL adds no pending pairs beyond M0 on the same threads", () => {
  const order = admittedList([...NON_RELEVANT, "T", "S"]);
  const judgedM0 = evaluateVariant("M0", [caseOf(order, fullyJudged)]);
  const judgedProduction = evaluateVariant("PRODUCTION_RECALL", [
    caseOf(order, fullyJudged)
  ]);
  assert.deepEqual(judgedProduction.pending, []);
  assert.deepEqual(judgedM0.pending, []);

  const withoutS: Record<string, RelevanceGrade> = { ...fullyJudged };
  delete withoutS.S;
  const m0 = evaluateVariant("M0", [caseOf(order, withoutS)]);
  const production = evaluateVariant("PRODUCTION_RECALL", [
    caseOf(order, withoutS)
  ]);
  assert.ok(m0.pending.length > 0);
  assert.deepEqual(production.pending, m0.pending);
});

test("PRODUCTION_RECALL returns the captured order cut at the limit and reads no judgments", async () => {
  const fail = (): never => {
    throw new Error("PRODUCTION_RECALL must not read judgments");
  };
  const judgments = new Proxy(
    {},
    { get: fail, has: fail, ownKeys: fail, getOwnPropertyDescriptor: fail }
  ) as Record<string, RelevanceGrade>;
  const input: VariantInput = {
    query: "q",
    channels: {} as MemorySearchChannels,
    reranker: {} as RerankingProvider,
    judgments,
    production: {
      effectiveQuery: "q",
      limit: 3,
      results: [
        { threadId: "T1", score: 0.9 },
        { threadId: "T2", score: 0.8 },
        { threadId: "T3", score: 0.7 },
        { threadId: "T4", score: 0.6 }
      ]
    }
  };

  const output = await PRODUCTION_RECALL(input);
  assert.deepEqual(
    output.map((item) => [item.threadId, item.score, item.admitted]),
    [
      ["T1", 0.9, true],
      ["T2", 0.8, true],
      ["T3", 0.7, true]
    ]
  );
});
