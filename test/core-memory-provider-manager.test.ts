import assert from "node:assert/strict";
import test from "node:test";
import { MemoryProviderManager } from "../src/core/memory/index.js";
import { FakeEmbeddingProvider, tempWorkspace } from "./memory-test-helpers.js";

class Deferred {
  promise: Promise<void>;
  resolve!: () => void;

  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 100
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out while waiting for provider lifecycle state.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

test("reuses a provider within the idle TTL and disposes it afterward", async () => {
  const info = await tempWorkspace();
  const providers: FakeEmbeddingProvider[] = [];
  const manager = new MemoryProviderManager(() => {
    const provider = new FakeEmbeddingProvider();
    providers.push(provider);
    return provider;
  }, 10);

  await manager.run(info, (provider) => provider.embedQuery("first query"));
  await manager.run(info, (provider) => provider.embedQuery("second query"));

  assert.equal(providers.length, 1);
  assert.equal(providers[0]?.queryCalls, 2);
  await waitFor(() => providers[0]?.disposeCalls === 1);

  await manager.disposeAll();
  assert.equal(providers[0]?.disposeCalls, 1);
});

test("keeps providers isolated by workspace", async () => {
  const firstWorkspace = await tempWorkspace();
  const secondWorkspace = await tempWorkspace();
  const providers: FakeEmbeddingProvider[] = [];
  const manager = new MemoryProviderManager(() => {
    const provider = new FakeEmbeddingProvider();
    providers.push(provider);
    return provider;
  }, 1_000);

  await manager.run(firstWorkspace, (provider) => provider.embedQuery("first"));
  await manager.run(secondWorkspace, (provider) =>
    provider.embedQuery("second")
  );

  assert.equal(providers.length, 2);
  await manager.disposeAll();
  assert.equal(providers[0]?.disposeCalls, 1);
  assert.equal(providers[1]?.disposeCalls, 1);
});

test("serializes operations for one workspace and disposes only after both finish", async () => {
  const info = await tempWorkspace();
  const provider = new FakeEmbeddingProvider();
  const manager = new MemoryProviderManager(() => provider, 10);
  const firstStarted = new Deferred();
  const releaseFirst = new Deferred();
  let secondStarted = false;

  const first = manager.run(info, async () => {
    firstStarted.resolve();
    await releaseFirst.promise;
  });
  await firstStarted.promise;

  const second = manager.run(info, async () => {
    secondStarted = true;
  });

  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(secondStarted, false);
  assert.equal(provider.disposeCalls, 0);

  releaseFirst.resolve();
  await Promise.all([first, second]);
  assert.equal(secondStarted, true);
  await waitFor(() => provider.disposeCalls === 1);
});
