import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMemoryVectorStore } from "../src/core/memory/index.js";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";
import type {
  MemoryLayer,
  MemoryVectorRecord
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { tempWorkspace } from "./memory-test-helpers.js";
import {
  sha256Text,
  summaryProvenanceFixture
} from "./memory-provenance-fixtures.js";

const PROVENANCE_KEYS = [
  "sourceType",
  "layer",
  "sourcePath",
  "authority",
  "lineStart",
  "lineEnd",
  "sourceSha256",
  "passageOrdinal",
  "passageSha256",
  "passageId"
] as const;

const SUMMARY_LAYER_RECORD = fixtureRecord(
  "thread-layer",
  "passage",
  "Brutalism summary passage."
);

const ARTIFACT_LAYER_RECORD: MemoryVectorRecord = {
  ...fixtureRecord("artifact-layer", "passage", "Brutalism artifact passage."),
  sourceType: "artifact",
  layer: 1,
  authority: "artifact",
  sourcePath: ".marc/threads/artifact-layer/artifacts/notes.md"
};

const VECTOR_LAYER_SCENARIOS: Array<{
  name: string;
  layers?: readonly MemoryLayer[];
  expectedRecordIds: string[];
}> = [
  {
    name: "the default search reads only the summary layer",
    expectedRecordIds: [SUMMARY_LAYER_RECORD.recordId]
  },
  {
    name: "layer 1 reads only artifact records",
    layers: [1],
    expectedRecordIds: [ARTIFACT_LAYER_RECORD.recordId]
  },
  {
    name: "both layers return both records",
    layers: [0, 1],
    expectedRecordIds: [
      SUMMARY_LAYER_RECORD.recordId,
      ARTIFACT_LAYER_RECORD.recordId
    ]
  },
  {
    name: "an empty layer list returns no records",
    layers: [],
    expectedRecordIds: []
  }
];

for (const scenario of VECTOR_LAYER_SCENARIOS) {
  test(`in-memory vector search: ${scenario.name}`, async () => {
    const info = await tempWorkspace();
    const store = new InMemoryMemoryVectorStore();
    await layeredRecordsStore(info, store, "layers-memory");

    const hits = await store.searchVector(info, [1, 0, 0], {
      generation: "layers-memory",
      kind: "passage",
      layers: scenario.layers,
      limit: 10
    });

    assert.deepEqual(
      hits.map((hit) => hit.record.recordId).sort(),
      [...scenario.expectedRecordIds].sort()
    );
  });

  test(`LanceDB vector search: ${scenario.name}`, async () => {
    const info = await tempWorkspace();
    const store = new LanceDbMemoryVectorStore();
    await layeredRecordsStore(info, store, "layers-lancedb");

    const hits = await store.searchVector(info, [1, 0, 0], {
      generation: "layers-lancedb",
      kind: "passage",
      layers: scenario.layers,
      limit: 10
    });

    assert.deepEqual(
      hits.map((hit) => hit.record.recordId).sort(),
      [...scenario.expectedRecordIds].sort()
    );
  });
}

test("LanceDB lexical search respects the layer filter", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  await layeredRecordsStore(info, store, "layers-lexical");

  const defaultHits = await store.searchLexical(info, "brutalism", [1, 0, 0], {
    field: "summary",
    generation: "layers-lexical",
    limit: 10
  });
  const artifactHits = await store.searchLexical(info, "brutalism", [1, 0, 0], {
    field: "summary",
    generation: "layers-lexical",
    layers: [1],
    limit: 10
  });

  assert.deepEqual(
    defaultHits.map((hit) => hit.record.recordId),
    [SUMMARY_LAYER_RECORD.recordId]
  );
  assert.deepEqual(
    artifactHits.map((hit) => hit.record.recordId),
    [ARTIFACT_LAYER_RECORD.recordId]
  );
});

test("LanceDB round trip keeps provenance and returns absent optional fields as absent", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  const plain = fixtureRecord("thread-rt", "identity", "Plain text.");
  const withOptional: MemoryVectorRecord = {
    ...fixtureRecord("thread-rt", "passage", "Optional text."),
    messageId: "msg-1",
    agentId: "agent-a"
  };
  await store.rebuild(
    info,
    [plain, withOptional],
    [
      [1, 0, 0],
      [0, 1, 0]
    ],
    "round-trip"
  );

  const rows = await store.readRows(info, "round-trip");
  const restoredById = new Map(rows.map((row) => [row.recordId, row]));
  const restoredOptional = restoredById.get(withOptional.recordId);
  const restoredPlain = restoredById.get(plain.recordId);

  assert.equal(restoredOptional?.messageId, "msg-1");
  assert.equal(restoredOptional?.agentId, "agent-a");
  assert.equal(restoredOptional?.artifactFileName, undefined);
  assert.equal(restoredPlain?.messageId, undefined);
  assert.equal(restoredPlain?.agentId, undefined);
  for (const original of [plain, withOptional]) {
    const restored = restoredById.get(original.recordId);
    assert.ok(restored);
    for (const key of PROVENANCE_KEYS) {
      assert.equal(restored[key], original[key]);
    }
  }
});

function fixtureRecord(
  threadId: string,
  kind: "identity" | "passage",
  text: string
): MemoryVectorRecord {
  return {
    recordId: `${threadId}:${kind}:${sha256Text(text).slice(0, 8)}`,
    threadId,
    title: `${threadId} title`,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    text,
    embeddingText: text,
    ...summaryProvenanceFixture(threadId, text)
  };
}

async function layeredRecordsStore(
  info: WorkspaceInfo,
  store: InMemoryMemoryVectorStore | LanceDbMemoryVectorStore,
  generation: string
): Promise<void> {
  await store.rebuild(
    info,
    [SUMMARY_LAYER_RECORD, ARTIFACT_LAYER_RECORD],
    [
      [1, 0, 0],
      [1, 0, 0]
    ],
    generation
  );
}
