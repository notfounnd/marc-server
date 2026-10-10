import assert from "node:assert/strict";
import test from "node:test";
import {
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace
} from "../src/core/memory/index.js";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";
import { readMemoryManifest } from "../src/core/memory/store.js";
import {
  connectLanceDb,
  tableName
} from "../src/core/memory/lancedb-store-support.js";
import type { MemoryVectorRecord } from "../src/core/memory/types.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

test("LanceDB lexical indexes keep title, summary, and prefix evidence distinct", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  const records = lexicalRecords();
  const vectors = records.map((record) =>
    record.threadId === "ui" ? [1, 0, 0] : [0, 1, 0]
  );

  await store.rebuild(info, records, vectors, "hybrid-test");
  await store.validateGeneration(info, "hybrid-test");

  const [title, summary, passage, prefix, infix] = await Promise.all([
    store.searchLexical(info, "brutalism", [1, 0, 0], {
      field: "title",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "brutalism", [1, 0, 0], {
      field: "summary",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "toggle", [1, 0, 0], {
      field: "summary",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "brutal", [1, 0, 0], {
      field: "titlePrefix",
      generation: "hybrid-test",
      limit: 10
    }),
    store.searchLexical(info, "rutal", [1, 0, 0], {
      field: "titlePrefix",
      generation: "hybrid-test",
      limit: 10
    })
  ]);

  assert.deepEqual(
    title.map((hit) => hit.record.threadId),
    ["ui"]
  );
  assert.deepEqual(
    summary.map((hit) => hit.record.threadId),
    ["calibration"]
  );
  assert.equal(passage[0]?.record.kind, "passage");
  assert.equal(passage[0]?.record.threadId, "ui");
  assert.deepEqual(
    prefix.map((hit) => hit.record.threadId),
    ["ui"]
  );
  assert.deepEqual(infix, []);
  assert.equal(title[0]?.vectorScore, 1);
});

test("incremental LanceDB rebuild accepts null optional fields after a round trip", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  await writeSummary(
    info,
    "thread-a",
    summary("thread-a", "Stable", "unchanged")
  );
  await writeSummary(
    info,
    "thread-b",
    summary("thread-b", "Changed", "before")
  );

  const initial = await rebuildMemoryInWorkspace(info, {
    batchSize: 4,
    provider,
    reranker,
    store
  });
  assert.equal(initial.acquired, true);
  const initialManifest = await readMemoryManifest(info);
  assert.ok(initialManifest);
  const initialRows = await store.readRows(info, initialManifest.generation);
  const database = await connectLanceDb(info);
  const initialTable = await database.openTable(
    tableName(initialManifest.generation)
  );
  const storedRows = await initialTable.query().toArray();
  const storedIdentity = storedRows.find(
    (row) => row.recordId === "thread-a:identity"
  );
  assert.equal(storedIdentity?.sectionTitle, null);

  await writeSummary(
    info,
    "thread-b",
    summary("thread-b", "Changed", "after", "2026-10-10T12:00:00.000Z")
  );
  await writeSummary(info, "thread-c", summary("thread-c", "Added", "new"));
  const incremental = await reconcileMemoryInWorkspace(info, {
    batchSize: 4,
    provider,
    reranker,
    store
  });

  assert.equal(incremental.acquired, true);
  const activeManifest = await readMemoryManifest(info);
  assert.ok(activeManifest);
  assert.notEqual(activeManifest.generation, initialManifest.generation);
  const rows = await store.readRows(info, activeManifest.generation);
  const preservedRows = initialRows.filter(
    (row) => row.threadId === "thread-a"
  );
  const activeTable = await database.openTable(
    tableName(activeManifest.generation)
  );
  const schema = await activeTable.schema();
  const textFields = schema.fields.filter((field) => field.name !== "vector");
  assert.equal(textFields.length, 14);
  for (const field of textFields) {
    assert.equal(field.type.toString(), "Utf8");
    assert.equal(field.nullable, true);
  }
  const vectorField = schema.fields.find((field) => field.name === "vector");
  assert.ok(vectorField);
  assert.equal(vectorField.nullable, true);
  assert.equal((vectorField.type as { listSize: number }).listSize, 3);
  assert.equal(vectorField.type.valueField.type.toString(), "Float32");
  assert.equal(vectorField.type.valueField.nullable, true);
  const activeStoredRows = await activeTable.query().toArray();
  const activeStoredIdentity = activeStoredRows.find(
    (row) => row.recordId === "thread-a:identity"
  );
  assert.equal(activeStoredIdentity?.sectionTitle, null);
  assert.equal(activeStoredIdentity?.closedAt, null);
  assert.equal(
    rows.find((row) => row.recordId === "thread-a:identity")?.sectionTitle,
    undefined
  );
  assert.equal(
    rows.find((row) => row.recordId === "thread-a:identity")?.closedAt,
    undefined
  );
  assert.equal(
    rows.find((row) => row.recordId === "thread-b:identity")?.closedAt,
    "2026-10-10T12:00:00.000Z"
  );
  assert.equal(provider.documentCalls, 2);
  assert.deepEqual(rows.slice(0, preservedRows.length), preservedRows);
  assert.deepEqual(
    rows.filter((row) => row.threadId === "thread-a"),
    preservedRows
  );
});

test("LanceDB distinguishes null optional fields from empty strings", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  const allMissing = [
    record("missing-a", "identity", "Missing A", "identity"),
    record("missing-b", "identity", "Missing B", "identity")
  ];
  await store.rebuild(
    info,
    allMissing,
    [
      [1, 0],
      [0, 1]
    ],
    "missing-only"
  );

  const missingTable = await (
    await connectLanceDb(info)
  ).openTable(tableName("missing-only"));
  const missingSchema = await missingTable.schema();
  for (const name of ["closedAt", "sectionTitle"]) {
    const field = missingSchema.fields.find(
      (candidate) => candidate.name === name
    );
    assert.equal(field?.type.toString(), "Utf8");
    assert.equal(field?.nullable, true);
  }
  const missingStoredRows = await missingTable.query().toArray();
  assert.equal(missingStoredRows.length, allMissing.length);
  assert.equal(
    missingStoredRows.every(
      (row) => row.closedAt === null && row.sectionTitle === null
    ),
    true
  );

  const missing = record("optional", "identity", "Optional", "missing");
  const empty = {
    ...record("optional", "passage", "Optional", "empty"),
    closedAt: "",
    sectionTitle: ""
  };

  await store.rebuild(
    info,
    [missing, empty],
    [
      [1, 0],
      [0, 1]
    ],
    "optional-fields"
  );

  const rows = await store.readRows(info, "optional-fields");
  const missingRow = rows.find((row) => row.recordId === missing.recordId);
  const emptyRow = rows.find((row) => row.recordId === empty.recordId);
  assert.equal(missingRow?.sectionTitle, undefined);
  assert.equal(missingRow?.closedAt, undefined);
  assert.equal(emptyRow?.sectionTitle, "");
  assert.equal(emptyRow?.closedAt, "");

  const database = await connectLanceDb(info);
  const table = await database.openTable(tableName("optional-fields"));
  const storedRows = await table.query().toArray();
  const storedMissing = storedRows.find(
    (row) => row.recordId === missing.recordId
  );
  const storedEmpty = storedRows.find((row) => row.recordId === empty.recordId);
  assert.equal(storedMissing?.sectionTitle, null);
  assert.equal(storedMissing?.closedAt, null);
  assert.equal(storedEmpty?.sectionTitle, "");
  assert.equal(storedEmpty?.closedAt, "");
  const schema = await table.schema();
  const vectorField = schema.fields.find((field) => field.name === "vector");
  assert.ok(vectorField);
  assert.equal((vectorField.type as { listSize: number }).listSize, 2);
  assert.equal(vectorField.type.valueField.type.toString(), "Float32");
});

function summary(
  threadId: string,
  title: string,
  content: string,
  closedAt?: string
): string {
  return [
    `# Summary - ${title}`,
    `Thread: \`${threadId}\``,
    ...(closedAt ? [`Closed: \`${closedAt}\``] : []),
    "",
    "## Outcome",
    "",
    content
  ].join("\n");
}

function lexicalRecords(): MemoryVectorRecord[] {
  return [
    record("ui", "identity", "Neo brutalism interface", "Visual system"),
    record("ui", "passage", "Neo brutalism interface", "Button borders"),
    record(
      "ui",
      "passage",
      "Neo brutalism interface",
      "The toggle controls the visual mode"
    ),
    record(
      "calibration",
      "identity",
      "Search calibration",
      "The brutalism query exposed ranking behavior"
    )
  ];
}

function record(
  threadId: string,
  kind: "identity" | "passage",
  title: string,
  text: string
): MemoryVectorRecord {
  return {
    recordId: `${threadId}:${kind}`,
    threadId,
    title,
    summaryPath: `/tmp/${threadId}/SUMMARY.md`,
    relativeSummaryPath: `threads/${threadId}/SUMMARY.md`,
    reference: `marc://$${threadId}`,
    kind,
    sectionTitle: kind === "passage" ? "Result" : undefined,
    text,
    embeddingText: text
  };
}
