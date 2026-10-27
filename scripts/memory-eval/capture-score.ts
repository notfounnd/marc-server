import { DEFAULT_RERANK_BATCH_SIZE } from "../../src/core/memory/model-config.js";
import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import type {
  MemorySearchChannels,
  MemorySearchDepth,
  MemoryVectorRecord
} from "../../src/core/memory/types.js";
import {
  captureProductionRecall,
  toCapturedHit,
  toCapturedLexicalHit
} from "./capture-channels.js";
import type { CasePlan } from "./capture-plan.js";
import { CAPTURE_DEPTHS, E3_RERANK_ORDER } from "./capture-layers.js";
import type {
  CapturedCase,
  CapturedChannels,
  CaptureContext
} from "./capture-types.js";
import { rerankPairKey } from "./recording-providers.js";

/**
 * Scores the matrix of one planned case: every record of the scope, once, for the effective query.
 * The pairs are the only reranker calls of a capture; the planning does not score anything.
 */
export async function scoreCase(context: CaptureContext, plan: CasePlan): Promise<CapturedCase> {
  const records = recordsOf(context, plan.scopeRecordIds);
  const documents = records.map((record) => semanticRerankingDocument(record));
  const scores = await scoreDocuments(context, plan.effectiveQuery, documents);
  const effective = plan.effectiveQuery;
  return {
    id: plan.evalCase.id,
    queryMode: plan.evalCase.queryMode,
    originalQuery: plan.evalCase.query,
    interpretation: plan.interpretation,
    candidates: plan.candidates,
    interpretationTrace: plan.interpretationTrace,
    queryVectors: { [effective]: plan.queryVector },
    channels: { [effective]: capturedChannelsOf(channelsAt(plan.channelsByDepth, 0)) },
    channelsByDepth: capturedByDepth(plan.channelsByDepth),
    rerankScores: pairScoresOf(effective, documents, scores),
    recordScores: recordScoresOf(records, scores),
    productionRecall: await captureProductionRecall(context, effective),
    evidence: plan.evidence,
    incomplete: plan.incomplete
  };
}

/**
 * The scores by recordId. Two records with the same document get the same score, because the reranker
 * is deterministic for a text; each record keeps its own entry, so the funnel reads every pair it needs.
 */
export function recordScoresOf(
  records: readonly { recordId: string }[],
  scores: readonly number[]
): Record<string, number> {
  return Object.fromEntries(records.map((record, index) => [record.recordId, scores[index]]));
}

/** The scores by rerankPairKey: one entry per distinct (query, document) text, as M0 reads them. */
export function pairScoresOf(
  query: string,
  documents: readonly string[],
  scores: readonly number[]
): Record<string, number> {
  return Object.fromEntries(
    documents.map((document, index) => [rerankPairKey(query, document), scores[index]])
  );
}

async function scoreDocuments(
  context: CaptureContext,
  query: string,
  documents: string[]
): Promise<number[]> {
  if (documents.length === 0) return [];
  const scores = await context.providers.reranker.rerank(
    query,
    documents,
    DEFAULT_RERANK_BATCH_SIZE,
    E3_RERANK_ORDER
  );
  if (scores.length !== documents.length)
    throw new Error("The reranker returned an unexpected score count for the matrix.");
  return scores;
}

function recordsOf(context: CaptureContext, recordIds: readonly string[]): MemoryVectorRecord[] {
  const byId = new Map(context.matrixRecords.map((record) => [record.recordId, record]));
  return recordIds.map((recordId) => {
    const record = byId.get(recordId);
    if (record === undefined) throw new Error(`Record ${recordId} is outside the matrix.`);
    return record;
  });
}

function channelsAt(
  channelsByDepth: Partial<Record<MemorySearchDepth, MemorySearchChannels>>,
  depth: MemorySearchDepth
): MemorySearchChannels {
  const channels = channelsByDepth[depth];
  if (channels === undefined) throw new Error(`The case has no channels for depth ${depth}.`);
  return channels;
}

function capturedByDepth(
  channelsByDepth: Partial<Record<MemorySearchDepth, MemorySearchChannels>>
): Partial<Record<MemorySearchDepth, CapturedChannels>> {
  return Object.fromEntries(
    CAPTURE_DEPTHS.map((depth) => [depth, capturedChannelsOf(channelsAt(channelsByDepth, depth))])
  ) as Partial<Record<MemorySearchDepth, CapturedChannels>>;
}

export function capturedChannelsOf(channels: MemorySearchChannels): CapturedChannels {
  return {
    identities: channels.identities.map(toCapturedHit),
    passages: channels.passages.map(toCapturedHit),
    lexical: channels.lexical.map(toCapturedLexicalHit)
  };
}
