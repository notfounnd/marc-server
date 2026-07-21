import { useEffect, useRef, useState } from "react";
import {
  findMemorySearchThread,
  isMemorySearchAvailable,
  readStoredMemorySearchState,
  writeStoredMemorySearchState
} from "./memory-search.js";
import {
  automaticMemorySearchScores,
  isMemorySearchRetryDepth,
  MEMORY_SEARCH_UI_LIMIT,
  minScoreForMemorySearchDepth,
  nextMemorySearchDepth,
  type MemorySearchDepthState,
  type MemorySearchRetryDepth
} from "./memory-search-depth.js";
import type {
  MemoryIndexHealth,
  MemoryRecallHit,
  MemoryRecallResult,
  MemorySearchStatus,
  StatusKind,
  Thread,
  Workspace
} from "./types.js";

type ApiPost = <T>(path: string, body: unknown) => Promise<T>;
type Translation = (key: string, options?: Record<string, unknown>) => string;

export function useMemorySearch({
  allWorkspaceThreads,
  apiPost,
  selectedMemoryHealth,
  selectedWorkspace,
  t,
  onSelectThread,
  onStatusChange
}: {
  allWorkspaceThreads: Thread[];
  apiPost: ApiPost;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedWorkspace?: Workspace;
  t: Translation;
  onSelectThread: (thread: Thread) => void | Promise<unknown>;
  onStatusChange: (kind: StatusKind, status: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<MemoryRecallResult>();
  const [status, setStatus] = useState<MemorySearchStatus>("idle");
  const [error, setError] = useState<string>();
  const [activeSearch, setActiveSearch] = useState<MemorySearchDepthState>();
  const requestId = useRef(0);
  const workspaceId = selectedWorkspace?.id;

  useEffect(() => {
    requestId.current += 1;
    const saved = readStoredMemorySearchState(localStorage, workspaceId);
    setQuery(saved?.query ?? "");
    setResult(saved?.result);
    setStatus("idle");
    setError(undefined);
    setActiveSearch(
      saved
        ? {
            configuredDepth: saved.configuredDepth,
            manualDeepRetries: saved.manualDeepRetries
          }
        : undefined
    );
  }, [workspaceId]);

  async function runSearch(): Promise<void> {
    if (!selectedWorkspace) return;
    if (!isMemorySearchAvailable(selectedMemoryHealth)) {
      setStatus("error");
      setError(selectedMemoryHealth?.message ?? t("Memory search unavailable"));
      return;
    }
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setStatus("error");
      setError(t("Enter a search query."));
      return;
    }

    const active = {
      configuredDepth: selectedSearchRetryDepth(selectedMemoryHealth),
      manualDeepRetries: 0
    };
    await executeSearch({
      active,
      query: trimmedQuery,
      scores: automaticMemorySearchScores(active.configuredDepth)
    });
  }

  async function runDeepRetry(): Promise<void> {
    if (!selectedWorkspace) return;
    if (!isMemorySearchAvailable(selectedMemoryHealth)) return;
    if (!activeSearch) return;
    if (!result) return;
    const depth = nextMemorySearchDepth(activeSearch);
    if (depth === undefined) return;

    const active = {
      ...activeSearch,
      manualDeepRetries: activeSearch.manualDeepRetries + 1
    };
    await executeSearch({
      active,
      query: result.query,
      scores: [minScoreForMemorySearchDepth(depth)]
    });
  }

  async function executeSearch({
    active,
    query: nextQuery,
    scores
  }: {
    active: MemorySearchDepthState;
    query: string;
    scores: number[];
  }): Promise<void> {
    if (!selectedWorkspace) return;
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setStatus("searching");
    setError(undefined);

    try {
      const nextResult = await recallScores({
        query: nextQuery,
        scores,
        workspaceId: selectedWorkspace.id
      });
      if (nextRequestId !== requestId.current) return;
      setActiveSearch(active);
      setResult(nextResult);
      setStatus("idle");
      writeStoredMemorySearchState(localStorage, {
        ...active,
        query: nextQuery,
        result: nextResult,
        workspaceId: selectedWorkspace.id
      });
    } catch (caught) {
      if (nextRequestId !== requestId.current) return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function recallScores({
    query: nextQuery,
    scores,
    workspaceId: nextWorkspaceId
  }: {
    query: string;
    scores: number[];
    workspaceId: string;
  }): Promise<MemoryRecallResult> {
    let latestResult: MemoryRecallResult | undefined;
    for (const minScore of scores) {
      latestResult = await apiPost<MemoryRecallResult>(
        `/api/workspaces/${encodeURIComponent(nextWorkspaceId)}/memory/recall`,
        { limit: MEMORY_SEARCH_UI_LIMIT, minScore, query: nextQuery }
      );
      if (latestResult.results.length) return latestResult;
    }
    if (latestResult) return latestResult;
    throw new Error("Memory search requires at least one score.");
  }

  function selectHit(hit: MemoryRecallHit): void {
    const thread = findMemorySearchThread(hit, allWorkspaceThreads);
    if (!thread) {
      onStatusChange(
        "error",
        t("Thread not found: {{threadId}}", { threadId: hit.threadId })
      );
      return;
    }
    void onSelectThread(thread);
  }

  return {
    error,
    deepRetryAvailable:
      activeSearch !== undefined &&
      result !== undefined &&
      !error &&
      status !== "searching" &&
      nextMemorySearchDepth(activeSearch) !== undefined,
    query,
    result,
    runDeepRetry,
    status,
    runSearch,
    selectHit,
    setQuery
  };
}

function selectedSearchRetryDepth(
  health: MemoryIndexHealth | undefined
): MemorySearchRetryDepth {
  if (isMemorySearchRetryDepth(health?.searchRetryDepth)) {
    return health.searchRetryDepth;
  }
  return 0;
}
