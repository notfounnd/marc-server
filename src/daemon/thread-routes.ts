import type http from "node:http";
import {
  createThread,
  rebuildThreadIndexInBackground
} from "../core/workspace.js";
import { json, readBody, text } from "./http.js";
import type { UiEventBus } from "./events.js";
import type { DaemonStore } from "./store.js";

type ThreadRouteContext = {
  events: UiEventBus;
  request: http.IncomingMessage;
  response: http.ServerResponse;
  store: DaemonStore;
};

export async function postWorkspaceThreadCreation(
  context: ThreadRouteContext,
  match: RegExpExecArray
): Promise<void> {
  const workspace = await context.store.getWorkspace(
    decodeURIComponent(match[1])
  );
  if (!workspace) {
    text(context.response, 404, "Workspace not found");
    return;
  }

  let body: unknown;
  try {
    body = await readBody(context.request);
  } catch {
    text(context.response, 400, "Invalid thread payload");
    return;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    text(context.response, 400, "Invalid thread payload");
    return;
  }

  const title = (body as { title?: unknown }).title;
  if (typeof title !== "string") {
    text(context.response, 400, "Invalid thread payload");
    return;
  }

  const normalizedTitle = title.trim();
  if (!normalizedTitle || /[\r\n]/.test(title)) {
    text(context.response, 400, "Invalid thread payload");
    return;
  }

  const thread = await createThread(workspace.rootPath, normalizedTitle);
  try {
    await rebuildThreadIndexInBackground(workspace.rootPath);
  } catch {
    context.events.scheduleThreadIndexRebuild(workspace);
  }

  context.events.send("workspace-changed", {
    workspaceId: workspace.id,
    threadId: thread.id,
    at: new Date().toISOString()
  });
  json(context.response, 201, thread);
}
