import { useEffect, useRef, useState } from "react";
import {
  alternateMemorySearchQuery,
  findMemorySearchThread,
  isCurrentMemorySearchRequest,
  isMemorySearchAvailable,
  recallMemorySearchDepths,
  readStoredMemorySearchState,
  writeStoredMemorySearchState
} from "./memory-search.js";
import {
  automaticMemorySearchDepths,
  isMemorySearchRetryDepth,
  nextMemorySearchDepth,
  type MemorySearchDepthState,
  type MemorySearchRetryDepth
} from "./memory-search-depth.js";
import type {
  MemoryIndexHealth,
  MemoryQueryInterpretation,
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
  const workspaceId = selectedWorkspace?.id;
  const requestId = useRef(0);
  const currentWorkspaceId = useRef(workspaceId);
  currentWorkspaceId.current = workspaceId;

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
            lastExecutedDepth: saved.lastExecutedDepth
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

    const configuredDepth = selectedSearchRetryDepth(selectedMemoryHealth);
    await executeSearch({
      configuredDepth,
      query: trimmedQuery,
      depths: automaticMemorySearchDepths(configuredDepth)
    });
  }

  async function runDeepRetry(): Promise<void> {
    if (!selectedWorkspace) return;
    if (!isMemorySearchAvailable(selectedMemoryHealth)) return;
    if (!activeSearch) return;
    if (!result) return;
    const depth = nextMemorySearchDepth(activeSearch);
    if (depth === undefined) return;

    await executeSearch({
      configuredDepth: activeSearch.configuredDepth,
      query: result.query,
      depths: [depth],
      interpretation: result.interpretation
    });
  }

  async function runAlternateSearch(): Promise<void> {
    if (!result) return;
    const alternateQuery = alternateMemorySearchQuery(result.interpretation);
    if (!alternateQuery) return;
    const configuredDepth = selectedSearchRetryDepth(selectedMemoryHealth);
    setQuery(alternateQuery);
    await executeSearch({
      configuredDepth,
      depths: automaticMemorySearchDepths(configuredDepth),
      initialMode: "literal",
      query: alternateQuery
    });
  }

  async function executeSearch({
    configuredDepth,
    query: nextQuery,
    depths,
    initialMode = "auto",
    interpretation
  }: {
    configuredDepth: MemorySearchRetryDepth;
    query: string;
    depths: MemorySearchRetryDepth[];
    initialMode?: "auto" | "literal";
    interpretation?: MemoryQueryInterpretation;
  }): Promise<void> {
    if (!selectedWorkspace) return;
    const nextWorkspaceId = selectedWorkspace.id;
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setStatus("searching");
    setError(undefined);

    try {
      const { lastExecutedDepth, result: nextResult } =
        await recallMemorySearchDepths({
          apiPost,
          query: nextQuery,
          depths,
          initialMode,
          interpretation,
          workspaceId: nextWorkspaceId
        });
      if (
        !isCurrentMemorySearchRequest(
          nextRequestId,
          requestId.current,
          nextWorkspaceId,
          currentWorkspaceId.current
        )
      ) {
        return;
      }
      const active = { configuredDepth, lastExecutedDepth };
      setActiveSearch(active);
      setResult(nextResult);
      setStatus("idle");
      writeStoredMemorySearchState(localStorage, {
        ...active,
        query: nextQuery,
        result: nextResult,
        workspaceId: nextWorkspaceId
      });
    } catch (caught) {
      if (
        !isCurrentMemorySearchRequest(
          nextRequestId,
          requestId.current,
          nextWorkspaceId,
          currentWorkspaceId.current
        )
      ) {
        return;
      }
      setStatus("error");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
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
    runAlternateSearch,
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
