import { isRecord } from "../core/activation-rules.js";
import { isFixedStage, type FixedStage } from "../core/activation-stages.js";
import type { WorkspaceInfo } from "../core/types.js";
import {
  ADVANCE_TIMEOUT_MS,
  activationRouteOf,
  postActivation,
  type ActivationReply
} from "./activation-client.js";
import type { IdentityFields } from "./session-identity.js";
import type { McpOptions } from "./types.js";

/** The advance the agent asked for: the destination, and the identity of its session. */
export type AdvanceRequest = { to: string; identity: IdentityFields };

/**
 * What the daemon answered for one advance. An answer that never came (no answer, a timeout, a
 * missing daemon) is unknown: the advance may or may not have happened, so it is never repeated.
 */
export type AdvanceReport =
  | { decision: "done"; stage: FixedStage; operationId: string }
  | { decision: "refused"; reason: string }
  | { decision: "unknown" };

/**
 * Asks the daemon to grant the advance inside the thread's queue. The grant is the daemon's; this
 * function only reports what it heard.
 */
export async function prepareAdvance(
  options: McpOptions,
  info: WorkspaceInfo,
  threadId: string,
  agentId: string,
  expectedStage: FixedStage,
  request: AdvanceRequest
): Promise<AdvanceReport> {
  const reply = await postActivation(
    options,
    activationRouteOf(info, threadId, "agent-advance"),
    {
      agentId,
      expectedStage,
      advanceTo: request.to,
      identity: request.identity
    },
    timeoutOf(options)
  );
  return reportOf(reply);
}

/**
 * Confirms, after the write, that the message carries the granted operation. The answer is true only
 * when the daemon accepted the confirmation with a 200.
 */
export async function confirmAdvance(
  options: McpOptions,
  info: WorkspaceInfo,
  threadId: string,
  agentId: string,
  operationId: string,
  messageId: string
): Promise<boolean> {
  const reply = await postActivation(
    options,
    activationRouteOf(info, threadId, "agent-advance/confirm"),
    { agentId, operationId, messageId },
    timeoutOf(options)
  );
  return reply.ok && reply.status === 200;
}

function timeoutOf(options: McpOptions): number {
  return options.activationTimeoutMs ?? ADVANCE_TIMEOUT_MS;
}

/** Dispatch of the daemon's answer: a granted 200, a refusal 409 with its reason, anything else unknown. */
function reportOf(reply: ActivationReply): AdvanceReport {
  if (!reply.ok) return { decision: "unknown" };
  if (reply.status === 200 && isDoneBody(reply.body)) {
    return {
      decision: "done",
      stage: reply.body.stage,
      operationId: reply.body.operationId
    };
  }
  if (reply.status === 409 && isRefusedBody(reply.body)) {
    return { decision: "refused", reason: reply.body.reason };
  }
  return { decision: "unknown" };
}

type DoneBody = { decision: "done"; stage: FixedStage; operationId: string };
type RefusedBody = { decision: "refused"; reason: string };

function isDoneBody(value: unknown): value is DoneBody {
  if (!isRecord(value)) return false;
  return (
    value.decision === "done" &&
    isFixedStage(value.stage) &&
    typeof value.operationId === "string"
  );
}

function isRefusedBody(value: unknown): value is RefusedBody {
  if (!isRecord(value)) return false;
  return value.decision === "refused" && typeof value.reason === "string";
}
