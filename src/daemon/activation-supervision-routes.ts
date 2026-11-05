import {
  emitChanged,
  invalidBody,
  textFieldsOf
} from "./activation-route-io.js";
import type {
  ActivationRoute,
  ActivationRouteContext
} from "./activation-routes.js";
import { json, readBody } from "./http.js";
import { threadFor } from "./route-targets.js";
import { declineIn } from "./supervision-decline.js";
import { DEFAULT_SUPERVISION_OPTIONS } from "./supervision-runner.js";
import { startIn, type StartAction } from "./supervision-start.js";

type RouteMatch = RegExpExecArray;

const SUPERVISION_PREFIX =
  "^/api/workspaces/([^/]+)/threads/([^/]+)/activation/supervision";

/**
 * The supervisor's human actions: approve, retry and continue start a turn, and decline dismisses an
 * awaiting card. Each names a card by its message and recipient. Only the daemon reads the mention, from
 * CHAT.md, and the decisions come from the UI, never from an agent.
 */
export const SUPERVISION_ROUTES: ActivationRoute[] = [
  startRoute("approve"),
  startRoute("retry"),
  startRoute("continue"),
  {
    method: "POST",
    pattern: new RegExp(`${SUPERVISION_PREFIX}/decline$`),
    handle: postDecline
  },
  {
    method: "GET",
    pattern: /^\/api\/supervision\/runs\/([^/]+)\/notice$/,
    handle: getRunNotice
  }
];

/**
 * Route: GET /api/supervision/runs/:runId/notice. The deadline notice of a live run, behind the daemon
 * token like every API route. The MCP process of the turn reads it with the token it already holds; the
 * turn's own process never receives one. A run that is not live answers 404.
 */
async function getRunNotice(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const options = context.activation.supervision ?? DEFAULT_SUPERVISION_OPTIONS;
  const notice = options.runner.notice?.(decodeURIComponent(match[1]));
  if (notice === undefined) {
    return json(context.response, 404, { error: "run_not_found" });
  }
  return json(context.response, 200, notice);
}

function startRoute(action: StartAction): ActivationRoute {
  return {
    method: "POST",
    pattern: new RegExp(`${SUPERVISION_PREFIX}/${action}$`),
    handle: (context, match) => postStart(context, match, action)
  };
}

/** Route: POST .../activation/supervision/{approve,retry,continue}. The body names the message and the recipient. */
async function postStart(
  context: ActivationRouteContext,
  match: RouteMatch,
  action: StartAction
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const card = textFieldsOf(await readBody(context.request), [
    "messageId",
    "recipient"
  ]);
  if (card === undefined) return invalidBody(context.response);
  const options = context.activation.supervision ?? DEFAULT_SUPERVISION_OPTIONS;
  const outcome = await startIn(
    {
      services: context.activation,
      sessions: context.sessions,
      options,
      workspace: target.workspace,
      threadId: target.threadId
    },
    action,
    card
  );
  if (outcome.started !== undefined) {
    options.runner.start(
      { workspace: target.workspace, threadId: target.threadId },
      outcome.started
    );
  }
  return answer(
    context,
    target.workspace.id,
    target.threadId,
    outcome.response
  );
}

/** Route: POST .../activation/supervision/decline. Only an awaiting card can be declined. */
async function postDecline(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const card = textFieldsOf(await readBody(context.request), [
    "messageId",
    "recipient"
  ]);
  if (card === undefined) return invalidBody(context.response);
  const response = await declineIn(
    context.activation,
    target.workspace,
    target.threadId,
    card
  );
  return answer(context, target.workspace.id, target.threadId, response);
}

/** A refusal is 409 with its reason and the card's state, and nothing was written. A success is 200 and emits the change. */
function answer(
  context: ActivationRouteContext,
  workspaceId: string,
  threadId: string,
  response: { decision: string }
): void {
  if (response.decision === "refused") {
    return json(context.response, 409, response);
  }
  emitChanged(context, workspaceId, threadId);
  json(context.response, 200, response);
}
