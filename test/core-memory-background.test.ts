import assert from "node:assert/strict";
import test from "node:test";
import {
  BackgroundMemoryReconciler,
  MEMORY_REBUILD_RESOURCE
} from "../src/core/memory/index.js";
import { withWorkspaceWriteLock } from "../src/core/write-coordination.js";
import {
  FakeEmbeddingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import type {
  MemoryVectorRecord,
  MemoryVectorRow,
  MemoryVectorStore
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";

class Deferred {
  promise: Promise<void>;
  resolve!: () => void;

  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}

class PreparedProvider extends FakeEmbeddingProvider {
  constructor(
    private preparedState: boolean,
    private readonly gate?: Deferred
  ) {
    super();
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(this.preparedState);
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
    await this.gate?.promise;
    this.preparedState = true;
  }
}

class GatedStore implements MemoryVectorStore {
  rebuildCalls = 0;
  reconcileCalls = 0;
  records: Array<MemoryVectorRecord & { vector: number[] }> = [];

  constructor(
    private readonly gate?: Deferred,
    private readonly failure?: Error
  ) {}

  exists(): Promise<boolean> {
    return Promise.resolve(this.records.length > 0);
  }

  listRecordIds(): Promise<string[]> {
    return Promise.resolve(this.records.map((record) => record.recordId));
  }

  async rebuild(
    _info: WorkspaceInfo,
    records: MemoryVectorRecord[],
    vectors: number[][]
  ): Promise<void> {
    this.rebuildCalls += 1;
    await this.gate?.promise;
    if (this.failure) throw this.failure;
    this.records = records.map((record, index) => ({
      ...record,
      vector: vectors[index] ?? []
    }));
  }

  async reconcile(
    _info: WorkspaceInfo,
    rows: MemoryVectorRow[],
    removeRecordIds: string[]
  ): Promise<void> {
    this.reconcileCalls += 1;
    await this.gate?.promise;
    if (this.failure) throw this.failure;
    const recordsById = new Map(
      this.records.map((record) => [record.recordId, record])
    );
    for (const row of rows) recordsById.set(row.recordId, row);
    for (const recordId of removeRecordIds) recordsById.delete(recordId);
    this.records = [...recordsById.values()];
  }

  search(): Promise<[]> {
    return Promise.resolve([]);
  }
}

async function waitFor(assertion: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("background memory prepare deduplicates concurrent requests", async () => {
  const info = await tempWorkspace();
  const gate = new Deferred();
  const provider = new PreparedProvider(false, gate);
  const memory = new BackgroundMemoryReconciler(info, () => provider);

  const first = memory.prepare();
  const second = memory.prepare();
  const preparing = await memory.health({ memory: { autoRebuild: true } });

  assert.equal(preparing.status, "preparing");
  assert.equal(preparing.preparing, true);
  assert.equal(provider.prepareCalls, 1);

  gate.resolve();
  await Promise.all([first, second]);

  const prepared = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(provider.prepareCalls, 1);
  assert.equal(prepared.modelPrepared, true);
  assert.ok(prepared.lastPreparedAt);
});

test("background memory rebuild deduplicates concurrent requests", async () => {
  const info = await tempWorkspace();
  const gate = new Deferred();
  const provider = new PreparedProvider(true);
  const store = new GatedStore(gate);
  const memory = new BackgroundMemoryReconciler(info, () => provider, store);
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );

  const first = memory.rebuild();
  const second = memory.rebuild();
  const rebuilding = await memory.health({ memory: { autoRebuild: true } });

  assert.equal(rebuilding.status, "rebuilding");
  assert.equal(rebuilding.rebuilding, true);
  await waitFor(() => store.reconcileCalls === 1);
  assert.equal(store.reconcileCalls, 1);

  gate.resolve();
  await Promise.all([first, second]);

  const ready = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(store.reconcileCalls, 1);
  assert.equal(ready.status, "ready");
  assert.ok(ready.lastRebuildAt);
});

test("background memory runs full rebuild only when explicitly requested", async () => {
  const info = await tempWorkspace();
  const provider = new PreparedProvider(true);
  const store = new GatedStore();
  const memory = new BackgroundMemoryReconciler(info, () => provider, store);
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );

  await memory.rebuild();
  await memory.rebuildFull();

  assert.equal(store.reconcileCalls, 1);
  assert.equal(store.rebuildCalls, 1);
});

test("background memory does not rebuild again while another reconciler holds the lock", async () => {
  const info = await tempWorkspace();
  const gate = new Deferred();
  const store = new GatedStore(gate);
  const first = new BackgroundMemoryReconciler(
    info,
    () => new PreparedProvider(true),
    store
  );
  const second = new BackgroundMemoryReconciler(
    info,
    () => new PreparedProvider(true),
    store
  );
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );

  const firstRebuild = first.rebuild();
  await waitFor(() => store.reconcileCalls === 1);

  const secondRebuild = second.rebuild();

  try {
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(store.reconcileCalls, 1);
    const health = await second.health({ memory: { autoRebuild: true } });
    assert.equal(health.status, "rebuilding");
  } finally {
    gate.resolve();
    await Promise.all([firstRebuild, secondRebuild]);
  }
});

test("background memory reports a rebuild held by another process", async () => {
  const info = await tempWorkspace();
  const provider = new PreparedProvider(true);
  const store = new GatedStore();
  const memory = new BackgroundMemoryReconciler(info, () => provider, store);

  await withWorkspaceWriteLock(
    info.marcPath,
    MEMORY_REBUILD_RESOURCE,
    async () => {
      const health = await memory.health({ memory: { autoRebuild: true } });

      assert.equal(health.status, "rebuilding");
      assert.equal(health.rebuilding, true);
      assert.equal(store.rebuildCalls, 0);
    }
  );
});

test("background memory does not start rebuild while model prepare is running", async () => {
  const info = await tempWorkspace();
  const gate = new Deferred();
  const provider = new PreparedProvider(false, gate);
  const store = new GatedStore();
  const memory = new BackgroundMemoryReconciler(info, () => provider, store);

  const prepare = memory.prepare();
  const rebuild = memory.rebuild();
  const health = await memory.health({ memory: { autoRebuild: true } });

  assert.equal(health.status, "preparing");
  assert.equal(provider.prepareCalls, 1);
  assert.equal(provider.documentCalls, 0);
  assert.equal(store.rebuildCalls, 0);

  gate.resolve();
  await Promise.all([prepare, rebuild]);
});

test("background memory reports degraded state after rebuild failure", async () => {
  const info = await tempWorkspace();
  const provider = new PreparedProvider(true);
  const store = new GatedStore(undefined, new Error("memory write failed"));
  const memory = new BackgroundMemoryReconciler(info, () => provider, store);
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );

  await assert.rejects(() => memory.rebuild(), /memory write failed/);

  const health = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(health.status, "degraded");
  assert.equal(health.lastError, "memory write failed");
});
