import assert from "node:assert/strict";
import test from "node:test";
import { deepMemoryInWorkspace } from "../src/core/memory/deep.js";
import {
  rankScopePassages,
  scopePassageRows,
  SCOPE_RERANK_BUDGET
} from "../src/core/memory/deep-scope.js";
import { rebuildMemoryInWorkspace } from "../src/core/memory/index.js";
import type { MemorySourceType } from "../src/core/memory/sources/contract.js";
import { readMemoryManifest } from "../src/core/memory/store.js";
import type { MemoryVectorRow } from "../src/core/memory/types.js";
import {
  DeepFixtureStore,
  recordFixture,
  summaryMarkdown
} from "./memory-deep-fixtures.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary,
  writeThreadChat
} from "./memory-test-helpers.js";

const QUERY_VECTOR = [1, 0];

test("the scope budget is 232 passages, the E3 measured budget", () => {
  assert.equal(SCOPE_RERANK_BUDGET, 232);
});

const SOURCE_TYPE_CASES: ReadonlyArray<
  readonly [string, MemorySourceType[] | undefined, string[]]
> = [
  [
    "no source types keeps every passage",
    undefined,
    ["summary-1", "artifact-1", "chat-1"]
  ],
  ["one source type keeps its passages", ["artifact"], ["artifact-1"]],
  [
    "an unrequested type is dropped",
    ["chat", "summary"],
    ["summary-1", "chat-1"]
  ]
];

SOURCE_TYPE_CASES.forEach(([label, sourceTypes, expected]) => {
  test(`scopePassageRows: ${label}`, () => {
    const rows = [
      rowFixture("summary-1", "summary", "passage"),
      rowFixture("artifact-1", "artifact", "passage"),
      rowFixture("chat-1", "chat", "passage"),
      rowFixture("identity-1", "summary", "identity"),
      rowFixture("section-1", "summary", "section")
    ];

    assert.deepEqual(
      scopePassageRows(rows, sourceTypes).map((row) => row.recordId),
      expected
    );
  });
});

test("up to the budget, every passage of the scope goes to the reranker in one call", async () => {
  const rows = scopeRows(SCOPE_RERANK_BUDGET);
  const reranker = new FakeRerankingProvider();

  const ranking = await rankScopePassages({
    query: "toogle",
    queryVector: QUERY_VECTOR,
    rows,
    reranker
  });

  assert.equal(reranker.rerankCalls, 1);
  assert.equal(reranker.rerankedDocuments[0]?.length, SCOPE_RERANK_BUDGET);
  assert.equal(ranking.ranked.length, SCOPE_RERANK_BUDGET);
  assert.equal(ranking.truncated, false);
});

test("above the budget, the reranker gets exactly the budget passages with the best cosine, and the result is truncated", async () => {
  const rows = scopeRows(SCOPE_RERANK_BUDGET + 1);
  const reranker = new FakeRerankingProvider();

  const ranking = await rankScopePassages({
    query: "toogle",
    queryVector: QUERY_VECTOR,
    rows,
    reranker
  });

  const sentIds = ranking.ranked.map((passage) => passage.row.recordId);
  assert.equal(reranker.rerankCalls, 1);
  assert.equal(reranker.rerankedDocuments[0]?.length, SCOPE_RERANK_BUDGET);
  assert.equal(ranking.truncated, true);
  assert.equal(sentIds.length, SCOPE_RERANK_BUDGET);
  assert.ok(!sentIds.includes(`passage-${SCOPE_RERANK_BUDGET}`));
  assert.ok(sentIds.includes("passage-0"));
});

test("the order is score, then cosine, then recordId", async () => {
  const rows = [
    rowFixture("p-high", "summary", "passage", "high score", [0.5, 0.5]),
    rowFixture("p-tie-far", "summary", "passage", "tie far", [0, 1]),
    rowFixture("p-tie-close-b", "summary", "passage", "tie close", [1, 0]),
    rowFixture("p-tie-close", "summary", "passage", "tie close", [1, 0])
  ];
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(scoreByText)
  );

  const ranking = await rankScopePassages({
    query: "toogle",
    queryVector: QUERY_VECTOR,
    rows,
    reranker
  });

  assert.deepEqual(
    ranking.ranked.map((passage) => passage.row.recordId),
    ["p-high", "p-tie-close", "p-tie-close-b", "p-tie-far"]
  );
  assert.equal(ranking.truncated, false);
});

test("a small budget keeps the best cosine passages and reports the truncation", async () => {
  const rows = scopeRows(3);
  const reranker = new FakeRerankingProvider();

  const ranking = await rankScopePassages({
    query: "toogle",
    queryVector: QUERY_VECTOR,
    rows,
    reranker,
    budget: 2
  });

  assert.deepEqual(
    ranking.ranked.map((passage) => passage.row.recordId),
    ["passage-0", "passage-1"]
  );
  assert.equal(ranking.truncated, true);
});

test("an empty scope calls no reranker", async () => {
  const reranker = new FakeRerankingProvider();

  const ranking = await rankScopePassages({
    query: "toogle",
    queryVector: QUERY_VECTOR,
    rows: [],
    reranker
  });

  assert.equal(reranker.rerankCalls, 0);
  assert.deepEqual(ranking, { ranked: [], truncated: false });
});

test("a thread search returns only that thread, its passages with provenance, and the scope count", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new DeepFixtureStore();
  await writeSummary(
    info,
    "scoped-thread-cafe0001",
    summaryMarkdown(
      "scoped-thread-cafe0001",
      "Toggle settings for the daemon token"
    )
  );
  await writeThreadChat(info, "scoped-thread-cafe0001", "Scoped thread");
  await writeSummary(
    info,
    "other-thread-cafe0002",
    summaryMarkdown("other-thread-cafe0002", "Toggle settings for the composer")
  );
  await writeThreadChat(info, "other-thread-cafe0002", "Other thread");
  await rebuildMemoryInWorkspace(info, {
    provider,
    reranker: new FakeRerankingProvider(),
    store
  });
  const manifest = await readMemoryManifest(info);
  const indexed = (
    await store.readRows(info, manifest?.generation, {
      threadId: "scoped-thread-cafe0001"
    })
  ).filter((row) => row.kind === "passage");

  const deep = await deepMemoryInWorkspace(info, {
    provider,
    reranker: new FakeRerankingProvider(),
    store,
    query: "toogle",
    threadId: "cafe0001",
    limit: 20
  });

  assert.equal(deep.mode, "scoped");
  assert.equal(deep.threadId, "scoped-thread-cafe0001");
  assert.equal(deep.scopePassages, indexed.length);
  assert.equal(deep.scopeTruncated, false);
  assert.equal(deep.rerankPairs, indexed.length);
  assert.equal(deep.abstained, undefined);
  assert.ok(deep.results.length > 0);
  assert.ok(
    deep.results.every((hit) => hit.threadId === "scoped-thread-cafe0001")
  );
  assert.ok(deep.results.every((hit) => hit.groupBand === undefined));
  assert.ok(deep.results.every((hit) => hit.groupKind === "thread"));
  assert.ok(
    deep.results
      .filter((hit) => hit.sourceType === "summary")
      .every((hit) => hit.reference === "marc://$scoped-thread-cafe0001")
  );
});

test("a sourceTypes filter inside a thread keeps only the requested sources", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new DeepFixtureStore();
  await writeSummary(
    info,
    "typed-thread-cafe0003",
    summaryMarkdown("typed-thread-cafe0003", "Toggle settings for the token")
  );
  await writeThreadChat(info, "typed-thread-cafe0003", "Typed thread");
  await rebuildMemoryInWorkspace(info, {
    provider,
    reranker: new FakeRerankingProvider(),
    store
  });

  const deep = await deepMemoryInWorkspace(info, {
    provider,
    reranker: new FakeRerankingProvider(),
    store,
    query: "toogle",
    threadId: "typed-thread-cafe0003",
    sourceTypes: ["summary"],
    limit: 20
  });

  assert.ok(deep.results.every((hit) => hit.sourceType === "summary"));
});

function rowFixture(
  recordId: string,
  sourceType: MemorySourceType,
  kind: "identity" | "passage" | "section",
  text = recordId,
  vector: number[] = [1, 0]
): MemoryVectorRow {
  return {
    ...recordFixture({
      recordId,
      threadId: "scope-thread",
      kind,
      text,
      sourceType
    }),
    vector
  };
}

/** Rows whose cosine with the query decreases with the index, so the best cosine is the first row. */
function scopeRows(count: number): MemoryVectorRow[] {
  return Array.from({ length: count }, (_, index) => ({
    ...recordFixture({
      recordId: `passage-${index}`,
      threadId: "scope-thread",
      kind: "passage",
      text: `scope passage ${index}`
    }),
    vector: [1, index / count]
  }));
}

const SCORE_BY_TEXT: ReadonlyArray<readonly [string, number]> = [
  ["high score", 0.9],
  ["tie close", 0.5],
  ["tie far", 0.5]
];

function scoreByText(document: string): number {
  const match = SCORE_BY_TEXT.find(([text]) => document.includes(text));
  return match?.[1] ?? 0;
}
