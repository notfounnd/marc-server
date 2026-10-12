import { safeJoin } from "./paths.js";
import {
  BackgroundMemoryReconciler,
  LocalEmbeddingProvider,
  LocalQueryInterpretationProvider,
  LocalRerankingProvider,
  readWorkspaceSettingsInWorkspace
} from "./memory/index.js";
import {
  BackgroundThreadIndexReconciler,
  JsonThreadIndexStore,
  ThreadIndexReconciler,
  threadIndexPath
} from "./thread-index.js";
import type {
  SummaryProjectionState,
  ThreadInfo,
  ThreadListOptions,
  ThreadIndexStore,
  WorkspaceInfo,
  WorkspaceSettings,
  WorkspaceStatus
} from "./types.js";

const backgroundThreadIndexes = new Map<
  string,
  BackgroundThreadIndexReconciler
>();
const backgroundMemories = new Map<string, BackgroundMemoryReconciler>();

export type WorkspaceStatusDependencies = {
  createThreadIndexStore?: (indexPath: string) => ThreadIndexStore;
  memoryReconciler?: BackgroundMemoryReconciler;
};

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

export async function refreshThreadSummaryProjectionsInWorkspace(
  info: WorkspaceInfo,
  dependencies: WorkspaceStatusDependencies = {}
): Promise<SummaryProjectionState> {
  const errors: SummaryProjectionState["errors"] = [];
  let threadIndex: SummaryProjectionState["threadIndex"] = "pending";
  let memory: SummaryProjectionState["memory"] = "pending";

  try {
    await new ThreadIndexReconciler(
      safeJoin(info.marcPath, "threads"),
      (
        dependencies.createThreadIndexStore ??
        ((indexPath) => new JsonThreadIndexStore(indexPath))
      )(threadIndexPath(info.marcPath))
    ).reconcile();
    threadIndex = "updated";
  } catch {
    errors.push("thread_index_refresh_failed");
  }

  try {
    const status = await readWorkspaceStatusInWorkspace(info, {
      memoryReconciler: dependencies.memoryReconciler
    });
    memory = memoryProjectionState(status.modules.memory);
  } catch {
    errors.push("memory_status_failed");
  }

  return { threadIndex, memory, errors };
}

export async function readWorkspaceStatusInWorkspace(
  info: WorkspaceInfo,
  dependencies: WorkspaceStatusDependencies = {}
): Promise<WorkspaceStatus> {
  const index = await backgroundThreadIndex(info);
  const memoryIndex =
    dependencies.memoryReconciler ?? (await backgroundMemory(info));
  const settings = await readWorkspaceSettingsInWorkspace(info);
  let threadIndex = await index.health();
  if (threadIndex.status === "unavailable" && !threadIndex.rebuilding) {
    await index.rebuild();
    threadIndex = await index.health();
  }

  let memory = await memoryIndex.health(settings);
  if (shouldAutoRebuildMemory(memory)) {
    void memoryIndex.rebuild(settings).catch(() => undefined);
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
    () => new LocalEmbeddingProvider(info),
    undefined,
    () => new LocalRerankingProvider(info),
    () => new LocalQueryInterpretationProvider(info)
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
  info: WorkspaceInfo,
  mode: "incremental" | "full" = "incremental"
) {
  const memory = await backgroundMemory(info);
  const settings = await readWorkspaceSettingsInWorkspace(info);
  const rebuild = backgroundMemoryRebuilds[mode];
  void rebuild(memory, settings).catch(() => undefined);
  return memory.health(settings);
}

const backgroundMemoryRebuilds = {
  incremental: (
    memory: BackgroundMemoryReconciler,
    settings: WorkspaceSettings
  ) => memory.rebuild(settings),
  full: (memory: BackgroundMemoryReconciler, settings: WorkspaceSettings) =>
    memory.rebuildFull(settings)
};

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
  if (!memory.rebuildReady) return false;
  if (memory.preparing) return false;
  if (memory.rebuilding) return false;
  return memory.status === "missing" || memory.status === "stale";
}

function memoryProjectionState(
  memory: WorkspaceStatus["modules"]["memory"]
): SummaryProjectionState["memory"] {
  if (memory.status === "ready" && !memory.stale) return "current";
  if (memory.rebuilding) return "scheduled";
  if (
    memory.autoRebuild &&
    memory.rebuildReady &&
    (memory.status === "missing" || memory.status === "stale")
  ) {
    return "scheduled";
  }
  return "pending";
}
