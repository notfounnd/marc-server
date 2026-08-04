import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  purgeUnusedMemory,
  readMemoryMaintenance
} from "../src/core/memory/maintenance.js";
import { purgeMemoryInWorkspace } from "../src/core/memory/operations.js";
import { MEMORY_OPERATION_RESOURCE } from "../src/core/memory/rebuild-coordination.js";
import {
  E5_MODEL_FILE,
  LFM_INTERPRETER_MODEL_DATA_FILE,
  LFM_INTERPRETER_MODEL_FILE,
  MMARCO_RERANKER_MODEL_FILE,
  localModelCachePath
} from "../src/core/memory/model-config.js";
import {
  InMemoryMemoryVectorStore,
  memoryManifestPath,
  writeMemoryManifest
} from "../src/core/memory/store.js";
import type {
  MemoryManifest,
  MemoryStorePurgeResult
} from "../src/core/memory/types.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import {
  withWorkspaceWriteLock,
  workspaceWriteLockPath
} from "../src/core/write-coordination.js";
import { tempWorkspace } from "./memory-test-helpers.js";

test("purge preserves the generation published before the operation lock callback", async (t) => {
  const info = await tempWorkspace();
  t.after(async () => fs.rm(info.rootPath, { force: true, recursive: true }));

  const manifestA = memoryManifest("generation-a");
  const manifestB = memoryManifest("generation-b");
  const manifestPath = memoryManifestPath(info);
  const lockPath = workspaceWriteLockPath(
    info.marcPath,
    MEMORY_OPERATION_RESOURCE
  );
  const events: string[] = [];
  const store = new GenerationTrackingMemoryStore(events);
  await writeMemoryManifest(info, manifestA);

  const originalMkdir = fs.mkdir.bind(fs);
  const originalReadFile = fs.readFile.bind(fs);
  t.mock.method(
    fs,
    "readFile",
    async (
      filePath: Parameters<typeof fs.readFile>[0],
      options?: Parameters<typeof fs.readFile>[1]
    ) => {
      const content = await originalReadFile(filePath, options);
      if (typeof filePath !== "string") return content;
      if (path.resolve(filePath) !== manifestPath) return content;
      events.push(`manifest:${JSON.parse(String(content)).generation}`);
      return content;
    }
  );
  let publishedGenerationB = false;
  t.mock.method(
    fs,
    "mkdir",
    async (
      directory: Parameters<typeof fs.mkdir>[0],
      options?: Parameters<typeof fs.mkdir>[1]
    ) => {
      const isOperationLock =
        typeof directory === "string" && path.resolve(directory) === lockPath;
      if (isOperationLock && !publishedGenerationB) {
        await writeMemoryManifest(info, manifestB);
        events.push("published:generation-b");
        publishedGenerationB = true;
      }
      const result = await originalMkdir(directory, options);
      if (isOperationLock) events.push("lock:acquired");
      return result;
    }
  );

  const result = await purgeMemoryInWorkspace(info, { store });

  assert.equal(
    store.activeGeneration,
    "generation-b",
    `Observed interleaving: ${events.join(" -> ")}`
  );
  assert.deepEqual(result.generationsRemoved, ["generation-a"]);
  assert.deepEqual([...store.availableGenerations], ["generation-b"]);
  assert.deepEqual(events, [
    "published:generation-b",
    "lock:acquired",
    "manifest:generation-b",
    "purge:generation-b"
  ]);
});

test("busy purge does not read the manifest or remove unused resources", async (t) => {
  const info = await tempWorkspace();
  t.after(async () => fs.rm(info.rootPath, { force: true, recursive: true }));

  const manifestPath = memoryManifestPath(info);
  await writeMemoryManifest(info, memoryManifest("generation-a"));
  const unusedModelPath = path.join(
    localModelCachePath(info, "embedding"),
    "onnx",
    "unused-model.onnx"
  );
  await fs.mkdir(path.dirname(unusedModelPath), { recursive: true });
  await fs.writeFile(unusedModelPath, "unused model");

  let manifestReads = 0;
  const originalReadFile = fs.readFile.bind(fs);
  t.mock.method(
    fs,
    "readFile",
    async (
      filePath: Parameters<typeof fs.readFile>[0],
      options?: Parameters<typeof fs.readFile>[1]
    ) => {
      if (
        typeof filePath === "string" &&
        path.resolve(filePath) === manifestPath
      ) {
        manifestReads += 1;
      }
      return originalReadFile(filePath, options);
    }
  );

  const store = new GenerationTrackingMemoryStore();
  await withWorkspaceWriteLock(
    info.marcPath,
    MEMORY_OPERATION_RESOURCE,
    async () => {
      await assert.rejects(
        purgeMemoryInWorkspace(info, { store }),
        /Another memory operation is already running\./
      );
      assert.equal(manifestReads, 0);
      assert.equal(store.purgeCalls, 0);
      assert.deepEqual(
        [...store.availableGenerations],
        ["generation-a", "generation-b"]
      );
      assert.equal(await fs.readFile(unusedModelPath, "utf8"), "unused model");
    }
  );
});

test("purge keeps the current behavior when the manifest is absent", async (t) => {
  const info = await tempWorkspace();
  t.after(async () => fs.rm(info.rootPath, { force: true, recursive: true }));

  const store = new GenerationTrackingMemoryStore();
  const result = await purgeMemoryInWorkspace(info, { store });

  assert.equal(store.purgeCalls, 1);
  assert.equal(store.activeGeneration, undefined);
  assert.deepEqual(result.generationsRemoved, ["generation-a", "generation-b"]);
  assert.deepEqual([...store.availableGenerations], []);
});

test("purge removes only unused managed model artifacts", async () => {
  const info = await tempWorkspace();
  const embeddingRoot = localModelCachePath(info, "embedding");
  const rerankingRoot = localModelCachePath(info, "reranking");
  const interpretationRoot = localModelCachePath(info, "interpretation");
  const legacyRoot = path.join(
    info.marcPath,
    "cache",
    "memory-models",
    "Xenova--legacy-model"
  );
  await writeModelFile(embeddingRoot, "config.json", 2);
  await writeModelFile(embeddingRoot, `onnx/${E5_MODEL_FILE}`, 3);
  await writeModelFile(embeddingRoot, "onnx/model.onnx", 5);
  await writeModelFile(rerankingRoot, "config.json", 7);
  await writeModelFile(rerankingRoot, `onnx/${MMARCO_RERANKER_MODEL_FILE}`, 11);
  await writeModelFile(rerankingRoot, "onnx/model_quint8_avx2.onnx", 13);
  await writeModelFile(interpretationRoot, "config.json", 2);
  await writeModelFile(
    interpretationRoot,
    `onnx/${LFM_INTERPRETER_MODEL_FILE}`,
    19
  );
  await writeModelFile(
    interpretationRoot,
    `onnx/${LFM_INTERPRETER_MODEL_DATA_FILE}`,
    23
  );
  await writeModelFile(interpretationRoot, "onnx/model_quantized.onnx", 29);
  await writeModelFile(legacyRoot, "onnx/model.onnx", 17);

  const before = await readMemoryMaintenance(info);
  assert.equal(before.recoverableBytes, 64);
  assert.equal(before.models.filter((model) => model.active).length, 3);

  const result = await purgeUnusedMemory(
    info,
    undefined,
    new InMemoryMemoryVectorStore()
  );

  assert.equal(result.bytesRemoved, 64);
  assert.equal(result.filesRemoved, 4);
  assert.deepEqual(result.modelsRemoved, ["Xenova/legacy-model"]);
  await assert.doesNotReject(() =>
    fs.stat(path.join(embeddingRoot, "onnx", E5_MODEL_FILE))
  );
  await assert.doesNotReject(() =>
    fs.stat(path.join(rerankingRoot, "onnx", MMARCO_RERANKER_MODEL_FILE))
  );
  await assert.doesNotReject(() =>
    fs.stat(
      path.join(interpretationRoot, "onnx", LFM_INTERPRETER_MODEL_DATA_FILE)
    )
  );
  await assert.rejects(() =>
    fs.stat(path.join(embeddingRoot, "onnx", "model.onnx"))
  );
  await assert.rejects(() => fs.stat(legacyRoot));
});

async function writeModelFile(
  root: string,
  relativePath: string,
  bytes: number
): Promise<void> {
  const filePath = path.join(root, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.alloc(bytes));
}

function memoryManifest(generation: string): MemoryManifest {
  return {
    schemaVersion: 6,
    builtAt: "2026-10-08T00:00:00.000Z",
    generation,
    embeddingProvider: {
      id: "test-provider",
      name: "Test provider",
      model: "test/model",
      version: "1",
      dimensions: 2,
      distance: "cosine",
      quantized: false,
      runtime: "local"
    },
    retrievalContract: "field-aware-hybrid-v2",
    records: []
  };
}

class GenerationTrackingMemoryStore extends InMemoryMemoryVectorStore {
  readonly availableGenerations = new Set(["generation-a", "generation-b"]);
  activeGeneration: string | undefined;
  purgeCalls = 0;

  constructor(private readonly events: string[] = []) {
    super();
  }

  async purgeUnused(
    _info: WorkspaceInfo,
    activeGeneration?: string
  ): Promise<MemoryStorePurgeResult> {
    this.purgeCalls += 1;
    this.activeGeneration = activeGeneration;
    this.events.push(`purge:${activeGeneration ?? "undefined"}`);
    const generationsRemoved = [...this.availableGenerations].filter(
      (generation) => generation !== activeGeneration
    );
    for (const generation of generationsRemoved)
      this.availableGenerations.delete(generation);
    return {
      bytesRemoved: 0,
      generationsRemoved,
      oldVersionsRemoved: 0
    };
  }
}
