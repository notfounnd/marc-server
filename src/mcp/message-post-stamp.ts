import {
  readThreadPolicy,
  type ThreadPolicyRead
} from "../core/activation-policy-store.js";
import {
  appendStampedMessageInWorkspace,
  appendMessageInWorkspace
} from "../core/threads.js";
import { isRecord } from "../core/activation-rules.js";
import { isFixedStage, type FixedStage } from "../core/activation-stages.js";
import { initWorkspace } from "../core/workspace.js";
import type {
  ChatMessage,
  MessageInput,
  WorkspaceInfo
} from "../core/types.js";
import {
  activationRouteOf,
  postActivation,
  STAMP_TIMEOUT_MS
} from "./activation-client.js";
import {
  confirmAdvance,
  prepareAdvance,
  type AdvanceReport,
  type AdvanceRequest
} from "./advance-call.js";
import type { McpOptions } from "./types.js";

type Stamp = Parameters<typeof appendStampedMessageInWorkspace>[3];

/** The advance as the caller learns it: granted (with the message that carries it), refused, or unknown. */
export type AdvancePosted =
  | { decision: "advanced"; stage: FixedStage; reference: string | null }
  | { decision: "refused"; reason: string }
  | { decision: "unknown" };

/**
 * The posted message, with every activation warning it carries and the advance outcome when one was
 * asked. The advance warning comes first, then one `activation_confirm_failed` per failed confirmation
 * kind, each listed once.
 */
export type PostedMessage = ChatMessage & {
  warnings: string[];
  advance?: AdvancePosted;
};

type Extras = { warnings: string[]; advance?: AdvancePosted };

const CONFIRM_FAILED = "activation_confirm_failed";

type PreparedOk = {
  ok: true;
  stamp: Stamp;
  reservation: string | undefined;
  /** The stage the thread stands on now. Absent only from a daemon that predates the advance. */
  expectedStage: FixedStage | undefined;
};

type Prepared = PreparedOk | { ok: false };

/** How one post is written: the stamp, the operation to confirm, and what the caller learns. */
type AdvancePlan = Extras & { stamp: Stamp; operationId?: string };

/** An unknown stage is not a stamp: the daemon's answer is then treated as unavailable. */
type StampBody = {
  decision: "stamp";
  stage: FixedStage;
  cycle?: number;
  reservation?: string;
  expectedStage?: FixedStage;
};

/**
 * Posts a message. In a thread whose policy is enabled (or unreadable), the stamp is prepared before
 * the write and confirmed after it. With `advance`, the daemon grants the advance first; a granted
 * advance stamps the message with the destination and no cycle, and the grant is confirmed with the
 * message. The post is never blocked: an activation failure writes the message and reports why.
 */
export async function postMessageWithActivation(
  options: McpOptions,
  workspaceRoot: string,
  threadId: string,
  input: MessageInput,
  advance?: AdvanceRequest
): Promise<PostedMessage> {
  const info = await initWorkspace(workspaceRoot);
  if (!(await isGoverned(info, threadId))) {
    return plainPost(
      info,
      threadId,
      input,
      refusedAdvance(advance, "policy_disabled")
    );
  }
  const prepared = await prepare(options, info, threadId, input.agentId);
  if (!prepared.ok) {
    return plainPost(info, threadId, input, stampUnavailable(advance));
  }
  const plan = await planAdvance(
    options,
    info,
    threadId,
    input.agentId,
    prepared,
    advance
  );
  const message = await appendStampedMessageInWorkspace(
    info,
    threadId,
    input,
    plan.stamp
  );
  return settle(
    options,
    info,
    threadId,
    input.agentId,
    message,
    prepared.reservation,
    plan
  );
}

async function isGoverned(
  info: WorkspaceInfo,
  threadId: string
): Promise<boolean> {
  return governedOf(await readThreadPolicy(info, threadId));
}

/** An enabled policy governs; an unreadable one counts as governed, so the daemon decides. */
function governedOf(read: ThreadPolicyRead): boolean {
  if (read.status === "none") return false;
  if (read.status === "invalid") return true;
  if (read.status === "outdated") return read.enabled;
  return read.policy.enabled;
}

/** A post without a stamp: the thread is not governed, so no advance was asked of the daemon. */
function refusedAdvance(
  advance: AdvanceRequest | undefined,
  reason: string
): Extras {
  if (advance === undefined) return { warnings: [] };
  return {
    warnings: ["stage_advance_refused"],
    advance: { decision: "refused", reason }
  };
}

/** The stamp could not be prepared, so the advance cannot be judged against the stage it saw. */
function stampUnavailable(advance: AdvanceRequest | undefined): Extras {
  if (advance === undefined)
    return { warnings: ["activation_stamp_unavailable"] };
  return {
    warnings: ["activation_stamp_unavailable"],
    advance: { decision: "refused", reason: "stamp_unavailable" }
  };
}

async function prepare(
  options: McpOptions,
  info: WorkspaceInfo,
  threadId: string,
  agentId: string
): Promise<Prepared> {
  const reply = await postActivation(
    options,
    activationRouteOf(info, threadId, "stamp"),
    { agentId },
    timeoutOf(options)
  );
  if (!reply.ok || reply.status !== 200) return { ok: false };
  if (!isStampBody(reply.body)) return { ok: false };
  return {
    ok: true,
    stamp: { stage: reply.body.stage, cycle: reply.body.cycle },
    reservation: reply.body.reservation,
    expectedStage: reply.body.expectedStage
  };
}

/**
 * The advance step before the write. Without an advance, the message keeps the stamp of the stage the
 * thread stands on. With one, the daemon grants or refuses it, and only a grant changes the stamp.
 */
async function planAdvance(
  options: McpOptions,
  info: WorkspaceInfo,
  threadId: string,
  agentId: string,
  prepared: PreparedOk,
  advance: AdvanceRequest | undefined
): Promise<AdvancePlan> {
  if (advance === undefined) return { stamp: prepared.stamp, warnings: [] };
  if (prepared.expectedStage === undefined) {
    return refusedPlan(prepared.stamp, "stamp_unavailable");
  }
  const report = await prepareAdvance(
    options,
    info,
    threadId,
    agentId,
    prepared.expectedStage,
    advance
  );
  return planOf(report, prepared.stamp);
}

type PlanTable = {
  [K in AdvanceReport["decision"]]: (
    report: Extract<AdvanceReport, { decision: K }>,
    origin: Stamp
  ) => AdvancePlan;
};

/**
 * The plan of each answer, in one table. A granted advance writes the destination stage with no
 * cycle; a refusal or an unknown answer keeps the stamp of the stage the thread stood on. An unknown
 * answer is never repeated, so the message stays the only write.
 */
const PLAN_OF: PlanTable = {
  done: (report) => ({
    stamp: { stage: report.stage },
    operationId: report.operationId,
    warnings: [],
    advance: { decision: "advanced", stage: report.stage, reference: null }
  }),
  refused: (report, origin) => refusedPlan(origin, report.reason),
  unknown: (_report, origin) => ({
    stamp: origin,
    warnings: ["stage_advance_unknown"],
    advance: { decision: "unknown" }
  })
};

function planOf(report: AdvanceReport, origin: Stamp): AdvancePlan {
  // The table is keyed by the same decision as the report, so the entry receives its own variant.
  return PLAN_OF[report.decision](report as never, origin);
}

function refusedPlan(origin: Stamp, reason: string): AdvancePlan {
  return {
    stamp: origin,
    warnings: ["stage_advance_refused"],
    advance: { decision: "refused", reason }
  };
}

/**
 * The confirmations after the write: the stamp's grant is answered by the message, and the advance is
 * bound to it. A failed confirmation keeps what was written and reports it; the reference is then null.
 */
async function settle(
  options: McpOptions,
  info: WorkspaceInfo,
  threadId: string,
  agentId: string,
  message: ChatMessage,
  reservation: string | undefined,
  plan: AdvancePlan
): Promise<PostedMessage> {
  const stampFailed =
    reservation !== undefined &&
    !(await confirmStamp(
      options,
      info,
      threadId,
      agentId,
      message.id,
      reservation
    ));
  const advanceFailed =
    plan.operationId !== undefined &&
    !(await confirmAdvance(
      options,
      info,
      threadId,
      agentId,
      plan.operationId,
      message.id
    ));
  const failures = [
    ...(stampFailed ? [CONFIRM_FAILED] : []),
    ...(advanceFailed ? [CONFIRM_FAILED] : [])
  ];
  return withExtras(message, {
    warnings: uniqueOf([...plan.warnings, ...failures]),
    advance:
      plan.advance === undefined
        ? undefined
        : withReference(plan.advance, advanceFailed ? null : message.id)
  });
}

/** Each warning once, in the order it was first raised. */
function uniqueOf(list: string[]): string[] {
  return [...new Set(list)];
}

async function confirmStamp(
  options: McpOptions,
  info: WorkspaceInfo,
  threadId: string,
  agentId: string,
  messageId: string,
  reservation: string
): Promise<boolean> {
  const reply = await postActivation(
    options,
    activationRouteOf(info, threadId, "stamp/confirm"),
    { agentId, messageId, reservation },
    timeoutOf(options)
  );
  return reply.ok && reply.status === 200;
}

async function plainPost(
  info: WorkspaceInfo,
  threadId: string,
  input: MessageInput,
  extras: Extras
): Promise<PostedMessage> {
  return withExtras(
    await appendMessageInWorkspace(info, threadId, input),
    extras
  );
}

function withExtras(message: ChatMessage, extras: Extras): PostedMessage {
  return {
    ...message,
    warnings: extras.warnings,
    ...(extras.advance === undefined ? {} : { advance: extras.advance })
  };
}

function withReference(
  advance: AdvancePosted,
  reference: string | null
): AdvancePosted {
  if (advance.decision !== "advanced") return advance;
  return { ...advance, reference };
}

function timeoutOf(options: McpOptions): number {
  return options.activationTimeoutMs ?? STAMP_TIMEOUT_MS;
}

function isStampBody(value: unknown): value is StampBody {
  if (!isRecord(value)) return false;
  return (
    value.decision === "stamp" &&
    isFixedStage(value.stage) &&
    (value.expectedStage === undefined || isFixedStage(value.expectedStage))
  );
}
