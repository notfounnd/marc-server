import type { WorkspaceInfo } from "../types.js";
import {
  buildMemoryQueryCandidates,
  interpretMemoryQuery,
  literalMemoryQueryInterpretation
} from "./query-interpretation.js";
import type {
  MemoryQueryInterpretation,
  MemoryRecallHit,
  MemoryRecallOptions,
  MemoryRecallResult,
  MemoryStatus,
  MemoryVectorStore
} from "./types.js";

/**
 * The result of a recall that did not search: an unready index, a concurrent operation
 * or a manifest without records. Only a search that admits nothing sets abstained.
 */
export function emptyMemoryRecallResult(
  query: string,
  queryMode: MemoryRecallOptions["queryMode"],
  status: MemoryStatus,
  nextActions: string[]
): MemoryRecallResult {
  return {
    query,
    interpretation: literalMemoryQueryInterpretation(
      query,
      queryMode ?? "auto"
    ),
    indexStatus: status,
    results: [],
    nextActions,
    abstained: false
  };
}

export async function resolveMemoryQueryInterpretation(
  info: WorkspaceInfo,
  options: MemoryRecallOptions,
  store: MemoryVectorStore,
  generation?: string
): Promise<MemoryQueryInterpretation> {
  const mode = options.queryMode ?? "auto";
  if (mode === "literal")
    return literalMemoryQueryInterpretation(options.query, mode);
  if (!options.interpreter)
    return literalMemoryQueryInterpretation(options.query, mode);
  const rows = store.readRows ? await store.readRows(info, generation) : [];
  const candidates = buildMemoryQueryCandidates(options.query, rows);
  return interpretMemoryQuery({
    mode,
    originalQuery: options.query,
    provider: options.interpreter,
    ...candidates
  });
}

export function dedupeMemoryRecallHits(
  hits: MemoryRecallHit[]
): MemoryRecallHit[] {
  const seen = new Set<string>();
  const results: MemoryRecallHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.threadId)) continue;
    seen.add(hit.threadId);
    results.push(hit);
  }
  return results;
}
