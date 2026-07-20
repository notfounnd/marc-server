import { useEffect } from "react";
import type { MemoryIndexHealth, StatusKind, Workspace } from "./types.js";

type ApiPost = <T>(path: string, body: unknown) => Promise<T>;
type Refresh = (options?: {
  force?: boolean;
  includeThread?: boolean;
}) => Promise<void>;

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useWorkspaceMemoryActions({
  apiPost,
  refresh,
  selectedMemoryHealth,
  selectedWorkspace,
  setStatus,
  setStatusKind
}: {
  apiPost: ApiPost;
  refresh: Refresh;
  selectedMemoryHealth?: MemoryIndexHealth;
  selectedWorkspace?: Workspace;
  setStatus: (status: string) => void;
  setStatusKind: (kind: StatusKind) => void;
}) {
  useEffect(() => {
    const memoryBusy =
      selectedMemoryHealth?.preparing || selectedMemoryHealth?.rebuilding;
    if (!memoryBusy) return;
    const timer = window.setTimeout(() => {
      void refresh({ force: true, includeThread: true });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [
    refresh,
    selectedMemoryHealth?.preparing,
    selectedMemoryHealth?.rebuilding
  ]);

  async function postWorkspace(path: string, body: unknown): Promise<void> {
    if (!selectedWorkspace) return;
    try {
      await apiPost(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}${path}`,
        body
      );
      await refresh({ force: true, includeThread: true });
    } catch (error) {
      setStatusKind("error");
      setStatus(errorText(error));
    }
  }

  return {
    prepareMemoryModel: () => postWorkspace("/memory/prepare", {}),
    rebuildMemoryIndex: (mode: "incremental" | "full") =>
      postWorkspace("/memory/rebuild", { mode }),
    updateWorkspaceAutoRebuild: (autoRebuild: boolean) =>
      postWorkspace("/settings", { memory: { autoRebuild } }),
    updateWorkspaceEmbeddingBatchSize: (embeddingBatchSize: number) =>
      postWorkspace("/settings", { memory: { embeddingBatchSize } })
  };
}
