import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest,
  readMemoryStatusInWorkspace,
  reconcileMemoryInWorkspace,
  rebuildMemoryInWorkspace
} from "../src/core/memory/index.js";
import { memoryManifestPath } from "../src/core/memory/store.js";
import type {
  MemoryVectorRow,
  RerankingProvider
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import { sha256Text } from "./memory-provenance-fixtures.js";

// Line numbers are 1-based. The blank line after "## Result" belongs to Result.
const SECTIONED_SUMMARY = [
  "# Summary - Provenance check",
  "",
  "Thread: `thread-prov`",
  "",
  "## Result",
  "",
  "Decided to keep the snapshot.",
  "",
  "## Validation",
  "",
  "Ran the focused tests."
].join("\n");

class DeclaredSplitReranker extends FakeRerankingProvider {
  constructor(private readonly partsByText: Record<string, string[]>) {
    super();
  }

  override async splitPassages(texts: string[]): Promise<string[][]> {
    return texts.map((text) => this.partsByText[text] ?? [text]);
  }
}

test("summary records carry layer 0, decision authority, and the summary source path", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-prov", SECTIONED_SUMMARY);

  const rows = await rebuiltRows(info);

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.sourceType, "summary");
    assert.equal(row.layer, 0);
    assert.equal(row.authority, "decision");
    assert.equal(row.sourcePath, ".marc/threads/thread-prov/SUMMARY.md");
  }
});

test("manifest records carry the source type and source path", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-prov", SECTIONED_SUMMARY);
  await rebuiltRows(info);

  const manifest = await readMemoryManifest(info);

  assert.equal(manifest?.records[0]?.sourceType, "summary");
  assert.equal(
    manifest?.records[0]?.sourcePath,
    ".marc/threads/thread-prov/SUMMARY.md"
  );
});

test("line provenance points at the section heading inside the summary file", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-prov", SECTIONED_SUMMARY);
  const lines = (
    await fs.readFile(summaryFilePath(info, "thread-prov"), "utf8")
  ).split(/\r?\n/);

  const rows = await rebuiltRows(info);
  const passages = rows.filter((row) => row.kind === "passage");

  assert.equal(passages.length, 2);
  for (const row of passages) {
    assert.equal(lines[row.lineStart - 1], `## ${row.sectionTitle}`);
    assert.ok(row.lineEnd >= row.lineStart);
    assert.ok(row.lineEnd <= lines.length);
  }
  const result = passages.find((row) => row.sectionTitle === "Result");
  const validation = passages.find((row) => row.sectionTitle === "Validation");
  assert.equal(result?.lineStart, 5);
  assert.equal(result?.lineEnd, 8);
  assert.equal(validation?.lineStart, 9);
  assert.equal(validation?.lineEnd, 11);
});

test("identity inherits the lines of the first section with text", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-prov", SECTIONED_SUMMARY);

  const rows = await rebuiltRows(info);
  const identity = rows.find((row) => row.kind === "identity");

  assert.equal(identity?.lineStart, 5);
  assert.equal(identity?.lineEnd, 8);
  assert.equal(identity?.passageOrdinal, 0);
});

test("summaries without sections use the whole file for identity and overview lines", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-plain", "Plain summary text.\nSecond line.");

  const rows = await rebuiltRows(info);
  const identity = rows.find((row) => row.kind === "identity");
  const overview = rows.find((row) => row.kind === "passage");

  assert.equal(identity?.lineStart, 1);
  assert.equal(identity?.lineEnd, 2);
  assert.equal(overview?.sectionTitle, "Overview");
  assert.equal(overview?.lineStart, 1);
  assert.equal(overview?.lineEnd, 2);
});

test("source hash covers the summary bytes and passage hash covers the indexed text", async () => {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-prov", SECTIONED_SUMMARY);
  const fileText = await fs.readFile(
    summaryFilePath(info, "thread-prov"),
    "utf8"
  );

  const rows = await rebuiltRows(info);

  for (const row of rows) {
    assert.equal(row.sourceSha256, sha256Text(fileText));
    assert.equal(row.passageSha256, sha256Text(row.text));
    assert.equal(
      row.passageId,
      `${row.sourcePath}#${row.passageSha256.slice(0, 16)}`
    );
  }
});

test("two passages of different text in one section get distinct ids and ordinals", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-split",
    [
      "# Summary - Split check",
      "",
      "Thread: `thread-split`",
      "",
      "## Decision",
      "",
      "Alpha keeps the cache. Beta drops the queue."
    ].join("\n")
  );
  const reranker = new DeclaredSplitReranker({
    "Alpha keeps the cache. Beta drops the queue.": [
      "Alpha keeps the cache.",
      "Beta drops the queue."
    ]
  });

  const rows = await rebuiltRows(info, reranker);
  const passages = rows.filter((row) => row.kind === "passage");

  assert.deepEqual(
    passages.map((row) => row.passageOrdinal),
    [0, 1]
  );
  assert.deepEqual(
    passages.map((row) => row.text),
    ["Alpha keeps the cache.", "Beta drops the queue."]
  );
  assert.notEqual(passages[0]?.passageId, passages[1]?.passageId);
});

test("the same text in different sections of one file gets the same passage id", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-repeat",
    [
      "# Summary - Repeat check",
      "",
      "Thread: `thread-repeat`",
      "",
      "## First",
      "",
      "Same text.",
      "",
      "## Second",
      "",
      "Same text."
    ].join("\n")
  );

  const rows = await rebuiltRows(info);
  const passages = rows.filter((row) => row.kind === "passage");

  assert.equal(passages.length, 2);
  assert.equal(passages[0]?.passageId, passages[1]?.passageId);
  assert.notEqual(passages[0]?.recordId, passages[1]?.recordId);
});

test("duplicate section titles keep distinct record ids and their own passages", async () => {
  const info = await tempWorkspace();
  await writeSummary(
    info,
    "thread-dup",
    [
      "# Summary - Duplicate check",
      "",
      "Thread: `thread-dup`",
      "",
      "## Result",
      "",
      "First result.",
      "",
      "## Result",
      "",
      "Second result."
    ].join("\n")
  );

  const rows = await rebuiltRows(info);
  const passages = rows.filter((row) => row.kind === "passage");

  assert.deepEqual(
    passages.map((row) => row.recordId),
    [
      "thread-dup:source:result:passage:001",
      "thread-dup:source:result-2:passage:001"
    ]
  );
  assert.deepEqual(
    passages.map((row) => row.text),
    ["First result.", "Second result."]
  );
  assert.deepEqual(
    passages.map((row) => [row.lineStart, row.lineEnd]),
    [
      [5, 8],
      [9, 11]
    ]
  );
});

test("a schema 6 manifest reports incompatible status and refuses reconciliation", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "thread-prov", SECTIONED_SUMMARY);
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  const current = await readMemoryManifest(info);
  assert.ok(current);
  const legacyManifest = {
    ...current,
    retrievalContract: "field-aware-hybrid-v2",
    schemaVersion: 6
  };
  await fs.writeFile(
    memoryManifestPath(info),
    JSON.stringify(legacyManifest, null, 2)
  );

  const status = await readMemoryStatusInWorkspace(info, {
    provider,
    reranker,
    store
  });

  assert.equal(status.status, "incompatible");
  await assert.rejects(
    reconcileMemoryInWorkspace(info, { provider, reranker, store }),
    /Memory schema changed/
  );
});

async function rebuiltRows(
  info: WorkspaceInfo,
  reranker: RerankingProvider = new FakeRerankingProvider()
): Promise<MemoryVectorRow[]> {
  const store = new InMemoryMemoryVectorStore();
  await rebuildMemoryInWorkspace(info, {
    provider: new FakeEmbeddingProvider(),
    reranker,
    store
  });
  const manifest = await readMemoryManifest(info);
  return store.readRows(info, manifest?.generation);
}

function summaryFilePath(info: WorkspaceInfo, threadId: string): string {
  return path.join(info.marcPath, "threads", threadId, "SUMMARY.md");
}
