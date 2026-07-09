import type http from "node:http";
import { appendMessage, registerAgent } from "../core/workspace.js";
import { json, readBody, text } from "./http.js";
import type { UiEventBus } from "./events.js";
import type { DaemonStore } from "./store.js";

type MessageRouteContext = {
  events: UiEventBus;
  request: http.IncomingMessage;
  response: http.ServerResponse;
  store: DaemonStore;
};

type PostThreadBody = Partial<{
  agentId: string;
  displayName: string;
  role: string;
  message: string;
}>;

export async function postWorkspaceThreadMessage(
  context: MessageRouteContext,
  workspaceId: string,
  threadId: string
): Promise<void> {
  const workspace = await context.store.getWorkspace(
    decodeURIComponent(workspaceId)
  );
  if (!workspace) {
    text(context.response, 404, "Workspace not found");
    return;
  }

  const body = (await readBody(context.request)) as PostThreadBody;
  if (!body.agentId || !body.message) {
    text(context.response, 400, "agentId and message are required");
    return;
  }

  const decodedThreadId = decodeURIComponent(threadId);
  await registerAgent(workspace.rootPath, {
    description: "Posted from the mARC web UI.",
    displayName: body.displayName,
    id: body.agentId,
    model: "human",
    role: body.role ?? "user"
  });
  const message = await appendMessage(workspace.rootPath, decodedThreadId, {
    agentId: body.agentId,
    body: body.message,
    role: body.role ?? "user"
  });
  context.events.send("workspace-changed", {
    at: new Date().toISOString(),
    threadId: decodedThreadId,
    workspaceId: workspace.id
  });
  json(context.response, 200, message);
}
