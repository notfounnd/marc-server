import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest,
  reconcileMemoryInWorkspace,
  rebuildMemoryInWorkspace
} from "../src/core/memory/index.js";
import {
  MEMORY_SOURCE_LAYERS,
  type MemoryLayer,
  type MemorySourceType
} from "../src/core/memory/types.js";
import type { MemoryVectorRow } from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

const ALL_SOURCE_TYPES: MemorySourceType[] = [
  "summary",
  "artifact",
  "rules",
  "document",
  "chat"
];

test("default rebuild indexes every configured layer, as the explicit rebuild of those layers does", async () => {
  const info = await summaryWorkspace();
  await addExtraSources(info);

  const defaults = await rebuiltRows(info);
  const explicit = await rebuiltRows(info, [0, 1, 2]);

  assert.ok(defaults.some((row) => row.layer !== 0));
  assert.deepEqual(textsById(defaults), textsById(explicit));
  assert.deepEqual(
    defaults.map((row) => row.sourceType),
    explicit.map((row) => row.sourceType)
  );
});

test("explicit layer 0 indexes only the summaries, as a summary-only workspace does", async () => {
  const info = await summaryWorkspace();
  await addExtraSources(info);
  const summaryOnly = await summaryWorkspace();

  const explicit = await rebuiltRows(info, [0]);
  const baseline = await rebuiltRows(summaryOnly);

  assert.ok(explicit.length > 0);
  assert.ok(explicit.every((row) => row.layer === 0));
  assert.deepEqual(textsById(explicit), textsById(baseline));
});

test("all layers include every source type with its own layer", async () => {
  const info = await summaryWorkspace();
  await addExtraSources(info);

  const rows = await rebuiltRows(info, [0, 1, 2]);
  const types = new Set(rows.map((row) => row.sourceType));

  assert.deepEqual([...types].sort(), [...ALL_SOURCE_TYPES].sort());
  for (const row of rows) {
    assert.equal(row.layer, MEMORY_SOURCE_LAYERS[row.sourceType]);
  }
  assert.ok(rows.some((row) => row.recordId.startsWith("@rules:source:")));
  assert.ok(
    rows.some((row) =>
      row.recordId.startsWith("@document/docs/policy.md:source:")
    )
  );
  assert.ok(rows.some((row) => row.recordId.startsWith("thread-a:chat:msg-1")));
  assert.ok(
    rows.some((row) =>
      row.recordId.startsWith("thread-a:artifact:notes.md:source:")
    )
  );
});

test("the manifest records every indexed source with its type and path", async () => {
  const info = await summaryWorkspace();
  await addExtraSources(info);

  await rebuiltRows(info, [0, 1, 2]);
  const manifest = await readMemoryManifest(info);
  const pairs = (manifest?.records ?? []).map((record) => [
    record.sourceType,
    record.sourcePath
  ]);

  assert.ok(pairs.some(([type]) => type === "rules"));
  assert.ok(pairs.some(([type]) => type === "chat"));
  assert.ok(pairs.some(([type]) => type === "artifact"));
  assert.ok(pairs.some(([type]) => type === "document"));
});

async function summaryWorkspace(): Promise<WorkspaceInfo> {
  const info = await tempWorkspace();
  await writeSummary(info, "thread-a", summaryA());
  await writeSummary(info, "thread-b", summaryB());
  return info;
}

function summaryA(): string {
  return [
    "# Summary - Thread A",
    "",
    "Thread: `thread-a`",
    "",
    "## Result",
    "",
    "Kept the snapshot.",
    "",
    "## Validation",
    "",
    "Ran the tests."
  ].join("\n");
}

function summaryB(): string {
  return [
    "# Summary - Thread B",
    "",
    "Thread: `thread-b`",
    "",
    "Plain closing note."
  ].join("\n");
}

async function addExtraSources(info: WorkspaceInfo): Promise<void> {
  await writeFileAt(
    path.join(info.marcPath, "threads", "thread-a", "artifacts", "notes.md"),
    "# Notes\n\n## Decision\n\nArtifact decision."
  );
  await writeFileAt(
    path.join(info.marcPath, "RULES.md"),
    "# Rules\n\n## Alpha\n\nAlpha rule.\n\n### Beta\n\nBeta rule."
  );
  await writeFileAt(
    path.join(info.marcPath, "threads", "thread-a", "CHAT.md"),
    [
      "# Thread A chat",
      "",
      "Thread: `thread-a`",
      "",
      "<!-- marc-message",
      "id: msg-1",
      "threadId: thread-a",
      "timestamp: 2026-10-01T00:00:01.000Z",
      "agentId: agent-a",
      "-->",
      "",
      "Chat body.",
      "",
      "<!-- /marc-message -->"
    ].join("\n")
  );
  await writeFileAt(
    path.join(info.rootPath, "docs", "policy.md"),
    "# Policy\n\n## Scope\n\nScope text."
  );
  await writeFileAt(
    path.join(info.marcPath, "marc.config.json"),
    JSON.stringify({
      memory: {
        documentSources: [{ path: "docs/policy.md", authority: "normative" }]
      }
    })
  );
}

async function rebuiltRows(
  info: WorkspaceInfo,
  indexedLayers?: readonly MemoryLayer[]
): Promise<MemoryVectorRow[]> {
  const store = new InMemoryMemoryVectorStore();
  await rebuildMemoryInWorkspace(info, {
    provider: new FakeEmbeddingProvider(),
    reranker: new FakeRerankingProvider(),
    store,
    indexedLayers
  });
  const manifest = await readMemoryManifest(info);
  return store.readRows(info, manifest?.generation);
}

function textsById(rows: MemoryVectorRow[]): Array<[string, string]> {
  return rows
    .map((row): [string, string] => [row.recordId, row.text])
    .sort((left, right) => left[0].localeCompare(right[0]));
}

test("switching a document from reference to normative re-indexes it", async () => {
  const info = await summaryWorkspace();
  await writeFileAt(
    path.join(info.rootPath, "docs", "policy.md"),
    "# Policy\n\n## Scope\n\nScope text."
  );
  await writeDocumentAuthority(info, "reference");
  const store = new InMemoryMemoryVectorStore();
  const options = {
    provider: new FakeEmbeddingProvider(),
    reranker: new FakeRerankingProvider(),
    store,
    indexedLayers: DOCUMENT_LAYERS
  };
  await rebuildMemoryInWorkspace(info, options);
  const before = await readMemoryManifest(info);
  await writeDocumentAuthority(info, "normative");

  const attempt = await reconcileMemoryInWorkspace(info, options);
  const after = await readMemoryManifest(info);

  assert.equal(attempt.acquired, true);
  assert.ok(before && after);
  assert.notEqual(after.generation, before.generation);
  const record = after.records.find(
    (item) => item.sourcePath === "docs/policy.md"
  );
  assert.equal(record?.authority, "rule");
  const rows = (await store.readRows(info, after.generation)).filter(
    (row) => row.sourcePath === "docs/policy.md"
  );
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.authority === "rule"));
});

const DOCUMENT_LAYERS: readonly MemoryLayer[] = [0, 1, 2];

async function writeDocumentAuthority(
  info: WorkspaceInfo,
  authority: "reference" | "normative"
): Promise<void> {
  await writeFileAt(
    path.join(info.marcPath, "marc.config.json"),
    JSON.stringify({
      memory: {
        documentSources: [{ path: "docs/policy.md", authority }]
      }
    })
  );
}

async function writeFileAt(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}
