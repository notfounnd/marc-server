import {
  LocalEmbeddingProvider,
  LocalQueryInterpretationProvider,
  LocalRerankingProvider,
  defaultMemoryInferenceManager,
  deepMemoryInWorkspace,
  isMemorySearchDepth,
  MEMORY_SEARCH_DEPTH_RANGE_MESSAGE,
  memoryRebuildActiveInWorkspace,
  memoryRebuildingStatus,
  prepareMemoryInWorkspace,
  purgeMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  readWorkspaceSettingsInWorkspace,
  rebuildMemoryInWorkspace,
  reconcileMemoryInWorkspace,
  recallMemoryInWorkspace,
  updateWorkspaceSettingsInWorkspace
} from "./memory/index.js";
import type {
  MemoryDeepInput,
  MemoryDeepResult,
  MemoryPurgeResult,
  MemoryQueryMode,
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
  interpreter: ReturnType<LocalQueryInterpretationProvider["describe"]>;
  reranker: ReturnType<LocalRerankingProvider["describe"]>;
}> {
  const info = await initWorkspace(workspaceRoot);
  const prepared = await prepareMemoryInWorkspace(info, {
    interpreter: new LocalQueryInterpretationProvider(info),
    provider: new LocalEmbeddingProvider(info),
    reranker: new LocalRerankingProvider(info)
  });
  if (!prepared.interpreter)
    throw new Error("Memory query interpretation model was not prepared.");
  return { ...prepared, interpreter: prepared.interpreter };
}

export async function purgeMemory(
  workspaceRoot: string
): Promise<MemoryPurgeResult> {
  const info = await initWorkspace(workspaceRoot);
  return purgeMemoryInWorkspace(info, {});
}

export async function readMemoryStatus(
  workspaceRoot: string
): Promise<MemoryStatus> {
  const info = await initWorkspace(workspaceRoot);
  const status = await readMemoryStatusInWorkspace(info, {
    interpreter: new LocalQueryInterpretationProvider(info),
    provider: new LocalEmbeddingProvider(info),
    reranker: new LocalRerankingProvider(info)
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
  const reranker = new LocalRerankingProvider(info);
  const interpreter = new LocalQueryInterpretationProvider(info);
  const status = await readMemoryStatusInWorkspace(info, {
    provider,
    interpreter,
    reranker
  });
  const settings = await readWorkspaceSettingsInWorkspace(info);
  const rebuilding = await memoryRebuildActiveInWorkspace(info);
  if (rebuilding) return memoryRebuildingStatus(status);
  if (!status.rebuildReady) return status;
  if (mode === "incremental" && status.status === "incompatible") return status;
  const rebuild = await memoryRebuildOperations[mode](info, {
    provider,
    interpreter,
    reranker,
    batchSize: settings.memory.embeddingBatchSize
  });
  const nextStatus = await readMemoryStatusInWorkspace(info, {
    provider,
    interpreter,
    reranker
  });
  if (!rebuild.acquired) return memoryRebuildingStatus(nextStatus);

  return nextStatus;
}

const memoryRebuildOperations = {
  incremental: reconcileMemoryInWorkspace,
  full: rebuildMemoryInWorkspace
} satisfies Record<MemoryRebuildMode, typeof rebuildMemoryInWorkspace>;

export async function recallMemory(
  workspaceRoot: string,
  input: {
    depth?: number;
    query: string;
    queryMode?: MemoryQueryMode;
    limit?: number;
  }
): Promise<MemoryRecallResult> {
  const info = await initWorkspace(workspaceRoot);
  if (input.depth !== undefined && !isMemorySearchDepth(input.depth))
    throw new Error(MEMORY_SEARCH_DEPTH_RANGE_MESSAGE);
  return recallMemoryInWorkspace(info, {
    provider: new LocalEmbeddingProvider(info),
    interpreter: new LocalQueryInterpretationProvider(info),
    reranker: new LocalRerankingProvider(info),
    query: input.query,
    queryMode: input.queryMode,
    limit: input.limit,
    depth: input.depth
  });
}

export async function deepMemory(
  workspaceRoot: string,
  input: MemoryDeepInput
): Promise<MemoryDeepResult> {
  const info = await initWorkspace(workspaceRoot);
  return deepMemoryInWorkspace(info, {
    provider: new LocalEmbeddingProvider(info),
    interpreter: new LocalQueryInterpretationProvider(info),
    reranker: new LocalRerankingProvider(info),
    query: input.query,
    threadId: input.threadId,
    sourceTypes: input.sourceTypes,
    queryMode: input.queryMode,
    limit: input.limit
  });
}

export async function disposeMemoryProviders(): Promise<void> {
  await defaultMemoryInferenceManager.disposeAll();
}
