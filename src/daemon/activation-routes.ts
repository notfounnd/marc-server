import { randomUUID } from "node:crypto";
import type http from "node:http";
import {
  policyCandidate,
  saveErrorsOf,
  validatePolicy
} from "../core/activation-policy.js";
import { writeThreadPolicy } from "../core/activation-policy-store.js";
import { isRecord } from "../core/activation-rules.js";
import { listAgentProfiles } from "../core/workspace.js";
import type { StageMappingChoice } from "./activation-activity.js";
import {
  activationBody,
  scopeOf,
  type ActivationServices
} from "./activation-views.js";
import { json, readBody } from "./http.js";
import type { UiEventBus } from "./events.js";
import { RESERVATION_ROUTES } from "./activation-reservation-routes.js";
import { STAGE_ROUTES } from "./activation-stage-routes.js";
import { LEAD_ROUTES } from "./activation-lead-routes.js";
import { SUPERVISION_ROUTES } from "./activation-supervision-routes.js";
import { PERMISSION_ROUTES } from "./supervision-permission-routes.js";
import { emitChanged, refuse } from "./activation-route-io.js";
import type { SessionServices } from "./session-routes.js";
import {
  threadFor,
  workspaceFor,
  type TargetContext
} from "./route-targets.js";

export type { ActivationServices };

/** The route context. `sessions` is the one the daemon already builds for the session routes. */
export type ActivationRouteContext = TargetContext & {
  request: http.IncomingMessage;
  events: UiEventBus;
  activation: ActivationServices;
  sessions: SessionServices;
};

type RouteMatch = RegExpExecArray;

export type ActivationRoute = {
  method: string;
  pattern: RegExp;
  handle: (context: ActivationRouteContext, match: RouteMatch) => Promise<void>;
};

const BASE_ACTIVATION_ROUTES: ActivationRoute[] = [
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/activation$/,
    handle: (context, match) => getWorkspaceActivation(context, match[1])
  },
  {
    method: "GET",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/activation$/,
    handle: getThreadActivation
  },
  {
    method: "PUT",
    pattern:
      /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/activation\/policy$/,
    handle: putThreadPolicy
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/activation\/pause$/,
    handle: (context, match) => setPausedRoute(context, match[1], true)
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/activation\/resume$/,
    handle: (context, match) => setPausedRoute(context, match[1], false)
  },
  {
    method: "POST",
    pattern: /^\/api\/workspaces\/([^/]+)\/activation\/recover$/,
    handle: postRecover
  }
];

export const ACTIVATION_ROUTES: ActivationRoute[] = [
  ...BASE_ACTIVATION_ROUTES,
  ...STAGE_ROUTES,
  ...LEAD_ROUTES,
  ...RESERVATION_ROUTES,
  ...SUPERVISION_ROUTES,
  ...PERMISSION_ROUTES
];

/** Route: GET /api/workspaces/:id/activation. The pause alone, for the workspace view that has no thread. */
async function getWorkspaceActivation(
  context: ActivationRouteContext,
  workspaceParam: string
): Promise<void> {
  const workspace = await workspaceFor(context, workspaceParam);
  if (!workspace) return;
  const state = await context.activation.ledger.workspaceState(workspace.id);
  if (state.status === "invalid") {
    return refuse(context.response, state.reason, 409);
  }
  json(context.response, 200, {
    paused: state.paused,
    pausedAt: state.pausedAt ?? null
  });
}

/** Route: GET /api/workspaces/:id/threads/:threadId/activation */
async function getThreadActivation(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  json(
    context.response,
    200,
    await activationBody(context.activation, target.workspace, target.threadId)
  );
}

/**
 * Route: PUT /api/workspaces/:id/threads/:threadId/activation/policy. The body is the UI form
 * only, plus the optional stageMapping the human confirmed for an F3a stage. The ledger is
 * touched before the policy file, so a refused save writes nothing. A thread that closes during
 * the save is refused by the write itself, under the lock the summary write also takes.
 */
async function putThreadPolicy(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  if (target.thread.status === "closed") {
    return refuse(context.response, "thread_closed", 409);
  }
  const body = await readBody(context.request);
  const profiles = await listAgentProfiles(target.workspace.rootPath);
  const candidate = policyCandidate(
    body,
    randomUUID(),
    new Date().toISOString()
  );
  const result = validatePolicy(candidate);
  if (!result.ok) return json(context.response, 400, { errors: result.errors });
  const errors = saveErrorsOf(result.policy, profiles);
  if (errors.length > 0) return json(context.response, 400, { errors });

  const scope = scopeOf(target.workspace, target.threadId);
  const outcome = result.policy.enabled
    ? await context.activation.ledger.authorize(
        scope,
        result.policy,
        confirmedMappingOf(body)
      )
    : undefined;
  if (outcome?.decision === "refused") {
    return refuse(context.response, outcome.reason, 409);
  }
  if (outcome?.decision === "mapping_required") {
    return json(context.response, 409, {
      decision: "refused",
      reason: "stage_mapping_required",
      from: outcome.from,
      to: outcome.to
    });
  }
  const written = await writeThreadPolicy(
    target.workspace,
    target.threadId,
    result.policy
  );
  if (written === "closed") {
    return refuse(context.response, "thread_closed", 409);
  }
  emitChanged(context, target.workspace.id, target.threadId);
  json(
    context.response,
    200,
    await activationBody(context.activation, target.workspace, target.threadId)
  );
}

/** Route: POST /api/workspaces/:id/activation/pause and /resume */
async function setPausedRoute(
  context: ActivationRouteContext,
  workspaceParam: string,
  paused: boolean
): Promise<void> {
  const workspace = await workspaceFor(context, workspaceParam);
  if (!workspace) return;
  const result = await context.activation.ledger.setPaused(
    workspace.id,
    paused
  );
  if (result.decision === "refused") {
    return refuse(context.response, result.reason, 409);
  }
  emitChanged(context, workspace.id);
  json(context.response, 200, result);
}

/**
 * Route: POST /api/workspaces/:id/activation/recover. Human action only. It moves invalid
 * content aside and recreates the missing files without authorization, so every enabled
 * policy stays blocked until it is saved again.
 */
async function postRecover(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const workspace = await workspaceFor(context, match[1]);
  if (!workspace) return;
  const result = await context.activation.ledger.recover(workspace);
  if (result.decision === "refused") {
    return refuse(context.response, result.reason, 409);
  }
  emitChanged(context, workspace.id);
  json(context.response, 200, result);
}

function confirmedMappingOf(body: unknown): StageMappingChoice | undefined {
  if (!isRecord(body) || !isRecord(body.stageMapping)) return undefined;
  const { from, to } = body.stageMapping;
  if (typeof from !== "string" || typeof to !== "string") return undefined;
  return { from, to };
}
