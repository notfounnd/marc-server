import fs from "node:fs/promises";
import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";
import type { EmbeddingProvider, EmbeddingProviderMetadata } from "./types.js";

const MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const MODEL_VERSION = "transformers-js-4.2.0";
const MODEL_DIMENSIONS = 384;

type FeatureExtractionPipeline = {
  (
    input: string | string[],
    options: { pooling: "mean"; normalize: true }
  ): Promise<{ tolist(): number[] | number[][] }>;
  dispose?: () => Promise<void>;
};

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private extractor?: FeatureExtractionPipeline;

  constructor(private readonly info: WorkspaceInfo) {}

  describe(): EmbeddingProviderMetadata {
    return {
      id: "transformers-js-local",
      name: "Transformers.js local multilingual embeddings",
      model: MODEL_ID,
      version: MODEL_VERSION,
      dimensions: MODEL_DIMENSIONS,
      distance: "cosine",
      quantized: false,
      runtime: "local"
    };
  }

  async isPrepared(): Promise<boolean> {
    const cachePath = localModelCachePath(this.info);
    const entries = await fs.readdir(cachePath).catch(() => []);
    return entries.length > 0;
  }

  async prepare(): Promise<void> {
    await this.loadExtractor({ allowRemoteModels: true });
    await this.dispose();
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const extractor = await this.loadExtractor({ allowRemoteModels: false });
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    const vectors = output.tolist();
    if (!Array.isArray(vectors[0])) return [vectors as number[]];
    return vectors as number[][];
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embedDocuments([text]);
    return vectors[0] ?? [];
  }

  async dispose(): Promise<void> {
    const extractor = this.extractor;
    this.extractor = undefined;
    if (!extractor?.dispose) return;
    await extractor.dispose();
  }

  private async loadExtractor(options: {
    allowRemoteModels: boolean;
  }): Promise<FeatureExtractionPipeline> {
    if (this.extractor) return this.extractor;
    const transformers = (await import("@huggingface/transformers")) as {
      env: {
        cacheDir: string;
        allowRemoteModels: boolean;
      };
      pipeline(
        task: "feature-extraction",
        model: string
      ): Promise<FeatureExtractionPipeline>;
    };
    transformers.env.cacheDir = localModelCachePath(this.info);
    transformers.env.allowRemoteModels = options.allowRemoteModels;
    await fs.mkdir(transformers.env.cacheDir, { recursive: true });
    this.extractor = await transformers.pipeline(
      "feature-extraction",
      MODEL_ID
    );
    return this.extractor;
  }
}

export function localModelCachePath(info: WorkspaceInfo): string {
  return safeJoin(info.marcPath, "cache", "memory-models", pathSafeModelId());
}

function pathSafeModelId(): string {
  return MODEL_ID.replaceAll("/", "--");
}
