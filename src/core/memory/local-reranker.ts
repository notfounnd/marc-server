import type { WorkspaceInfo } from "../types.js";
import { defaultMemoryInferenceManager } from "./inference-manager.js";
import { DEFAULT_RERANK_ORDER, type RerankOrder } from "./rerank-order.js";
import {
  DEFAULT_RERANK_BATCH_SIZE,
  isLocalMemoryModelPrepared,
  localModelCachePath,
  rerankingProviderMetadata
} from "./model-config.js";
import type { RerankingProvider, RerankingProviderMetadata } from "./types.js";

export class LocalRerankingProvider implements RerankingProvider {
  constructor(
    private readonly info: WorkspaceInfo,
    private readonly inference = defaultMemoryInferenceManager
  ) {}

  describe(): RerankingProviderMetadata {
    return rerankingProviderMetadata();
  }

  async isPrepared(): Promise<boolean> {
    return isLocalMemoryModelPrepared(this.info, "reranking");
  }

  async prepare(): Promise<void> {
    const result = await this.inference.run(this.info, "reranking", {
      action: "prepare"
    });
    if ("prepared" in result) return;
    throw new Error(
      "Memory reranking worker returned an invalid preparation result."
    );
  }

  async rerank(
    query: string,
    documents: string[],
    batchSize = DEFAULT_RERANK_BATCH_SIZE,
    order: RerankOrder = DEFAULT_RERANK_ORDER
  ): Promise<number[]> {
    const result = await this.inference.run(this.info, "reranking", {
      action: "rerank",
      batchSize,
      documents,
      order,
      query
    });
    if ("scores" in result) return result.scores;
    throw new Error(
      "Memory reranking worker returned an invalid score result."
    );
  }

  async splitPassages(
    texts: string[],
    options: { maxTokens: number; overlapTokens: number }
  ): Promise<string[][]> {
    const result = await this.inference.run(this.info, "reranking", {
      action: "splitPassages",
      maxTokens: options.maxTokens,
      overlapTokens: options.overlapTokens,
      texts
    });
    if ("passages" in result) return result.passages;
    throw new Error(
      "Memory reranking worker returned an invalid passage result."
    );
  }

  async dispose(): Promise<void> {
    await this.inference.dispose(this.info, "reranking");
  }
}

export function localRerankingModelCachePath(info: WorkspaceInfo): string {
  return localModelCachePath(info, "reranking");
}
