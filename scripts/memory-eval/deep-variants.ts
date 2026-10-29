import {
  admittedDepthPassages,
  rankDepthPoolPassages,
  type DepthPassage,
  type DepthPool
} from "../../src/core/memory/deep-pool.js";
import { firstPerPassage } from "../../src/core/memory/deep-output.js";
import {
  rankScopePassages,
  scopePassageRows,
  SCOPE_RERANK_BUDGET,
  type ScopedPassage
} from "../../src/core/memory/deep-scope.js";
import { SEMANTIC_ELIGIBILITY_THRESHOLD } from "../../src/core/memory/semantic-ranking.js";
import type { MemorySourceType } from "../../src/core/memory/sources/contract.js";
import type {
  MemoryVectorRecord,
  MemoryVectorRow,
  RerankingProviderMetadata
} from "../../src/core/memory/types.js";
import { cosineSimilarity } from "../../src/core/memory/vector-math.js";
import { CachedRerankingProvider } from "./cached-providers.js";
import { asSearchRecord, type CapturedCase, type CapturedRecord } from "./capture-types.js";
import type { EvalCase } from "./dataset.js";
import { channelsOfCaptured } from "./replay.js";

/** The variants of a deep case. DEEP is the evaluated one; the others are diagnostics and references. */
export const DEEP_VARIANTS = ["DEEP", "DEEP_ALL", "DEEP_COSINE", "DEEP_BUDGET"] as const;
export type DeepVariantId = (typeof DEEP_VARIANTS)[number];

/** One passage of a variant's order. `score` is the reranker score, absent for the cosine variant. */
export type RankedPassage = {
  recordId: string;
  passageId: string;
  threadId: string;
  sourceType: MemorySourceType;
  score: number | undefined;
};

export type VariantRun =
  | {
      variant: DeepVariantId;
      status: "ok";
      /** One entry per passageId, best first, as the core returns them: the first occurrence is kept. */
      ranked: RankedPassage[];
      /** Documents sent to the reranker: the budgeted passages, or the pool entries. Zero for the cosine variant. */
      pairs: number;
      truncated: boolean;
      /** Passages of the scope after the source types. Null for an unscoped case. */
      scopePassages: number | null;
    }
  | { variant: DeepVariantId; status: "incomplete"; reason: "missing-pair" };

export type VariantRuns = Partial<Record<DeepVariantId, VariantRun>>;

export type DeepCaseInput = {
  evalCase: EvalCase;
  captured: CapturedCase;
  records: ReadonlyMap<string, CapturedRecord>;
  vectors: ReadonlyMap<string, readonly number[]>;
  rerankerMetadata: RerankingProviderMetadata;
  /** The budget of the DEEP_BUDGET variant. The variant runs only when it is given. */
  deepBudget?: number;
};

export type DeepCaseRuns = {
  runs: VariantRuns;
  /** Unscoped cases only: the pool of depth 2, used by the failure classes. */
  pool?: DepthPool;
  /** Unscoped cases only: the groups that the pool admits. */
  admittedGroups?: ReadonlySet<string>;
};

type RunContext = DeepCaseInput & {
  query: string;
  queryVector: number[];
  reranker: CachedRerankingProvider;
};

const MISSING_PAIR = "Missing cached rerank score";

/** A reranker score that the capture does not hold. The cached provider raises it for the pair. */
export function isMissingPair(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(MISSING_PAIR);
}

/**
 * Runs every variant of one deep case over its capture. Scoped cases use the thread scope; unscoped
 * cases use the depth-2 pool. A missing reranker pair makes the variant incomplete, never a zero score.
 */
export async function runDeepVariants(input: DeepCaseInput): Promise<DeepCaseRuns> {
  const query = input.captured.interpretation.effectiveQuery;
  const queryVector = input.captured.queryVectors[query];
  if (queryVector === undefined) throw new Error(`The capture has no query vector for "${query}".`);
  const reranker = new CachedRerankingProvider(
    input.rerankerMetadata,
    new Map(Object.entries(input.captured.rerankScores))
  );
  const context: RunContext = { ...input, query, queryVector: [...queryVector], reranker };
  const threadId = input.evalCase.scope?.threadId;
  if (threadId === undefined) return unscopedRuns(context);
  return { runs: await scopedRuns(context, threadId) };
}

async function scopedRuns(context: RunContext, threadId: string): Promise<VariantRuns> {
  const rows = scopeRowsOf(context, threadId);
  const scopePassages = rows.length;
  const base = { query: context.query, queryVector: context.queryVector, rows, reranker: context.reranker };
  const runs: VariantRuns = {
    DEEP: await attempt(
      "DEEP",
      () => rankScopePassages({ ...base, budget: SCOPE_RERANK_BUDGET }),
      (result) => scopedRunOf("DEEP", result.ranked, result.truncated, scopePassages)
    ),
    DEEP_ALL: await attempt(
      "DEEP_ALL",
      () => rankScopePassages({ ...base, budget: Number.POSITIVE_INFINITY }),
      (result) => scopedRunOf("DEEP_ALL", result.ranked, result.truncated, scopePassages)
    ),
    DEEP_COSINE: cosineRun("DEEP_COSINE", rows, context.queryVector, scopePassages)
  };
  if (context.deepBudget === undefined) return runs;
  return {
    ...runs,
    DEEP_BUDGET: await attempt(
      "DEEP_BUDGET",
      () => rankScopePassages({ ...base, budget: context.deepBudget }),
      (result) => scopedRunOf("DEEP_BUDGET", result.ranked, result.truncated, scopePassages)
    )
  };
}

async function unscopedRuns(context: RunContext): Promise<DeepCaseRuns> {
  const channels = channelsOfCaptured(depthTwoChannelsOf(context.captured), context.records);
  let pool: DepthPool;
  try {
    pool = await rankDepthPoolPassages(context.query, channels, context.reranker);
  } catch (error) {
    if (isMissingPair(error)) return { runs: incompleteRuns(context.deepBudget) };
    throw error;
  }
  const runs = unscopedVariantsOf({
    admitted: admittedDepthPassages(pool),
    pairs: pool.entries.length,
    vectors: context.vectors,
    queryVector: context.queryVector,
    sourceTypes: context.evalCase.scope?.sourceTypes,
    deepBudget: context.deepBudget
  });
  return { runs, pool, admittedGroups: admittedGroupsOf(pool) };
}

/**
 * The variants of an unscoped case, from the admitted passages best first. The source types filter the output,
 * and then the first occurrence of each passageId is kept, as the core does before it cuts the limit. The pairs
 * are the documents that the reranker scored, so the dedupe does not change them.
 */
export function unscopedVariantsOf(input: {
  admitted: readonly DepthPassage[];
  pairs: number;
  vectors: ReadonlyMap<string, readonly number[]>;
  queryVector: readonly number[];
  sourceTypes?: MemorySourceType[];
  deepBudget?: number;
}): VariantRuns {
  const passages = input.admitted.filter(
    (passage) => input.sourceTypes === undefined || input.sourceTypes.includes(passage.record.sourceType)
  );
  const deep: VariantRun = {
    variant: "DEEP",
    status: "ok",
    ranked: firstPerPassage(passages.map((passage) => rankedOf(passage.record, passage.score))),
    pairs: input.pairs,
    truncated: false,
    scopePassages: null
  };
  const universe = passages.map((passage) => vectorRowOf(passage.record, input.vectors));
  const runs: VariantRuns = {
    DEEP: deep,
    DEEP_ALL: { ...deep, variant: "DEEP_ALL" },
    DEEP_COSINE: cosineRun("DEEP_COSINE", universe, input.queryVector, null)
  };
  if (input.deepBudget === undefined) return runs;
  return { ...runs, DEEP_BUDGET: { ...deep, variant: "DEEP_BUDGET" } };
}

function incompleteRuns(deepBudget: number | undefined): VariantRuns {
  const runs: VariantRuns = {
    DEEP: incompleteOf("DEEP"),
    DEEP_ALL: incompleteOf("DEEP_ALL"),
    DEEP_COSINE: incompleteOf("DEEP_COSINE")
  };
  if (deepBudget === undefined) return runs;
  return { ...runs, DEEP_BUDGET: incompleteOf("DEEP_BUDGET") };
}

function incompleteOf(variant: DeepVariantId): VariantRun {
  return { variant, status: "incomplete", reason: "missing-pair" };
}

async function attempt<T>(
  variant: DeepVariantId,
  run: () => Promise<T>,
  mapOk: (value: T) => VariantRun
): Promise<VariantRun> {
  try {
    return mapOk(await run());
  } catch (error) {
    if (isMissingPair(error)) return incompleteOf(variant);
    throw error;
  }
}

/** The scoped run: `pairs` counts the documents the reranker scored, before the dedupe of the output. */
function scopedRunOf(
  variant: DeepVariantId,
  ranked: ScopedPassage[],
  truncated: boolean,
  scopePassages: number
): VariantRun {
  return {
    variant,
    status: "ok",
    ranked: firstPerPassage(ranked.map((passage) => rankedOf(passage.row, passage.score))),
    pairs: ranked.length,
    truncated,
    scopePassages
  };
}

/** The cosine order alone: no reranker, ties by recordId. The first occurrence of each passageId is kept. */
function cosineRun(
  variant: DeepVariantId,
  rows: readonly MemoryVectorRow[],
  queryVector: readonly number[],
  scopePassages: number | null
): VariantRun {
  const ordered = rows
    .map((row) => ({ row, similarity: cosineSimilarity([...queryVector], row.vector) }))
    .sort((left, right) => right.similarity - left.similarity || left.row.recordId.localeCompare(right.row.recordId))
    .map((item) => rankedOf(item.row, undefined));
  return { variant, status: "ok", ranked: firstPerPassage(ordered), pairs: 0, truncated: false, scopePassages };
}

function scopeRowsOf(context: RunContext, threadId: string): MemoryVectorRow[] {
  const rows = [...context.records.values()]
    .filter((record) => record.threadId === threadId && record.kind === "passage")
    .map((record) => vectorRowOf(asSearchRecord(record), context.vectors));
  return scopePassageRows(rows, context.evalCase.scope?.sourceTypes);
}

function vectorRowOf(record: MemoryVectorRecord, vectors: ReadonlyMap<string, readonly number[]>): MemoryVectorRow {
  const vector = vectors.get(record.recordId);
  if (vector === undefined) throw new Error(`The capture has no vector for ${record.recordId}.`);
  return { ...record, vector: [...vector] };
}

function rankedOf(record: MemoryVectorRecord, score: number | undefined): RankedPassage {
  return {
    recordId: record.recordId,
    passageId: record.passageId,
    threadId: record.threadId,
    sourceType: record.sourceType,
    score
  };
}

function depthTwoChannelsOf(captured: CapturedCase) {
  const channels = captured.channelsByDepth?.[2];
  if (channels === undefined) throw new Error(`The capture of ${captured.id} has no depth 2 channels.`);
  return channels;
}

/** The groups whose eligibility reaches the threshold: the same rule that gives the pool its groupBand. */
export function admittedGroupsOf(pool: DepthPool): ReadonlySet<string> {
  return new Set(
    pool.ranked
      .filter((thread) => thread.eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD)
      .map((thread) => thread.evidence.record.threadId)
  );
}
