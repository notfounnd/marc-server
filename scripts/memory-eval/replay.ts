import type {
  MemoryLexicalSearchHit,
  MemorySearchChannels,
  MemorySearchHit,
  MemoryVectorRecord
} from "../../src/core/memory/types.js";
import type {
  CaptureFile,
  CapturedCase,
  CapturedChannels,
  CapturedProductionRecall
} from "./capture-types.js";
import { CachedEmbeddingProvider, CachedRerankingProvider } from "./cached-providers.js";
import type { EvalDataset, RelevanceGrade } from "./dataset.js";
import {
  isRankingVariantId,
  rankingVariants,
  type VariantInput,
  type VariantResult
} from "./variants.js";

/** The replay never loads a model: only the providers built from a capture. */
export type ReplayProviders = {
  embedding: CachedEmbeddingProvider;
  reranker: CachedRerankingProvider;
};

/**
 * `passed` is decided by the admitted threadId sequence only. `maxScoreDelta` is
 * reported per case and never gates: scores depend on the batch padded length of
 * the reranker call (see the CA1 findings), so a delta is evidence, not a failure.
 */
export type CaseEquivalence = {
  passed: boolean;
  productionThreadIds: string[];
  replayThreadIds: string[];
  maxScoreDelta: number;
};

/** Median, nearest-rank p95 and max of the per-case score deltas of one corpus. */
export type DeltaSummary = {
  cases: number;
  median: number | null;
  p95: number | null;
  max: number | null;
};

export type VariantOutput = {
  variant: string;
  results: VariantResult[];
};

export type CaseReplay = {
  caseId: string;
  effectiveQuery: string;
  variants: VariantOutput[];
  equivalence: CaseEquivalence;
};

export type ReplayResult = {
  captureId: string;
  corpus: string;
  variantIds: string[];
  equivalence: "passed" | "failed";
  failedCaseIds: string[];
  scoreDelta: DeltaSummary;
  cases: CaseReplay[];
};

export type ReplayInput = {
  capture: CaptureFile;
  dataset: EvalDataset;
  variantIds: string[];
};

/** Cached providers that serve exactly the vectors and scores recorded for one case. */
export function cachedReplayProviders(
  captured: CapturedCase,
  capture: CaptureFile
): ReplayProviders {
  return {
    embedding: new CachedEmbeddingProvider(
      capture.providers.embedding,
      new Map(Object.entries(captured.queryVectors))
    ),
    reranker: new CachedRerankingProvider(
      capture.providers.reranker,
      new Map(Object.entries(captured.rerankScores))
    )
  };
}

/** Replays every captured case with the requested variants, judged by the dataset's current judgments. */
export async function replayCapture(input: ReplayInput): Promise<ReplayResult> {
  assertKnownVariants(input.variantIds);
  const records = recordsById(input.capture.records);
  const cases: CaseReplay[] = [];
  for (const captured of input.capture.cases) {
    cases.push(
      await replayCase({
        captured,
        judgments: judgmentsOf(input.dataset, captured.id),
        records,
        variantIds: input.variantIds,
        providers: cachedReplayProviders(captured, input.capture)
      })
    );
  }
  const summary = summarizeEquivalence(cases);
  return {
    captureId: input.capture.captureId,
    corpus: input.capture.corpus,
    variantIds: input.variantIds,
    equivalence: summary.equivalence,
    failedCaseIds: summary.failedCaseIds,
    scoreDelta: summary.scoreDelta,
    cases
  };
}

export async function replayCase(input: {
  captured: CapturedCase;
  judgments: Record<string, RelevanceGrade>;
  records: ReadonlyMap<string, MemoryVectorRecord>;
  variantIds: string[];
  providers: ReplayProviders;
}): Promise<CaseReplay> {
  const { captured, judgments, records, variantIds, providers } = input;
  assertKnownVariants(variantIds);
  const effectiveQuery = captured.interpretation.effectiveQuery;
  // The captured query vector must exist. The replay never embeds a query.
  await providers.embedding.embedQuery(effectiveQuery);
  const variantInput: VariantInput = {
    query: effectiveQuery,
    channels: channelsOf(captured, effectiveQuery, records),
    reranker: providers.reranker,
    judgments,
    production: captured.productionRecall
  };
  const results = await runVariants(
    [...new Set([...variantIds, "M0"])],
    variantInput
  );
  return {
    caseId: captured.id,
    effectiveQuery,
    variants: variantIds.map((variant) => ({
      variant,
      results: results.get(variant) ?? []
    })),
    equivalence: equivalenceOf(
      captured.productionRecall,
      results.get("M0") ?? []
    )
  };
}

async function runVariants(
  ids: string[],
  input: VariantInput
): Promise<Map<string, VariantResult[]>> {
  const results = new Map<string, VariantResult[]>();
  for (const id of ids) {
    const variant = rankingVariants[id];
    if (variant === undefined) throw new Error(`Unknown ranking variant: ${id}`);
    results.set(id, await variant(input));
  }
  return results;
}

function assertKnownVariants(ids: readonly string[]): void {
  for (const id of ids) {
    if (isRankingVariantId(id)) continue;
    throw new Error(`Unknown ranking variant: ${id}`);
  }
}

/**
 * Equivalence with production, on the sequence only: the admitted threadId
 * sequence of M0, cut to the production limit, must equal the production recall
 * order. The largest score delta is recorded and never gates the case.
 */
export function equivalenceOf(
  production: CapturedProductionRecall,
  m0: VariantResult[]
): CaseEquivalence {
  const replayAdmitted = m0
    .filter((item) => item.admitted)
    .slice(0, production.limit);
  const productionThreadIds = production.results.map((hit) => hit.threadId);
  const replayThreadIds = replayAdmitted.map((item) => item.threadId);
  const maxScoreDelta = maxDifference(
    production.results.map((hit) => hit.score),
    replayAdmitted.map((item) => item.score)
  );
  const sameSequence =
    productionThreadIds.length === replayThreadIds.length &&
    productionThreadIds.every((id, index) => id === replayThreadIds[index]);
  return {
    passed: sameSequence,
    productionThreadIds,
    replayThreadIds,
    maxScoreDelta
  };
}

function maxDifference(left: number[], right: number[]): number {
  const pairs = Math.min(left.length, right.length);
  const differences = Array.from({ length: pairs }, (_, index) =>
    Math.abs((left[index] ?? 0) - (right[index] ?? 0))
  );
  return Math.max(0, ...differences);
}

/** Median, nearest-rank p95 and max of the case score deltas of one corpus. */
export function deltaSummary(values: readonly number[]): DeltaSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  if (count === 0) return { cases: 0, median: null, p95: null, max: null };
  const middle = Math.floor(count / 2);
  const median =
    count % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  const p95 = sorted[Math.min(count - 1, Math.ceil(0.95 * count) - 1)] ?? 0;
  return { cases: count, median, p95, max: sorted[count - 1] ?? 0 };
}

/** Corpus verdict (CA1b): the admitted sequence of every case; score deltas are reported only. */
export function summarizeEquivalence(cases: readonly CaseReplay[]): {
  equivalence: "passed" | "failed";
  failedCaseIds: string[];
  scoreDelta: DeltaSummary;
} {
  const failedCaseIds = cases
    .filter((item) => !item.equivalence.passed)
    .map((item) => item.caseId);
  return {
    equivalence: failedCaseIds.length === 0 ? "passed" : "failed",
    failedCaseIds,
    scoreDelta: deltaSummary(cases.map((item) => item.equivalence.maxScoreDelta))
  };
}

function channelsOf(
  captured: CapturedCase,
  query: string,
  records: ReadonlyMap<string, MemoryVectorRecord>
): MemorySearchChannels {
  const channels: CapturedChannels | undefined = captured.channels[query];
  if (channels === undefined)
    throw new Error(`Capture case ${captured.id} has no channels for its effective query.`);
  return {
    identities: channels.identities.map((hit) =>
      memoryHit(hit.recordId, hit.score, records)
    ),
    passages: channels.passages.map((hit) =>
      memoryHit(hit.recordId, hit.score, records)
    ),
    lexical: channels.lexical.map(
      (hit): MemoryLexicalSearchHit => ({
        field: hit.field,
        record: recordOf(records, hit.recordId),
        score: hit.score,
        vectorScore: hit.vectorScore
      })
    )
  };
}

function memoryHit(
  recordId: string,
  score: number,
  records: ReadonlyMap<string, MemoryVectorRecord>
): MemorySearchHit {
  return { record: recordOf(records, recordId), score };
}

function recordOf(
  records: ReadonlyMap<string, MemoryVectorRecord>,
  recordId: string
): MemoryVectorRecord {
  const record = records.get(recordId);
  if (record === undefined) throw new Error(`Capture has no record ${recordId}.`);
  return record;
}

function recordsById(
  records: readonly MemoryVectorRecord[]
): Map<string, MemoryVectorRecord> {
  return new Map(records.map((record) => [record.recordId, record]));
}

function judgmentsOf(
  dataset: EvalDataset,
  caseId: string
): Record<string, RelevanceGrade> {
  const evalCase = dataset.cases.find((item) => item.id === caseId);
  if (evalCase === undefined) throw new Error(`Dataset has no case ${caseId}.`);
  return evalCase.judgments;
}
