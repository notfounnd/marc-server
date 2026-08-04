import assert from "node:assert/strict";
import test from "node:test";
import {
  memoryRebuildingStatus,
  readMemoryStatusInWorkspace
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  FakeQueryInterpretationProvider,
  FakeRerankingProvider,
  tempWorkspace
} from "./memory-test-helpers.js";

test("requires the interpreter for search but not for rebuilding", async () => {
  const info = await tempWorkspace();
  const interpreter = new FakeQueryInterpretationProvider([], false);

  const status = await readMemoryStatusInWorkspace(info, {
    interpreter,
    provider: new FakeEmbeddingProvider(),
    reranker: new FakeRerankingProvider()
  });

  assert.equal(status.interpreterPrepared, false);
  assert.equal(status.modelPrepared, false);
  assert.equal(status.rebuildReady, true);
  assert.equal(status.searchReady, false);
});

test("maps an existing memory snapshot to the rebuilding status", () => {
  const rebuilding = memoryRebuildingStatus({
    status: "stale",
    ready: false,
    stale: true,
    modelPrepared: true,
    retrieverPrepared: true,
    rerankerPrepared: true,
    interpreterPrepared: true,
    rebuildReady: true,
    searchReady: true,
    summaryCount: 2,
    indexedSummaryCount: 1,
    missingSummaryIds: ["thread-current"],
    staleSummaryIds: [],
    extraSummaryIds: [],
    message: "Memory index is stale."
  });

  assert.deepEqual(rebuilding, {
    status: "rebuilding",
    ready: false,
    stale: true,
    modelPrepared: true,
    retrieverPrepared: true,
    rerankerPrepared: true,
    interpreterPrepared: true,
    rebuildReady: true,
    searchReady: true,
    summaryCount: 2,
    indexedSummaryCount: 1,
    missingSummaryIds: ["thread-current"],
    staleSummaryIds: [],
    extraSummaryIds: [],
    message: "Memory rebuild is running."
  });
});
