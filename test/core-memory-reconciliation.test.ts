import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";

class RecordingEmbeddingProvider extends FakeEmbeddingProvider {
  readonly batches: string[][] = [];

  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.batches.push([...texts]);
    return super.embedDocuments(texts);
  }
}

class FailingEmbeddingProvider extends RecordingEmbeddingProvider {
  constructor(private readonly failingBatch: number) {
    super();
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (this.batches.length + 1 === this.failingBatch)
      throw new Error("Embedding batch failed.");
    return super.embedDocuments(texts);
  }
}

test("full rebuild respects the configured inference batch size", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummaries(info, 5);

  await rebuildMemoryInWorkspace(info, {
    batchSize: 4,
    provider,
    reranker,
    store
  });

  assert.ok(provider.batches.length > 1);
  assert.equal(
    provider.batches.every((batch) => batch.length <= 4),
    true
  );
});

test("incremental reconciliation embeds only changed summaries", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "thread-one", summaryFor("Thread one", "first"));
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  provider.batches.length = 0;

  const firstManifest = await readMemoryManifest(info);
  await reconcileMemoryInWorkspace(info, { provider, reranker, store });
  assert.equal(provider.batches.length, 0);

  await writeSummary(info, "thread-one", summaryFor("Thread one", "second"));
  await reconcileMemoryInWorkspace(info, { provider, reranker, store });
  const secondManifest = await readMemoryManifest(info);
  assert.equal(provider.batches.length, 1);
  assert.notEqual(secondManifest?.generation, firstManifest?.generation);
});

test("incremental reconciliation removes records for deleted summaries", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "thread-one", summaryFor("Thread one", "first"));
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  await fs.rm(path.join(info.marcPath, "threads", "thread-one"), {
    force: true,
    recursive: true
  });

  await reconcileMemoryInWorkspace(info, { provider, reranker, store });
  assert.deepEqual(await store.listRecordIds(), []);
});

test("failed full rebuild leaves the index missing", async () => {
  const info = await tempWorkspace();
  const provider = new FailingEmbeddingProvider(1);
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummaries(info, 1);

  await assert.rejects(
    rebuildMemoryInWorkspace(info, { provider, reranker, store }),
    /Embedding batch failed/
  );

  const status = await readMemoryStatusInWorkspace(info, {
    provider,
    reranker,
    store
  });
  assert.equal(status.status, "missing");
});

test("failed full rebuild preserves the active generation", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummaries(info, 1);
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });
  const active = await readMemoryManifest(info);
  const activeRecordIds = await store.listRecordIds(info, active?.generation);
  await writeSummary(info, "thread-1", summaryFor("Thread 1", "changed"));

  await assert.rejects(
    rebuildMemoryInWorkspace(info, {
      provider: new FailingEmbeddingProvider(1),
      reranker,
      store
    }),
    /Embedding batch failed/
  );

  const preserved = await readMemoryManifest(info);
  assert.equal(preserved?.generation, active?.generation);
  assert.deepEqual(
    await store.listRecordIds(info, active?.generation),
    activeRecordIds
  );
});

test("failed incremental validation keeps the active manifest and rows", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "thread-one", summaryFor("Thread one", "first"));
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const active = await readMemoryManifest(info);
  assert.ok(active);
  const activeRows = await store.readRows(info, active.generation);
  await writeSummary(info, "thread-one", summaryFor("Thread one", "changed"));
  const validateGeneration = store.validateGeneration;
  store.validateGeneration = async () => {
    throw new Error("Generation validation failed.");
  };

  await assert.rejects(
    reconcileMemoryInWorkspace(info, { provider, reranker, store }),
    /Generation validation failed/
  );
  store.validateGeneration = validateGeneration;

  const preserved = await readMemoryManifest(info);
  assert.deepEqual(preserved, active);
  assert.deepEqual(await store.readRows(info, active.generation), activeRows);
});

test("empty LanceDB generations publish without a table and accept later rows", async () => {
  const info = await tempWorkspace();
  const store = new LanceDbMemoryVectorStore();
  const provider = new FakeEmbeddingProvider();
  const reranker = new FakeRerankingProvider();
  await rebuildMemoryInWorkspace(info, { provider, reranker, store });

  const emptyManifest = await readMemoryManifest(info);
  assert.ok(emptyManifest);
  assert.deepEqual(emptyManifest.records, []);
  assert.equal(await store.exists(info, emptyManifest.generation), false);
  assert.deepEqual(await store.readRows(info, emptyManifest.generation), []);

  await writeSummary(
    info,
    "thread-later",
    [
      "# Summary - Later",
      "Thread: `thread-later`",
      "",
      "## Outcome",
      "",
      "added"
    ].join("\n")
  );
  await reconcileMemoryInWorkspace(info, { provider, reranker, store });

  const populatedManifest = await readMemoryManifest(info);
  assert.ok(populatedManifest);
  assert.notEqual(populatedManifest.generation, emptyManifest.generation);
  assert.ok(await store.exists(info, populatedManifest.generation));
  assert.ok(
    (await store.readRows(info, populatedManifest.generation)).length > 0
  );

  const documentCalls = provider.documentCalls;
  await fs.rm(path.join(info.marcPath, "threads", "thread-later"), {
    force: true,
    recursive: true
  });
  await reconcileMemoryInWorkspace(info, { provider, reranker, store });

  const removedManifest = await readMemoryManifest(info);
  assert.ok(removedManifest);
  assert.deepEqual(removedManifest.records, []);
  assert.equal(provider.documentCalls, documentCalls);
  assert.equal(await store.exists(info, removedManifest.generation), false);
});

async function writeSummaries(
  info: Awaited<ReturnType<typeof tempWorkspace>>,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    await writeSummary(
      info,
      `thread-${index + 1}`,
      summaryFor(`Thread ${index + 1}`, `content ${index + 1}`)
    );
  }
}

function summaryFor(title: string, content: string): string {
  return [
    `# Summary - ${title}`,
    "",
    `Thread: \`${title.toLowerCase().replaceAll(" ", "-")}\``,
    "",
    "## Result",
    "",
    `- ${content}`
  ].join("\n");
}
