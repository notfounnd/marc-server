import path from "node:path";
import { removeThreadPolicy } from "../core/activation-policy-store.js";
import { listThreadsInWorkspace } from "../core/threads.js";
import type { WorkspaceInfo } from "../core/types.js";
import { pathExists } from "./http.js";
import { isSafeSegment } from "./marked-file.js";
import type { DaemonStore } from "./store.js";
import type { ThreadScope, ThreadStore } from "./thread-store.js";

/**
 * Removes the state and the policy file of every thread that already has a SUMMARY.md. It runs
 * at startup, for threads closed while the daemon was down, and each time a SUMMARY.md appears.
 * It is idempotent. A workspace that cannot be read keeps its state and its files, so a temporary
 * failure never deletes them.
 */
export async function removeClosedThreads(
  workspaces: readonly WorkspaceInfo[],
  threads: ThreadStore
): Promise<void> {
  for (const workspace of workspaces) {
    await removeClosedIn(workspace, threads);
  }
}

/**
 * The folder watcher's path. A SUMMARY.md that appears closes its thread, which is then
 * forgotten. An open thread is left as it is.
 */
export async function forgetIfClosed(
  store: DaemonStore,
  threads: ThreadStore,
  workspace: WorkspaceInfo,
  threadId: string
): Promise<void> {
  const closed = await closedThreadChecker(store)({
    workspaceId: workspace.id,
    threadId
  });
  if (!closed) return;
  await forgetClosedThread(workspace, threads, threadId);
}

/** The cleanup of one closed thread: its daemon state, then its policy file. Both are idempotent. */
export async function forgetClosedThread(
  workspace: WorkspaceInfo,
  threads: ThreadStore,
  threadId: string
): Promise<void> {
  await threads.remove({ workspaceId: workspace.id, threadId });
  await removeClosedPolicy(workspace, threadId);
}

/**
 * Whether a thread is closed, read from its SUMMARY.md. It is the closure rule of the
 * whole workspace, so every write path asks the same question. An unknown workspace or an
 * unsafe id is not closed: the store refuses the unsafe id on its own.
 */
export function closedThreadChecker(
  store: DaemonStore
): (scope: ThreadScope) => Promise<boolean> {
  return async (scope) => {
    if (!isSafeSegment(scope.threadId)) return false;
    const workspace = await store.getWorkspace(scope.workspaceId);
    if (!workspace) return false;
    return pathExists(
      path.join(workspace.marcPath, "threads", scope.threadId, "SUMMARY.md")
    );
  };
}

async function removeClosedIn(
  workspace: WorkspaceInfo,
  threads: ThreadStore
): Promise<void> {
  const closed = await closedIds(workspace).catch(() => undefined);
  if (!closed) return;
  const scopes = await threads.scopes(workspace.id);
  for (const scope of scopes) {
    if (closed.has(scope.threadId)) await threads.remove(scope);
  }
  for (const threadId of closed) await removeClosedPolicy(workspace, threadId);
}

/** Best effort. A policy file that cannot be removed stays, and the next pass retries it. */
function removeClosedPolicy(
  workspace: WorkspaceInfo,
  threadId: string
): Promise<void> {
  return removeThreadPolicy(workspace, threadId).catch(() => undefined);
}

async function closedIds(workspace: WorkspaceInfo): Promise<Set<string>> {
  const closed = await listThreadsInWorkspace(workspace, { status: "closed" });
  return new Set(closed.map((thread) => thread.id));
}
