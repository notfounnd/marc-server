import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { env } from "@huggingface/transformers";
import {
  InMemoryMemoryVectorStore,
  readMemoryManifest,
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace
} from "../src/core/memory/index.js";
import {
  MEMORY_MODEL_VERSION,
  embeddingProviderMetadata,
  queryInterpretationProviderMetadata,
  rerankingProviderMetadata
} from "../src/core/memory/model-config.js";
import { memoryProvidersMatch } from "../src/core/memory/status.js";
import {
  FakeEmbeddingProvider,
  FakeRerankingProvider,
  providerMetadata,
  tempWorkspace,
  writeSummary
} from "./memory-test-helpers.js";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  MemoryManifest
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";

const EXPECTED_RUNTIME_VERSION = "transformers-js-4.3.1";

const oldVersionManifest: MemoryManifest = {
  builtAt: "2026-10-13T00:00:00.000Z",
  embeddingProvider: {
    ...embeddingProviderMetadata(),
    version: "transformers-js-4.2.0"
  },
  generation: "generation-old-runtime",
  records: [],
  retrievalContract: "field-aware-hybrid-v2",
  schemaVersion: 6
};

const currentVersionManifest: MemoryManifest = {
  ...oldVersionManifest,
  embeddingProvider: {
    ...oldVersionManifest.embeddingProvider,
    version: MEMORY_MODEL_VERSION
  }
};

const embeddingProvider = {
  describe: embeddingProviderMetadata,
  dispose: async () => {},
  embedDocuments: async () => [],
  embedQuery: async () => [],
  isPrepared: async () => true,
  prepare: async () => {}
} satisfies EmbeddingProvider;

const withoutVersion = (metadata: EmbeddingProviderMetadata) => ({
  dimensions: metadata.dimensions,
  distance: metadata.distance,
  id: metadata.id,
  model: metadata.model,
  name: metadata.name,
  quantized: metadata.quantized,
  runtime: metadata.runtime
});

test("all provider metadata follows the installed Transformers.js version", () => {
  assert.equal(env.version, "4.3.1");
  assert.equal(MEMORY_MODEL_VERSION, EXPECTED_RUNTIME_VERSION);
  assert.equal(MEMORY_MODEL_VERSION, `transformers-js-${env.version}`);
  assert.deepEqual(
    [
      embeddingProviderMetadata().version,
      rerankingProviderMetadata().version,
      queryInterpretationProviderMetadata().version
    ],
    [
      EXPECTED_RUNTIME_VERSION,
      EXPECTED_RUNTIME_VERSION,
      EXPECTED_RUNTIME_VERSION
    ]
  );
});

test("the compatibility guard rejects old runtime vectors and accepts the new identity", () => {
  assert.deepEqual(
    withoutVersion(oldVersionManifest.embeddingProvider),
    withoutVersion(currentVersionManifest.embeddingProvider)
  );
  assert.equal(
    memoryProvidersMatch(oldVersionManifest, embeddingProvider),
    false
  );
  assert.equal(
    memoryProvidersMatch(currentVersionManifest, embeddingProvider),
    true
  );
});

class RecordingEmbeddingProvider extends FakeEmbeddingProvider {
  readonly embeddedTexts: string[] = [];

  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.embeddedTexts.push(...texts);
    return super.embedDocuments(texts);
  }
}

class RecordingRerankingProvider extends FakeRerankingProvider {
  splitPassagesCalls = 0;

  async splitPassages(texts: string[]): Promise<string[][]> {
    this.splitPassagesCalls += 1;
    return super.splitPassages(texts);
  }
}

class RecordingMemoryStore extends InMemoryMemoryVectorStore {
  readRowsCalls = 0;

  async readRows(...args: Parameters<InMemoryMemoryVectorStore["readRows"]>) {
    this.readRowsCalls += 1;
    return super.readRows(...args);
  }
}

const RUNTIME_THREAD_ID = "runtime-version-fixture";

const reconciliationScenarios: Array<{
  name: string;
  updateSources(info: WorkspaceInfo): Promise<void>;
}> = [
  {
    name: "rejects provider mismatch before an unchanged-source no-op",
    updateSources: () => Promise.resolve()
  },
  {
    name: "rejects provider mismatch before reconciling changed sources",
    updateSources: (info) =>
      writeSummary(info, RUNTIME_THREAD_ID, summaryFor("updated source"))
  }
];

for (const scenario of reconciliationScenarios) {
  test(scenario.name, async (t) => {
    const fixture = await oldRuntimeFixture(t);
    await scenario.updateSources(fixture.info);

    await assert.rejects(
      reconcileMemoryInWorkspace(fixture.info, {
        provider: fixture.currentProvider,
        reranker: fixture.reranker,
        store: fixture.store
      }),
      /provider is incompatible.*full rebuild/i
    );

    assert.equal(fixture.store.readRowsCalls, 0);
    assert.equal(fixture.currentProvider.documentCalls, 0);
    assert.deepEqual(fixture.currentProvider.embeddedTexts, []);
    assert.equal(fixture.reranker.splitPassagesCalls, 0);
    assert.deepEqual(await readMemoryManifest(fixture.info), fixture.manifest);
    assert.equal(fixture.manifest.generation, fixture.generation);
    assert.deepEqual(
      await fixture.store.readRows(fixture.info, fixture.generation),
      fixture.rows
    );
  });
}

test("an explicit full rebuild replaces every old-runtime vector", async (t) => {
  const fixture = await oldRuntimeFixture(t);

  await rebuildMemoryInWorkspace(fixture.info, {
    provider: fixture.currentProvider,
    reranker: fixture.reranker,
    store: fixture.store
  });
  const rebuilt = await readMemoryManifest(fixture.info);
  assert.ok(rebuilt);
  const rows = await fixture.store.readRows(fixture.info, rebuilt.generation);

  assert.equal(rebuilt.embeddingProvider.version, EXPECTED_RUNTIME_VERSION);
  assert.notEqual(rebuilt.generation, fixture.generation);
  assert.equal(
    fixture.currentProvider.embeddedTexts.length,
    fixture.rows.length
  );
  assert.equal(rows.length, fixture.rows.length);
  assert.deepEqual(
    rows.map((row) => row.recordId).sort(),
    fixture.rows.map((row) => row.recordId).sort()
  );
});

async function oldRuntimeFixture(t: import("node:test").TestContext) {
  const info = await tempWorkspace();
  t.after(() => fs.rm(info.rootPath, { force: true, recursive: true }));

  const previousProvider = providerAtVersion("transformers-js-4.2.0");
  const currentProvider = providerAtVersion(EXPECTED_RUNTIME_VERSION);
  const reranker = new RecordingRerankingProvider();
  const store = new RecordingMemoryStore();

  await writeSummary(info, RUNTIME_THREAD_ID, summaryFor("original source"));
  await rebuildMemoryInWorkspace(info, {
    provider: previousProvider,
    reranker,
    store
  });

  const manifest = await readMemoryManifest(info);
  assert.ok(manifest);
  const generation = manifest.generation;
  const rows = await store.readRows(info, generation);
  assert.ok(rows.length > 0);
  store.readRowsCalls = 0;
  reranker.splitPassagesCalls = 0;

  return { currentProvider, generation, info, manifest, reranker, rows, store };
}

function providerAtVersion(version: string): RecordingEmbeddingProvider {
  return new RecordingEmbeddingProvider({ ...providerMetadata, version });
}

function summaryFor(content: string): string {
  return [
    "# Summary - Runtime compatibility",
    "",
    `Thread: \`${RUNTIME_THREAD_ID}\``,
    "",
    "## Result",
    "",
    `- ${content}`
  ].join("\n");
}
