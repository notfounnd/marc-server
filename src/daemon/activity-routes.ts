import { json, text } from "./http.js";
import { buildThreadActivity } from "./activity-snapshot.js";
import type { ActivationServices } from "./activation-routes.js";
import { threadFor, type TargetContext } from "./route-targets.js";

export type ActivityRouteContext = TargetContext & {
  activation: ActivationServices;
};

type RouteMatch = RegExpExecArray;

export const ACTIVITY_ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handle: (context: ActivityRouteContext, match: RouteMatch) => Promise<void>;
}> = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/activity$/,
    handle: getThreadActivity
  }
];

/**
 * Route: GET /api/workspaces/:id/threads/:threadId/activity. Read-only. The MCP asks it
 * while a thread closes; a 503 there means the section is recorded as unavailable.
 */
async function getThreadActivity(
  context: ActivityRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const snapshot = await buildThreadActivity({
    workspace: target.workspace,
    threadId: target.threadId,
    threadCreatedAt: target.thread.createdAt,
    threads: context.activation.threads,
    workspaces: context.activation.workspaces
  });
  if (!snapshot) {
    return text(context.response, 503, "Thread state is unavailable");
  }
  json(context.response, 200, snapshot);
}
