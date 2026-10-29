// The resolution lives in the core now (src/core/thread-resolution.ts). This module keeps the MCP import path.
export {
  resolveThreadId,
  type ThreadResolution,
  type ThreadResolutionError,
  type ThreadResolutionErrorCode,
  type ThreadResolutionFileSystem
} from "../core/thread-resolution.js";
