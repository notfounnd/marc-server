/**
 * Order in which the reranker worker sends documents to the model. The worker fills each
 * batch up to its longest document, so sending documents of similar length together reduces
 * the padding. Scores always come back in the order of the input documents.
 */
export type RerankOrder = "length" | "input";

export const DEFAULT_RERANK_ORDER: RerankOrder = "length";

/** Planner by order: the indexes of the input documents, in the order they are sent. */
export const RERANK_ORDER_PLANNERS: Readonly<
  Record<RerankOrder, (documents: readonly string[]) => number[]>
> = {
  length: (documents) =>
    documents
      .map((_, index) => index)
      .sort(
        (left, right) =>
          documents[left].length - documents[right].length || left - right
      ),
  input: (documents) => documents.map((_, index) => index)
};

/** Unknown or missing values fall back to the default order. */
export function rerankOrderOf(value: unknown): RerankOrder {
  if (value === "input") return "input";
  return DEFAULT_RERANK_ORDER;
}

/** The input indexes in the order that the worker sends them for a requested order. */
export function rerankSendOrder(
  order: unknown,
  documents: readonly string[]
): number[] {
  return RERANK_ORDER_PLANNERS[rerankOrderOf(order)](documents);
}

/**
 * Scores of a reordered call, mapped back to the input order. `sendOrder[position]` is the
 * input index of the document that was scored at `position`.
 */
export function restoreScoreOrder(
  sendOrder: readonly number[],
  sentScores: readonly number[]
): number[] {
  if (sentScores.length !== sendOrder.length)
    throw new Error("The memory reranker returned an unexpected score count.");
  const scores: number[] = new Array(sendOrder.length).fill(0);
  sendOrder.forEach((inputIndex, position) => {
    scores[inputIndex] = sentScores[position];
  });
  return scores;
}
