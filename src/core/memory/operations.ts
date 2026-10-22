import type { WorkspaceInfo } from "../types.js";
import { LanceDbMemoryVectorStore, readMemoryManifest } from "./store.js";
import { rebuildAllMemory, reconcileMemory } from "./rebuild-operations.js";
import { purgeUnusedMemory, readMemoryMaintenance } from "./maintenance.js";
import { rankHybridMemoryHits, semanticRecallHits } from "./hybrid-ranking.js";
import { candidateLimitForDepth } from "./semantic-ranking.js";
import {
  DEFAULT_MEMORY_SEARCH_DEPTH,
  isMemorySearchDepth
} from "./search-depth.js";
import { nextActionsForRecallResults } from "./recall-actions.js";
import {
  dedupeMemoryRecallHits,
  emptyMemoryRecallResult,
  resolveMemoryQueryInterpretation
} from "./recall-support.js";
import {
  tryWithMemoryRebuildLock,
  tryWithMemoryOperationLock,
  type MemoryRebuildAttempt
} from "./rebuild-coordination.js";
import {
  buildMemoryStatus,
  compareMemoryManifestSources,
  memoryProvidersMatch
} from "./status.js";
import { scanThreadSummarySources } from "./summaries.js";
import type {
  EmbeddingProvider,
  MemoryManifest,
  MemoryOperationOptions,
  MemoryPurgeResult,
  MemoryRebuildMode,
  MemoryRecallOptions,
  MemoryRecallResult,
  MemoryStatus,
  MemoryVectorStore
} from "./types.js";

const DEFAULT_LIMIT = 5;

export async function prepareMemoryInWorkspace(
  info: WorkspaceInfo,
  options: Pick<MemoryOperationOptions, "interpreter" | "provider" | "reranker">
): Promise<{
  prepared: true;
  interpreter?: ReturnType<
    NonNullable<MemoryOperationOptions["interpreter"]>["describe"]
  >;
  provider: ReturnType<EmbeddingProvider["describe"]>;
  reranker: ReturnType<MemoryOperationOptions["reranker"]["describe"]>;
}> {
  const attempt = await tryWithMemoryOperationLock(info, async () => {
    const preparations = [
      options.provider.prepare(),
      options.reranker.prepare()
    ];
    if (options.interpreter) preparations.push(options.interpreter.prepare());
    await Promise.all(preparations);
    return {
      prepared: true as const,
      interpreter: options.interpreter?.describe(),
      provider: options.provider.describe(),
      reranker: options.reranker.describe()
    };
  });
  if (!attempt.acquired)
    throw new Error("Another memory operation is already running.");
  return attempt.value;
}

export async function readMemoryStatusInWorkspace(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryStatus> {
  const store = memoryStore(options.store);
  const provider = options.provider;
  const [
    manifest,
    sources,
    retrieverPrepared,
    rerankerPrepared,
    interpreterPrepared,
    maintenance
  ] = await Promise.all([
    readMemoryManifest(info),
    scanThreadSummarySources(info),
    provider.isPrepared(),
    options.reranker.isPrepared(),
    interpreterIsPrepared(options.interpreter),
    readMemoryMaintenance(info)
  ]);
  const storeExists =
    manifest?.records.length === 0 ||
    (await store.exists(info, manifest?.generation));
  const models = {
    interpreterPrepared,
    maintenance,
    rerankerPrepared,
    retrieverPrepared
  };
  if (!retrieverPrepared)
    return buildMemoryStatus("model_missing", sources, manifest, models);
  if (!manifest || !storeExists)
    return buildMemoryStatus("missing", sources, manifest, models);
  if (!memoryProvidersMatch(manifest, provider)) {
    return buildMemoryStatus("incompatible", sources, manifest, models);
  }

  const stale = compareMemoryManifestSources(manifest, sources);
  if (stale.stale) {
    return {
      ...buildMemoryStatus("stale", sources, manifest, models),
      missingSummaryIds: stale.missingSummaryIds,
      staleSummaryIds: stale.staleSummaryIds,
      extraSummaryIds: stale.extraSummaryIds
    };
  }

  return buildMemoryStatus("ready", sources, manifest, models);
}

export async function rebuildMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryRebuildAttempt> {
  return runMemoryRebuild(info, options, "full");
}

export async function reconcileMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryOperationOptions
): Promise<MemoryRebuildAttempt> {
  return runMemoryRebuild(info, options, "incremental");
}

export async function purgeMemoryInWorkspace(
  info: WorkspaceInfo,
  options: Pick<MemoryOperationOptions, "store">
): Promise<MemoryPurgeResult> {
  const attempt = await tryWithMemoryOperationLock(info, async () => {
    const manifest = await readMemoryManifest(info);
    return purgeUnusedMemory(
      info,
      manifest?.generation,
      memoryStore(options.store)
    );
  });
  if (!attempt.acquired)
    throw new Error("Another memory operation is already running.");
  return attempt.value;
}

export async function recallMemoryInWorkspace(
  info: WorkspaceInfo,
  options: MemoryRecallOptions
): Promise<MemoryRecallResult> {
  const status = await readMemoryStatusInWorkspace(info, options);
  if (!status.rebuildReady) {
    return emptyMemoryRecallResult(options.query, options.queryMode, status, [
      "Run memory_prepare before using memory_recall."
    ]);
  }
  if (status.status === "missing") {
    return emptyMemoryRecallResult(options.query, options.queryMode, status, [
      "Run memory_rebuild before using memory_recall."
    ]);
  }
  if (status.status === "incompatible") {
    return emptyMemoryRecallResult(options.query, options.queryMode, status, [
      "Run memory_rebuild because the embedding provider changed."
    ]);
  }
  if (!status.searchReady) {
    return emptyMemoryRecallResult(options.query, options.queryMode, status, [
      "Run memory_prepare before using memory_recall."
    ]);
  }

  const attempt = await tryWithMemoryOperationLock(info, () =>
    runReadyMemoryRecall(info, options, status)
  );
  if (!attempt.acquired)
    return emptyMemoryRecallResult(options.query, options.queryMode, status, [
      "Retry after the current memory operation completes."
    ]);
  return attempt.value;
}

async function runReadyMemoryRecall(
  info: WorkspaceInfo,
  options: MemoryRecallOptions,
  status: MemoryStatus
): Promise<MemoryRecallResult> {
  const manifest = await readMemoryManifest(info);
  if (manifest?.records.length === 0)
    return emptyMemoryRecallResult(
      options.query,
      options.queryMode,
      status,
      []
    );
  const store = memoryStore(options.store);
  const interpretation = await resolveMemoryQueryInterpretation(
    info,
    options,
    store,
    manifest?.generation
  );
  const effectiveQuery = interpretation.effectiveQuery;
  const vector = await options.provider.embedQuery(effectiveQuery);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const depth = isMemorySearchDepth(options.depth)
    ? options.depth
    : DEFAULT_MEMORY_SEARCH_DEPTH;
  const candidateLimit = candidateLimitForDepth(depth);
  const lexicalFields = lexicalFieldsForQuery(effectiveQuery);
  const [identityHits, passageHits, ...lexicalHits] = await Promise.all([
    store.searchVector(info, vector, {
      generation: manifest?.generation,
      kind: "identity",
      limit: candidateLimit
    }),
    store.searchVector(info, vector, {
      generation: manifest?.generation,
      kind: "passage",
      limit: candidateLimit
    }),
    ...lexicalFields.map((field) =>
      store.searchLexical(info, effectiveQuery, vector, {
        field,
        generation: manifest?.generation,
        limit: candidateLimit
      })
    )
  ]);
  const admitted = dedupeMemoryRecallHits(
    semanticRecallHits(
      await rankHybridMemoryHits(
        effectiveQuery,
        {
          identities: identityHits,
          passages: passageHits,
          lexical: lexicalHits.flat()
        },
        options.reranker
      )
    )
  );
  const results = admitted.slice(0, limit);
  return {
    query: options.query,
    interpretation,
    indexStatus: status,
    results,
    nextActions: nextActionsForRecallResults(results, status),
    abstained: admitted.length === 0
  };
}

function lexicalFieldsForQuery(
  query: string
): Array<"title" | "summary" | "titlePrefix"> {
  const fields: Array<"title" | "summary" | "titlePrefix"> = [
    "title",
    "summary"
  ];
  if (query.trim().split(/\s+/).length !== 1) return fields;
  return [...fields, "titlePrefix"];
}

function memoryStore(store?: MemoryVectorStore): MemoryVectorStore {
  return store ?? new LanceDbMemoryVectorStore();
}

async function runMemoryRebuild(
  info: WorkspaceInfo,
  options: MemoryOperationOptions,
  mode: MemoryRebuildMode
): Promise<MemoryRebuildAttempt> {
  const operation = memoryRebuildOperations[mode];
  const attempt = await tryWithMemoryRebuildLock(info, () =>
    operation(info, options)
  );
  if (!attempt.acquired) return attempt;
  return { acquired: true, manifest: attempt.value };
}

const memoryRebuildOperations: Record<
  MemoryRebuildMode,
  (
    info: WorkspaceInfo,
    options: MemoryOperationOptions
  ) => Promise<MemoryManifest>
> = {
  full: rebuildAllMemory,
  incremental: reconcileMemory
};

async function interpreterIsPrepared(
  interpreter: MemoryOperationOptions["interpreter"]
): Promise<boolean> {
  if (!interpreter) return true;
  return interpreter.isPrepared();
}
