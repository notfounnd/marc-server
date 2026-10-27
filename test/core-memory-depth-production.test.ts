import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace
} from "../src/core/memory/index.js";
import type { MemoryLayer } from "../src/core/memory/sources/contract.js";
import { InMemoryMemoryVectorStore } from "../src/core/memory/store.js";
import type { MemoryRecallHit } from "../src/core/memory/types.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import {
  chatMessage,
  chatText,
  summary,
  writeArtifact,
  writeFileAt
} from "./memory-layers-fixtures.js";

const ALL_LAYERS: MemoryLayer[] = [0, 1, 2];
const QUERY = "brutalism interface";

/** A chat message whose body carries the searched words, so chat can be the best evidence of its thread. */
function chatMessageWithBody(
  id: string,
  threadId: string,
  body: string
): string {
  return [
    "<!-- marc-message",
    `id: ${id}`,
    `threadId: ${threadId}`,
    "timestamp: 2026-10-01T00:00:00.000Z",
    "agentId: agent",
    "artifacts:",
    "-->",
    body,
    "<!-- /marc-message -->"
  ].join("\n");
}

/**
 * A workspace with thread t1 (summary, artifact and chat), thread t2 whose only evidence is a chat message
 * that matches the query, and workspace rules.
 */
async function populatedWorkspace() {
  const info = await tempWorkspace();
  await writeSummary(info, "t1", summary("t1", "Brutalism interface"));
  await writeArtifact(info, "t1", "plano.md", "Brutalism interface plan.");
  await writeFileAt(
    path.join(info.marcPath, "RULES.md"),
    "# Rules\n\nBrutalism interface rules."
  );
  await writeFileAt(
    path.join(info.marcPath, "threads", "t1", "CHAT.md"),
    chatText([chatMessage("m1", "artifacts/plano.md")])
  );
  // Chat is indexed only for threads with a summary, so t2 gets an unrelated summary.
  await writeSummary(info, "t2", summary("t2", "Unrelated planning notes"));
  await writeFileAt(
    path.join(info.marcPath, "threads", "t2", "CHAT.md"),
    chatText([
      chatMessageWithBody("m2", "t2", "Brutalism interface chat discussion.")
    ])
  );
  return info;
}

async function buildIndex(
  info: Awaited<ReturnType<typeof tempWorkspace>>,
  indexedLayers: MemoryLayer[]
) {
  const store = new InMemoryMemoryVectorStore();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(() => 0.9)
  );
  await rebuildMemoryInWorkspace(info, {
    indexedLayers,
    provider,
    reranker,
    store
  });
  return { provider, reranker, store };
}

/** The reference of each hit follows its source type: a thread link, a message link, or the source path. */
const REFERENCE_CHECK_BY_SOURCE: Readonly<
  Record<string, (hit: MemoryRecallHit) => void>
> = {
  summary: (hit) => assert.equal(hit.reference, `marc://$${hit.threadId}`),
  artifact: (hit) =>
    assert.match(hit.reference, /^marc:\/\/\$t1\/#m1\/!plano\.md$/),
  chat: (hit) => assert.match(hit.reference, /^marc:\/\/\$t[12]\/#m[12]$/),
  rules: (hit) => assert.equal(hit.reference, hit.sourcePath),
  document: (hit) => assert.equal(hit.reference, hit.sourcePath)
};

function assertReferenceByType(hit: MemoryRecallHit): void {
  const check = REFERENCE_CHECK_BY_SOURCE[String(hit.sourceType)];
  assert.ok(check, `unexpected source type ${String(hit.sourceType)}`);
  check(hit);
}

test("depth 1 and 2 search the layers up to their depth and admit every group kind", async () => {
  const info = await populatedWorkspace();
  const { provider, reranker, store } = await buildIndex(info, ALL_LAYERS);

  const oneDeep = await recallMemoryInWorkspace(info, {
    provider,
    query: QUERY,
    reranker,
    store,
    depth: 1
  });
  const twoDeep = await recallMemoryInWorkspace(info, {
    provider,
    query: QUERY,
    reranker,
    store,
    depth: 2
  });

  assert.deepEqual(oneDeep.layersSearched, [0, 1]);
  assert.deepEqual(twoDeep.layersSearched, ALL_LAYERS);
  const kinds = new Set(twoDeep.results.map((hit) => hit.groupKind));
  assert.ok(kinds.has("thread"));
  assert.ok(kinds.has("rules"));
  const deepSources = new Set(
    twoDeep.results.map((hit) => String(hit.sourceType))
  );
  assert.ok(deepSources.has("artifact"));
  assert.ok(deepSources.has("chat"));
  const middleSources = new Set(
    oneDeep.results.map((hit) => String(hit.sourceType))
  );
  assert.ok(middleSources.has("artifact"));
  assert.equal(middleSources.has("chat"), false);
  twoDeep.results.forEach(assertReferenceByType);
  oneDeep.results.forEach(assertReferenceByType);
  twoDeep.results
    .filter((hit) => hit.groupKind === "thread")
    .forEach((hit) => {
      assert.ok(["t1", "t2"].includes(hit.threadId ?? ""));
      assert.equal(hit.groupId, hit.threadId);
    });
  twoDeep.results
    .filter((hit) => hit.groupKind !== "thread")
    .forEach((hit) => {
      assert.equal(hit.threadId, undefined);
      assert.equal(hit.summaryPath, undefined);
    });
});

test("rerankPairs counts every passage that depth 1 and 2 sent to the reranker, with no funnel budget", async () => {
  const info = await populatedWorkspace();
  const { provider, store } = await buildIndex(info, ALL_LAYERS);

  for (const depth of [1, 2] as const) {
    const reranker = new FakeRerankingProvider((_query, documents) =>
      documents.map(() => 0.9)
    );
    const result = await recallMemoryInWorkspace(info, {
      depth,
      provider,
      query: QUERY,
      reranker,
      store
    });
    const sent = reranker.rerankedDocuments.reduce(
      (total, batch) => total + batch.length,
      0
    );
    assert.ok(sent > 0);
    assert.equal(result.rerankPairs, sent);
  }
});

test("depth 1 and 2 behave as depth 0 while the index holds only layer 0", async () => {
  const info = await populatedWorkspace();
  const { provider, reranker, store } = await buildIndex(info, [0]);

  // Sequential on purpose: a concurrent recall loses the memory operation lock and returns an empty result.
  const shallow = await recallMemoryInWorkspace(info, {
    depth: 0,
    provider,
    query: QUERY,
    reranker,
    store
  });
  const middle = await recallMemoryInWorkspace(info, {
    depth: 1,
    provider,
    query: QUERY,
    reranker,
    store
  });
  const deep = await recallMemoryInWorkspace(info, {
    depth: 2,
    provider,
    query: QUERY,
    reranker,
    store
  });
  assert.deepEqual(shallow.layersSearched, [0]);
  assert.deepEqual(middle.layersSearched, [0]);
  assert.deepEqual(deep.layersSearched, [0]);
  assert.deepEqual(middle.results, shallow.results);
  assert.deepEqual(deep.results, shallow.results);
  assert.equal(middle.rerankPairs, shallow.rerankPairs);
  assert.equal(deep.rerankPairs, shallow.rerankPairs);
  assert.ok(shallow.results.every((hit) => hit.groupKind === "thread"));
});

test("depth 0 searches only layer 0 and is repeatable on the same index", async () => {
  const info = await populatedWorkspace();
  const { provider, reranker, store } = await buildIndex(info, ALL_LAYERS);

  const first = await recallMemoryInWorkspace(info, {
    depth: 0,
    provider,
    query: QUERY,
    reranker,
    store
  });
  const second = await recallMemoryInWorkspace(info, {
    depth: 0,
    provider,
    query: QUERY,
    reranker,
    store
  });

  assert.deepEqual(first.layersSearched, [0]);
  assert.deepEqual(first.results, second.results);
  assert.equal(first.rerankPairs, second.rerankPairs);
  assert.ok(first.results.every((hit) => hit.groupKind === "thread"));
});
