import { safeJoin } from "./paths.js";
import {
  LocalEmbeddingProvider,
  readMemoryStatusInWorkspace
} from "./memory/index.js";
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

  const memory = await readMemoryStatusInWorkspace(info, {
    provider: new LocalEmbeddingProvider(info)
  });

  return {
    ok: threadIndex.status !== "unavailable",
    modules: {
      threadIndex,
      memory: {
        status: memory.status,
        ready: memory.ready,
        stale: memory.stale,
        modelPrepared: memory.modelPrepared,
        summaryCount: memory.summaryCount,
        indexedSummaryCount: memory.indexedSummaryCount,
        message: memory.message
      }
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
