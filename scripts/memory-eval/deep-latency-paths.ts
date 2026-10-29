import { deepMemoryInWorkspace } from "../../src/core/memory/deep.js";
import { assertThreadIndexed, resolveClosedThread } from "../../src/core/memory/deep-thread.js";
import { rankScopePassages, scopePassageRows } from "../../src/core/memory/deep-scope.js";
import { resolveMemoryQueryInterpretation } from "../../src/core/memory/recall-support.js";
import { presentLayersOf } from "../../src/core/memory/search-depth.js";
import { LanceDbMemoryVectorStore, readMemoryManifest } from "../../src/core/memory/store.js";
import type { MemoryVectorStore } from "../../src/core/memory/types.js";
import type { WorkspaceInfo } from "../../src/core/types.js";
import type { CaptureProviders } from "./capture-types.js";
import type { EvalCase } from "./dataset.js";
import { LATENCY_LIMIT } from "./deep-latency-math.js";
import type { PathName } from "./deep-latency.js";
import {
  probedCall,
  probedRecall,
  type ProbeHolder,
  type RecallSample
} from "./t0-funnel-prestudy.js";

/** The deep call of one path on the production workspace. The scoped call passes the thread and the source types. */
async function deepCall(info: WorkspaceInfo, providers: CaptureProviders, evalCase: EvalCase, scoped: boolean) {
  return deepMemoryInWorkspace(info, {
    query: evalCase.query,
    queryMode: evalCase.queryMode,
    limit: LATENCY_LIMIT,
    provider: providers.embedding,
    reranker: providers.reranker,
    interpreter: providers.interpreter,
    ...(scoped ? { threadId: evalCase.scope?.threadId, sourceTypes: evalCase.scope?.sourceTypes } : {})
  });
}

/**
 * The scoped path with a budget B' below the core budget. The core fixes its budget at 232 and takes no parameter for
 * it, so this replays the scope branch of memory_deep with the same steps and the same providers, and with the
 * budget of the recuo. It is used only for the recuo measurement.
 */
async function budgetedScopedDeep(
  info: WorkspaceInfo,
  evalCase: EvalCase,
  providers: CaptureProviders,
  budget: number
) {
  const store: MemoryVectorStore = new LanceDbMemoryVectorStore();
  const manifest = await readMemoryManifest(info);
  if (manifest === undefined || manifest.records.length === 0) throw new Error("The production index has no records.");
  const thread = await resolveClosedThread(info, evalCase.scope?.threadId ?? "");
  assertThreadIndexed(manifest, thread);
  const interpretation = await resolveMemoryQueryInterpretation(
    info,
    {
      query: evalCase.query,
      queryMode: evalCase.queryMode,
      provider: providers.embedding,
      reranker: providers.reranker,
      interpreter: providers.interpreter
    },
    store,
    manifest.generation
  );
  const vector = await providers.embedding.embedQuery(interpretation.effectiveQuery);
  if (store.readRows === undefined) throw new Error("The memory store cannot read rows.");
  const records = await store.readRows(info, manifest.generation, {
    layers: presentLayersOf(manifest.records),
    threadId: thread.threadId
  });
  const rows = scopePassageRows(records, evalCase.scope?.sourceTypes);
  return rankScopePassages({
    query: interpretation.effectiveQuery,
    queryVector: vector,
    rows,
    reranker: providers.reranker,
    budget
  });
}

/**
 * The timed runners of one case. M0 runs on the reference copy with the input order; the scoped and unscoped paths run
 * on the production index with the length order, as the production providers do. A budget switches the scoped runner
 * to the recuo replay.
 */
export function runnersOf(input: {
  evalCase: EvalCase;
  reference: Parameters<typeof probedRecall>[0];
  m0Providers: CaptureProviders;
  deepProviders: CaptureProviders;
  holder: ProbeHolder;
  info: WorkspaceInfo;
  budget?: number;
}): Record<PathName, () => Promise<RecallSample>> {
  const { evalCase, reference, m0Providers, deepProviders, holder, info, budget } = input;
  const scopedRun =
    budget === undefined
      ? () => probedCall(holder, evalCase.id, () => deepCall(info, deepProviders, evalCase, true))
      : () => probedCall(holder, evalCase.id, () => budgetedScopedDeep(info, evalCase, deepProviders, budget));
  return {
    m0: () => probedRecall(reference, m0Providers, holder, evalCase, 0),
    scoped: scopedRun,
    unscoped: () => probedCall(holder, evalCase.id, () => deepCall(info, deepProviders, evalCase, false))
  };
}
