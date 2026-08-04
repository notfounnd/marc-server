import fs from "node:fs/promises";
import {
  normalizePassageOptions,
  splitTextIntoPassages
} from "./passage-segmentation.js";
import {
  passageTokenizer,
  type TransformersPassageTokenizer
} from "./transformers-passage-tokenizer.js";
import {
  isMemoryAllocationError,
  rerankBatchSizes
} from "./rerank-batching.js";
import type { MemoryInferenceRole } from "./model-config.js";
import {
  activeMemoryModelSelection,
  DEFAULT_RERANK_BATCH_SIZE,
  workerModelCachePath
} from "./model-config.js";
import type {
  MemoryInferenceRequest,
  MemoryInferenceResult
} from "./inference-protocol.js";
import { toScores } from "./inference-output.js";
import {
  parseMemoryInferenceEnvelope,
  sendMemoryInferenceResponse
} from "./inference-wire.js";
import { handleQueryInterpretationRequest } from "./query-interpretation-inference.js";

type FeatureExtractionPipeline = {
  (
    input: string | string[],
    options: { normalize: true; pooling: "mean" }
  ): Promise<{ tolist(): number[] | number[][] }>;
  dispose?: () => Promise<void>;
};

type RerankerModel = {
  (input: unknown): Promise<{ logits: { tolist(): unknown } }>;
  dispose?: () => Promise<void>;
};

type RerankerTokenizer = TransformersPassageTokenizer;

let extractor: FeatureExtractionPipeline | undefined;
let reranker: RerankerModel | undefined;
let rerankerTokenizer: RerankerTokenizer | undefined;

process.on("message", (message: unknown) => {
  void handleRequest(message);
});

async function handleRequest(message: unknown): Promise<void> {
  const envelope = parseMemoryInferenceEnvelope(message);
  if (!envelope) return;

  try {
    const result = await executeWorkerRequest(envelope.role, envelope.request);
    sendMemoryInferenceResponse({ id: envelope.id, ok: true, result });
  } catch (error) {
    sendMemoryInferenceResponse({
      error: error instanceof Error ? error.message : String(error),
      id: envelope.id,
      ok: false
    });
  }
}

async function executeWorkerRequest(
  role: MemoryInferenceRole,
  request: MemoryInferenceRequest
): Promise<MemoryInferenceResult> {
  if (request.action === "memoryUsage") {
    const usage = process.memoryUsage();
    return {
      memoryUsage: {
        arrayBuffers: usage.arrayBuffers,
        external: usage.external,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        rss: usage.rss
      }
    };
  }
  return workerActions[role](request);
}

const workerActions: Record<
  MemoryInferenceRole,
  (request: MemoryInferenceRequest) => Promise<MemoryInferenceResult>
> = {
  embedding: handleEmbeddingRequest,
  interpretation: handleQueryInterpretationRequest,
  reranking: handleRerankingRequest
};

async function handleEmbeddingRequest(
  request: MemoryInferenceRequest
): Promise<MemoryInferenceResult> {
  if (request.action === "prepare") {
    await loadExtractor(true);
    return { prepared: true };
  }
  if (request.action === "embedDocuments") {
    const pipeline = await loadExtractor(false);
    const output = await pipeline(request.texts.map(passageText), {
      normalize: true,
      pooling: "mean"
    });
    return { vectors: toVectors(output.tolist()) };
  }
  if (request.action === "embedQuery") {
    const pipeline = await loadExtractor(false);
    const output = await pipeline(queryText(request.text), {
      normalize: true,
      pooling: "mean"
    });
    return { vectors: toVectors(output.tolist()) };
  }
  throw new Error("Embedding worker does not support reranking requests.");
}

async function handleRerankingRequest(
  request: MemoryInferenceRequest
): Promise<MemoryInferenceResult> {
  if (request.action === "prepare") {
    await loadReranker(true);
    return { prepared: true };
  }
  if (request.action === "rerank") {
    return {
      scores: await rerankDocuments(
        request.query,
        request.documents,
        request.batchSize
      )
    };
  }
  if (request.action === "splitPassages") {
    return {
      passages: await splitDocumentsIntoPassages(
        request.texts,
        request.maxTokens,
        request.overlapTokens
      )
    };
  }
  throw new Error("Reranking worker does not support embedding requests.");
}

async function loadExtractor(
  allowRemoteModels: boolean
): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;
  const transformers = await import("@huggingface/transformers");
  const embedding = activeMemoryModelSelection().embedding;
  transformers.env.allowRemoteModels = allowRemoteModels;
  transformers.env.cacheDir = workerMemoryModelCachePath("embedding");
  await fs.mkdir(transformers.env.cacheDir, { recursive: true });
  extractor = await transformers.pipeline(
    "feature-extraction",
    embedding.model,
    {
      dtype: "int8",
      model_file_name: "model"
    }
  );
  return extractor;
}

async function loadReranker(
  allowRemoteModels: boolean
): Promise<{ model: RerankerModel; tokenizer: RerankerTokenizer }> {
  const tokenizer = await loadRerankerTokenizer(allowRemoteModels);
  if (reranker) return { model: reranker, tokenizer };

  const reranking = activeMemoryModelSelection().reranking;
  const transformers = await loadTransformers(allowRemoteModels, "reranking");
  reranker =
    (await transformers.AutoModelForSequenceClassification.from_pretrained(
      reranking.model,
      {
        model_file_name: reranking.modelFile.replace(".onnx", ""),
        subfolder: "onnx"
      }
    )) as unknown as RerankerModel;
  return { model: reranker, tokenizer };
}

async function loadRerankerTokenizer(
  allowRemoteModels: boolean
): Promise<RerankerTokenizer> {
  if (rerankerTokenizer) return rerankerTokenizer;
  const reranking = activeMemoryModelSelection().reranking;
  const transformers = await loadTransformers(allowRemoteModels, "reranking");
  rerankerTokenizer = (await transformers.AutoTokenizer.from_pretrained(
    reranking.model
  )) as unknown as RerankerTokenizer;
  return rerankerTokenizer;
}

async function loadTransformers(
  allowRemoteModels: boolean,
  role: MemoryInferenceRole
): Promise<typeof import("@huggingface/transformers")> {
  const transformers = await import("@huggingface/transformers");
  transformers.env.allowRemoteModels = allowRemoteModels;
  transformers.env.cacheDir = workerMemoryModelCachePath(role);
  await fs.mkdir(transformers.env.cacheDir, { recursive: true });
  return transformers;
}

async function rerankDocuments(
  query: string,
  documents: string[],
  batchSize: number
): Promise<number[]> {
  if (!documents.length) return [];
  const { model, tokenizer } = await loadReranker(false);
  const size = normalizedBatchSize(batchSize);
  return rerankWithBackoff(model, tokenizer, query, documents, size);
}

async function rerankWithBackoff(
  model: RerankerModel,
  tokenizer: RerankerTokenizer,
  query: string,
  documents: string[],
  batchSize: number
): Promise<number[]> {
  let lastMemoryError: unknown;
  for (const size of rerankBatchSizes(batchSize)) {
    try {
      return await rerankDocumentBatches(
        model,
        tokenizer,
        query,
        documents,
        size
      );
    } catch (error) {
      if (!isMemoryAllocationError(error)) throw error;
      lastMemoryError = error;
    }
  }
  throw lastMemoryError;
}

async function rerankDocumentBatches(
  model: RerankerModel,
  tokenizer: RerankerTokenizer,
  query: string,
  documents: string[],
  batchSize: number
): Promise<number[]> {
  const scores: number[] = [];

  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize);
    const inputs = tokenizer(
      Array.from({ length: batch.length }, () => query),
      {
        max_length: 512,
        padding: true,
        text_pair: batch,
        truncation: true
      }
    );
    const output = await model(inputs);
    scores.push(...toScores(output.logits.tolist()));
  }

  return scores;
}

async function splitDocumentsIntoPassages(
  texts: string[],
  maxTokens: number,
  overlapTokens: number
): Promise<string[][]> {
  const tokenizer = await loadRerankerTokenizer(false);
  const options = normalizePassageOptions(maxTokens, overlapTokens);
  return texts.map((text) =>
    splitTextIntoPassages(passageTokenizer(tokenizer), text, options)
  );
}

function queryText(text: string): string {
  return `query: ${text}`;
}

function passageText(text: string): string {
  return `passage: ${text}`;
}

function normalizedBatchSize(value: number): number {
  if (!Number.isInteger(value)) return DEFAULT_RERANK_BATCH_SIZE;
  if (value < 1) return DEFAULT_RERANK_BATCH_SIZE;
  return value;
}

function toVectors(value: number[] | number[][]): number[][] {
  if (!Array.isArray(value[0])) return [value as number[]];
  return value as number[][];
}

function workerMemoryModelCachePath(role: MemoryInferenceRole): string {
  const marcPath = process.env.MARC_WORKSPACE_PATH;
  if (!marcPath)
    throw new Error("Memory inference worker requires workspace path.");
  return workerModelCachePath(marcPath, role, process.cwd());
}
