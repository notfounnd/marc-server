import { derivedLeadOf } from "../core/activation-floor.js";
import {
  appendLeadChange,
  effectiveLeadOf,
  leadChangeRefusal,
  type LeadChange
} from "../core/activation-lead.js";
import { isRecord } from "../core/activation-rules.js";
import { messagesOfThreadInWorkspace } from "../core/threads.js";
import type { WorkspaceInfo } from "../core/types.js";
import { architectIdsOf } from "./activation-reservation-store.js";
import { emitChanged, invalidBody, refuse } from "./activation-route-io.js";
import type {
  ActivationRoute,
  ActivationRouteContext
} from "./activation-routes.js";
import { json, readBody } from "./http.js";
import { threadFor } from "./route-targets.js";
import { scopeOf, type ActivationServices } from "./activation-views.js";
import type { ThreadUpdate } from "./thread-store.js";
import { reasonOf } from "./activation-ledger.js";

type RouteMatch = RegExpExecArray;

/** The human's request to change the lead: the new lead, and the lead the human saw. */
export type LeadRequest = { agentId: string; expectedLead: string | null };

export type LeadOutcome =
  | { decision: "changed"; lead: string }
  | { decision: "refused"; reason: string };

export const LEAD_ROUTES: ActivationRoute[] = [
  {
    method: "PUT",
    pattern: /^\/api\/workspaces\/([^/]+)\/threads\/([^/]+)\/activation\/lead$/,
    handle: putLead
  }
];

/**
 * Route: PUT /api/workspaces/:id/threads/:threadId/activation/lead. Only the human sends it, and only
 * an architect profile can become the lead. A change moves the lead and nothing else: the budget and
 * the stage stay as they are.
 */
async function putLead(
  context: ActivationRouteContext,
  match: RouteMatch
): Promise<void> {
  const target = await threadFor(context, match[1], match[2]);
  if (!target) return;
  const request = leadRequestOf(await readBody(context.request));
  if (request === undefined) return invalidBody(context.response);
  const outcome = await changeLeadIn(
    context.activation,
    target.workspace,
    target.threadId,
    request,
    new Date().toISOString()
  );
  if (outcome.decision === "refused") {
    return refuse(context.response, outcome.reason, 409);
  }
  emitChanged(context, target.workspace.id, target.threadId);
  json(context.response, 200, outcome);
}

/**
 * The lead change inside the thread's queue. The current lead, the architect check and the expected
 * lead are judged on the same state the change writes, and the derived lead is read from CHAT.md
 * inside the same step.
 */
export async function changeLeadIn(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string,
  request: LeadRequest,
  now: string
): Promise<LeadOutcome> {
  const result = await services.threads.update<LeadOutcome>(
    scopeOf(workspace, threadId),
    async (file) => {
      const messages = await messagesOfThreadInWorkspace(workspace, threadId);
      const architects = await architectIdsOf(workspace);
      const current = effectiveLeadOf(
        derivedLeadOf(messages, architects),
        file.lead,
        architects
      );
      const refusal = leadChangeRefusal({
        current,
        expectedLead: request.expectedLead,
        agentId: request.agentId,
        architect: architects.has(request.agentId)
      });
      if (refusal !== undefined) {
        return { value: { decision: "refused", reason: refusal } };
      }
      const change: LeadChange = {
        at: now,
        to: request.agentId,
        by: "human",
        ...(current === undefined ? {} : { from: current })
      };
      return {
        value: { decision: "changed", lead: request.agentId },
        file: {
          ...file,
          lead: request.agentId,
          leadChanges: appendLeadChange(file.leadChanges, change)
        }
      };
    }
  );
  return leadOutcomeOf(result);
}

function leadOutcomeOf(result: ThreadUpdate<LeadOutcome>): LeadOutcome {
  if (result.status === "invalid") {
    return { decision: "refused", reason: reasonOf(result.reason) };
  }
  if (result.status === "closed") {
    return { decision: "refused", reason: "thread_closed" };
  }
  return result.value;
}

function leadRequestOf(body: unknown): LeadRequest | undefined {
  if (!isRecord(body)) return undefined;
  const { agentId, expectedLead } = body;
  if (typeof agentId !== "string" || agentId.length === 0) return undefined;
  if (expectedLead !== null && typeof expectedLead !== "string") {
    return undefined;
  }
  return { agentId, expectedLead };
}
