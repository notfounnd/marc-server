import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  RerankingProvider,
  RerankingProviderMetadata
} from "../../src/core/memory/types.js";
import { rerankPairKey } from "./recording-providers.js";

/** Serves query vectors from a capture. Documents cannot be embedded offline. */
export class CachedEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly metadata: EmbeddingProviderMetadata,
    private readonly vectors: ReadonlyMap<string, number[]>
  ) {}

  describe(): EmbeddingProviderMetadata {
    return this.metadata;
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  embedDocuments(): Promise<number[][]> {
    return Promise.reject(
      new Error("Cached embedding replay cannot embed documents.")
    );
  }

  embedQuery(text: string): Promise<number[]> {
    const vector = this.vectors.get(text);
    if (vector === undefined)
      return Promise.reject(
        new Error(`Missing cached query vector for "${text}".`)
      );
    return Promise.resolve([...vector]);
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

/** Serves reranker scores from a capture, keyed by rerankPairKey. */
export class CachedRerankingProvider implements RerankingProvider {
  constructor(
    private readonly metadata: RerankingProviderMetadata,
    private readonly scores: ReadonlyMap<string, number>
  ) {}

  describe(): RerankingProviderMetadata {
    return this.metadata;
  }

  isPrepared(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  rerank(
    query: string,
    documents: string[],
    _batchSize: number
  ): Promise<number[]> {
    const scores: number[] = [];
    for (const document of documents) {
      const key = rerankPairKey(query, document);
      const score = this.scores.get(key);
      if (score === undefined)
        return Promise.reject(
          new Error(`Missing cached rerank score for pair ${key}.`)
        );
      scores.push(score);
    }
    return Promise.resolve(scores);
  }

  splitPassages(): Promise<string[][]> {
    return Promise.reject(
      new Error("Cached reranking replay cannot split passages.")
    );
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}
