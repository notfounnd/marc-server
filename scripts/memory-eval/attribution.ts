import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import {
  asSearchRecord,
  type CapturedChannels,
  type CapturedRecord
} from "./capture-types.js";
import { rerankPairKey } from "./recording-providers.js";
import { TARGET_GRADE } from "./metrics.js";
import type { RelevanceGrade } from "./dataset.js";
import type { VariantResult } from "./variants.js";

/** Passages per thread sent to the reranker, as in src/core/memory/semantic-ranking.ts:20. */
export const MAX_RERANK_PASSAGES_PER_THREAD = 3;

export type AttributionCategory = "success" | "candidate_recall" | "admission" | "ordering";

export type AttributionInput = {
  caseId: string;
  positive: boolean;
  query: string;
  channels: CapturedChannels;
  rerankScores: Record<string, number>;
  records: ReadonlyMap<string, CapturedRecord>;
  judgments: Record<string, RelevanceGrade>;
  results: VariantResult[];
};

export type AttributionRow = {
  caseId: string;
  threadId: string;
  category: AttributionCategory;
  passageSelectionSuspect: boolean;
  position: number | null;
  eligibility: number | null;
};

export const ATTRIBUTION_CATEGORIES: readonly AttributionCategory[] = [
  "success",
  "candidate_recall",
  "admission",
  "ordering"
];

/**
 * Classifies every thread of grade 3 of a positive case with exactly one
 * category, using the M0 list at depth 0. The passage-selection mark applies to
 * admission and ordering only.
 */
export function attributeCase(input: AttributionInput): AttributionRow[] {
  if (!input.positive) return [];
  const targets = Object.entries(input.judgments)
    .filter(([, grade]) => grade === TARGET_GRADE)
    .map(([threadId]) => threadId);
  const channelThreads = channelThreadIds(input.channels, input.records);
  const firstAdmitted = input.results.find((item) => item.admitted)?.threadId;
  return targets.map((threadId) => {
    const position = input.results.findIndex((item) => item.threadId === threadId);
    const result = position < 0 ? undefined : input.results[position];
    const category = categoryOf({
      threadId,
      channelHit: channelThreads.has(threadId),
      present: result !== undefined,
      admitted: result?.admitted ?? false,
      first: firstAdmitted === threadId
    });
    const suspect =
      (category === "admission" || category === "ordering") &&
      passageSelectionSuspect(input, threadId);
    return {
      caseId: input.caseId,
      threadId,
      category,
      passageSelectionSuspect: suspect,
      position: position < 0 ? null : position + 1,
      eligibility: result?.score ?? null
    };
  });
}

type CategoryFacts = {
  threadId: string;
  channelHit: boolean;
  present: boolean;
  admitted: boolean;
  first: boolean;
};

function categoryOf(facts: CategoryFacts): AttributionCategory {
  if (facts.first) return "success";
  if (!facts.channelHit || !facts.present) return "candidate_recall";
  if (!facts.admitted) return "admission";
  return "ordering";
}

/**
 * Suspect selection: the thread's best matrix score beats the best of the three
 * selected passages, and with that score the thread would rank first among the
 * best scores of all threads (ties do not rank first).
 */
function passageSelectionSuspect(input: AttributionInput, threadId: string): boolean {
  const selected = (input.channels.passages ?? [])
    .filter((hit) => input.records.get(hit.recordId)?.threadId === threadId)
    .slice(0, MAX_RERANK_PASSAGES_PER_THREAD)
    .map((hit) => scoreOf(input, hit.recordId));
  if (selected.length === 0) return false;
  const bestSelected = Math.max(...selected);
  const bestPerThread = bestMatrixScorePerThread(input);
  const own = bestPerThread.get(threadId);
  if (own === undefined) return false;
  const others = [...bestPerThread]
    .filter(([id]) => id !== threadId)
    .map(([, score]) => score);
  const ownBeatsSelected = own > bestSelected;
  const ownFirst = others.every((score) => own > score);
  return ownBeatsSelected && ownFirst;
}

function bestMatrixScorePerThread(input: AttributionInput): Map<string, number> {
  const best = new Map<string, number>();
  for (const record of input.records.values()) {
    if (record.kind !== "identity" && record.kind !== "passage") continue;
    const score = scoreOf(input, record.recordId);
    const current = best.get(record.threadId);
    if (current === undefined || score > current) best.set(record.threadId, score);
  }
  return best;
}

function scoreOf(input: AttributionInput, recordId: string): number {
  const record = input.records.get(recordId);
  if (record === undefined) throw new Error(`Capture has no record ${recordId}.`);
  const key = rerankPairKey(input.query, semanticRerankingDocument(asSearchRecord(record)));
  const score = input.rerankScores[key];
  if (score === undefined) throw new Error(`Capture has no matrix score for record ${recordId}.`);
  return score;
}

function channelThreadIds(
  channels: CapturedChannels,
  records: ReadonlyMap<string, CapturedRecord>
): Set<string> {
  const recordIds = [
    ...channels.identities,
    ...channels.passages,
    ...channels.lexical
  ].map((hit) => hit.recordId);
  return new Set(
    recordIds.map((recordId) => records.get(recordId)?.threadId).filter(
      (threadId): threadId is string => threadId !== undefined
    )
  );
}
