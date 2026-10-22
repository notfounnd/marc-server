import assert from "node:assert/strict";
import test from "node:test";
import {
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace
} from "../src/core/memory/index.js";
import { tryWithMemoryOperationLock } from "../src/core/memory/rebuild-coordination.js";
import { memoryBandOf } from "../src/core/memory/scoring/bands.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  ScoreOverrideStore,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

test("every recalled hit carries the band of its eligibility", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
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

  assert.ok(recall.results.length > 0, "the fixture must admit a hit");
  assert.deepEqual(
    recall.results.map((hit) => hit.band),
    recall.results.map((hit) => memoryBandOf(hit.score))
  );
  assert.equal(recall.abstained, false);
});

test("abstained is true only when the search ran and admitted no thread", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(() => 0)
  );
  const store = new ScoreOverrideStore({ "thread-toggle": 0 });
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

  assert.deepEqual(recall.results, []);
  assert.equal(recall.abstained, true);
});

test("a ready index without records reports abstained false", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({});
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "toogle"
  });

  assert.deepEqual(recall.results, []);
  assert.equal(recall.abstained, false);
});

test("a recall that cannot take the operation lock reports abstained false", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new ScoreOverrideStore({ "thread-toggle": 0.9 });
  await writeSummary(
    info,
    "thread-toggle",
    summary("thread-toggle", "Toggle settings")
  );
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  const held = deferredVoid();
  const release = deferredVoid();
  const holder = tryWithMemoryOperationLock(info, async () => {
    held.resolve();
    await release.promise;
  });
  await held.promise;

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "toogle"
  });
  release.resolve();
  await holder;

  assert.deepEqual(recall.results, []);
  assert.equal(recall.abstained, false);
  assert.ok(
    recall.nextActions.includes(
      "Retry after the current memory operation completes."
    )
  );
});

test("recall without a limit returns at most five admitted hits, each with its band", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const threadIds = Array.from(
    { length: 6 },
    (_, index) => `thread-default-limit-${index + 1}`
  );
  const store = new ScoreOverrideStore(
    Object.fromEntries(threadIds.map((threadId) => [threadId, 0.6]))
  );
  for (const threadId of threadIds) {
    await writeSummary(info, threadId, summary(threadId, "Neo-brutalism UI"));
  }
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "Neo-brutalism UI"
  });

  assert.equal(recall.results.length, 5);
  assert.deepEqual(
    recall.results.map((hit) => hit.band),
    recall.results.map((hit) => memoryBandOf(hit.score))
  );
});

function deferredVoid(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
}

/** Limits that cut the admitted list: zero, a fraction, and a limit that keeps the hit. */
const TRUNCATING_LIMITS: ReadonlyArray<readonly [string, number, number]> = [
  ["zero", 0, 0],
  ["a fraction", 0.5, 0],
  ["five", 5, 1]
];

TRUNCATING_LIMITS.forEach(([label, limit, expected]) => {
  test(`an admitted hit with limit ${label} is not abstained`, async () => {
    const info = await tempWorkspace();
    const provider = new FakeEmbeddingProvider();
    const reranker = new FakeRerankingProvider();
    const store = new ScoreOverrideStore({ "thread-toggle": 0.9 });
    await writeSummary(
      info,
      "thread-toggle",
      summary("thread-toggle", "Toggle settings")
    );
    await rebuildMemoryInWorkspace(info, { provider, reranker, store });

    const recall = await recallMemoryInWorkspace(info, {
      limit,
      provider,
      reranker,
      store,
      query: "toogle"
    });

    assert.equal(recall.results.length, expected, label);
    assert.equal(recall.abstained, false, label);
    assert.deepEqual(
      recall.results.map((hit) => hit.band),
      recall.results.map((hit) => memoryBandOf(hit.score)),
      label
    );
  });
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
