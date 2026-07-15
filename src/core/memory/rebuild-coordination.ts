import type { WorkspaceInfo } from "../types.js";
import {
  tryWithWorkspaceWriteLock,
  workspaceWriteLockActive,
  type WorkspaceWriteLockAttempt
} from "../write-coordination.js";
import type { MemoryManifest, MemoryStatus } from "./types.js";

export const MEMORY_REBUILD_RESOURCE = "memory-rebuild";

export type MemoryRebuildAttempt =
  | { acquired: false }
  | { acquired: true; manifest: MemoryManifest };

export async function tryWithMemoryRebuildLock(
  info: WorkspaceInfo,
  callback: () => Promise<MemoryManifest>
): Promise<WorkspaceWriteLockAttempt<MemoryManifest>> {
  return tryWithWorkspaceWriteLock(
    info.marcPath,
    MEMORY_REBUILD_RESOURCE,
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
