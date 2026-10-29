import type { WorkspaceInfo } from "../types.js";
import { CountingRerankingProvider } from "./counting-reranker.js";
import {
  deepHitOf,
  emptyDeepResult,
  firstPerPassage,
  isSourceTypeAllowed,
  nextActionsFor
} from "./deep-output.js";
import { deepReadinessAction } from "./deep-readiness.js";
import { normalizeDeepInput, type NormalizedDeepInput } from "./deep-input.js";
import {
  admitsAnyGroup,
  admittedDepthPassages,
  lexicalFieldsForDeep,
  rankDepthPoolPassages
} from "./deep-pool.js";
import { rankScopePassages, scopePassageRows } from "./deep-scope.js";
import {
  assertThreadIndexed,
  resolveClosedThread,
  type ScopedThread
} from "./deep-thread.js";
import type { MemoryDeepOptions, MemoryDeepResult } from "./deep-types.js";
import { searchChannelsByLayer } from "./layered-search.js";
import { readMemoryStatusInWorkspace } from "./operations.js";
import { resolveMemoryQueryInterpretation } from "./recall-support.js";
import { tryWithMemoryOperationLock } from "./rebuild-coordination.js";
import {
  layersForDepth,
  MAX_MEMORY_SEARCH_DEPTH,
  presentLayersOf
} from "./search-depth.js";
import { LanceDbMemoryVectorStore, readMemoryManifest } from "./store.js";
import type {
  MemoryLayer,
  MemoryManifest,
  MemoryQueryInterpretation,
  MemoryStatus,
  MemoryVectorRow,
  MemoryVectorStore
} from "./types.js";

// The lock message matches recall, so an operator sees the same wait in both tools.
const RETRY_ACTION = "Retry after the current memory operation completes.";

/**
 * memory_deep: passages with provenance. Without threadId, the passages of the groups that depth 2
 * admits. With threadId, the passages of one closed, indexed thread, which are all reranked up to the budget.
 */
export async function deepMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryDeepOptions
): Promise<MemoryDeepResult> {
  const input = normalizeDeepInput(options);
  const thread =
    options.threadId === undefined
      ? undefined
      : await resolveClosedThread(info, options.threadId);
  const status = await readMemoryStatusInWorkspace(info, options);
  const blocked = deepReadinessAction(status);
  if (blocked !== undefined)
    return emptyDeepResult(options, status, [blocked], thread?.threadId);

  const attempt = await tryWithMemoryOperationLock(info, () =>
    searchReadyIndex(info, options, input, status, thread)
  );
  if (!attempt.acquired)
    return emptyDeepResult(options, status, [RETRY_ACTION], thread?.threadId);
  return attempt.value;
}

type ReadySearch = {
  info: WorkspaceInfo;
  options: MemoryDeepOptions;
  input: NormalizedDeepInput;
  status: MemoryStatus;
  manifest: MemoryManifest;
  store: MemoryVectorStore;
  interpretation: MemoryQueryInterpretation;
  vector: number[];
  reranker: CountingRerankingProvider;
};

async function searchReadyIndex(
  info: WorkspaceInfo,
  options: MemoryDeepOptions,
  input: NormalizedDeepInput,
  status: MemoryStatus,
  thread: ScopedThread | undefined
): Promise<MemoryDeepResult> {
  const manifest = await readMemoryManifest(info);
  if (thread !== undefined) assertThreadIndexed(manifest, thread);
  // Copied from recallMemoryInWorkspace (operations.ts, excluded from this change): an index without
  // records returns an empty result. The parity test in core-memory-deep-parity.test.ts protects it.
  if (manifest === undefined || manifest.records.length === 0)
    return emptyDeepResult(options, status, [], thread?.threadId);

  // Copied from memoryStore in operations.ts, which is excluded from this change. Same parity test.
  const store = options.store ?? new LanceDbMemoryVectorStore();
  const interpretation = await resolveMemoryQueryInterpretation(
    info,
    options,
    store,
    manifest.generation
  );
  const vector = await options.provider.embedQuery(
    interpretation.effectiveQuery
  );
  const search: ReadySearch = {
    info,
    options,
    input,
    status,
    manifest,
    store,
    interpretation,
    vector,
    reranker: new CountingRerankingProvider(options.reranker)
  };
  if (thread === undefined) return searchDepthPool(search);
  return searchThread(search, thread);
}

async function searchDepthPool(search: ReadySearch): Promise<MemoryDeepResult> {
  const query = search.interpretation.effectiveQuery;
  const layers = layersForDepth(
    MAX_MEMORY_SEARCH_DEPTH,
    presentLayersOf(search.manifest.records)
  );
  const channels = await searchChannelsByLayer({
    info: search.info,
    store: search.store,
    generation: search.manifest.generation,
    vector: search.vector,
    queryText: query,
    fields: lexicalFieldsForDeep(query),
    layers
  });
  const pool = await rankDepthPoolPassages(query, channels, search.reranker);
  const passages = admittedDepthPassages(pool)
    .filter((passage) =>
      isSourceTypeAllowed(passage.record.sourceType, search.input.sourceTypes)
    )
    .map((passage) =>
      deepHitOf(passage.record, passage.score, passage.groupBand)
    );
  const results = firstPerPassage(passages).slice(0, search.input.limit);
  return {
    query: search.options.query,
    interpretation: search.interpretation,
    indexStatus: search.status,
    mode: "unscoped",
    results,
    nextActions: nextActionsFor(results, search.status),
    abstained: !admitsAnyGroup(pool),
    layersSearched: layers,
    rerankPairs: search.reranker.pairs
  };
}

async function searchThread(
  search: ReadySearch,
  thread: ScopedThread
): Promise<MemoryDeepResult> {
  const layers = presentLayersOf(search.manifest.records);
  const rows = await readScopeRows(search, thread.threadId, layers);
  const ranking = await rankScopePassages({
    query: search.interpretation.effectiveQuery,
    queryVector: search.vector,
    rows,
    reranker: search.reranker
  });
  const passages = ranking.ranked.map((passage) =>
    deepHitOf(passage.row, passage.score)
  );
  const results = firstPerPassage(passages).slice(0, search.input.limit);
  return {
    query: search.options.query,
    interpretation: search.interpretation,
    indexStatus: search.status,
    mode: "scoped",
    threadId: thread.threadId,
    results,
    nextActions: nextActionsFor(results, search.status),
    layersSearched: layers,
    rerankPairs: search.reranker.pairs,
    scopePassages: rows.length,
    scopeTruncated: ranking.truncated
  };
}

async function readScopeRows(
  search: ReadySearch,
  threadId: string,
  layers: MemoryLayer[]
): Promise<MemoryVectorRow[]> {
  if (search.store.readRows === undefined)
    throw new Error("memory_deep needs a memory store that can read rows.");
  const rows = await search.store.readRows(
    search.info,
    search.manifest.generation,
    { layers, threadId }
  );
  return scopePassageRows(rows, search.input.sourceTypes);
}
