import type { WorkspaceInfo } from "../types.js";
import { defaultMemoryInferenceManager } from "./inference-manager.js";
import {
  embeddingProviderMetadata,
  isLocalMemoryModelPrepared,
  localModelCachePath
} from "./model-config.js";
import type { EmbeddingProvider, EmbeddingProviderMetadata } from "./types.js";

export class LocalEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly info: WorkspaceInfo,
    private readonly inference = defaultMemoryInferenceManager
  ) {}

  describe(): EmbeddingProviderMetadata {
    return embeddingProviderMetadata();
  }

  async isPrepared(): Promise<boolean> {
    return isLocalMemoryModelPrepared(this.info, "embedding");
  }

  async prepare(): Promise<void> {
    const result = await this.inference.run(this.info, "embedding", {
      action: "prepare"
    });
    if ("prepared" in result) return;
    throw new Error(
      "Memory embedding worker returned an invalid preparation result."
    );
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const result = await this.inference.run(this.info, "embedding", {
      action: "embedDocuments",
      texts
    });
    if ("vectors" in result) return result.vectors;
    throw new Error(
      "Memory embedding worker returned an invalid vector result."
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    const result = await this.inference.run(this.info, "embedding", {
      action: "embedQuery",
      text
    });
    if ("vectors" in result) return result.vectors[0] ?? [];
    throw new Error(
      "Memory embedding worker returned an invalid query vector."
    );
  }

  async dispose(): Promise<void> {
    await this.inference.dispose(this.info, "embedding");
  }
}

export function localEmbeddingModelCachePath(info: WorkspaceInfo): string {
  return localModelCachePath(info, "embedding");
}
