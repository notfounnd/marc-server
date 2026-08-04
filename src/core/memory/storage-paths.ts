import { safeJoin } from "../paths.js";
import type { WorkspaceInfo } from "../types.js";

export const MEMORY_MANIFEST_FILE = "manifest.json";

export function memoryRootPath(info: WorkspaceInfo): string {
  return safeJoin(info.marcPath, "memory");
}

export function memoryManifestPath(info: WorkspaceInfo): string {
  return safeJoin(memoryRootPath(info), MEMORY_MANIFEST_FILE);
}
