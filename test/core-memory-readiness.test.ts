import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  recallMemoryInWorkspace
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  providerMetadata,
  tempWorkspace
} from "./memory-test-helpers.js";

test("recall does not load embeddings when the local provider is not prepared", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider(providerMetadata, false);
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();

  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker,
    store,
    query: "verificar historico de token"
  });

  assert.equal(recall.indexStatus.status, "model_missing");
  assert.deepEqual(recall.results, []);
  assert.equal(provider.queryCalls, 0);
  assert.ok(
    recall.nextActions.some((action) => action.includes("memory_prepare"))
  );
});
