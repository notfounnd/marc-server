import { createHash } from "node:crypto";
import type { MemoryVectorRecord } from "../../src/core/memory/types.js";
import type { RerankScores } from "./features.js";

/** Token budget of the judged document, in the tokenizer of the judge model. */
export const JUDGE_DOCUMENT_TOKENS = 512;

/**
 * Cuts a text to at most `maxTokens` tokens of the model's tokenizer. Injected, so
 * the harness and the production judge (T2b) use the same budget rule.
 */
export type TokenTruncator = (text: string, maxTokens: number) => string;

/**
 * The document a judge reads for one thread: the identity text, a blank line, and
 * the text of the selected passage with the highest reranker score. A tie goes to
 * the smallest recordId. A thread with no selected passage is judged on its identity
 * text alone. The result is truncated to JUDGE_DOCUMENT_TOKENS.
 *
 * `passages` must be the production selection of the thread (consolidateThreads,
 * up to three), and `rerankScores` must hold their scores for the query. The
 * maximum over the whole matrix is not used, so the document of a thread does not
 * change when the other candidates change.
 */
export function judgeDocumentOf(input: {
  identity: MemoryVectorRecord;
  passages: readonly MemoryVectorRecord[];
  rerankScores: RerankScores;
  truncate: TokenTruncator;
}): string {
  const best = bestPassage(input.passages, input.rerankScores);
  const text =
    best === undefined
      ? input.identity.text
      : `${input.identity.text}\n\n${best.text}`;
  return input.truncate(text, JUDGE_DOCUMENT_TOKENS);
}

function bestPassage(
  passages: readonly MemoryVectorRecord[],
  scores: RerankScores
): MemoryVectorRecord | undefined {
  // Every score is read before the sort, so a missing score fails even for one passage.
  const scored = passages.map((passage) => ({
    passage,
    score: scoreOf(scores, passage)
  }));
  return scored.sort(
    (left, right) =>
      right.score - left.score ||
      compareIds(left.passage.recordId, right.passage.recordId)
  )[0]?.passage;
}

function scoreOf(scores: RerankScores, record: MemoryVectorRecord): number {
  const score = scores.get(record.recordId);
  if (score === undefined) {
    throw new Error(`Missing rerank score for record ${record.recordId}.`);
  }
  return score;
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** SHA-256 of the judged document, hex. */
export function judgeDocumentSha256(document: string): string {
  return createHash("sha256").update(document).digest("hex");
}

/**
 * The cache key of one judge score: the model, the effective query, the thread and
 * the document. The effective query is part of the key, so a score of one
 * interpretation is never reused for another.
 */
export function judgeCacheKey(input: {
  model: string;
  effectiveQuery: string;
  threadId: string;
  documentSha256: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.model,
        input.effectiveQuery,
        input.threadId,
        input.documentSha256
      ])
    )
    .digest("hex");
}
