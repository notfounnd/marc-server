import { recallMemoryInWorkspace } from "../../src/core/memory/operations.js";
import type { RerankingProvider } from "../../src/core/memory/types.js";
import { BASELINE_DEPTH, PRODUCTION_RECALL_LIMIT } from "./capture-channels.js";
import type { CaptureContext } from "./capture-types.js";
import { ADOPTED_PAIRS_PER_SECOND, countPlanOf, type CountPlan } from "./matrix-plan.js";

/** The pairs of one case that a capture scores: its matrix, and the production recall it also runs. */
export type CaseGateCount = { pairs: number; productionRecallPairs: number };

/**
 * The gate of a capture: the matrix pairs plus the production recall pairs of every case, converted to
 * hours at the adopted throughput and compared with the limit. The count command and the capture use it.
 */
export function gateOf(perCase: readonly CaseGateCount[], limitHours: number): CountPlan {
  return countPlanOf(
    perCase.map((item) => item.pairs + item.productionRecallPairs),
    ADOPTED_PAIRS_PER_SECOND,
    limitHours
  );
}

/** The documents that the production recall of a case sends to the reranker (M0 at depth 0). */
export async function productionRecallPairsOf(context: CaptureContext, query: string): Promise<number> {
  const recall = await recallMemoryInWorkspace(context.info, {
    query,
    queryMode: "literal",
    limit: PRODUCTION_RECALL_LIMIT,
    depth: BASELINE_DEPTH,
    provider: context.providers.embedding,
    reranker: zeroRerankerOf(context.providers.reranker),
    store: context.store
  });
  return recall.rerankPairs;
}

/**
 * The reranker of a dry run: its `rerank` returns zeros without scoring anything, so a recall with it
 * reports the documents it would send to the reranker. Every other method is the real provider's.
 */
export function zeroRerankerOf(reranker: RerankingProvider): RerankingProvider {
  return Object.assign(Object.create(reranker) as RerankingProvider, {
    rerank: async (_query: string, documents: string[]) => documents.map(() => 0)
  });
}
