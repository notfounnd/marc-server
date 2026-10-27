import assert from "node:assert/strict";
import test from "node:test";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";
import type {
  MemoryLexicalSearchHit,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import type {
  MemoryLayer,
  MemorySourceType
} from "../src/core/memory/sources/contract.js";
import { summaryProvenanceFixture } from "./memory-provenance-fixtures.js";
import { tempWorkspace } from "./memory-test-helpers.js";

const QUERY_VECTOR = [1, 0, 0];

// Layer 0: the summaries.
const LAYER_ZERO_RECORDS = [
  record(
    "summary-a",
    0,
    "summary",
    "brutalism interface notes for the composer"
  ),
  record("summary-b", 0, "summary", "unrelated caching notes about a queue"),
  record("summary-c", 0, "summary", "brutalism brutalism interface")
];

// Layers 1 and 2: artifacts and chat messages that repeat the query terms many times.
const HIGH_FREQUENCY_RECORDS = [
  record(
    "artifact-a",
    1,
    "artifact",
    "brutalism interface brutalism interface brutalism"
  ),
  record(
    "artifact-b",
    1,
    "artifact",
    "brutalism brutalism brutalism interface"
  ),
  record(
    "chat-a",
    2,
    "chat",
    "brutalism interface brutalism brutalism interface"
  )
];

const LAYER_ZERO_ONLY = {
  generation: "layer-zero-only",
  records: LAYER_ZERO_RECORDS
};

const THREE_LAYERS = {
  generation: "three-layers",
  records: [...LAYER_ZERO_RECORDS, ...HIGH_FREQUENCY_RECORDS]
};

test("a single-term query returns the same layer-zero summary hits with and without layers one and two", async () => {
  // Scenario: "brutalism" over the summary field. Adding high-frequency documents of layers
  // one and two must not change which layer-zero summaries are hit, nor their order.
  const before = await layerZeroHits(LAYER_ZERO_ONLY, "brutalism");
  const after = await layerZeroHits(THREE_LAYERS, "brutalism");
  assert.deepEqual(hitIdsOf(after), hitIdsOf(before));
});

test("a two-term query returns the same layer-zero summary hits with and without layers one and two", async () => {
  // Scenario: "brutalism interface" over the summary field, with the same added documents.
  const before = await layerZeroHits(LAYER_ZERO_ONLY, "brutalism interface");
  const after = await layerZeroHits(THREE_LAYERS, "brutalism interface");
  assert.deepEqual(hitIdsOf(after), hitIdsOf(before));
});

test("the layer filter keeps layer-one and layer-two documents out of a layer-zero search", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  await store.rebuild(
    info,
    THREE_LAYERS.records,
    vectorsFor(THREE_LAYERS.records),
    THREE_LAYERS.generation
  );
  await store.validateGeneration(info, THREE_LAYERS.generation);
  const hits = await store.searchLexical(info, "brutalism", QUERY_VECTOR, {
    field: "summary",
    generation: THREE_LAYERS.generation,
    layers: [0],
    limit: 100
  });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((hit) => hit.record.layer === 0));
});

test("readRows on LanceDB returns only the requested layers, and every layer without a filter", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  await store.rebuild(
    info,
    THREE_LAYERS.records,
    vectorsFor(THREE_LAYERS.records),
    THREE_LAYERS.generation
  );
  await store.validateGeneration(info, THREE_LAYERS.generation);
  const layerZero = await store.readRows(info, THREE_LAYERS.generation, {
    layers: [0]
  });
  const everything = await store.readRows(info, THREE_LAYERS.generation);
  assert.ok(layerZero.length > 0);
  assert.ok(layerZero.every((row) => row.layer === 0));
  assert.equal(everything.length, THREE_LAYERS.records.length);
  assert.ok(everything.some((row) => row.layer === 2));
});

async function layerZeroHits(
  scenario: { generation: string; records: MemoryVectorRecord[] },
  query: string
): Promise<MemoryLexicalSearchHit[]> {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  await store.rebuild(
    info,
    scenario.records,
    vectorsFor(scenario.records),
    scenario.generation
  );
  await store.validateGeneration(info, scenario.generation);
  return store.searchLexical(info, query, QUERY_VECTOR, {
    field: "summary",
    generation: scenario.generation,
    layers: [0],
    limit: 100
  });
}

function hitIdsOf(hits: MemoryLexicalSearchHit[]): string[] {
  return hits.map((hit) => hit.record.recordId);
}

function vectorsFor(records: readonly MemoryVectorRecord[]): number[][] {
  return records.map(() => QUERY_VECTOR);
}

function record(
  threadId: string,
  layer: MemoryLayer,
  sourceType: MemorySourceType,
  text: string
): MemoryVectorRecord {
  return {
    ...summaryProvenanceFixture(threadId, text),
    recordId: `${threadId}:passage`,
    threadId,
    title: `${threadId} title`,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind: "passage",
    sectionTitle: "Result",
    text,
    embeddingText: text,
    layer,
    sourceType
  };
}
