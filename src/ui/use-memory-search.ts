import { useEffect, useRef, useState } from "react";
import {
  alternateMemorySearchQuery,
  findMemorySearchThread,
  isCurrentMemorySearchRequest,
  isMemorySearchAvailable,
  readStoredMemorySearchState,
  recallMemorySearch,
  writeStoredMemorySearchState
} from "./memory-search.js";
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

    await executeSearch({ query: trimmedQuery });
  }

  async function runAlternateSearch(): Promise<void> {
    if (!result) return;
    const alternateQuery = alternateMemorySearchQuery(result.interpretation);
    if (!alternateQuery) return;
    setQuery(alternateQuery);
    await executeSearch({ initialMode: "literal", query: alternateQuery });
  }

  async function executeSearch({
    query: nextQuery,
    initialMode = "auto"
  }: {
    query: string;
    initialMode?: "auto" | "literal";
  }): Promise<void> {
    if (!selectedWorkspace) return;
    const nextWorkspaceId = selectedWorkspace.id;
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setStatus("searching");
    setError(undefined);

    try {
      const nextResult = await recallMemorySearch({
        apiPost,
        initialMode,
        query: nextQuery,
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
      setResult(nextResult);
      setStatus("idle");
      writeStoredMemorySearchState(localStorage, {
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

  /** A rules or document hit has no thread to open: selecting it does nothing and reports no error. */
  function selectHit(hit: MemoryRecallHit): void {
    if (!hit.threadId) return;
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
    query,
    result,
    runAlternateSearch,
    status,
    runSearch,
    selectHit,
    setQuery
  };
}
