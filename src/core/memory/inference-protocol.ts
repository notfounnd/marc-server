import type { MemoryInferenceRole } from "./model-config.js";

export type MemoryInferenceRequest =
  | { action: "prepare" }
  | { action: "memoryUsage" }
  | { action: "embedDocuments"; texts: string[] }
  | { action: "embedQuery"; text: string }
  | {
      action: "interpret";
      feedback?: string;
      originalQuery: string;
      variants: string[];
    }
  | { action: "rerank"; batchSize: number; documents: string[]; query: string }
  | {
      action: "splitPassages";
      maxTokens: number;
      overlapTokens: number;
      texts: string[];
    };

export type MemoryInferenceResult =
  | { prepared: true }
  | {
      memoryUsage: {
        arrayBuffers: number;
        external: number;
        heapTotal: number;
        heapUsed: number;
        rss: number;
      };
    }
  | { vectors: number[][] }
  | { scores: number[] }
  | { text: string }
  | { passages: string[][] };

export type MemoryInferenceEnvelope = {
  id: number;
  role: MemoryInferenceRole;
  request: MemoryInferenceRequest;
};

export type MemoryInferenceResponse =
  | { id: number; ok: true; result: MemoryInferenceResult }
  | { error: string; id: number; ok: false };
