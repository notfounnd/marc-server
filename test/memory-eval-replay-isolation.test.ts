import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CachedEmbeddingProvider,
  CachedRerankingProvider
} from "../scripts/memory-eval/cached-providers.js";
import {
  cachedReplayProviders,
  replayCapture,
  type ReplayProviders
} from "../scripts/memory-eval/replay.js";
import { captureFixture, dataset } from "./memory-eval-capture-fixtures.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider
} from "./memory-test-helpers.js";

const SCRIPTS_DIR = fileURLToPath(
  new URL("../scripts/memory-eval/", import.meta.url)
);
const LOCAL_PROVIDER_IMPORT = /local-(provider|reranker|query-interpreter)/;

/**
 * Compile-time proof that the replay accepts only the cached providers: a fake
 * provider is not assignable to a cached one. Called by the test below.
 */
function typeOnlyChecks(): void {
  const fakeEmbedding = new FakeEmbeddingProvider();
  // @ts-expect-error a fake embedding provider is not a CachedEmbeddingProvider
  const cachedEmbedding: CachedEmbeddingProvider = fakeEmbedding;
  const fakeReranker = new FakeRerankingProvider();
  // @ts-expect-error a fake reranker is not a CachedRerankingProvider
  const cachedReranker: CachedRerankingProvider = fakeReranker;
  const providers: ReplayProviders = {
    embedding: cachedEmbedding,
    reranker: cachedReranker
  };
  assert.ok(providers);
}

test("replay and variants import none of the local providers", async () => {
  for (const file of ["replay.ts", "variants.ts"]) {
    const source = await fs.readFile(path.join(SCRIPTS_DIR, file), "utf8");
    assert.doesNotMatch(source, LOCAL_PROVIDER_IMPORT);
  }
});

test("the replay accepts only providers built from a capture", async (t: TestContext) => {
  typeOnlyChecks();
  const capture = await captureFixture(t);
  const providers = cachedReplayProviders(capture.cases[0], capture);

  assert.ok(providers.embedding instanceof CachedEmbeddingProvider);
  assert.ok(providers.reranker instanceof CachedRerankingProvider);
});

test("a missing cached rerank score stops the replay instead of loading a model", async (t: TestContext) => {
  const emptied = structuredClone(await captureFixture(t));
  emptied.cases[0].rerankScores = {};

  await assert.rejects(
    replayCapture({ capture: emptied, dataset, variantIds: ["M0"] }),
    /Missing cached rerank score for pair/
  );
});
