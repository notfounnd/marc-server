import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  MEMORY_MODEL_BENCHMARK_PROFILES,
  MEMORY_MODEL_BENCHMARK_PROFILE_ENV,
  LocalQueryInterpretationProvider,
  LocalRerankingProvider,
  localQueryInterpretationModelCachePath,
  localRerankingModelCachePath,
  memoryModelSelection
} from "../src/core/memory/index.js";
import { localModelCachePath } from "../src/core/memory/model-config.js";
import { tempWorkspace } from "./memory-test-helpers.js";

test("recognizes the required O4 reranker model through Windows separators", async () => {
  const info = await tempWorkspace();
  const modelRoot = path.join(
    localRerankingModelCachePath(info),
    "cross-encoder",
    "mmarco-mMiniLMv2-L12-H384-v1"
  );
  const onnxRoot = path.join(modelRoot, "onnx");
  await fs.mkdir(onnxRoot, { recursive: true });
  await fs.writeFile(path.join(modelRoot, "config.json"), "{}");
  await fs.writeFile(path.join(onnxRoot, "model_O4.onnx"), "model");

  const provider = new LocalRerankingProvider(info);

  assert.equal(await provider.isPrepared(), true);
});

test("requires the Q4 interpretation model and external data file", async () => {
  const info = await tempWorkspace();
  const modelRoot = localQueryInterpretationModelCachePath(info);
  const onnxRoot = path.join(modelRoot, "onnx-community", "LFM2.5-350M-ONNX");
  const modelFiles = path.join(onnxRoot, "onnx");
  await fs.mkdir(modelFiles, { recursive: true });
  await fs.writeFile(path.join(onnxRoot, "config.json"), "{}");
  await fs.writeFile(path.join(modelFiles, "model_q4.onnx"), "model");

  const provider = new LocalQueryInterpretationProvider(info);

  assert.equal(await provider.isPrepared(), false);
  await fs.writeFile(path.join(modelFiles, "model_q4.onnx_data"), "weights");
  assert.equal(await provider.isPrepared(), true);
});

test("defines an isolated 2x2 memory model benchmark matrix", () => {
  assert.deepEqual(Object.keys(MEMORY_MODEL_BENCHMARK_PROFILES), [
    "baseline",
    "retriever-base",
    "reranker-bge",
    "base-bge"
  ]);

  const retriever = memoryModelSelection("retriever-base");
  assert.equal(retriever.embedding.dimensions, 768);
  assert.equal(retriever.embedding.model, "Xenova/multilingual-e5-base");
  assert.equal(
    retriever.reranking.model,
    "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
  );

  const reranker = memoryModelSelection("reranker-bge");
  assert.equal(reranker.embedding.dimensions, 384);
  assert.equal(
    reranker.reranking.model,
    "onnx-community/bge-reranker-v2-m3-ONNX"
  );
  assert.equal(reranker.reranking.modelFile, "model_int8.onnx");
});

test("rejects unknown memory model benchmark profiles", () => {
  assert.throws(
    () => memoryModelSelection("unknown"),
    /Unknown memory model benchmark profile/
  );
});

test("shares unchanged models and isolates only experimental model caches", async () => {
  const info = await tempWorkspace();
  const previousProfile = process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV];
  delete process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV];
  const baselineEmbedding = localModelCachePath(info, "embedding");
  const baselineReranking = localModelCachePath(info, "reranking");

  process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV] = "retriever-base";
  assert.match(
    localModelCachePath(info, "embedding").replaceAll("\\", "/"),
    /memory-models\/experiments\/Xenova--multilingual-e5-base$/
  );
  assert.equal(localModelCachePath(info, "reranking"), baselineReranking);

  process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV] = "reranker-bge";
  assert.equal(localModelCachePath(info, "embedding"), baselineEmbedding);
  assert.match(
    localModelCachePath(info, "reranking").replaceAll("\\", "/"),
    /memory-models\/experiments\/onnx-community--bge-reranker-v2-m3-ONNX$/
  );

  if (previousProfile)
    process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV] = previousProfile;
  if (!previousProfile) delete process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV];
});
