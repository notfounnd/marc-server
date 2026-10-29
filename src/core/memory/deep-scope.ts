import { selectRerankPassages } from "./funnel-selection.js";
import { rerankRecords } from "./deep-rerank.js";
import type { MemorySourceType } from "./sources/contract.js";
import type { MemoryVectorRow, RerankingProvider } from "./types.js";
import { cosineSimilarity } from "./vector-math.js";

/**
 * The most passages of one thread that go to the reranker in a scoped call. The E3 budget
 * measured within 1.2 times the M0 median; ADR 0013 records it as the memory_deep budget.
 */
export const SCOPE_RERANK_BUDGET = 232;

export type ScopedPassage = {
  row: MemoryVectorRow;
  score: number;
  cosine: number;
};

export type ScopeRanking = {
  /** Passages sent to the reranker, best first. */
  ranked: ScopedPassage[];
  /** True when the scope held more passages than the budget. */
  truncated: boolean;
};

/** The passages of the requested source types. Identities never enter a scoped search. */
export function scopePassageRows(
  rows: readonly MemoryVectorRow[],
  sourceTypes: readonly MemorySourceType[] | undefined
): MemoryVectorRow[] {
  return rows
    .filter((row) => row.kind === "passage")
    .filter(
      (row) => sourceTypes === undefined || sourceTypes.includes(row.sourceType)
    );
}

/**
 * Orders the passages of one thread. Up to the budget, every passage goes to the reranker in one
 * call. Above it, the budget keeps the passages with the best cosine similarity. The order is score
 * (descending), then cosine (descending), then recordId, because the sigmoid score saturates near 1.
 */
export async function rankScopePassages(input: {
  query: string;
  queryVector: number[];
  rows: readonly MemoryVectorRow[];
  reranker: RerankingProvider;
  budget?: number;
}): Promise<ScopeRanking> {
  const budget = input.budget ?? SCOPE_RERANK_BUDGET;
  const selected = selectByCosine(input.queryVector, input.rows, budget);
  const scores = await rerankRecords(input.query, selected, input.reranker);
  const ranked = selected
    .map((row, index) => ({
      row,
      score: scores[index] ?? 0,
      cosine: cosineSimilarity(input.queryVector, row.vector)
    }))
    .sort(compareScopedPassages);
  return { ranked, truncated: input.rows.length > budget };
}

function selectByCosine(
  queryVector: number[],
  rows: readonly MemoryVectorRow[],
  budget: number
): MemoryVectorRow[] {
  const rowsById = new Map(rows.map((row) => [row.recordId, row] as const));
  const funnelRows = rows.map((row) => ({
    recordId: row.recordId,
    kind: "passage" as const,
    vector: row.vector
  }));
  return selectRerankPassages(queryVector, funnelRows, budget, "cosine")
    .map((recordId) => rowsById.get(recordId))
    .filter((row): row is MemoryVectorRow => row !== undefined);
}

export function compareScopedPassages(
  left: ScopedPassage,
  right: ScopedPassage
): number {
  return (
    right.score - left.score ||
    right.cosine - left.cosine ||
    left.row.recordId.localeCompare(right.row.recordId)
  );
}
