import { createHash } from "node:crypto";
import type {
  EmbeddingProvider,
  EmbeddingProviderMetadata,
  QueryInterpretationProvider,
  QueryInterpretationProviderMetadata,
  RerankingProvider,
  RerankingProviderMetadata
} from "../../src/core/memory/types.js";

export type InterpretationTrace = {
  feedback?: string;
  output: string;
  variants: string[];
};

/** Key of one query/document pair in the reranker capture. */
export function rerankPairKey(query: string, document: string): string {
  return createHash("sha256")
    .update(query)
    .update("\0")
    .update(document)
    .digest("hex");
}

/** Delegates to a real embedding provider and records each query vector by text. */
export class RecordingEmbeddingProvider implements EmbeddingProvider {
  readonly queryVectors = new Map<string, number[]>();

  constructor(private readonly delegate: EmbeddingProvider) {}

  describe(): EmbeddingProviderMetadata {
    return this.delegate.describe();
  }

  isPrepared(): Promise<boolean> {
    return this.delegate.isPrepared();
  }

  prepare(): Promise<void> {
    return this.delegate.prepare();
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.delegate.embedDocuments(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    const vector = await this.delegate.embedQuery(text);
    this.queryVectors.set(text, vector);
    return vector;
  }

  dispose(): Promise<void> {
    return this.delegate.dispose();
  }
}

/** Delegates to a real reranker and records every scored pair by rerankPairKey. */
export class RecordingRerankingProvider implements RerankingProvider {
  readonly scores = new Map<string, number>();

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

  async rerank(
    query: string,
    documents: string[],
    batchSize: number
  ): Promise<number[]> {
    const scores = await this.delegate.rerank(query, documents, batchSize);
    if (scores.length !== documents.length)
      throw new Error("Memory reranker returned an unexpected score count.");
    documents.forEach((document, index) => {
      this.scores.set(rerankPairKey(query, document), scores[index] ?? 0);
    });
    return scores;
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

/**
 * Delegates to a real query interpreter and records every selectVariant call,
 * following the RecordingQueryInterpreter of scripts/memory-quality-v4.ts.
 */
export class RecordingQueryInterpreter implements QueryInterpretationProvider {
  readonly trace: InterpretationTrace[] = [];

  constructor(private readonly delegate: QueryInterpretationProvider) {}

  describe(): QueryInterpretationProviderMetadata {
    return this.delegate.describe();
  }

  isPrepared(): Promise<boolean> {
    return this.delegate.isPrepared();
  }

  prepare(): Promise<void> {
    return this.delegate.prepare();
  }

  async selectVariant(input: {
    feedback?: string;
    originalQuery: string;
    variants: string[];
  }): Promise<string> {
    const output = await this.delegate.selectVariant(input);
    this.trace.push({
      feedback: input.feedback,
      output,
      variants: input.variants
    });
    return output;
  }

  dispose(): Promise<void> {
    return this.delegate.dispose();
  }
}
