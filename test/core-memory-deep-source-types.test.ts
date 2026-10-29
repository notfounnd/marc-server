import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { deepMemoryInWorkspace } from "../src/core/memory/deep.js";
import { rebuildMemoryInWorkspace } from "../src/core/memory/index.js";
import { DeepFixtureStore, summaryMarkdown } from "./memory-deep-fixtures.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

const QUERY = "daemon token";

const RULES_MARKDOWN = [
  "# Workspace rules",
  "",
  "## Daemon token rule",
  "",
  "Keep the daemon token private.",
  "",
  "## Composer rule",
  "",
  "Keep the composer autocomplete stable.",
  ""
].join("\n");

test("sourceTypes in the unscoped mode changes only the output: same documents, pairs and abstained", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new DeepFixtureStore();
  await fs.writeFile(path.join(info.marcPath, "RULES.md"), RULES_MARKDOWN);
  await writeSummary(
    info,
    "types-thread-a-cafe0061",
    summaryMarkdown("types-thread-a-cafe0061", "Daemon token rotation")
  );
  await writeSummary(
    info,
    "types-thread-b-cafe0062",
    summaryMarkdown("types-thread-b-cafe0062", "Composer autocomplete")
  );
  await rebuildMemoryInWorkspace(info, {
    provider,
    reranker: new FakeRerankingProvider(),
    store
  });

  const unfilteredReranker = new FakeRerankingProvider();
  const unfiltered = await deepMemoryInWorkspace(info, {
    provider,
    reranker: unfilteredReranker,
    store,
    query: QUERY,
    limit: 20
  });
  const filteredReranker = new FakeRerankingProvider();
  const filtered = await deepMemoryInWorkspace(info, {
    provider,
    reranker: filteredReranker,
    store,
    query: QUERY,
    sourceTypes: ["rules"],
    limit: 20
  });

  // The fixture must mix sources, or the filter proves nothing.
  assert.ok(unfiltered.results.some((hit) => hit.sourceType === "rules"));
  assert.ok(unfiltered.results.some((hit) => hit.sourceType === "summary"));

  // The filter does not touch the pool: the same documents go to the reranker, in the same order.
  assert.deepEqual(
    filteredReranker.rerankedDocuments,
    unfilteredReranker.rerankedDocuments
  );
  assert.equal(filteredReranker.rerankCalls, unfilteredReranker.rerankCalls);
  assert.equal(filtered.rerankPairs, unfiltered.rerankPairs);
  assert.equal(filtered.abstained, unfiltered.abstained);

  // The filtered output is the subset of the unfiltered output with that source, in the same order.
  const expected = unfiltered.results
    .filter((hit) => hit.sourceType === "rules")
    .map((hit) => hit.recordId);
  assert.ok(filtered.results.length > 0);
  assert.deepEqual(
    filtered.results.map((hit) => hit.recordId),
    expected
  );
  assert.ok(filtered.results.every((hit) => hit.sourceType === "rules"));
});
