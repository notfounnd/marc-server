import fs from "node:fs/promises";
import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";
import type {
  EmbeddingProviderMetadata,
  QueryInterpretationProviderMetadata,
  RerankingProviderMetadata
} from "./types.js";

export type MemoryInferenceRole = "embedding" | "interpretation" | "reranking";

export const MEMORY_MODEL_VERSION = "transformers-js-4.2.0";
export const E5_MODEL_ID = "Xenova/multilingual-e5-small";
export const E5_MODEL_FILE = "model_int8.onnx";
export const MMARCO_MODEL_ID = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1";
export const MMARCO_RERANKER_MODEL_FILE = "model_O4.onnx";
export const E5_BASE_MODEL_ID = "Xenova/multilingual-e5-base";
export const BGE_RERANKER_MODEL_ID = "onnx-community/bge-reranker-v2-m3-ONNX";
export const BGE_RERANKER_MODEL_FILE = "model_int8.onnx";
export const LFM_INTERPRETER_MODEL_ID = "onnx-community/LFM2.5-350M-ONNX";
export const LFM_INTERPRETER_MODEL_FILE = "model_q4.onnx";
export const LFM_INTERPRETER_MODEL_DATA_FILE = "model_q4.onnx_data";
export const DEFAULT_RERANK_BATCH_SIZE = 8;
export const MEMORY_MODEL_BENCHMARK_PROFILE_ENV =
  "MARC_MEMORY_BENCHMARK_PROFILE";

export type MemoryModelSelection = {
  embedding: {
    dimensions: number;
    model: string;
    modelFile: string;
    name: string;
    providerId: string;
    quantized: boolean;
  };
  id: MemoryModelBenchmarkProfileId;
  reranking: {
    model: string;
    modelFile: string;
    name: string;
    providerId: string;
    quantized: boolean;
  };
};

export type MemoryModelBenchmarkProfileId =
  | "baseline"
  | "retriever-base"
  | "reranker-bge"
  | "base-bge";

const smallEmbedding = {
  dimensions: 384,
  model: E5_MODEL_ID,
  modelFile: E5_MODEL_FILE,
  name: "Transformers.js local multilingual E5 retrieval",
  providerId: "transformers-js-local-e5",
  quantized: true
};

const baseEmbedding = {
  dimensions: 768,
  model: E5_BASE_MODEL_ID,
  modelFile: E5_MODEL_FILE,
  name: "Transformers.js local multilingual E5 base retrieval",
  providerId: "transformers-js-local-e5-base",
  quantized: true
};

const mmarcoReranking = {
  model: MMARCO_MODEL_ID,
  modelFile: MMARCO_RERANKER_MODEL_FILE,
  name: "Transformers.js local multilingual mMARCO reranking",
  providerId: "transformers-js-local-mmarco",
  quantized: false
};

const bgeReranking = {
  model: BGE_RERANKER_MODEL_ID,
  modelFile: BGE_RERANKER_MODEL_FILE,
  name: "Transformers.js local multilingual BGE reranking",
  providerId: "transformers-js-local-bge-reranker-v2-m3",
  quantized: true
};

export const MEMORY_MODEL_BENCHMARK_PROFILES = {
  baseline: {
    embedding: smallEmbedding,
    id: "baseline",
    reranking: mmarcoReranking
  },
  "retriever-base": {
    embedding: baseEmbedding,
    id: "retriever-base",
    reranking: mmarcoReranking
  },
  "reranker-bge": {
    embedding: smallEmbedding,
    id: "reranker-bge",
    reranking: bgeReranking
  },
  "base-bge": {
    embedding: baseEmbedding,
    id: "base-bge",
    reranking: bgeReranking
  }
} satisfies Record<MemoryModelBenchmarkProfileId, MemoryModelSelection>;

export function memoryModelSelection(
  profileId: string = "baseline"
): MemoryModelSelection {
  const selection = Reflect.get(MEMORY_MODEL_BENCHMARK_PROFILES, profileId) as
    | MemoryModelSelection
    | undefined;
  if (selection) return selection;
  throw new Error(`Unknown memory model benchmark profile: ${profileId}`);
}

export function activeMemoryModelSelection(): MemoryModelSelection {
  return memoryModelSelection(
    process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV] ?? "baseline"
  );
}

export function embeddingProviderMetadata(): EmbeddingProviderMetadata {
  const embedding = activeMemoryModelSelection().embedding;
  return {
    id: embedding.providerId,
    name: embedding.name,
    model: embedding.model,
    version: MEMORY_MODEL_VERSION,
    dimensions: embedding.dimensions,
    distance: "cosine",
    quantized: embedding.quantized,
    runtime: "local"
  };
}

export function rerankingProviderMetadata(): RerankingProviderMetadata {
  const reranking = activeMemoryModelSelection().reranking;
  return {
    id: reranking.providerId,
    name: reranking.name,
    model: `${reranking.model}/${reranking.modelFile}`,
    version: MEMORY_MODEL_VERSION,
    quantized: reranking.quantized,
    runtime: "local"
  };
}

export function queryInterpretationProviderMetadata(): QueryInterpretationProviderMetadata {
  return {
    id: "transformers-js-local-lfm-query-interpreter",
    name: "Transformers.js local LFM query interpreter",
    model: `${LFM_INTERPRETER_MODEL_ID}/${LFM_INTERPRETER_MODEL_FILE}`,
    version: MEMORY_MODEL_VERSION,
    quantized: true,
    runtime: "local"
  };
}

const modelCacheDirectories: Record<MemoryInferenceRole, string> = {
  embedding: "Xenova--multilingual-e5-small",
  interpretation: "onnx-community--LFM2.5-350M-ONNX",
  reranking: "cross-encoder--mmarco-mMiniLMv2-L12-H384-v1"
};

export function localModelCachePath(
  info: WorkspaceInfo,
  role: MemoryInferenceRole
): string {
  const root = safeJoin(info.marcPath, "cache", "memory-models");
  const profileId = process.env[MEMORY_MODEL_BENCHMARK_PROFILE_ENV];
  if (!profileId || profileId === "baseline" || role === "interpretation")
    return safeJoin(root, modelCacheDirectories[role]);
  const selection = memoryModelSelection(profileId);
  const modelByRole = {
    embedding: selection.embedding.model,
    reranking: selection.reranking.model
  };
  const productionModelByRole = {
    embedding: E5_MODEL_ID,
    reranking: MMARCO_MODEL_ID
  };
  const model = modelByRole[role];
  if (model === productionModelByRole[role])
    return safeJoin(root, modelCacheDirectories[role]);
  return safeJoin(root, "experiments", model.replaceAll("/", "--"));
}

export function workerModelCachePath(
  marcPath: string,
  role: MemoryInferenceRole,
  rootPath: string
): string {
  return localModelCachePath(
    {
      id: "worker",
      marcPath,
      name: "worker",
      rootPath
    },
    role
  );
}

export async function isLocalMemoryModelPrepared(
  info: WorkspaceInfo,
  role: MemoryInferenceRole
): Promise<boolean> {
  const files = await cachedModelFiles(localModelCachePath(info, role));
  const requiredFiles = requiredModelFiles(role);
  return requiredFiles.every((file) =>
    files.some((path) => normalizedModelPath(path).endsWith(file))
  );
}

function normalizedModelPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function requiredModelFiles(role: MemoryInferenceRole): string[] {
  const selection = activeMemoryModelSelection();
  const requiredFilesByRole: Record<MemoryInferenceRole, string[]> = {
    embedding: ["config.json", `onnx/${selection.embedding.modelFile}`],
    interpretation: [
      "config.json",
      `onnx/${LFM_INTERPRETER_MODEL_FILE}`,
      `onnx/${LFM_INTERPRETER_MODEL_DATA_FILE}`
    ],
    reranking: ["config.json", `onnx/${selection.reranking.modelFile}`]
  };
  return requiredFilesByRole[role];
}

async function cachedModelFiles(root: string): Promise<string[]> {
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = safeJoin(root, entry.name);
    if (entry.isFile()) files.push(entryPath);
    if (!entry.isDirectory()) continue;
    files.push(...(await cachedModelFiles(entryPath)));
  }

  return files;
}
