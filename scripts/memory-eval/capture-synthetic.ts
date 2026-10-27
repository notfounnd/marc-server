import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RERANK_BATCH_SIZE } from "../../src/core/memory/model-config.js";
import { MEMORY_LAYER_CANDIDATE_LIMIT } from "../../src/core/memory/search-depth.js";
import type {
  EmbeddingProvider,
  MemoryLexicalSearchHit,
  MemorySearchHit,
  RerankingProvider
} from "../../src/core/memory/types.js";
import { SYNTHETIC_QUERY_COUNT, SYNTHETIC_QUERY_RULE, syntheticQueries } from "./synthetic-queries.js";
import { lexicalFieldsForQueryReplica, toCapturedHit, toCapturedLexicalHit } from "./capture-channels.js";
import type {
  CapturedChannels,
  CapturedSyntheticQuery,
  CaptureContext
} from "./capture-types.js";
import { RecordingEmbeddingProvider, RecordingRerankingProvider } from "./recording-providers.js";

/**
 * The E2 synthetic queries (Inverse Cloze) of a capture. They are the labels of the H2 calibration,
 * so only the legacy E2 captures and their fixtures carry them. An E3 capture does not run this step.
 * Each query scores the whole matrix of the temporary index, as the E2 captures did.
 */
export const SYNTHETIC_CACHE_FILE = "synthetic-queries.json";

export const E2_SYNTHETIC_RULE = SYNTHETIC_QUERY_RULE;
export const E2_SYNTHETIC_REQUESTED = SYNTHETIC_QUERY_COUNT;

/** The synthetic queries of a capture. A resumed capture reads them back, like its concluded cases. */
export async function captureSyntheticQueries(
  context: CaptureContext,
  captureDir: string,
  resume: boolean
): Promise<CapturedSyntheticQuery[]> {
  const cachePath = path.join(captureDir, SYNTHETIC_CACHE_FILE);
  const cached = resume
    ? await fs.readFile(cachePath, "utf8").catch(() => undefined)
    : undefined;
  if (cached !== undefined) return JSON.parse(cached) as CapturedSyntheticQuery[];
  const captured = await computeSyntheticQueries(context);
  await fs.writeFile(cachePath, JSON.stringify(captured));
  return captured;
}

async function computeSyntheticQueries(context: CaptureContext): Promise<CapturedSyntheticQuery[]> {
  const passages = context.rows
    .filter((row) => row.kind === "passage")
    .map((row) => ({ recordId: row.recordId, threadId: row.threadId, text: row.text }));
  const captured: CapturedSyntheticQuery[] = [];
  for (const query of syntheticQueries(passages, context.generation)) {
    const embedding = new RecordingEmbeddingProvider(context.providers.embedding);
    const reranker = new RecordingRerankingProvider(context.providers.reranker);
    const channels = await captureMatrixChannels(context, embedding, reranker, query.text);
    captured.push({
      ...query,
      queryVector: vectorOf(embedding.queryVectors, query.text),
      channels,
      rerankScores: Object.fromEntries(reranker.scores)
    });
  }
  return captured;
}

/** The E2 channels of one text: the production channels at the layer 0 limit, with the whole matrix scored. */
async function captureMatrixChannels(
  context: CaptureContext,
  embedding: EmbeddingProvider,
  reranker: RerankingProvider,
  text: string
): Promise<CapturedChannels> {
  const vector = await embedding.embedQuery(text);
  const { info, store, generation } = context;
  const limit = MEMORY_LAYER_CANDIDATE_LIMIT;
  const [identityHits, passageHits, ...lexicalHits] = await Promise.all([
    store.searchVector(info, vector, { generation, kind: "identity", limit }),
    store.searchVector(info, vector, { generation, kind: "passage", limit }),
    ...lexicalFieldsForQueryReplica(text).map((field) =>
      store.searchLexical(info, text, vector, { field, generation, limit })
    )
  ]);
  await reranker.rerank(text, context.matrixDocuments, DEFAULT_RERANK_BATCH_SIZE);
  return {
    identities: identityHits.map((hit: MemorySearchHit) => toCapturedHit(hit)),
    passages: passageHits.map((hit: MemorySearchHit) => toCapturedHit(hit)),
    lexical: lexicalHits.flat().map((hit: MemoryLexicalSearchHit) => toCapturedLexicalHit(hit))
  };
}

function vectorOf(vectors: ReadonlyMap<string, number[]>, text: string): number[] {
  const vector = vectors.get(text);
  if (vector === undefined) throw new Error(`Missing query vector for "${text}".`);
  return [...vector];
}
