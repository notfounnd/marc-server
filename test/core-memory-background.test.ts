import assert from "node:assert/strict";
import test from "node:test";
import {
  BackgroundMemoryReconciler,
  MEMORY_REBUILD_RESOURCE,
  readMemoryManifest
} from "../src/core/memory/index.js";
import { LanceDbMemoryVectorStore } from "../src/core/memory/store.js";
import { withWorkspaceWriteLock } from "../src/core/write-coordination.js";
import {
  FakeRerankingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import {
  Deferred,
  GatedStore,
  PreparedProvider,
  waitFor
} from "./background-memory-test-helpers.js";

class GatedLanceDbStore extends LanceDbMemoryVectorStore {
  gate?: Deferred;
  started?: Deferred;

  override async rebuild(
    ...args: Parameters<LanceDbMemoryVectorStore["rebuild"]>
  ): Promise<void> {
    this.started?.resolve();
    await this.gate?.promise;
    await super.rebuild(...args);
  }
}

test("background memory prepare deduplicates concurrent requests", async () => {
  const info = await tempWorkspace();
  const gate = new Deferred();
  const provider = new PreparedProvider(false, gate);
  const reranker = new FakeRerankingProvider();
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    undefined,
    () => reranker
  );

  const first = memory.prepare();
  const second = memory.prepare();
  const preparing = await memory.health({ memory: { autoRebuild: true } });

  assert.equal(preparing.status, "preparing");
  assert.equal(preparing.preparing, true);
  await waitFor(() => provider.prepareCalls === 1);
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
  const store = new GatedStore();
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    store,
    () => new FakeRerankingProvider()
  );
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );
  await memory.rebuildFull();
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nUpdated thread: `thread-memory`"
  );
  store.rebuildCalls = 0;
  store.setGate(gate);

  const first = memory.rebuild();
  const second = memory.rebuild();
  const rebuilding = await memory.health({ memory: { autoRebuild: true } });

  assert.equal(rebuilding.status, "rebuilding");
  assert.equal(rebuilding.rebuilding, true);
  await waitFor(() => store.rebuildCalls === 1);
  assert.equal(store.rebuildCalls, 1);

  gate.resolve();
  await Promise.all([first, second]);

  const ready = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(store.rebuildCalls, 1);
  assert.equal(ready.status, "ready");
  assert.ok(ready.lastRebuildAt);
});

test("background reconciliation returns a real LanceDB generation to ready", async () => {
  const info = await tempWorkspace();
  const provider = new PreparedProvider(true);
  const reranker = new FakeRerankingProvider();
  const store = new GatedLanceDbStore();
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    store,
    () => reranker
  );
  await writeSummary(
    info,
    "thread-live",
    "# Summary - Live\n\nInitial content"
  );
  await memory.rebuildFull();
  await writeSummary(
    info,
    "thread-live",
    "# Summary - Live\n\nUpdated content"
  );
  const gate = new Deferred();
  const started = new Deferred();
  store.gate = gate;
  store.started = started;

  const rebuild = memory.rebuild();
  await started.promise;
  const rebuilding = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(rebuilding.status, "rebuilding");
  gate.resolve();
  await rebuild;

  const ready = await memory.health({ memory: { autoRebuild: true } });
  const manifest = await readMemoryManifest(info);
  const persistedRows = await store.readRows(info, manifest?.generation);
  assert.equal(ready.status, "ready");
  assert.equal(ready.summaryCount, 1);
  assert.equal(ready.indexedSummaryCount, 1);
  assert.ok(ready.lastRebuildAt);
  assert.equal(ready.lastError, null);
  assert.ok(manifest);
  assert.equal(manifest.records.length, 1);
  assert.equal(persistedRows.length, 2);
  assert.equal(provider.documentCalls, 2);
  assert.ok(await store.exists(info, manifest.generation));
});

test("background memory runs full rebuild only when explicitly requested", async () => {
  const info = await tempWorkspace();
  const provider = new PreparedProvider(true);
  const store = new GatedStore();
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    store,
    () => new FakeRerankingProvider()
  );
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );

  await memory.rebuildFull();
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nUpdated thread: `thread-memory`"
  );
  store.rebuildCalls = 0;
  store.readRowsCalls = 0;
  await memory.rebuild();
  await memory.rebuildFull();

  assert.equal(store.readRowsCalls, 1);
  assert.equal(store.rebuildCalls, 2);
});

test("background memory does not rebuild again while another reconciler holds the lock", async () => {
  const info = await tempWorkspace();
  const gate = new Deferred();
  const store = new GatedStore();
  const first = new BackgroundMemoryReconciler(
    info,
    () => new PreparedProvider(true),
    store,
    () => new FakeRerankingProvider()
  );
  const second = new BackgroundMemoryReconciler(
    info,
    () => new PreparedProvider(true),
    store,
    () => new FakeRerankingProvider()
  );
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );
  await first.rebuildFull();
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nUpdated thread: `thread-memory`"
  );
  store.rebuildCalls = 0;
  store.setGate(gate);

  const firstRebuild = first.rebuild();
  await waitFor(() => store.rebuildCalls === 1);

  const secondRebuild = second.rebuild();

  try {
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(store.rebuildCalls, 1);
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
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    store,
    () => new FakeRerankingProvider()
  );

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
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    store,
    () => new FakeRerankingProvider()
  );

  const prepare = memory.prepare();
  const rebuild = memory.rebuild();
  const health = await memory.health({ memory: { autoRebuild: true } });

  assert.equal(health.status, "preparing");
  await waitFor(() => provider.prepareCalls === 1);
  assert.equal(provider.prepareCalls, 1);
  assert.equal(provider.documentCalls, 0);
  assert.equal(store.rebuildCalls, 0);

  gate.resolve();
  await Promise.all([prepare, rebuild]);
});

test("background memory reports degraded state after rebuild failure", async () => {
  const info = await tempWorkspace();
  const provider = new PreparedProvider(true);
  const store = new GatedStore();
  const memory = new BackgroundMemoryReconciler(
    info,
    () => provider,
    store,
    () => new FakeRerankingProvider()
  );
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nThread: `thread-memory`"
  );
  await memory.rebuildFull();
  await writeSummary(
    info,
    "thread-memory",
    "# Summary\n\nUpdated thread: `thread-memory`"
  );
  store.setFailure(new Error("memory write failed"));

  await assert.rejects(() => memory.rebuild(), /memory write failed/);

  const health = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(health.status, "degraded");
  assert.equal(health.lastError, "memory write failed");
});
