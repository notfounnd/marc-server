import { useEffect, useState } from "react";
import {
  findMemorySearchThread,
  isMemorySearchAvailable,
  readStoredMemorySearchState,
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

  useEffect(() => {
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

    setStatus("searching");
    setError(undefined);
    try {
      const nextResult = await apiPost<MemoryRecallResult>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}/memory/recall`,
        { limit: 5, query: trimmedQuery }
      );
      setResult(nextResult);
      setStatus("idle");
      writeStoredMemorySearchState(localStorage, {
        query: trimmedQuery,
        result: nextResult,
        workspaceId: selectedWorkspace.id
      });
    } catch (caught) {
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
    query,
    result,
    status,
    runSearch,
    selectHit,
    setQuery
  };
}
