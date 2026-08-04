import type { WorkspaceInfo } from "../types.js";
import {
  tryWithWorkspaceWriteLock,
  workspaceWriteLockActive,
  type WorkspaceWriteLockAttempt
} from "../write-coordination.js";
import type { MemoryManifest, MemoryStatus } from "./types.js";

export const MEMORY_REBUILD_RESOURCE = "memory-rebuild";
export const MEMORY_OPERATION_RESOURCE = "memory-operation";

export type MemoryRebuildAttempt =
  | { acquired: false }
  | { acquired: true; manifest: MemoryManifest };

export async function tryWithMemoryRebuildLock(
  info: WorkspaceInfo,
  callback: () => Promise<MemoryManifest>
): Promise<WorkspaceWriteLockAttempt<MemoryManifest>> {
  const operation = await tryWithMemoryOperationLock(info, () =>
    tryWithWorkspaceWriteLock(info.marcPath, MEMORY_REBUILD_RESOURCE, callback)
  );
  if (!operation.acquired) return operation;
  if (!operation.value.acquired) return { acquired: false };
  return { acquired: true, value: operation.value.value };
}

export async function tryWithMemoryOperationLock<T>(
  info: WorkspaceInfo,
  callback: () => Promise<T>
): Promise<WorkspaceWriteLockAttempt<T>> {
  return tryWithWorkspaceWriteLock(
    info.marcPath,
    MEMORY_OPERATION_RESOURCE,
    callback
  );
}

export async function memoryRebuildActiveInWorkspace(
  info: WorkspaceInfo
): Promise<boolean> {
  return workspaceWriteLockActive(info.marcPath, MEMORY_REBUILD_RESOURCE);
}

export function memoryRebuildingStatus(status: MemoryStatus): MemoryStatus {
  return {
    ...status,
    status: "rebuilding",
    ready: false,
    message: "Memory rebuild is running."
  };
}
