import { rankHybridMemoryCandidates } from "../../src/core/memory/hybrid-ranking.js";
import { SEMANTIC_ELIGIBILITY_THRESHOLD } from "../../src/core/memory/semantic-eligibility.js";
import type {
  MemorySearchChannels,
  RerankingProvider
} from "../../src/core/memory/types.js";
import type { RelevanceGrade } from "./dataset.js";
import type { CapturedProductionRecall } from "./capture-types.js";

export type VariantInput = {
  query: string;
  channels: MemorySearchChannels;
  reranker: RerankingProvider;
  judgments: Record<string, RelevanceGrade>;
  /** Captured production recall of the same case. Only PRODUCTION_RECALL reads it. */
  production: CapturedProductionRecall;
};

export type VariantResult = {
  threadId: string;
  score: number;
  admitted: boolean;
  band?: "high" | "medium" | "low";
};

export type RankingVariant = (input: VariantInput) => Promise<VariantResult[]>;

/** Smallest grade that the oracle admits: the threads a perfect cut would keep. */
const ORACLE_MIN_GRADE: RelevanceGrade = 2;

type ProductionOrderItem = {
  threadId: string;
  score: number;
  eligible: boolean;
};

/**
 * Production order of rankHybridMemoryCandidates. `eligible` is the production
 * admission rule: eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD.
 */
async function productionOrder(input: VariantInput): Promise<ProductionOrderItem[]> {
  const ranked = await rankHybridMemoryCandidates(
    input.query,
    input.channels,
    input.reranker
  );
  return ranked.map((thread) => ({
    threadId: thread.evidence.record.threadId,
    score: thread.eligibility,
    eligible: thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD
  }));
}

/** M0: production order and production admission. Never reads judgments. */
export const M0: RankingVariant = async (input) =>
  (await productionOrder(input)).map((item) => ({
    threadId: item.threadId,
    score: item.score,
    admitted: item.eligible
  }));

/** D0: production order with every candidate admitted. Diagnostic only. Never reads judgments. */
export const D0: RankingVariant = async (input) =>
  (await productionOrder(input)).map((item) => ({
    threadId: item.threadId,
    score: item.score,
    admitted: true
  }));

/** ORACLE_ADMISSION: D0 order, admitting exactly the threads with grade >= 2. */
export const ORACLE_ADMISSION: RankingVariant = async (input) =>
  (await productionOrder(input)).map((item) => ({
    threadId: item.threadId,
    score: item.score,
    admitted: (input.judgments[item.threadId] ?? 0) >= ORACLE_MIN_GRADE
  }));

export const PRODUCTION_RECALL_ID = "PRODUCTION_RECALL";

/**
 * Pseudo-variant: the captured production recall as the admitted list, in captured
 * order, cut at the production limit that the replay uses. It reads no judgments.
 * It is not a decision variant; it lets the report show M0 against production order.
 */
export const PRODUCTION_RECALL: RankingVariant = async (input) =>
  input.production.results.slice(0, input.production.limit).map((hit) => ({
    threadId: hit.threadId,
    score: hit.score,
    admitted: true
  }));

/** Dispatch table of the ranking variants that the replay can run. */
export const rankingVariants: Readonly<Record<string, RankingVariant>> = {
  M0,
  D0,
  ORACLE_ADMISSION,
  [PRODUCTION_RECALL_ID]: PRODUCTION_RECALL
};

export function isRankingVariantId(id: string): boolean {
  return Object.hasOwn(rankingVariants, id);
}
