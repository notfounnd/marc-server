import assert from "node:assert/strict";
import test from "node:test";
import { summaryProvenanceFixture } from "./memory-provenance-fixtures.js";
import {
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace,
  semanticRerankingDocument
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  FakeQueryInterpretationProvider,
  FakeRerankingProvider,
  ScoreOverrideStore,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

test("interprets a typo before retrieval and reranking", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const interpreter = new FakeQueryInterpretationProvider(["1"]);
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-toggle": 0.9 });
  await writeSummary(
    info,
    "thread-toggle",
    summary("thread-toggle", "Toggle settings")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    interpreter,
    provider,
    query: "toogle",
    reranker,
    store
  });

  assert.equal(recall.interpretation.originalQuery, "toogle");
  assert.equal(recall.interpretation.effectiveQuery, "toggle");
  assert.equal(recall.interpretation.correctionApplied, true);
  assert.deepEqual(provider.queryTexts, ["toggle"]);
  assert.deepEqual(reranker.rerankedQueries, ["toggle"]);
});

test("literal recall bypasses query interpretation", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const interpreter = new FakeQueryInterpretationProvider(["1"]);
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-toggle": 0.9 });
  await writeSummary(
    info,
    "thread-toggle",
    summary("thread-toggle", "Toggle settings")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    interpreter,
    provider,
    query: "toogle",
    queryMode: "literal",
    reranker,
    store
  });

  assert.equal(recall.interpretation.effectiveQuery, "toogle");
  assert.equal(recall.interpretation.mode, "literal");
  assert.equal(interpreter.calls.length, 0);
  assert.deepEqual(provider.queryTexts, ["toogle"]);
});

test("recall applies limit after semantic ranking", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const threadIds = Array.from(
    { length: 6 },
    (_, index) => `thread-brutalism-${index + 1}`
  );
  const store = new ScoreOverrideStore(
    Object.fromEntries(threadIds.map((threadId) => [threadId, 0.6]))
  );

  for (const threadId of threadIds) {
    await writeSummary(info, threadId, summary(threadId, "Neo-brutalism UI"));
  }
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const limited = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "brutalism",
    limit: 5
  });
  const expanded = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "brutalism",
    limit: 50
  });

  assert.equal(limited.results.length, 5);
  assert.equal(expanded.results.length, 6);
  assert.deepEqual(
    store.searchOptions.map((options) => options.limit),
    [100, 100, 100, 100]
  );
});

test("recall depth expands only the semantic candidate pool", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-ui": 0.8 });
  await writeSummary(
    info,
    "thread-ui",
    summary("thread-ui", "Neo-brutalism UI")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "interface com brutalism",
    depth: 0
  });
  await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "interface com brutalism",
    depth: 3
  });

  assert.deepEqual(
    store.searchOptions.map((options) => options.limit),
    [100, 100, 400, 400]
  );
});

test("recall ranks reranker relevance above the retriever neighbor order", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map((document) =>
      document.includes("Neo-brutalism") ? 0.95 : 0.6
    )
  );
  const store = new ScoreOverrideStore({
    "thread-generic": 0.9,
    "thread-ui": 0.6
  });
  await writeSummary(
    info,
    "thread-generic",
    summary("thread-generic", "Generic UI")
  );
  await writeSummary(
    info,
    "thread-ui",
    summary("thread-ui", "Neo-brutalism UI")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "interface com brutalism"
  });

  assert.equal(recall.results[0]?.threadId, "thread-ui");
  assert.doesNotMatch(recall.results[0]?.reason ?? "", /exact terms/i);
});

test("reranker receives a structured title and content document", () => {
  assert.equal(
    semanticRerankingDocument({
      closedAt: "2026-07-29T00:00:00.000Z",
      embeddingText: "passage: ignored retrieval representation",
      kind: "section",
      recordId: "thread-ui:section:result",
      reference: "marc://$thread-ui",
      relativeSummaryPath: "threads/thread-ui/SUMMARY.md",
      sectionTitle: "Result",
      summaryPath: "C:/workspace/.marc/threads/thread-ui/SUMMARY.md",
      text: "The interface uses neo-brutalism.",
      threadId: "thread-ui",
      title: "Neo-brutalism interface",
      ...summaryProvenanceFixture(
        "thread-ui",
        "The interface uses neo-brutalism."
      )
    }),
    [
      "Title: Neo-brutalism interface",
      "Section: Result",
      "Content: The interface uses neo-brutalism."
    ].join("\n")
  );
});

test("recall eligibility does not depend on a raw reranker threshold", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(() => 0.19)
  );
  const store = new ScoreOverrideStore({ "thread-toggle": 0.9 });
  await writeSummary(
    info,
    "thread-toggle",
    summary("thread-toggle", "Toggle settings")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "toogle"
  });

  assert.equal(recall.results[0]?.threadId, "thread-toggle");
});

test("recall reranks bounded passages per thread", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-ui": 0.9 });
  await writeSummary(
    info,
    "thread-ui",
    multiSectionSummary("thread-ui", "Neo-brutalism UI")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    batchSize: 1,
    provider,
    reranker,
    store,
    query: "interface com brutalism"
  });

  assert.equal(reranker.rerankedDocuments[0]?.length, 3);
  assert.ok(
    reranker.rerankedDocuments[0]?.some((document) =>
      /Section: Validation/.test(document)
    )
  );
  assert.deepEqual(reranker.rerankBatchSizes, [8]);
  assert.equal(recall.results.length, 1);
  assert.equal(recall.results[0]?.threadId, "thread-ui");
});

function summary(threadId: string, content: string): string {
  return [
    `# Summary - ${content}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    "## Result",
    "",
    `- ${content}`
  ].join("\n");
}

function multiSectionSummary(threadId: string, content: string): string {
  return [
    `# Summary - ${content}`,
    "",
    `Thread: \`${threadId}\``,
    "",
    "## Decision",
    "",
    content,
    "",
    "## Implementation",
    "",
    content,
    "",
    "## Validation",
    "",
    content,
    "",
    "## Follow-up",
    "",
    content
  ].join("\n");
}
