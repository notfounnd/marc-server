import assert from "node:assert/strict";
import test from "node:test";
import {
  BackgroundMemoryReconciler,
  readWorkspaceSettingsInWorkspace,
  updateWorkspaceSettingsInWorkspace
} from "../src/core/memory/index.js";
import { readWorkspaceStatus } from "../src/core/workspace.js";
import {
  FakeEmbeddingProvider,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import type {
  MemoryVectorRecord,
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
  records: Array<MemoryVectorRecord & { vector: number[] }> = [];

  constructor(
    private readonly gate?: Deferred,
    private readonly failure?: Error
  ) {}

  exists(): Promise<boolean> {
    return Promise.resolve(this.records.length > 0);
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

test("workspace memory settings default to automatic rebuild and persist per workspace", async () => {
  const first = await tempWorkspace();
  const second = await tempWorkspace();

  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.autoRebuild,
    true
  );

  await updateWorkspaceSettingsInWorkspace(first, {
    memory: { autoRebuild: false }
  });

  assert.equal(
    (await readWorkspaceSettingsInWorkspace(first)).memory.autoRebuild,
    false
  );
  assert.equal(
    (await readWorkspaceSettingsInWorkspace(second)).memory.autoRebuild,
    true
  );
});

test("workspace status includes persisted memory auto rebuild setting", async () => {
  const info = await tempWorkspace();
  await updateWorkspaceSettingsInWorkspace(info, {
    memory: { autoRebuild: false }
  });

  const status = await readWorkspaceStatus(info.rootPath);

  assert.equal(status.modules.memory.autoRebuild, false);
  assert.equal(status.modules.memory.preparing, false);
  assert.equal(status.modules.memory.rebuilding, false);
  assert.equal(status.modules.memory.lastError, null);
});

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
  await waitFor(() => store.rebuildCalls === 1);
  assert.equal(store.rebuildCalls, 1);

  gate.resolve();
  await Promise.all([first, second]);

  const ready = await memory.health({ memory: { autoRebuild: true } });
  assert.equal(store.rebuildCalls, 1);
  assert.equal(ready.status, "ready");
  assert.ok(ready.lastRebuildAt);
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
