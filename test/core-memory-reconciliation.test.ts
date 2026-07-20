import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  InMemoryMemoryVectorStore,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace,
  scanThreadSummarySources
} from "../src/core/memory/index.js";
import {
  FakeEmbeddingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";

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

test("full rebuild limits local embedding inference to batches of four records", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummaries(info, 5);

  const sources = await scanThreadSummarySources(info);
  const recordCount = sources.reduce(
    (total, source) => total + source.chunks.length,
    0
  );

  await rebuildMemoryInWorkspace(info, { provider, store });

  assert.ok(provider.batches.length > 1);
  assert.equal(
    provider.batches.every((batch) => batch.length <= 4),
    true
  );
  assert.equal(
    provider.batches.reduce((total, batch) => total + batch.length, 0),
    recordCount
  );
  assert.equal(provider.disposeCalls, 1);
});

test("incremental reconciliation skips unchanged sources and embeds only changes", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "thread-one", summaryFor("Thread one", "first"));

  await rebuildMemoryInWorkspace(info, { provider, store });
  const batchesAfterFullRebuild = provider.batches.length;

  await reconcileMemoryInWorkspace(info, { provider, store });
  assert.equal(provider.batches.length, batchesAfterFullRebuild);

  await writeSummary(info, "thread-two", summaryFor("Thread two", "second"));
  await reconcileMemoryInWorkspace(info, { provider, store });
  const batchesAfterAdding = provider.batches.length;

  await writeSummary(
    info,
    "thread-one",
    summaryFor("Thread one", "changed first")
  );
  await reconcileMemoryInWorkspace(info, { provider, store });

  const status = await readMemoryStatusInWorkspace(info, { provider, store });
  assert.ok(provider.batches.length > batchesAfterFullRebuild);
  assert.ok(provider.batches.length > batchesAfterAdding);
  assert.equal(status.status, "ready");
  assert.equal(status.summaryCount, 2);
});

test("a failed embedding batch leaves the previous full rebuild projection absent", async () => {
  const info = await tempWorkspace();
  const provider = new FailingEmbeddingProvider(2);
  const store = new InMemoryMemoryVectorStore();
  await writeSummaries(info, 5);

  await assert.rejects(
    rebuildMemoryInWorkspace(info, { provider, store }),
    /Embedding batch failed/
  );

  const status = await readMemoryStatusInWorkspace(info, { provider, store });
  assert.equal(status.status, "missing");
  assert.equal(provider.disposeCalls, 1);
});

test("incremental reconciliation removes records for deleted summaries without embedding", async () => {
  const info = await tempWorkspace();
  const provider = new RecordingEmbeddingProvider();
  const store = new InMemoryMemoryVectorStore();
  await writeSummary(info, "thread-one", summaryFor("Thread one", "first"));
  await writeSummary(info, "thread-two", summaryFor("Thread two", "second"));

  await rebuildMemoryInWorkspace(info, { provider, store });
  const batchesAfterFullRebuild = provider.batches.length;
  await fs.rm(path.join(info.marcPath, "threads", "thread-one", "SUMMARY.md"));

  await reconcileMemoryInWorkspace(info, { provider, store });

  const expectedRecordIds = (await scanThreadSummarySources(info))
    .flatMap((source) => source.chunks)
    .map((chunk) => chunk.recordId)
    .sort();
  assert.deepEqual((await store.listRecordIds()).sort(), expectedRecordIds);
  assert.equal(provider.batches.length, batchesAfterFullRebuild);
});

async function writeSummaries(
  info: Awaited<ReturnType<typeof tempWorkspace>>,
  count: number
): Promise<void> {
  for (let index = 1; index <= count; index += 1)
    await writeSummary(
      info,
      `thread-${index}`,
      summaryFor(`Thread ${index}`, `decision ${index}`)
    );
}

function summaryFor(title: string, decision: string): string {
  return [
    `# Summary - ${title}`,
    "",
    `Thread: \`${title.toLowerCase().replaceAll(" ", "-")}\``,
    "Closed: `2026-07-20T00:00:00.000Z`",
    "",
    "## Executive summary",
    "",
    `- ${decision} summary.`,
    "",
    "## Decision",
    "",
    `- ${decision}.`
  ].join("\\n");
}
