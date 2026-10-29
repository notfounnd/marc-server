import { DEFAULT_RERANK_BATCH_SIZE } from "./model-config.js";
import { semanticRerankingDocument } from "./semantic-ranking.js";
import type { MemoryVectorRecord, RerankingProvider } from "./types.js";

/**
 * One reranker call for the records, in the given order, with the same batch size and document
 * text as M0. Returns one score per record, in the same order.
 */
export async function rerankRecords(
  query: string,
  records: readonly MemoryVectorRecord[],
  reranker: RerankingProvider
): Promise<number[]> {
  if (records.length === 0) return [];
  const scores = await reranker.rerank(
    query,
    records.map((record) => semanticRerankingDocument(record)),
    DEFAULT_RERANK_BATCH_SIZE
  );
  if (scores.length !== records.length)
    throw new Error("Memory reranker returned an unexpected score count.");
  return scores;
}
