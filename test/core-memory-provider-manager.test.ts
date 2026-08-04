import assert from "node:assert/strict";
import test from "node:test";
import {
  MemoryInferenceManager,
  type MemoryInferenceClient
} from "../src/core/memory/index.js";
import type { MemoryInferenceRequest } from "../src/core/memory/inference-protocol.js";
import { tempWorkspace } from "./memory-test-helpers.js";

class FakeInferenceClient implements MemoryInferenceClient {
  disposeCalls = 0;
  requests: MemoryInferenceRequest[] = [];

  async request(request: MemoryInferenceRequest) {
    this.requests.push(request);
    if (request.action === "prepare") return { prepared: true } as const;
    if (request.action === "memoryUsage")
      return {
        memoryUsage: {
          arrayBuffers: 1,
          external: 2,
          heapTotal: 3,
          heapUsed: 4,
          rss: 5
        }
      } as const;
    if (request.action === "rerank")
      return { scores: request.documents.map(() => 1) } as const;
    if (request.action === "interpret") return { text: "0" } as const;
    return {
      vectors: request.action === "embedQuery" ? [[1]] : [[1]]
    } as const;
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

test("reuses an inference worker within the idle TTL and terminates it afterward", async () => {
  const info = await tempWorkspace();
  const clients: FakeInferenceClient[] = [];
  const manager = new MemoryInferenceManager(() => {
    const client = new FakeInferenceClient();
    clients.push(client);
    return client;
  }, 10);

  await manager.run(info, "embedding", { action: "embedQuery", text: "first" });
  await manager.run(info, "embedding", {
    action: "embedQuery",
    text: "second"
  });

  assert.equal(clients.length, 1);
  assert.equal(clients[0]?.requests.length, 2);
  await waitFor(() => clients[0]?.disposeCalls === 1);

  await manager.disposeAll();
  assert.equal(clients[0]?.disposeCalls, 1);
});

test("keeps inference workers isolated by workspace and role", async () => {
  const first = await tempWorkspace();
  const second = await tempWorkspace();
  const clients: FakeInferenceClient[] = [];
  const manager = new MemoryInferenceManager(() => {
    const client = new FakeInferenceClient();
    clients.push(client);
    return client;
  }, 1_000);

  await manager.run(first, "embedding", {
    action: "embedQuery",
    text: "first"
  });
  await manager.run(first, "reranking", {
    action: "rerank",
    batchSize: 2,
    documents: ["first"],
    query: "first"
  });
  await manager.run(second, "embedding", {
    action: "embedQuery",
    text: "second"
  });
  await manager.run(first, "interpretation", {
    action: "interpret",
    originalQuery: "toogle",
    variants: ["toogle", "toggle"]
  });

  assert.equal(clients.length, 4);
  assert.deepEqual(
    manager.activeWorkers(first).map(({ role }) => role),
    ["embedding", "interpretation", "reranking"]
  );
  await manager.disposeAll();
});

test("applies idle TTL independently for each inference role", async () => {
  const info = await tempWorkspace();
  const clients = new Map<string, FakeInferenceClient>();
  const manager = new MemoryInferenceManager(
    (_info, role) => {
      const client = new FakeInferenceClient();
      clients.set(role, client);
      return client;
    },
    (role) => (role === "interpretation" ? 80 : 10)
  );

  await manager.run(info, "embedding", {
    action: "embedQuery",
    text: "first"
  });
  await manager.run(info, "interpretation", {
    action: "interpret",
    originalQuery: "toogle",
    variants: ["toogle", "toggle"]
  });

  await waitFor(() => clients.get("embedding")?.disposeCalls === 1);
  assert.equal(clients.get("interpretation")?.disposeCalls, 0);
  await waitFor(() => clients.get("interpretation")?.disposeCalls === 1);

  await manager.disposeAll();
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for inference worker disposal.");
}
