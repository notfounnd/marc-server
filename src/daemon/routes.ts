import type http from "node:http";
import type { URL } from "node:url";
import type { WorkspaceInfo } from "../core/types.js";
import {
  attachArtifactToMessage,
  listAgentProfiles,
  listThreadsCached,
  readMessageArtifact,
  readRules,
  readThread,
  rebuildThreadIndexInBackground
} from "../core/workspace.js";
import {
  isWorkspaceInfo,
  json,
  readBody,
  text,
  threadListStatus
} from "./http.js";
import type { UiEventBus } from "./events.js";
import { postWorkspaceThreadMessage } from "./message-routes.js";
import { postWorkspaceMemoryRecall } from "./memory-routes.js";
import type { DaemonStore } from "./store.js";

type RouteContext = {
  events: UiEventBus;
  request: http.IncomingMessage;
  response: http.ServerResponse;
  store: DaemonStore;
  url: URL;
};

type RouteMatch = RegExpExecArray;
type RouteHandler = (context: RouteContext, match: RouteMatch) => Promise<void>;
type Route = {
  method: string;
  pattern: RegExp;
  handle: RouteHandler;
};

type ArtifactBody = Partial<{
  content: string;
  fileName: string;
}>;

async function workspaceOr404(
  context: RouteContext,
  workspaceId: string
): Promise<WorkspaceInfo | undefined> {
  const workspace = await context.store.getWorkspace(
    decodeURIComponent(workspaceId)
  );
  if (workspace) return workspace;
  text(context.response, 404, "Workspace not found");
  return undefined;
}

async function postWorkspace(context: RouteContext): Promise<void> {
  const body = await readBody(context.request);
  if (!isWorkspaceInfo(body)) {
    text(context.response, 400, "Invalid workspace payload");
    return;
  }

  const workspace = await context.store.upsertWorkspace(body);
  await rebuildThreadIndexInBackground(workspace.rootPath);
  await context.events.watchWorkspace(workspace);
  context.events.send("workspace-registered", {
    workspaceId: workspace.id,
    at: new Date().toISOString()
  });
  json(context.response, 200, workspace);
}

async function deleteWorkspace(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspaceId = decodeURIComponent(match[1]);
  const workspace = await context.store.removeWorkspace(workspaceId);
  if (!workspace) {
    text(context.response, 404, "Workspace not found");
    return;
  }

  context.events.unwatchWorkspace(workspaceId);
  context.events.send("workspace-unregistered", {
    workspaceId,
    at: new Date().toISOString()
  });
  json(context.response, 200, { removed: workspace });
}

async function listWorkspaceThreads(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceOr404(context, match[1]);
  if (!workspace) return;

  const threads = await listThreadsCached(workspace.rootPath, {
    status: threadListStatus(context.url.searchParams.get("status"))
  });
  context.events.scheduleFallbackRebuild(workspace);
  json(context.response, 200, threads);
}

async function readWorkspaceRules(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceOr404(context, match[1]);
  if (!workspace) return;
  json(context.response, 200, {
    markdown: await readRules(workspace.rootPath)
  });
}

async function listWorkspaceAgents(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceOr404(context, match[1]);
  if (!workspace) return;
  json(
    context.response,
    200,
    await listAgentProfiles(workspace.rootPath, { includeMarkdown: true })
  );
}

async function readWorkspaceThread(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceOr404(context, match[1]);
  if (!workspace) return;
  json(
    context.response,
    200,
    await readThread(workspace.rootPath, decodeURIComponent(match[2]))
  );
}

async function readArtifact(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceOr404(context, match[1]);
  if (!workspace) return;

  json(
    context.response,
    200,
    await readMessageArtifact(
      workspace.rootPath,
      decodeURIComponent(match[2]),
      decodeURIComponent(match[3]),
      decodeURIComponent(match[4])
    )
  );
}

async function postArtifact(
  context: RouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceOr404(context, match[1]);
  if (!workspace) return;

  const threadId = decodeURIComponent(match[2]);
  const messageId = decodeURIComponent(match[3]);
  const body = (await readBody(context.request)) as ArtifactBody;
  if (!body.fileName || !body.content) {
    text(context.response, 400, "fileName and content are required");
    return;
  }

  const thread = await readThread(workspace.rootPath, threadId);
  const message = thread.messages?.find((item) => item.id === messageId);
  if (!message) {
    text(context.response, 404, "Message not found");
    return;
  }
  if (message.role !== "user") {
    text(
      context.response,
      403,
      "Artifacts can only be attached to UI user messages"
    );
    return;
  }

  const artifact = await attachArtifactToMessage(
    workspace.rootPath,
    threadId,
    messageId,
    body.fileName,
    body.content
  );
  context.events.send("workspace-changed", {
    workspaceId: workspace.id,
    threadId,
    at: new Date().toISOString()
  });
  json(context.response, 200, { artifact });
}

const routes: Route[] = [
  { method: "POST", pattern: /^\/api\/workspaces$/, handle: postWorkspace },
  {
    method: "DELETE",
    pattern: /^\/api\/workspaces\/([^/]+)$/,
    handle: deleteWorkspace
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads$/,
    handle: listWorkspaceThreads
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/rules$/,
    handle: readWorkspaceRules
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/agents$/,
    handle: listWorkspaceAgents
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/memory\/recall$/,
    handle: (context, match) => postWorkspaceMemoryRecall(context, match[1])
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)$/,
    handle: readWorkspaceThread
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)$/,
    handle: (context, match) =>
      postWorkspaceThreadMessage(context, match[1], match[2])
  },
  {
    method: "GET",
    pattern:
      /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/messages\/([^/]+)\/artifacts\/([^/]+)$/,
    handle: readArtifact
  },
  {
    method: "POST",
    pattern:
      /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/messages\/([^/]+)\/artifacts$/,
    handle: postArtifact
  }
];

export async function handleDaemonRoute(
  context: RouteContext
): Promise<boolean> {
  for (const route of routes) {
    if (context.request.method !== route.method) continue;
    const match = route.pattern.exec(context.url.pathname);
    if (!match) continue;
    await route.handle(context, match);
    return true;
  }

  return false;
}
