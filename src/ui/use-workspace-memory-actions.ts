import { useEffect } from "react";
import i18n from "./i18n.js";
import { showNotification } from "./notifications.js";
import type { MemoryIndexHealth, StatusKind, Workspace } from "./types.js";

type ApiPost = <T>(path: string, body: unknown) => Promise<T>;
type Refresh = (options?: {
  force?: boolean;
  includeThread?: boolean;
}) => Promise<void>;

type MemoryPurgeResult = {
  bytesRemoved: number;
};

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

  async function postWorkspace<T = unknown>(
    path: string,
    body: unknown
  ): Promise<T | undefined> {
    if (!selectedWorkspace) return;
    try {
      const result = await apiPost<T>(
        `/api/workspaces/${encodeURIComponent(selectedWorkspace.id)}${path}`,
        body
      );
      await refresh({ force: true, includeThread: true });
      return result;
    } catch (error) {
      setStatusKind("error");
      setStatus(errorText(error));
      return undefined;
    }
  }

  async function purgeUnusedMemory(): Promise<void> {
    const result = await postWorkspace<MemoryPurgeResult>("/memory/purge", {});
    if (!result) return;
    showNotification(
      i18n.t("Memory purge released {{size}}.", {
        size: formatBytes(result.bytesRemoved)
      })
    );
  }

  return {
    prepareMemoryModel: () => postWorkspace("/memory/prepare", {}),
    purgeUnusedMemory,
    rebuildMemoryIndex: (mode: "incremental" | "full") =>
      postWorkspace("/memory/rebuild", { mode }),
    updateWorkspaceAutoRebuild: (autoRebuild: boolean) =>
      postWorkspace("/settings", { memory: { autoRebuild } }),
    updateWorkspaceEmbeddingBatchSize: (embeddingBatchSize: number) =>
      postWorkspace("/settings", { memory: { embeddingBatchSize } }),
    updateWorkspaceSearchRetryDepth: (searchRetryDepth: number) =>
      postWorkspace("/settings", { memory: { searchRetryDepth } })
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const nextUnit of units) {
    value /= 1024;
    unit = nextUnit;
    if (value < 1024) break;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
