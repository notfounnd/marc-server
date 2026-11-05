import { randomUUID } from "node:crypto";
import { isRecord } from "../core/activation-rules.js";
import type { WorkspaceInfo } from "../core/types.js";
import {
  agentAdvanceIn,
  confirmAdvanceIn,
  identityDepsOf,
  verifyIdentityIn
} from "./activation-agent-advance.js";
import {
  emitChanged,
  invalidBody,
  refuse,
  textFieldsOf
} from "./activation-route-io.js";
import type {
  ActivationRoute,
  ActivationRouteContext
} from "./activation-routes.js";
import {
  advanceStage,
  extendStage,
  type StageActionOutcome
} from "./activation-stage-actions.js";
import { activationBody } from "./activation-views.js";
import { json, readBody } from "./http.js";
import type { ObservedIdentity } from "./presence.js";
import { threadFor } from "./route-targets.js";

type RouteMatch = RegExpExecArray;
type Target = { workspace: WorkspaceInfo; threadId: string };

const THREAD_PREFIX = "^/api/workspaces/([^/]+)/threads/([^/]+)/activation";

/**
 * The stage routes. The human's extend and advance, and the agent's advance and its confirmation,
 * judge their readiness and their authorization inside the thread's queue, in the step that writes.
 * No route reads that state first, so no route snapshot decides for them. The agent's identity is
 * verified before the queue; everything else is judged inside it.
 */
export const STAGE_ROUTES: ActivationRoute[] = [
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/extend$`),
    handle: postExtend
  },
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/advance$`),
    handle: postHumanAdvance
  },
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/agent-advance$`),
    handle: postAgentAdvance
  },
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/agent-advance/confirm$`),
    handle: postAgentAdvanceConfirm
  }
];

/** Route: POST .../activation/extend. Adds the authorized cycles as a grant to the current stage. */
async function postExtend(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const body = textFieldsOf(await readBody(context.request), ["expectedStage"]);
  if (body === undefined) return invalidBody(context.response);
  const outcome = await extendStage({
    services: context.activation,
    workspace: target.workspace,
    threadId: target.threadId,
    now: nowOf,
    expectedStage: body.expectedStage
  });
  return respondStage(context, target, outcome);
}

/**
 * Route: POST .../activation/advance. The human names the destination, which must be a fixed stage
 * strictly ahead of the one the human saw. An exhausted stage does not refuse the human.
 */
async function postHumanAdvance(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const body = textFieldsOf(await readBody(context.request), [
    "expectedStage",
    "to"
  ]);
  if (body === undefined) return invalidBody(context.response);
  const outcome = await advanceStage({
    services: context.activation,
    workspace: target.workspace,
    threadId: target.threadId,
    now: nowOf,
    expectedStage: body.expectedStage,
    to: body.to
  });
  return respondStage(context, target, outcome);
}

/**
 * Route: POST .../activation/agent-advance. The MCP sends the identity fields of its session, which
 * the daemon verifies against the slot before the queue. The outcome is the granted operation, with
 * the destination the message is stamped with, or a refusal with its reason.
 */
async function postAgentAdvance(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const raw = await readBody(context.request);
  const body = textFieldsOf(raw, ["agentId", "expectedStage", "advanceTo"]);
  if (body === undefined) return invalidBody(context.response);
  const identityVerified = await verifyIdentityIn(
    identityDepsOf(context.sessions, target.workspace),
    target.workspace,
    target.threadId,
    body.agentId,
    observedIdentityOf(isRecord(raw) ? raw.identity : undefined)
  );
  const outcome = await agentAdvanceIn({
    services: context.activation,
    workspace: target.workspace,
    threadId: target.threadId,
    agentId: body.agentId,
    expectedStage: body.expectedStage,
    advanceTo: body.advanceTo,
    identityVerified,
    operationId: randomUUID(),
    now: nowOf
  });
  if (outcome.decision === "refused") {
    return json(context.response, 409, outcome);
  }
  emitChanged(context, target.workspace.id, target.threadId);
  json(context.response, 200, outcome);
}

/** Route: POST .../activation/agent-advance/confirm. Marks the operation with the message written after it. */
async function postAgentAdvanceConfirm(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const body = textFieldsOf(await readBody(context.request), [
    "agentId",
    "operationId",
    "messageId"
  ]);
  if (body === undefined) return invalidBody(context.response);
  const outcome = await confirmAdvanceIn(
    context.activation,
    target.workspace,
    target.threadId,
    body
  );
  json(context.response, outcome.decision === "refused" ? 409 : 200, outcome);
}

async function respondStage(
  context: ActivationRouteContext,
  target: Target,
  outcome: StageActionOutcome
): Promise<void> {
  if (outcome.decision === "refused") {
    return refuse(context.response, outcome.reason, 409);
  }
  emitChanged(context, target.workspace.id, target.threadId);
  json(
    context.response,
    200,
    await activationBody(context.activation, target.workspace, target.threadId)
  );
}

function nowOf(): string {
  return new Date().toISOString();
}

/** The identity as the MCP's `identity.fields()` sends it. Without a native session, nothing can verify. */
function observedIdentityOf(value: unknown): ObservedIdentity | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.nativeSessionId !== "string" ||
    typeof value.hostId !== "string"
  )
    return undefined;
  if (!Number.isInteger(value.pid) || !Number.isInteger(value.ppid))
    return undefined;
  return {
    nativeSessionId: value.nativeSessionId,
    pid: Number(value.pid),
    ppid: Number(value.ppid),
    hostId: value.hostId
  };
}
