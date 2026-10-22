import { DEFAULT_RERANK_BATCH_SIZE } from "../../src/core/memory/model-config.js";
import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import {
  threadFeatures,
  type RerankScores,
  type ThreadFeatures
} from "../../src/core/memory/scoring/features.js";
import type {
  MemorySearchChannels,
  MemoryVectorRecord,
  RerankingProvider
} from "../../src/core/memory/types.js";

/**
 * Features of every candidate thread of one effective query. The reranker is
 * asked once for every record of the channels, so the feature function itself
 * stays pure and synchronous.
 */
export async function candidateFeaturesOf(
  query: string,
  channels: MemorySearchChannels,
  reranker: RerankingProvider
): Promise<ThreadFeatures[]> {
  const scores = await rerankScoresOf(query, channels, reranker);
  return threadFeatures(channels, scores);
}

/**
 * The reranker score of every identity and passage record of the channels, keyed by
 * recordId, for one effective query. One call to the reranker, as in the features.
 */
export async function rerankScoresOf(
  query: string,
  channels: MemorySearchChannels,
  reranker: RerankingProvider
): Promise<RerankScores> {
  const records = uniqueRecords(channels);
  if (records.length === 0) return new Map();
  const scores = await reranker.rerank(
    query,
    records.map((record) => semanticRerankingDocument(record)),
    DEFAULT_RERANK_BATCH_SIZE
  );
  return scoresByRecord(records, scores);
}

function uniqueRecords(channels: MemorySearchChannels): MemoryVectorRecord[] {
  const records = new Map<string, MemoryVectorRecord>();
  for (const hit of [...channels.identities, ...channels.passages]) {
    records.set(hit.record.recordId, hit.record);
  }
  for (const hit of channels.lexical) {
    records.set(hit.record.recordId, hit.record);
  }
  return [...records.values()];
}

function scoresByRecord(
  records: readonly MemoryVectorRecord[],
  scores: readonly number[]
): RerankScores {
  if (scores.length !== records.length) {
    throw new Error("The reranker returned an unexpected score count.");
  }
  return new Map(
    records.map((record, index) => [record.recordId, scores[index]] as const)
  );
}
