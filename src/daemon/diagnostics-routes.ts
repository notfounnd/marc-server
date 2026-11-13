import { json } from "./http.js";
import type { ActivationServices } from "./activation-routes.js";
import { buildThreadDiagnostics } from "./diagnostics-view.js";
import { threadFor, type TargetContext } from "./route-targets.js";
import type { SessionServices } from "./session-views.js";

export type DiagnosticsRouteContext = TargetContext & {
  activation: ActivationServices;
  sessions: SessionServices;
};

type RouteMatch = RegExpExecArray;

/** Registered in the state route table. The server already requires the token for every /api route. */
export const DIAGNOSTICS_ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handle: (
    context: DiagnosticsRouteContext,
    match: RouteMatch
  ) => Promise<void>;
}> = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/diagnostics$/,
    handle: getThreadDiagnostics
  }
];

/**
 * Route: GET /api/workspaces/:id/threads/:threadId/diagnostics. Read-only, and it answers for a closed
 * thread too. An unknown workspace or thread is a 404 from the target lookup.
 */
async function getThreadDiagnostics(
  context: DiagnosticsRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const view = await buildThreadDiagnostics({
    workspace: target.workspace,
    threadId: target.threadId,
    threads: context.activation.threads,
    sessions: context.sessions
  });
  json(context.response, 200, view);
}
