import {
  LocalEmbeddingProvider,
  MemoryProviderManager,
  memoryRebuildActiveInWorkspace,
  memoryRebuildingStatus,
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  readWorkspaceSettingsInWorkspace,
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace,
  recallMemoryInWorkspace,
  updateWorkspaceSettingsInWorkspace
} from "./memory/index.js";
import type {
  MemoryRecallResult,
  MemoryRebuildMode,
  MemoryStatus
} from "./memory/index.js";
import {
  prepareMemoryInBackgroundInWorkspace,
  rebuildMemoryInBackgroundInWorkspace
} from "./workspace-status.js";
import type { WorkspaceSettingsInput } from "./types.js";
import { initWorkspace } from "./workspace.js";

const memoryProviderManager = new MemoryProviderManager(
  (info) => new LocalEmbeddingProvider(info)
);

export async function readWorkspaceSettings(workspaceRoot: string) {
  const info = await initWorkspace(workspaceRoot);
  return readWorkspaceSettingsInWorkspace(info);
}

export async function updateWorkspaceSettings(
  workspaceRoot: string,
  input: WorkspaceSettingsInput
) {
  const info = await initWorkspace(workspaceRoot);
  return updateWorkspaceSettingsInWorkspace(info, input);
}

export async function prepareMemoryInBackground(workspaceRoot: string) {
  const info = await initWorkspace(workspaceRoot);
  return prepareMemoryInBackgroundInWorkspace(info);
}

export async function rebuildMemoryInBackground(
  workspaceRoot: string,
  mode: MemoryRebuildMode = "incremental"
) {
  const info = await initWorkspace(workspaceRoot);
  return rebuildMemoryInBackgroundInWorkspace(info, mode);
}

export async function prepareMemory(workspaceRoot: string): Promise<{
  prepared: true;
  provider: ReturnType<LocalEmbeddingProvider["describe"]>;
}> {
  const info = await initWorkspace(workspaceRoot);
  return prepareMemoryInWorkspace(new LocalEmbeddingProvider(info));
}

export async function readMemoryStatus(
  workspaceRoot: string
): Promise<MemoryStatus> {
  const info = await initWorkspace(workspaceRoot);
  const status = await readMemoryStatusInWorkspace(info, {
    provider: new LocalEmbeddingProvider(info)
  });
  const rebuilding = await memoryRebuildActiveInWorkspace(info);
  if (!rebuilding) return status;

  return memoryRebuildingStatus(status);
}

export async function rebuildMemory(
  workspaceRoot: string,
  mode: MemoryRebuildMode = "incremental"
): Promise<MemoryStatus> {
  const info = await initWorkspace(workspaceRoot);
  const provider = new LocalEmbeddingProvider(info);
  const status = await readMemoryStatusInWorkspace(info, { provider });
  const settings = await readWorkspaceSettingsInWorkspace(info);
  const rebuilding = await memoryRebuildActiveInWorkspace(info);
  if (rebuilding) return memoryRebuildingStatus(status);
  if (status.status === "model_missing") return status;
  if (mode === "incremental" && status.status === "incompatible") return status;
  const rebuild = await memoryRebuildOperations[mode](info, {
    provider,
    batchSize: settings.memory.embeddingBatchSize
  });
  const nextStatus = await readMemoryStatusInWorkspace(info, { provider });
  if (!rebuild.acquired) return memoryRebuildingStatus(nextStatus);

  return nextStatus;
}

const memoryRebuildOperations = {
  incremental: reconcileMemoryInWorkspace,
  full: rebuildMemoryInWorkspace
} satisfies Record<MemoryRebuildMode, typeof rebuildMemoryInWorkspace>;

export async function recallMemory(
  workspaceRoot: string,
  input: { query: string; limit?: number; minScore?: number }
): Promise<MemoryRecallResult> {
  const info = await initWorkspace(workspaceRoot);
  return memoryProviderManager.run(info, (provider) =>
    recallMemoryInWorkspace(info, {
      provider,
      query: input.query,
      limit: input.limit,
      minScore: input.minScore
    })
  );
}

export async function disposeMemoryProviders(): Promise<void> {
  await memoryProviderManager.disposeAll();
}
