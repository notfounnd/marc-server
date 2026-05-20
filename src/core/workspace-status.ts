import { safeJoin } from "./paths.js";
import {
  BackgroundThreadIndexReconciler,
  JsonThreadIndexStore,
  threadIndexPath
} from "./thread-index.js";
import type {
  ThreadInfo,
  ThreadListOptions,
  WorkspaceInfo,
  WorkspaceStatus
} from "./types.js";

const backgroundThreadIndexes = new Map<
  string,
  BackgroundThreadIndexReconciler
>();

export async function listThreadsCachedInWorkspace(
  info: WorkspaceInfo,
  options: ThreadListOptions = {}
): Promise<ThreadInfo[]> {
  return (await backgroundThreadIndex(info)).list(options);
}

export async function rebuildThreadIndexInWorkspace(
  info: WorkspaceInfo
): Promise<void> {
  await (await backgroundThreadIndex(info)).rebuild();
}

export async function readWorkspaceStatusInWorkspace(
  info: WorkspaceInfo
): Promise<WorkspaceStatus> {
  const index = await backgroundThreadIndex(info);
  let threadIndex = await index.health();
  if (threadIndex.status === "unavailable" && !threadIndex.rebuilding) {
    await index.rebuild();
    threadIndex = await index.health();
  }

  return {
    ok: threadIndex.status !== "unavailable",
    modules: {
      threadIndex
    }
  };
}

async function backgroundThreadIndex(
  info: WorkspaceInfo
): Promise<BackgroundThreadIndexReconciler> {
  const indexPath = threadIndexPath(info.marcPath);
  const existing = backgroundThreadIndexes.get(indexPath);
  if (existing) return existing;

  const reconciler = new BackgroundThreadIndexReconciler(
    safeJoin(info.marcPath, "threads"),
    new JsonThreadIndexStore(indexPath)
  );
  backgroundThreadIndexes.set(indexPath, reconciler);
  return reconciler;
}
