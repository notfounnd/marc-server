import {
  judgeReservation,
  type ReservationInput
} from "../core/activation-reservation.js";
import type { PolicyView } from "../core/activation-policy-store.js";
import type {
  OriginMessage,
  ReservationDecision,
  ReservationRequest,
  StageBudgets,
  ThreadGate
} from "../core/activation-reservation-types.js";
import {
  FIXED_STAGES,
  isFixedStage,
  type FixedStage
} from "../core/activation-stages.js";
import { mentionsProfile } from "../core/thread-mentions.js";
import { messagesOfThreadInWorkspace } from "../core/threads.js";
import type { ChatMessage, WorkspaceInfo } from "../core/types.js";
import type { IdentityCheck } from "../core/waiter-identity.js";
import { cyclesCountersOf } from "./activation-activity.js";
import type { ThreadActivity } from "./activation-file.js";
import { reasonOf } from "./activation-ledger.js";
import {
  judgeFacts,
  readQueueFacts,
  type QueueFacts
} from "./activation-queue-facts.js";
import { scopeOf, type ActivationServices } from "./activation-views.js";
import type { ThreadFile } from "./thread-store.js";
import type { WaiterIdentity } from "./waiter-identity.js";

/** The hold a waiter gets when its identity cannot be verified. It writes what any other hold writes. */
export const IDENTITY_HOLD = "identity_unverified";

export { architectIdsOf } from "./activation-queue-facts.js";

/** The attempt cap used when the policy is not readable. The policy's own cap wins when it is. */
const DEFAULT_ATTEMPT_CAP = 2;

export type ReservationResponse = {
  decision: ReservationDecision["status"];
  reason?: string;
  stage: FixedStage;
  cycle?: number;
};

/**
 * A waiter's reservation. The author, the mentions and the stamp come from the canonical message in
 * CHAT.md, never from the caller. Every authorization the judgment reads (the policy, the pause, the
 * cycles setting, the floor and the architects) is read inside the thread's queue, in the same step
 * that writes. A closed or unreadable thread is judged without any write.
 */
export async function reserveIn(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string,
  request: ReservationRequest,
  identity?: WaiterIdentity
): Promise<ReservationResponse> {
  const result = await services.threads.update<ReservationDecision>(
    scopeOf(workspace, threadId),
    async (file) => {
      const facts = await readQueueFacts(services, workspace, threadId);
      const check = await checkOf(identity, file);
      const decision = judgeInQueue(facts, file, request, check);
      return {
        value: decision,
        file: decision.write ? applyDecision(file, decision) : undefined
      };
    }
  );
  if (result.status === "done") return responseOf(result.value);
  return responseOf(
    judgeReservation(
      await outsideInput(workspace, threadId, request, gateOutside(result))
    )
  );
}

/**
 * The reservation judgment as one step inside a thread's queue. The facts are read in the same step,
 * and the decision says whether the caller must write it. Nothing is written here, so the supervisor's
 * pass can use the verdict alone and its approval can apply the write with its own composition.
 */
export function judgeInQueue(
  facts: QueueFacts,
  file: ThreadFile,
  request: ReservationRequest,
  identityCheck?: IdentityCheck
): ReservationDecision {
  return judgeReservation(inputOf(request, facts, file, identityCheck));
}

/** The waiter's identity check, read in the step when a waiter asks; the supervisor's own requests have none. */
async function checkOf(
  identity: WaiterIdentity | undefined,
  file: ThreadFile
): Promise<IdentityCheck | undefined> {
  if (identity === undefined) return undefined;
  return identity(file);
}

/**
 * A failed identity check holds a delivery that would otherwise be judged open and enabled, and the hold
 * carries the check that failed. A pause, a state that resolves in the panel, a disabled policy or a closed
 * thread keep their own answer, and a verified or absent check changes nothing.
 */
function withIdentityGate(
  gate: ThreadGate,
  check: IdentityCheck | undefined
): ThreadGate {
  if (check === undefined || check === "verified") return gate;
  if (gate.kind !== "open" || !gate.enabled) return gate;
  if (gate.hold !== undefined) return gate;
  return { ...gate, hold: IDENTITY_HOLD, identityCheck: check };
}

/** Per-stage budgets: the cycles used, and the authorized cycles plus the grants. */
export function budgetsOf(
  activation: ThreadActivity | undefined,
  cyclesPerStage: number
): StageBudgets {
  return Object.fromEntries(
    FIXED_STAGES.map((stage) => {
      const counters = cyclesCountersOf(activation?.stages[stage]);
      const granted = counters.extensions.reduce(
        (sum, grant) => sum + grant.cycles,
        0
      );
      return [
        stage,
        { used: counters.cyclesUsed, max: cyclesPerStage + granted }
      ];
    })
  ) as StageBudgets;
}

/** The stage the activation stands on, or the first fixed stage when there is none. */
export function stageOfActivation(
  activation: ThreadActivity | undefined
): FixedStage {
  const stage = activation?.currentStage;
  return isFixedStage(stage) ? stage : FIXED_STAGES[0];
}

/** The canonical message, with the mention check done against the recipient the caller named. */
function originOf(
  messages: readonly ChatMessage[],
  request: ReservationRequest
): OriginMessage | undefined {
  const found = messages.find((item) => item.id === request.messageId);
  if (found === undefined) return undefined;
  return {
    author: found.agentId,
    timestamp: found.timestamp,
    stage: found.stage,
    mentionsRecipient: mentionsProfile(found.body, request.recipient)
  };
}

function attemptCapOf(policy: PolicyView): number {
  return policy.status === "ready"
    ? policy.policy.attemptCap
    : DEFAULT_ATTEMPT_CAP;
}

function revisionOf(policy: PolicyView): string | undefined {
  return policy.status === "ready" ? policy.policy.revision : undefined;
}

/** Outside the queue: a lost or invalid state, or a closed thread, is judged without a write. */
function gateOutside(
  result: { status: "closed" } | { status: "invalid"; reason: string }
): ThreadGate {
  if (result.status === "closed") return { kind: "closed" };
  return { kind: "unreadable", reason: unreadableReason(result.reason) };
}

function unreadableReason(reason: string): "ledger_lost" | "ledger_invalid" {
  return reasonOf(reason) === "ledger_lost" ? "ledger_lost" : "ledger_invalid";
}

/**
 * Inside the queue: the cycles state first, then the policy switch, then the workspace pause, then the
 * thread's own pin and floor. A pause and a state that resolves in the panel hold; a disabled policy refuses.
 */
function gateOf(
  facts: QueueFacts,
  activation: ThreadActivity | undefined
): ThreadGate {
  if (facts.cycles.status === "ledger_lost") {
    return { kind: "unreadable", reason: "ledger_lost" };
  }
  if (facts.cycles.status === "ledger_invalid") {
    return { kind: "unreadable", reason: "ledger_invalid" };
  }
  if (!facts.enabled) return { kind: "open", enabled: false };
  if (facts.paused) {
    return { kind: "open", enabled: true, hold: "workspace_paused" };
  }
  const state = judgeFacts(facts, activation);
  if (state.status === "ready") return { kind: "open", enabled: true };
  return { kind: "open", enabled: true, hold: state.status };
}

/** The judgment's input inside the queue: the request, the message and every fact read in the same step. */
function inputOf(
  request: ReservationRequest,
  facts: QueueFacts,
  file: ThreadFile,
  identityCheck: IdentityCheck | undefined
): ReservationInput {
  const message = originOf(facts.messages, request);
  return {
    request,
    gate: withIdentityGate(gateOf(facts, file.activation), identityCheck),
    message,
    uiMessage: (file.uiMessages ?? []).some(
      (item) => item.messageId === request.messageId
    ),
    authorIsArchitect:
      message !== undefined && facts.architects.has(message.author),
    currentStage: stageOfActivation(file.activation),
    attemptCap: attemptCapOf(facts.policy),
    revision: revisionOf(facts.policy),
    budgets: budgetsOf(file.activation, facts.cyclesPerStage),
    records: file.reservations ?? [],
    prunedThrough: file.prunedThrough
  };
}

/**
 * The input for a thread that is closed or unreadable. The gate decides before the origin, the policy
 * or the architects are consulted, so none of them is read here. Only the canonical message is read,
 * because the response shows the stage that message carries.
 */
async function outsideInput(
  workspace: WorkspaceInfo,
  threadId: string,
  request: ReservationRequest,
  gate: ThreadGate
): Promise<ReservationInput> {
  const message = originOf(
    await messagesOfThreadInWorkspace(workspace, threadId),
    request
  );
  return {
    request,
    gate,
    message,
    uiMessage: false,
    authorIsArchitect: false,
    currentStage: FIXED_STAGES[0],
    attemptCap: DEFAULT_ATTEMPT_CAP,
    budgets: budgetsOf(undefined, 0),
    records: []
  };
}

/** The write of a judged decision: its records, its pruning floor and its debit. */
export function applyDecision(
  file: ThreadFile,
  decision: ReservationDecision
): ThreadFile {
  return {
    ...file,
    reservations: decision.records,
    prunedThrough: decision.prunedThrough,
    activation: addCycles(file.activation, decision.stage, decision.debit)
  };
}

function addCycles(
  activation: ThreadActivity | undefined,
  stage: FixedStage,
  debit: number
): ThreadActivity | undefined {
  if (activation === undefined || debit === 0) return activation;
  const counters = cyclesCountersOf(activation.stages[stage]);
  return {
    ...activation,
    stages: {
      ...activation.stages,
      [stage]: {
        cyclesUsed: counters.cyclesUsed + debit,
        extensions: counters.extensions
      }
    }
  };
}

function responseOf(decision: ReservationDecision): ReservationResponse {
  return {
    decision: decision.status,
    reason: decision.reason,
    stage: decision.stage,
    cycle: decision.cycle
  };
}
