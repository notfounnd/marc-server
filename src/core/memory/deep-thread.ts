import { safeJoin } from "../paths.js";
import { resolveThreadId } from "../thread-resolution.js";
import type { WorkspaceInfo } from "../types.js";
import { MemoryDeepError } from "./deep-errors.js";
import { marcRelativePath, readRegularFile } from "./sources/files.js";
import type { MemoryManifest } from "./types.js";

/** A closed thread that memory_deep may search. `relativeSummaryPath` is the key of its manifest group. */
export type ScopedThread = {
  threadId: string;
  relativeSummaryPath: string;
};

/**
 * Resolves the thread id and checks that the thread is closed: a non-empty SUMMARY.md, the same
 * rule as the closed-thread source. The resolution reports its own codes unchanged.
 */
export async function resolveClosedThread(
  info: WorkspaceInfo,
  requestedId: string
): Promise<ScopedThread> {
  const resolution = await resolveThreadId(info.rootPath, requestedId);
  if (!resolution.ok) {
    throw new MemoryDeepError(
      resolution.error.code,
      resolution.error.message,
      resolution.error.details
    );
  }
  const summaryPath = safeJoin(
    info.marcPath,
    "threads",
    resolution.threadId,
    "SUMMARY.md"
  );
  const summary = await readRegularFile(info.rootPath, summaryPath);
  if (!summary?.bytes.length) {
    throw new MemoryDeepError(
      "thread_not_closed",
      "memory_deep only covers closed threads."
    );
  }
  return {
    threadId: resolution.threadId,
    relativeSummaryPath: marcRelativePath(info, summary.path)
  };
}

/** A thread that exists on disk but is missing from the index cannot be searched; rebuild first. */
export function assertThreadIndexed(
  manifest: MemoryManifest | undefined,
  thread: ScopedThread
): void {
  const indexed =
    manifest?.records.some(
      (record) => record.relativeSummaryPath === thread.relativeSummaryPath
    ) === true;
  if (indexed) return;
  throw new MemoryDeepError(
    "thread_not_indexed",
    "The thread is not in the memory index. Run memory_rebuild before using memory_deep with threadId."
  );
}
