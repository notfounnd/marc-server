import type { RerankOrder } from "./rerank-order.js";
import type { RerankingProvider, RerankingProviderMetadata } from "./types.js";

/**
 * Forwards every call to the reranker and counts the documents that were sent. A recall
 * reports the count as rerankPairs, which is the number of pairs that M0 scores.
 */
export class CountingRerankingProvider implements RerankingProvider {
  pairs = 0;

  constructor(private readonly delegate: RerankingProvider) {}

  describe(): RerankingProviderMetadata {
    return this.delegate.describe();
  }

  isPrepared(): Promise<boolean> {
    return this.delegate.isPrepared();
  }

  prepare(): Promise<void> {
    return this.delegate.prepare();
  }

  rerank(
    query: string,
    documents: string[],
    batchSize: number,
    order?: RerankOrder
  ): Promise<number[]> {
    this.pairs += documents.length;
    return this.delegate.rerank(query, documents, batchSize, order);
  }

  splitPassages(
    texts: string[],
    options: { maxTokens: number; overlapTokens: number }
  ): Promise<string[][]> {
    return this.delegate.splitPassages(texts, options);
  }

  dispose(): Promise<void> {
    return this.delegate.dispose();
  }
}
