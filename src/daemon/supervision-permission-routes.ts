import { timingSafeEqual } from "node:crypto";
import { sameStart } from "../core/process-identity.js";
import { slotKey } from "../core/session-slots.js";
import {
  panelDecisionOf,
  requestBodyOf,
  type PermissionRequestBody
} from "../core/supervision-permissions.js";
import { emitChanged, invalidBody } from "./activation-route-io.js";
import type {
  ActivationRoute,
  ActivationRouteContext
} from "./activation-routes.js";
import { processesOf } from "./process-table-os.js";
import { json, readBody } from "./http.js";
import { threadFor } from "./route-targets.js";
import type { DecideOutcome } from "./supervision-permission-store.js";
import {
  DEFAULT_SUPERVISION_OPTIONS,
  type PermissionTarget,
  type SupervisionOptions
} from "./supervision-runner.js";
import type { ThreadFile } from "./thread-store.js";
import { listedStartOf } from "./supervision-turn-helpers.js";

type RouteMatch = RegExpExecArray;

type Refusal = { status: number; error: string };

type Check = (
  context: ActivationRouteContext,
  target: PermissionTarget,
  body: PermissionRequestBody
) => Promise<Refusal | undefined>;

const NOT_LIVE: Refusal = { status: 404, error: "run_not_found" };
const NOT_TURN_CHILD: Refusal = { status: 403, error: "not_turn_child" };
const NOT_TURN_PROCESS: Refusal = { status: 403, error: "not_turn_process" };
const NOT_HELD: Refusal = { status: 404, error: "slot_not_held" };
const NOT_REQUEST: Refusal = { status: 404, error: "request_not_found" };
const ALREADY_DECIDED: Refusal = { status: 409, error: "already_decided" };

/**
 * The claims a create request must pass, in order. The MCP process reports its pid and parent pid; the
 * daemon accepts only a child of the turn's process. A check the operating system cannot make (no table,
 * no agents source) passes, and the bearer token and the run id stay the checks it does make.
 */
const CHECKS: readonly Check[] = [
  checkParent,
  checkProcessTable,
  checkTurnStartInstant,
  checkSlotHeld
];

/** The MCP process is a direct child of the turn: its parent pid is the turn's pid. */
async function checkParent(
  _context: ActivationRouteContext,
  target: PermissionTarget,
  body: PermissionRequestBody
): Promise<Refusal | undefined> {
  if (body.ppid === target.pid) return undefined;
  return NOT_TURN_CHILD;
}

/** The OS table, when it can be read, must list the MCP process with the turn as its parent. */
async function checkProcessTable(
  context: ActivationRouteContext,
  target: PermissionTarget,
  body: PermissionRequestBody
): Promise<Refusal | undefined> {
  const read = await processesOf(context.sessions.processes).list();
  if (read.status !== "available") return undefined;
  const row = read.rows.find((candidate) => candidate.pid === body.pid);
  if (row?.ppid === target.pid) return undefined;
  return NOT_TURN_CHILD;
}

/** The turn's process keeps the start instant it had at launch, when the agents source still lists it. */
async function checkTurnStartInstant(
  context: ActivationRouteContext,
  target: PermissionTarget
): Promise<Refusal | undefined> {
  if (target.startedAt === undefined) return undefined;
  const listed = await listedStartOf(context.sessions.presence, target.pid);
  if (listed === undefined) return undefined;
  if (sameStart(target.startedAt, listed)) return undefined;
  return NOT_TURN_PROCESS;
}

/**
 * The slot the run holds is read now, in the thread's queue, the same way the heartbeat reads it: the binding
 * must be the supervisor's, of the run's generation, owned by the run's owner token, and not ended. A binding
 * taken by a manual open, a new generation, or a missing binding refuses the request.
 */
async function checkSlotHeld(
  context: ActivationRouteContext,
  target: PermissionTarget
): Promise<Refusal | undefined> {
  const result = await context.activation.threads.update<boolean>(
    { workspaceId: target.workspaceId, threadId: target.threadId },
    (file) => ({ value: holds(file, target) })
  );
  if (result.status !== "done") return NOT_HELD;
  if (result.value) return undefined;
  return NOT_HELD;
}

function holds(file: ThreadFile, target: PermissionTarget): boolean {
  const binding = file.slots[slotKey(target.slot)];
  if (binding === undefined) return false;
  if (binding.endedAt !== undefined) return false;
  if (binding.origin !== "supervisor") return false;
  if (binding.generation !== target.generation) return false;
  return sameToken(binding.owner.ownerToken, target.ownerToken);
}

/** Compares two owner tokens in constant time. A missing token, or one of another length, is another owner. */
function sameToken(expected: string | undefined, actual: string): boolean {
  if (expected === undefined) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Whether the target read after the checks is the one they passed: the same process, generation, slot and
 * owner. An absent target, a run that ended, or another owner is another target.
 */
function sameTarget(
  expected: PermissionTarget,
  actual: PermissionTarget | undefined
): boolean {
  if (actual === undefined) return false;
  if (actual.pid !== expected.pid) return false;
  if (actual.generation !== expected.generation) return false;
  if (slotKey(actual.slot) !== slotKey(expected.slot)) return false;
  return sameToken(expected.ownerToken, actual.ownerToken);
}

async function refusalOf(
  context: ActivationRouteContext,
  target: PermissionTarget,
  body: PermissionRequestBody
): Promise<Refusal | undefined> {
  for (const check of CHECKS) {
    const refusal = await check(context, target, body);
    if (refusal !== undefined) return refusal;
  }
  return undefined;
}

function optionsOf(context: ActivationRouteContext): SupervisionOptions {
  return context.activation.supervision ?? DEFAULT_SUPERVISION_OPTIONS;
}

function refuse(context: ActivationRouteContext, refusal: Refusal): void {
  return json(context.response, refusal.status, { error: refusal.error });
}

/** The body of a request, or undefined when it cannot be read as JSON. */
async function bodyOf(context: ActivationRouteContext): Promise<unknown> {
  try {
    return await readBody(context.request);
  } catch {
    return undefined;
  }
}

/**
 * Route: POST /api/supervision/runs/:runId/permissions. Only a live run's child process may open a request,
 * so a run id on its own opens nothing. The checks wait on the process table and the agents source, so the
 * run's target is read again after them, and the request opens only when that target is the one the checks
 * passed: a turn that ended or changed in the meantime refuses it. The re-read and the open are synchronous,
 * with no await between them. A refusal records nothing.
 */
async function createPermission(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const runId = decodeURIComponent(match[1]);
  const options = optionsOf(context);
  const target = options.runner.permissionTarget?.(runId);
  if (target === undefined) return refuse(context, NOT_LIVE);
  const body = requestBodyOf(await bodyOf(context));
  if (body === undefined) return invalidBody(context.response);
  const refusal = await refusalOf(context, target, body);
  if (refusal !== undefined) return refuse(context, refusal);
  const current = options.runner.permissionTarget?.(runId);
  if (!sameTarget(target, current)) return refuse(context, NOT_LIVE);
  const record = options.permissions.open({
    runId,
    workspaceId: target.workspaceId,
    threadId: target.threadId,
    toolName: body.toolName,
    input: body.input
  });
  return json(context.response, 201, { requestId: record.requestId });
}

/** Route: GET /api/supervision/runs/:runId/permissions/:requestId. The MCP process reads the decision here. */
async function readPermission(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const reply = optionsOf(context).permissions.query(
    decodeURIComponent(match[1]),
    decodeURIComponent(match[2])
  );
  if (reply === undefined) return refuse(context, NOT_REQUEST);
  return json(context.response, 200, reply);
}

/**
 * Route: POST .../activation/supervision/permissions/:requestId, the panel's decision. The decision comes
 * from the panel only: no agent route answers a request.
 */
async function decidePermission(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const decision = panelDecisionOf(await bodyOf(context));
  if (decision === undefined) return invalidBody(context.response);
  const outcome = optionsOf(context).permissions.decide({
    workspaceId: target.workspace.id,
    threadId: target.threadId,
    requestId: decodeURIComponent(match[3]),
    decision
  });
  return answerDecision(context, target.workspace.id, target.threadId, outcome);
}

/** A decision on a request already decided, or of a run that ended, is 409 and changes nothing. */
function answerDecision(
  context: ActivationRouteContext,
  workspaceId: string,
  threadId: string,
  outcome: DecideOutcome
): void {
  if (outcome.outcome === "not_found") return refuse(context, NOT_REQUEST);
  if (outcome.outcome === "conflict") {
    return json(context.response, ALREADY_DECIDED.status, {
      error: ALREADY_DECIDED.error,
      status: outcome.status
    });
  }
  emitChanged(context, workspaceId, threadId);
  return json(context.response, 200, { status: outcome.status });
}

const PANEL_DECISION_PATTERN =
  "^/api/workspaces/([^/]+)/threads/([^/]+)/activation/supervision/permissions/([^/]+)$";

export const PERMISSION_ROUTES: ActivationRoute[] = [
  {
    method: "POST",
    pattern: /^\/api\/supervision\/runs\/([^/]+)\/permissions$/,
    handle: createPermission
  },
  {
    method: "GET",
    pattern: /^\/api\/supervision\/runs\/([^/]+)\/permissions\/([^/]+)$/,
    handle: readPermission
  },
  {
    method: "POST",
    pattern: new RegExp(PANEL_DECISION_PATTERN),
    handle: decidePermission
  }
];
