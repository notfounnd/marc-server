import { safeJoin } from "./paths.js";
import {
  BackgroundMemoryReconciler,
  LocalEmbeddingProvider,
  readWorkspaceSettingsInWorkspace
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
const backgroundMemories = new Map<string, BackgroundMemoryReconciler>();

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
  const memoryIndex = await backgroundMemory(info);
  const settings = await readWorkspaceSettingsInWorkspace(info);
  let threadIndex = await index.health();
  if (threadIndex.status === "unavailable" && !threadIndex.rebuilding) {
    await index.rebuild();
    threadIndex = await index.health();
  }

  let memory = await memoryIndex.health(settings);
  if (shouldAutoRebuildMemory(memory)) {
    void memoryIndex.rebuild().catch(() => undefined);
    memory = await memoryIndex.health(settings);
  }

  return {
    ok: threadIndex.status !== "unavailable",
    modules: {
      threadIndex,
      memory
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

async function backgroundMemory(
  info: WorkspaceInfo
): Promise<BackgroundMemoryReconciler> {
  const existing = backgroundMemories.get(info.marcPath);
  if (existing) return existing;

  const reconciler = new BackgroundMemoryReconciler(
    info,
    () => new LocalEmbeddingProvider(info)
  );
  backgroundMemories.set(info.marcPath, reconciler);
  return reconciler;
}

export async function prepareMemoryInBackgroundInWorkspace(
  info: WorkspaceInfo
) {
  const memory = await backgroundMemory(info);
  const settings = await readWorkspaceSettingsInWorkspace(info);
  void memory
    .prepare()
    .then(() => scheduleAutoRebuildAfterPrepare(info, memory))
    .catch(() => undefined);
  return memory.health(settings);
}

export async function rebuildMemoryInBackgroundInWorkspace(
  info: WorkspaceInfo
) {
  const memory = await backgroundMemory(info);
  const settings = await readWorkspaceSettingsInWorkspace(info);
  void memory.rebuild().catch(() => undefined);
  return memory.health(settings);
}

async function scheduleAutoRebuildAfterPrepare(
  info: WorkspaceInfo,
  memory: BackgroundMemoryReconciler
): Promise<void> {
  const settings = await readWorkspaceSettingsInWorkspace(info);
  const health = await memory.health(settings);
  if (!shouldAutoRebuildMemory(health)) return;
  await memory.rebuild();
}

function shouldAutoRebuildMemory(
  memory: WorkspaceStatus["modules"]["memory"]
): boolean {
  if (!memory.autoRebuild) return false;
  if (!memory.modelPrepared) return false;
  if (memory.preparing) return false;
  if (memory.rebuilding) return false;
  return memory.status === "missing" || memory.status === "stale";
}
