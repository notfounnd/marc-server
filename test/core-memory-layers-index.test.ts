import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  reconcileMemoryInWorkspace,
  rebuildMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  recallMemoryInWorkspace
} from "../src/core/memory/index.js";
import type { MemoryLayer } from "../src/core/memory/sources/contract.js";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest
} from "../src/core/memory/store.js";
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

test("the in-memory store reads only the layers that were asked for", async () => {
  const info = await tempWorkspace();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "t1", summary("t1", "Brutalism summary"));
  await writeArtifact(info, "t1", "plano.md", "Brutalism artifact text.");
  await rebuildMemoryInWorkspace(info, {
    provider: new FakeEmbeddingProvider(),
    reranker: new FakeRerankingProvider(),
    store,
    indexedLayers: ALL_LAYERS
  });
  const manifest = await readMemoryManifest(info);
  const onlySummaries = await store.readRows(info, manifest?.generation, {
    layers: [0]
  });
  const everything = await store.readRows(info, manifest?.generation);
  assert.ok(onlySummaries.length > 0);
  assert.ok(onlySummaries.every((row) => row.layer === 0));
  assert.ok(everything.length > onlySummaries.length);
});

test("a three-layer index is ready after reconcile, goes stale when an artifact changes, and recalls by depth", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider((_query, documents) =>
    documents.map(() => 0.9)
  );
  const store = new InMemoryMemoryVectorStore();
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
  const options = {
    provider,
    reranker,
    store,
    indexedLayers: ALL_LAYERS
  };
  await rebuildMemoryInWorkspace(info, options);
  assert.equal(
    (await readMemoryStatusInWorkspace(info, options)).status,
    "ready"
  );
  const ready = await readMemoryStatusInWorkspace(info, options);
  assert.equal(ready.indexedSummaryCount, 1);

  await writeArtifact(
    info,
    "t1",
    "plano.md",
    "Brutalism interface plan, revised."
  );
  assert.equal(
    (await readMemoryStatusInWorkspace(info, options)).status,
    "stale"
  );

  await reconcileMemoryInWorkspace(info, options);
  assert.equal(
    (await readMemoryStatusInWorkspace(info, options)).status,
    "ready"
  );

  const deep = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "brutalism interface",
    depth: 2
  });
  assert.deepEqual(deep.layersSearched, ALL_LAYERS);
  assert.ok(deep.rerankPairs > 0);
  const shallow = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "brutalism interface",
    depth: 0
  });
  assert.deepEqual(shallow.layersSearched, [0]);
  assert.ok(shallow.results.every((hit) => hit.groupKind === "thread"));
});
