import { performance } from "node:perf_hooks";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { DEFAULT_RERANK_BATCH_SIZE } from "../../src/core/memory/model-config.js";
import {
  recallMemoryInWorkspace
} from "../../src/core/memory/operations.js";
import { candidateLimitForMemorySearchDepth } from "../../src/core/memory/search-depth.js";
import type {
  EmbeddingProvider,
  MemoryLexicalField,
  MemoryLexicalSearchHit,
  MemorySearchDepth,
  MemorySearchHit,
  RerankingProvider
} from "../../src/core/memory/types.js";
import type { EvalCase } from "./dataset.js";
import type {
  CapturedChannels,
  CapturedHit,
  CapturedLatency,
  CapturedLexicalHit,
  CapturedProductionRecall,
  CaptureContext
} from "./capture-types.js";

export const CAPTURE_DEPTH: MemorySearchDepth = 0;
const PRODUCTION_RECALL_LIMIT = 50;
const LATENCY_LIMIT = 5;
const LATENCY_SAMPLES = 3;

const LEXICAL_FIELDS_BY_TERM_COUNT = new Map<
  number,
  readonly MemoryLexicalField[]
>([[1, ["title", "summary", "titlePrefix"]]]);
const MULTI_TERM_LEXICAL_FIELDS: readonly MemoryLexicalField[] = [
  "title",
  "summary"
];

/**
 * Replica of lexicalFieldsForQuery in src/core/memory/operations.ts:259-268,
 * which is not exported. The end-to-end comparison with production is the
 * equivalence check of the replay stage.
 */
export function lexicalFieldsForQueryReplica(query: string): MemoryLexicalField[] {
  const termCount = query.trim().split(/\s+/).length;
  const fields = LEXICAL_FIELDS_BY_TERM_COUNT.get(termCount);
  return [...(fields ?? MULTI_TERM_LEXICAL_FIELDS)];
}

/**
 * Captures the production channels for one text and scores every identity and
 * passage record through the recording reranker, which fills the matrix.
 */
export async function captureChannels(
  context: CaptureContext,
  embedding: EmbeddingProvider,
  reranker: RerankingProvider,
  text: string
): Promise<CapturedChannels> {
  const vector = await embedding.embedQuery(text);
  const { info, store, generation } = context;
  const limit = candidateLimitForMemorySearchDepth(CAPTURE_DEPTH);
  const [identityHits, passageHits, ...lexicalHits] = await Promise.all([
    store.searchVector(info, vector, {
      generation,
      kind: "identity",
      limit
    }),
    store.searchVector(info, vector, {
      generation,
      kind: "passage",
      limit
    }),
    ...lexicalFieldsForQueryReplica(text).map((field) =>
      store.searchLexical(info, text, vector, {
        field,
        generation,
        limit
      })
    )
  ]);
  await reranker.rerank(text, context.matrixDocuments, DEFAULT_RERANK_BATCH_SIZE);
  return {
    identities: identityHits.map(toCapturedHit),
    passages: passageHits.map(toCapturedHit),
    lexical: lexicalHits.flat().map(toCapturedLexicalHit)
  };
}

/** Production recall in literal mode with the effective query, for the equivalence check. */
export async function captureProductionRecall(
  context: CaptureContext,
  effectiveQuery: string
): Promise<CapturedProductionRecall> {
  const recall = await recallMemoryInWorkspace(context.info, {
    query: effectiveQuery,
    queryMode: "literal",
    limit: PRODUCTION_RECALL_LIMIT,
    depth: CAPTURE_DEPTH,
    provider: context.providers.embedding,
    reranker: context.providers.reranker,
    store: context.store
  });
  return {
    effectiveQuery,
    limit: PRODUCTION_RECALL_LIMIT,
    results: recall.results.map((hit) => ({
      threadId: hit.threadId,
      score: hit.score
    }))
  };
}

/** One warm-up and three timed end-to-end recalls in the mode of the case. */
export async function measureLatency(
  context: CaptureContext,
  evalCase: EvalCase
): Promise<CapturedLatency> {
  const options = {
    query: evalCase.query,
    queryMode: evalCase.queryMode,
    limit: LATENCY_LIMIT,
    depth: CAPTURE_DEPTH,
    provider: context.providers.embedding,
    reranker: context.providers.reranker,
    interpreter: context.providers.interpreter,
    store: context.store
  };
  const warmup = await timedRecall(context.info, options);
  const samples: number[] = [];
  for (let run = 0; run < LATENCY_SAMPLES; run += 1) {
    samples.push(await timedRecall(context.info, options));
  }
  return { warmup, samples };
}

async function timedRecall(
  info: WorkspaceInfo,
  options: Parameters<typeof recallMemoryInWorkspace>[1]
): Promise<number> {
  const started = performance.now();
  await recallMemoryInWorkspace(info, options);
  return performance.now() - started;
}

function toCapturedHit(hit: MemorySearchHit): CapturedHit {
  return { recordId: hit.record.recordId, score: hit.score };
}

function toCapturedLexicalHit(hit: MemoryLexicalSearchHit): CapturedLexicalHit {
  return {
    field: hit.field,
    recordId: hit.record.recordId,
    score: hit.score,
    vectorScore: hit.vectorScore
  };
}
