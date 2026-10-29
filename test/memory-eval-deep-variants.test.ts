import assert from "node:assert/strict";
import test from "node:test";
import {
  rankScopePassages,
  SCOPE_RERANK_BUDGET
} from "../src/core/memory/deep-scope.js";
import { semanticRerankingDocument } from "../src/core/memory/semantic-ranking.js";
import type {
  MemoryVectorRecord,
  MemoryVectorRow
} from "../src/core/memory/types.js";
import { runDeepVariants } from "../scripts/memory-eval/deep-variants.js";
import {
  allPassages,
  capturedRecordOf,
  captureFixture,
  okOf,
  pairKeyOf,
  QUERY,
  scopedCase,
  SCOPE_PASSAGES,
  TableReranker,
  passageIdOf,
  type PassageSpec
} from "./memory-eval-deep-fixtures.js";

const S1 = passageIdOf(SCOPE_PASSAGES[0]!);
const S2 = passageIdOf(SCOPE_PASSAGES[1]!);
const S3 = passageIdOf(SCOPE_PASSAGES[2]!);
const S4 = passageIdOf(SCOPE_PASSAGES[3]!);

function input(
  captured: ReturnType<typeof captureFixture>,
  overrides: { deepBudget?: number; drop?: string } = {}
) {
  const rerankScores = Object.fromEntries(
    Object.entries(captured.captured.rerankScores).filter(
      ([key]) => key !== overrides.drop
    )
  );
  return {
    evalCase: scopedCase(),
    captured: { ...captured.captured, rerankScores },
    records: captured.records,
    vectors: captured.vectors,
    rerankerMetadata: captured.rerankerMetadata,
    deepBudget: overrides.deepBudget
  };
}

/** The scores of the scope rows, by document: the table that the core reranker and the capture share. */
function scoreTable(): Map<string, number> {
  return new Map(
    allPassages().map((item: PassageSpec) => [
      semanticRerankingDocument(
        capturedRecordOf(item) as unknown as MemoryVectorRecord
      ),
      item.score
    ])
  );
}

function scopeRowsOf(items: PassageSpec[]): MemoryVectorRow[] {
  return items.map((item) => ({
    ...(capturedRecordOf(item) as unknown as MemoryVectorRecord),
    vector: item.vector
  }));
}

test("the cached DEEP order equals the core rankScopePassages on the same scores", async () => {
  const fixture = captureFixture();
  const runs = await runDeepVariants(input(fixture));
  const deep = okOf(runs.runs.DEEP);
  const core = await rankScopePassages({
    query: QUERY,
    queryVector: [1, 0],
    rows: scopeRowsOf(SCOPE_PASSAGES),
    reranker: new TableReranker(scoreTable()),
    budget: SCOPE_RERANK_BUDGET
  });
  assert.deepEqual(
    deep.ranked.map((passage) => passage.recordId),
    core.ranked.map((passage) => passage.row.recordId)
  );
  assert.deepEqual(
    deep.ranked.map((passage) => passage.score),
    core.ranked.map((passage) => passage.score)
  );
  assert.equal(deep.pairs, SCOPE_PASSAGES.length);
  assert.equal(deep.scopePassages, SCOPE_PASSAGES.length);
  assert.equal(deep.truncated, false);
});

test("the scoped order is the reranker score, the best first, and the saturated score stays a score", async () => {
  const runs = await runDeepVariants(input(captureFixture()));
  const deep = okOf(runs.runs.DEEP);
  assert.deepEqual(
    deep.ranked.map((passage) => passage.passageId),
    [S4, S2, S3, S1]
  );
});

test("DEEP_ALL equals DEEP when the scope is within the budget, and the cosine variant needs no reranker", async () => {
  const runs = await runDeepVariants(input(captureFixture()));
  const all = okOf(runs.runs.DEEP_ALL);
  const cosine = okOf(runs.runs.DEEP_COSINE);
  assert.deepEqual(
    all.ranked.map((passage) => passage.passageId),
    [S4, S2, S3, S1]
  );
  assert.deepEqual(
    cosine.ranked.map((passage) => passage.passageId),
    [S1, S4, S2, S3]
  );
  assert.equal(cosine.pairs, 0);
  assert.equal(
    cosine.ranked.every((passage) => passage.score === undefined),
    true
  );
});

test("a missing reranker pair makes the reranked variants incomplete, and the cosine variant stays complete", async () => {
  const runs = await runDeepVariants(
    input(captureFixture(), { drop: pairKeyOfSecond() })
  );
  assert.deepEqual(runs.runs.DEEP, {
    variant: "DEEP",
    status: "incomplete",
    reason: "missing-pair"
  });
  assert.deepEqual(runs.runs.DEEP_ALL, {
    variant: "DEEP_ALL",
    status: "incomplete",
    reason: "missing-pair"
  });
  assert.equal(runs.runs.DEEP_COSINE?.status, "ok");
});

test("DEEP_BUDGET runs only when its budget is given, and keeps the cosine top of the budget", async () => {
  const without = await runDeepVariants(input(captureFixture()));
  const withBudget = await runDeepVariants(
    input(captureFixture(), { deepBudget: 2 })
  );
  assert.equal(without.runs.DEEP_BUDGET, undefined);
  const budget = okOf(withBudget.runs.DEEP_BUDGET);
  assert.equal(budget.truncated, true);
  assert.equal(budget.pairs, 2);
  assert.equal(budget.scopePassages, SCOPE_PASSAGES.length);
  assert.deepEqual(
    budget.ranked.map((passage) => passage.passageId),
    [S4, S1]
  );
});

test("a missing pair inside the DEEP_BUDGET selection makes the budget variant incomplete, and one outside it does not", async () => {
  const insideBudget = await runDeepVariants(
    input(captureFixture(), {
      deepBudget: 2,
      drop: pairKeyOf(SCOPE_PASSAGES[3]!)
    })
  );
  const outsideBudget = await runDeepVariants(
    input(captureFixture(), { deepBudget: 2, drop: pairKeyOfSecond() })
  );
  assert.equal(insideBudget.runs.DEEP_BUDGET?.status, "incomplete");
  assert.equal(outsideBudget.runs.DEEP_BUDGET?.status, "ok");
});

test("the pair key that the drop tests remove is the reranker key of the second scope passage", () => {
  const fixture = captureFixture();
  assert.equal(
    fixture.captured.rerankScores[pairKeyOfSecond()],
    SCOPE_PASSAGES[1]!.score
  );
});

function pairKeyOfSecond(): string {
  return pairKeyOf(SCOPE_PASSAGES[1]!);
}
