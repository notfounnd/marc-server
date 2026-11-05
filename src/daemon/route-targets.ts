import type http from "node:http";
import { listThreadsInWorkspace } from "../core/threads.js";
import type { ThreadInfo, WorkspaceInfo } from "../core/types.js";
import { text } from "./http.js";
import type { DaemonStore } from "./store.js";

/** The workspace and thread named in a route, or a 404 already written to the response. */
export type ThreadTarget = {
  workspace: WorkspaceInfo;
  threadId: string;
  thread: ThreadInfo;
};

export type TargetContext = {
  store: DaemonStore;
  response: http.ServerResponse;
};

export async function workspaceFor(
  context: TargetContext,
  workspaceParam: string
): Promise<WorkspaceInfo | undefined> {
  const workspace = await context.store.getWorkspace(
    decodeURIComponent(workspaceParam)
  );
  if (workspace) return workspace;
  text(context.response, 404, "Workspace not found");
  return undefined;
}

export async function threadFor(
  context: TargetContext,
  workspaceParam: string,
  threadParam: string
): Promise<ThreadTarget | undefined> {
  const workspace = await workspaceFor(context, workspaceParam);
  if (!workspace) return undefined;
  const threadId = decodeURIComponent(threadParam);
  const threads = await listThreadsInWorkspace(workspace, { status: "all" });
  const thread = threads.find((item) => item.id === threadId);
  if (thread) return { workspace, threadId, thread };
  text(context.response, 404, "Thread not found");
  return undefined;
}
