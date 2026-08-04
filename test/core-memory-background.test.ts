import assert from "node:assert/strict";
import test from "node:test";
import {
  BackgroundMemoryReconciler,
  MEMORY_REBUILD_RESOURCE
} from "../src/core/memory/index.js";
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
