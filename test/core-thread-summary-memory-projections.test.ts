import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  BackgroundMemoryReconciler,
  readMemoryManifest
} from "../src/core/memory/index.js";
import { renderSummary } from "../src/core/thread-summary-markdown.js";
import { hashSummaryBytes } from "../src/core/thread-summary-paths.js";
import { writeThreadSummaryInWorkspace } from "../src/core/thread-summary.js";
import { createThread, getWorkspaceInfo } from "../src/core/workspace.js";
import type { WorkspaceInfo, WorkspaceSettings } from "../src/core/types.js";
import type {
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemoryManifestRecord,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "../src/core/memory/types.js";
import {
  Deferred,
  PreparedProvider
} from "./background-memory-test-helpers.js";
import { FakeRerankingProvider } from "./memory-test-helpers.js";
import {
  getSummaryPath,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";

function summaryRecords(
  records: MemoryManifestRecord[]
): MemoryManifestRecord[] {
  return records.filter((record) => record.sourceType === "summary");
}

class ObservedMemoryReconciler extends BackgroundMemoryReconciler {
  rebuildCalls = 0;
  observedRebuild?: Promise<void>;

  override rebuild(settings?: WorkspaceSettings): Promise<void> {
    this.rebuildCalls += 1;
    this.observedRebuild = super.rebuild(settings);
    return this.observedRebuild;
  }
}

class SummaryPreparedProvider extends PreparedProvider {
  override async embedDocuments(texts: string[]): Promise<number[][]> {
    this.documentCalls += 1;
    return texts.map(() => [1, 0, 0]);
  }

  override async embedQuery(_text: string): Promise<number[]> {
    this.queryCalls += 1;
    return [1, 0, 0];
  }
}

class StartedPreparedProvider extends SummaryPreparedProvider {
  constructor(
    gate: Deferred,
    private readonly started: Deferred
  ) {
    super(false, gate);
  }

  override async prepare(): Promise<void> {
    this.started.resolve();
    await super.prepare();
  }
}

class ControlledMemoryStore implements MemoryVectorStore {
  private readonly generations = new Map<string, MemoryVectorRow[]>();
  private latestGeneration = "";

  async exists(_info: WorkspaceInfo, generation?: string): Promise<boolean> {
    return this.generations.has(generation ?? this.latestGeneration);
  }

  async listRecordIds(
    _info: WorkspaceInfo,
    generation?: string
  ): Promise<string[]> {
    return (await this.readRows(_info, generation)).map((row) => row.recordId);
  }

  async readRows(
    _info: WorkspaceInfo,
    generation?: string
  ): Promise<MemoryVectorRow[]> {
    return this.generations.get(generation ?? this.latestGeneration) ?? [];
  }

  async rebuild(
    _info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][],
    generation = "test-generation"
  ): Promise<void> {
    this.generations.set(
      generation,
      records.map((record, index) => ({
        ...record,
        vector: vectors[index] ?? []
      }))
    );
    this.latestGeneration = generation;
  }

  async reconcile(
    _info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    const remaining = (await this.readRows(_info)).filter(
      (row) => !removeRecordIds.includes(row.recordId)
    );
    this.generations.set(this.latestGeneration, [...remaining, ...rows]);
  }

  async validateGeneration(
    info: WorkspaceInfo,
    generation: string
  ): Promise<void> {
    assert.ok(await this.exists(info, generation));
  }

  async searchVector(
    _info: WorkspaceInfo,
    _vector: number[],
    _options: {
      generation?: string;
      kind?: "identity" | "passage";
      limit: number;
    }
  ): Promise<MemorySearchHit[]> {
    return [];
  }

  async searchLexical(
    _info: WorkspaceInfo,
    _query: string,
    _vector: number[],
    _options: { field: MemoryLexicalField; generation?: string; limit: number }
  ): Promise<MemoryLexicalSearchHit[]> {
    return [];
  }
}

test("auto-off stays pending during real preparation without starting a rebuild", async (t) => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Auto rebuild disabled");
  const info = await getWorkspaceInfo(workspace);
  const gate = new Deferred();
  const preparationStarted = new Deferred();
  const provider = new StartedPreparedProvider(gate, preparationStarted);
  const memory = new ObservedMemoryReconciler(
    info,
    () => provider,
    new ControlledMemoryStore(),
    () => new FakeRerankingProvider()
  );
  const preparation = memory.prepare();
  t.after(async () => {
    gate.resolve();
    await preparation;
    await fs.rm(workspace, { recursive: true, force: true });
  });
  await preparationStarted.promise;
  const prepareCallsBeforeSummary = provider.prepareCalls;
  await fs.writeFile(
    path.join(info.marcPath, "SETTINGS.md"),
    "<!-- marc-settings\nmemory.autoRebuild: false\n-->\n",
    "utf8"
  );

  const result = await writeThreadSummaryInWorkspace(
    info,
    { threadId: thread.id, body: "Still pending." },
    { projections: { memoryReconciler: memory } }
  );

  assert.equal(result.projections.memory, "pending");
  assert.equal(provider.prepareCalls, prepareCallsBeforeSummary);
  assert.equal(provider.queryCalls, 0);
  assert.equal(memory.rebuildCalls, 0);
});

test("eligible auto mode completes an incremental rebuild without model preparation", async (t) => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Auto rebuild enabled");
  const info = await getWorkspaceInfo(workspace);
  const provider = new SummaryPreparedProvider(true);
  const memory = new ObservedMemoryReconciler(
    info,
    () => provider,
    new ControlledMemoryStore(),
    () => new FakeRerankingProvider()
  );
  t.after(async () => {
    await memory.observedRebuild;
    await fs.rm(workspace, { recursive: true, force: true });
  });
  const initialMarkdown = renderSummary(
    thread.title,
    `marc://$${thread.id}`,
    "Initial source.",
    "2026-10-12T00:00:00.000Z"
  );
  await fs.writeFile(
    getSummaryPath(workspace, thread.id),
    initialMarkdown,
    "utf8"
  );
  await fs.writeFile(
    path.join(info.marcPath, "SETTINGS.md"),
    "<!-- marc-settings\nmemory.autoRebuild: false\n-->\n",
    "utf8"
  );
  await memory.rebuildFull();
  const initialManifest = await readMemoryManifest(info);
  assert.ok(initialManifest);
  const initialDocumentCalls = provider.documentCalls;
  await fs.writeFile(
    path.join(info.marcPath, "SETTINGS.md"),
    "<!-- marc-settings\nmemory.autoRebuild: true\n-->\n",
    "utf8"
  );

  const result = await writeThreadSummaryInWorkspace(
    info,
    {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: hashSummaryBytes(
        Buffer.from(initialMarkdown, "utf8")
      ),
      body: "Updated source."
    },
    { projections: { memoryReconciler: memory } }
  );

  assert.equal(result.projections.memory, "scheduled");
  assert.equal(memory.rebuildCalls, 1);
  assert.equal(provider.prepareCalls, 0);
  assert.equal(provider.queryCalls, 0);
  assert.ok(memory.observedRebuild);
  await memory.observedRebuild;

  const updatedManifest = await readMemoryManifest(info);
  assert.ok(updatedManifest);
  assert.notEqual(updatedManifest.generation, initialManifest.generation);
  const updatedSummaries = summaryRecords(updatedManifest.records);
  assert.equal(updatedSummaries.length, 1);
  assert.equal(updatedSummaries[0]?.threadId, thread.id);
  assert.notEqual(
    updatedSummaries[0]?.sha256,
    summaryRecords(initialManifest.records)[0]?.sha256
  );
  assert.ok(provider.documentCalls > initialDocumentCalls);
});
