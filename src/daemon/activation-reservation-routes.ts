import { invalidBody, textFieldsOf } from "./activation-route-io.js";
import type {
  ActivationRoute,
  ActivationRouteContext
} from "./activation-routes.js";
import { reserveIn } from "./activation-reservation-store.js";
import { confirmIn, prepareStampIn } from "./activation-stamp-store.js";
import { scopeOf } from "./activation-views.js";
import { json, readBody } from "./http.js";
import { threadFor } from "./route-targets.js";
import { waiterIdentityOf } from "./waiter-identity.js";

type RouteMatch = RegExpExecArray;

const THREAD_PREFIX = "^/api/workspaces/([^/]+)/threads/([^/]+)/activation";

/**
 * The reservation and stamp routes of F3b. They sit under the thread's activation prefix. Only the
 * daemon reads the author, the mentions and the stamp, from CHAT.md. The callers name a holder and a
 * run, never a sender. The agent's advance has its own routes in the stage routes module.
 */
export const RESERVATION_ROUTES: ActivationRoute[] = [
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/reservations$`),
    handle: postReservation
  },
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/stamp$`),
    handle: postStamp
  },
  {
    method: "POST",
    pattern: new RegExp(`${THREAD_PREFIX}/stamp/confirm$`),
    handle: postStampConfirm
  }
];

/** Route: POST .../activation/reservations. The body names the message, the recipient, the holder and the run. */
async function postReservation(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const raw = await readBody(context.request);
  const body = textFieldsOf(raw, ["messageId", "recipient", "holder", "runId"]);
  if (body === undefined) return invalidBody(context.response);
  const identity = waiterIdentityOf(context.sessions, {
    workspace: target.workspace,
    threadId: target.threadId,
    recipient: body.recipient,
    holder: body.holder,
    pid: pidOf(raw)
  });
  const response = await reserveIn(
    context.activation,
    target.workspace,
    target.threadId,
    body,
    identity
  );
  json(context.response, 200, response);
}

/** The waiter's pid, when the body carries a positive integer. Anything else leaves the identity unverified. */
function pidOf(raw: unknown): number | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const pid = (raw as Record<string, unknown>).pid;
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 1) {
    return undefined;
  }
  return pid;
}

/** Route: POST .../activation/stamp. Read-only: the stage, the cycle, the open reservation key and the current stage. */
async function postStamp(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const body = textFieldsOf(await readBody(context.request), ["agentId"]);
  if (body === undefined) return invalidBody(context.response);
  const response = await prepareStampIn(
    context.activation.threads,
    scopeOf(target.workspace, target.threadId),
    body.agentId
  );
  json(
    context.response,
    response.decision === "unavailable" ? 409 : 200,
    response
  );
}

/** Route: POST .../activation/stamp/confirm. Marks the grant answered, after the message is persisted. */
async function postStampConfirm(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const body = textFieldsOf(await readBody(context.request), [
    "agentId",
    "messageId",
    "reservation"
  ]);
  if (body === undefined) return invalidBody(context.response);
  const response = await confirmIn(
    context.activation.threads,
    target.workspace,
    target.threadId,
    body
  );
  json(context.response, response.decision === "refused" ? 409 : 200, response);
}
