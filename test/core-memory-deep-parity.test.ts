import assert from "node:assert/strict";
import test from "node:test";
import { deepMemoryInWorkspace } from "../src/core/memory/deep.js";
import {
  lexicalFieldsForDeep,
  rankDepthPoolPassages
} from "../src/core/memory/deep-pool.js";
import { rankHybridMemoryCandidates } from "../src/core/memory/hybrid-ranking.js";
import { searchChannelsByLayer } from "../src/core/memory/layered-search.js";
import {
  rebuildMemoryInWorkspace,
  recallMemoryInWorkspace
} from "../src/core/memory/index.js";
import {
  layersForDepth,
  presentLayersOf
} from "../src/core/memory/search-depth.js";
import { memoryBandOf } from "../src/core/memory/scoring/bands.js";
import { SEMANTIC_ELIGIBILITY_THRESHOLD } from "../src/core/memory/semantic-ranking.js";
import { readMemoryManifest } from "../src/core/memory/store.js";
import { DeepFixtureStore, summaryMarkdown } from "./memory-deep-fixtures.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

// A single term, so the lexical fields include the title prefix channel.
const QUERY = "toogle";

test("unscoped memory_deep admits and reranks like recall at depth 2, on the same index", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const store = new DeepFixtureStore({
    lexicalTerm: "lexicalonly",
    vectorExcludedTerm: "lexicalonly"
  });
  await writeSummary(
    info,
    "parity-a-cafe0011",
    summary("parity-a-cafe0011", "Toggle settings for the daemon token")
  );
  await writeSummary(
    info,
    "parity-b-cafe0012",
    summary("parity-b-cafe0012", "Toggle settings for the composer")
  );
  await writeSummary(
    info,
    "parity-tie-cafe0013",
    summary("parity-tie-cafe0013", "Toggle settings for the daemon token")
  );
  await writeSummary(
    info,
    "parity-lexical-cafe0014",
    summary("parity-lexical-cafe0014", "lexicalonly passage about the workflow")
  );
  await writeSummary(
    info,
    "parity-identity-cafe0015",
    summary("parity-identity-cafe0015", "")
  );
  await rebuildMemoryInWorkspace(info, {
    provider,
    reranker: new FakeRerankingProvider(),
    store
  });
  const manifest = await readMemoryManifest(info);
  const layers = layersForDepth(2, presentLayersOf(manifest?.records ?? []));
  const vector = await provider.embedQuery(QUERY);
  const channels = await searchChannelsByLayer({
    info,
    store,
    generation: manifest?.generation,
    vector,
    queryText: QUERY,
    fields: lexicalFieldsForDeep(QUERY),
    layers
  });

  const recallReranker = new FakeRerankingProvider();
  const recall = await recallMemoryInWorkspace(info, {
    provider,
    reranker: recallReranker,
    store,
    query: QUERY,
    depth: 2,
    limit: 20
  });
  const deepReranker = new FakeRerankingProvider();
  const deep = await deepMemoryInWorkspace(info, {
    provider,
    reranker: deepReranker,
    store,
    query: QUERY,
    limit: 20
  });
  const m0Reranker = new FakeRerankingProvider();
  const m0 = await rankHybridMemoryCandidates(QUERY, channels, m0Reranker);
  const poolReranker = new FakeRerankingProvider();
  const pool = await rankDepthPoolPassages(QUERY, channels, poolReranker);

  // The same documents, in the same order, to one reranker call in each path.
  assert.deepEqual(
    deepReranker.rerankedDocuments,
    recallReranker.rerankedDocuments
  );
  assert.deepEqual(
    poolReranker.rerankedDocuments,
    recallReranker.rerankedDocuments
  );
  assert.deepEqual(
    m0Reranker.rerankedDocuments,
    recallReranker.rerankedDocuments
  );
  assert.equal(deepReranker.rerankCalls, 1);
  assert.equal(deep.rerankPairs, recall.rerankPairs);
  assert.equal(pool.ranked.length, m0.length);
  assert.deepEqual(pool.ranked, m0);

  // The fixture must admit several groups, or the comparisons below prove nothing.
  assert.ok(
    recall.results.length >= 3,
    "the fixture must admit several groups"
  );
  assert.ok(deep.results.length > 0, "memory_deep must return passages");

  // The admitted groups, in the M0 admission order, are the groups of recall.
  const admittedInM0Order = m0
    .filter((thread) => thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD)
    .map((thread) => thread.evidence.record.threadId);
  assert.deepEqual(
    recall.results.map((hit) => hit.groupId),
    admittedInM0Order
  );

  // memory_deep returns passages of admitted groups only, and only groups recall admits.
  const recallGroups = new Set(recall.results.map((hit) => hit.groupId));
  const deepGroups = new Set(deep.results.map((hit) => hit.groupId));
  assert.ok([...deepGroups].every((groupId) => recallGroups.has(groupId)));
  assert.equal(deep.abstained, recall.abstained);

  // A group that recall admits and memory_deep does not return has no passage to return: it is identity-only.
  const rows = await store.readRows(info, manifest?.generation);
  const missingGroups = [...recallGroups].filter(
    (groupId) => !deepGroups.has(groupId)
  );
  assert.ok(
    missingGroups.every(
      (groupId) =>
        rows.filter((row) => row.threadId === groupId && row.kind === "passage")
          .length === 0
    )
  );

  // Each passage carries the band of its group, the band that recall reports.
  assert.ok(
    deep.results.every((hit) => {
      const group = recall.results.find((item) => item.groupId === hit.groupId);
      return group !== undefined && hit.groupBand === memoryBandOf(group.score);
    })
  );

  // The lexical-only passage reaches the pool through the lexical channel alone.
  assert.ok(
    pool.entries.some(
      (entry) =>
        entry.evidence.record.threadId === "parity-lexical-cafe0014" &&
        entry.evidence.record.kind === "passage"
    )
  );
});

function summary(threadId: string, body: string): string {
  return summaryMarkdown(threadId, body);
}
