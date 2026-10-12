import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { BackgroundMemoryReconciler } from "../src/core/memory/index.js";
import { hashSummaryBytes } from "../src/core/thread-summary-paths.js";
import { writeThreadSummaryInWorkspace } from "../src/core/thread-summary.js";
import {
  createThread,
  getWorkspaceInfo,
  writeThreadSummary
} from "../src/core/workspace.js";
import { JsonThreadIndexStore } from "../src/core/thread-index.js";
import type { WorkspaceSettings, WorkspaceInfo } from "../src/core/types.js";
import type {
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemorySearchHit,
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "../src/core/memory/types.js";
import {
  Deferred,
  PreparedProvider
} from "./background-memory-test-helpers.js";
import {
  getSummaryPath,
  tempWorkspace
} from "./core-thread-summary-fixtures.js";

class ObservedMemoryReconciler extends BackgroundMemoryReconciler {
  rebuildCalls = 0;
  observedRebuild?: Promise<void>;

  override rebuild(settings?: WorkspaceSettings): Promise<void> {
    this.rebuildCalls += 1;
    this.observedRebuild = super.rebuild(settings);
    return this.observedRebuild;
  }
}

class GatedSnapshotStore extends JsonThreadIndexStore {
  constructor(
    indexPath: string,
    private readonly threadId: string,
    private readonly hold: Promise<void>,
    private readonly signalStarted: () => void
  ) {
    super(indexPath);
  }

  override async save(
    snapshot: Parameters<JsonThreadIndexStore["save"]>[0]
  ): Promise<void> {
    this.signalStarted();
    assert.equal(
      snapshot.threads.find((item) => item.id === this.threadId)?.status,
      "closed"
    );
    await this.hold;
    await super.save(snapshot);
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

test("source commit survives a projection failure", async (t) => {
  const workspace = await tempWorkspace();
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const thread = await createThread(workspace, "Projection failure");
  await fs.mkdir(path.join(workspace, ".marc", "cache", "thread-index.json"), {
    recursive: true
  });

  const result = await writeThreadSummary(workspace, {
    threadId: thread.id,
    body: "Source commit survives projection failure."
  });

  assert.equal(result.outcome, "created");
  assert.equal(result.projections.threadIndex, "pending");
  assert.ok(result.projections.errors.includes("thread_index_refresh_failed"));
  assert.match(
    await fs.readFile(getSummaryPath(workspace, thread.id), "utf8"),
    /Source commit survives projection failure\./
  );
});

test("coalesced index refreshes persist the newer summary snapshot", async (t) => {
  const workspace = await tempWorkspace();
  const thread = await createThread(workspace, "Projection race");
  const info = await getWorkspaceInfo(workspace);
  const summaryPath = getSummaryPath(workspace, thread.id);
  const indexPath = path.join(info.marcPath, "cache", "thread-index.json");
  const snapshotStarted = new Deferred();
  const holdSnapshot = new Deferred();
  const secondSummaryCommitted = new Deferred();
  const stores = [
    new GatedSnapshotStore(indexPath, thread.id, holdSnapshot.promise, () =>
      snapshotStarted.resolve()
    ),
    new JsonThreadIndexStore(indexPath)
  ];
  const memory = new ObservedMemoryReconciler(
    info,
    () => new PreparedProvider(false),
    new ControlledMemoryStore()
  );
  const projections = {
    createThreadIndexStore: () => stores.shift()!,
    memoryReconciler: memory
  };
  const activeWrites: Promise<unknown>[] = [];
  t.after(async () => {
    holdSnapshot.resolve();
    await Promise.allSettled(activeWrites);
    await fs.rm(workspace, { recursive: true, force: true });
  });
  await fs.writeFile(
    path.join(info.marcPath, "SETTINGS.md"),
    "<!-- marc-settings\nmemory.autoRebuild: false\n-->\n",
    "utf8"
  );

  const firstWrite = writeThreadSummaryInWorkspace(
    info,
    { threadId: thread.id, body: "Snapshot A." },
    {
      projections: {
        createThreadIndexStore: projections.createThreadIndexStore,
        memoryReconciler: memory
      }
    }
  );
  activeWrites.push(firstWrite);
  await snapshotStarted.promise;
  const firstMarkdown = await fs.readFile(summaryPath, "utf8");
  const secondWrite = writeThreadSummaryInWorkspace(
    info,
    {
      threadId: thread.id,
      mode: "update",
      expectedSummaryRevision: hashSummaryBytes(
        Buffer.from(firstMarkdown, "utf8")
      ),
      body: "Snapshot B."
    },
    {
      rename: async (sourcePath, destinationPath) => {
        await fs.rename(sourcePath, destinationPath);
        secondSummaryCommitted.resolve();
      },
      projections: {
        createThreadIndexStore: projections.createThreadIndexStore,
        memoryReconciler: memory
      }
    }
  );
  activeWrites.push(secondWrite);
  const commitState = await Promise.race([
    secondSummaryCommitted.promise.then(() => "committed"),
    secondWrite.then(() => "completed")
  ]);
  assert.equal(commitState, "committed");
  const future = new Date("2040-01-02T03:04:05.000Z");
  await fs.utimes(summaryPath, future, future);
  holdSnapshot.resolve();

  const [first, second] = await Promise.all([firstWrite, secondWrite]);
  const fileMtime = (await fs.stat(summaryPath)).mtimeMs;
  const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
    threads: Array<{ id: string; summaryMtimeMs?: number }>;
  };
  const cachedThread = index.threads.find((item) => item.id === thread.id);

  assert.equal(first.projections.threadIndex, "updated");
  assert.equal(second.projections.threadIndex, "updated");
  assert.equal(cachedThread?.summaryMtimeMs, fileMtime);
});
