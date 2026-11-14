import { judgeSupervision } from "../core/activation-supervision.js";
import {
  findRecord,
  pruneSupervision,
  transitionRecord,
  upsertRecord
} from "../core/activation-supervision-records.js";
import type {
  SupervisionRecord,
  SupervisionStatus,
  SupervisionTurn
} from "../core/activation-supervision-types.js";
import type { TurnTimeoutState } from "../core/activation-turn-timeout.js";
import { slotKey } from "../core/session-slots.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { ThreadStep, ThreadFile } from "./thread-store.js";
import type { ActivationApproval, ThreadActivity } from "./activation-file.js";
import { isApprovedAt, withApproval } from "./activation-activity.js";
import { readQueueFacts } from "./activation-queue-facts.js";
import { applyDecision, judgeInQueue } from "./activation-reservation-store.js";
import type { TurnTimeoutRead } from "./activation-turn-timeout-ledger.js";
import type { ActivationServices } from "./activation-views.js";
import { scopeOf } from "./activation-views.js";
import { acquireStep } from "./session-operations.js";
import { probeFor, type SessionServices } from "./session-views.js";
import {
  CHECKING_SESSIONS,
  holderOf,
  inGraceAt,
  refusedWith,
  slotFactsOf,
  slotOf,
  type Refused
} from "./supervision-facts.js";
import type { SupervisionOptions } from "./supervision-runner.js";
import { supervisionOf } from "./supervision-pass.js";
import { turnFingerprintOf } from "../core/supervision-turn-recheck.js";
import { authorizedMinutesOf } from "./supervision-turn-steps.js";

/**
 * The actions that start a turn from a card. Approve starts an awaiting card and records the human's
 * approval of its architect; retry and continue restart a failed one; auto starts an awaiting card of an
 * architect the human already approved in this thread. Only the first three are routes.
 */
export type StartAction = "approve" | "retry" | "continue" | "auto";

export type CardRef = { messageId: string; recipient: string };

export type StartResponse =
  | {
      decision: "started";
      runId: string;
      attempt: number;
      mode: "new" | "resume";
    }
  | Refused;

export type StartOutcome = {
  response: StartResponse;
  /** The card as committed, when the start was written. The caller hands it to the runner after the queue. */
  started?: SupervisionRecord;
};

export type StartContext = {
  services: ActivationServices;
  sessions: SessionServices;
  options: SupervisionOptions;
  workspace: WorkspaceInfo;
  threadId: string;
};

/**
 * The refusal reason of a start rule, or undefined when the card may start. `approved` says whether the
 * card's architect holds a valid approval in this thread; only the auto rule reads it.
 */
type StartRule = (
  record: SupervisionRecord,
  cap: number,
  approved: boolean
) => string | undefined;

const START_RULES: Record<StartAction, StartRule> = {
  approve: (record) =>
    record.status === "awaiting_confirmation" ? undefined : "not_awaiting",
  retry: (record, cap) =>
    failedRefusal(
      record,
      cap,
      (reason) => reason !== "revoked",
      "not_retryable"
    ),
  continue: (record, cap) =>
    failedRefusal(
      record,
      cap,
      (reason) => reason === "timeout",
      "not_continuable"
    ),
  auto: (record, _cap, approved) => autoRefusal(record, approved)
};

/** An automatic start needs an awaiting card and the architect's approval. A failed card is never restarted here. */
function autoRefusal(
  record: SupervisionRecord,
  approved: boolean
): string | undefined {
  if (record.status !== "awaiting_confirmation") return "not_awaiting";
  if (!approved) return "not_approved";
  return undefined;
}

function failedRefusal(
  record: SupervisionRecord,
  cap: number,
  accepts: (reason: string | undefined) => boolean,
  refusal: string
): string | undefined {
  if (record.status !== "failed" || !accepts(record.reason)) return refusal;
  if (record.attempt >= cap) return "attempts_exhausted";
  return undefined;
}

/**
 * The refusal reason an action gets from its card, or undefined when the card may start now. The card view
 * reads the same function, so the Retry and Continue it offers are the ones the start accepts.
 */
export function startRefusalOf(
  action: StartAction,
  record: SupervisionRecord,
  cap: number,
  approved: boolean = false
): string | undefined {
  return START_RULES[action](record, cap, approved);
}

/**
 * The card the slot table judges. Approve and auto judge the card as it is. Retry and continue judge a
 * waiting copy of the failed card, so the same table decides whether the slot is free and the mention granted.
 */
const JUDGED_VIEW: Record<
  StartAction,
  (record: SupervisionRecord) => SupervisionRecord
> = {
  approve: (record) => record,
  retry: asWaiting,
  continue: asWaiting,
  auto: (record) => record
};

/** The activation an action leaves behind. Only an Approve records the approval; the other actions keep the activation. */
const ACTIVATION_AFTER: Record<
  StartAction,
  (
    activation: ThreadActivity | undefined,
    approval: ActivationApproval
  ) => ThreadActivity | undefined
> = {
  approve: (activation, approval) =>
    activation && withApproval(activation, approval),
  retry: (activation) => activation,
  continue: (activation) => activation,
  auto: (activation) => activation
};

/** The mark a turn carries. Only a turn the daemon starts without a card is marked automatic. */
const TURN_MARK: Record<StartAction, Pick<SupervisionTurn, "auto">> = {
  approve: {},
  retry: {},
  continue: {},
  auto: { auto: true }
};

function asWaiting(record: SupervisionRecord): SupervisionRecord {
  return { ...record, status: "waiting" };
}

/** The turn time limit must be authorized, or the start is refused, so no turn runs on a tampered value. */
const TURN_REFUSAL: Record<TurnTimeoutState["status"], string | undefined> = {
  authorized: undefined,
  tampered: "turn_timeout_tampered"
};

function turnRefusalOf(read: TurnTimeoutRead): string | undefined {
  if ("turnTimeoutMinutes" in read) return TURN_REFUSAL[read.status];
  return "turn_timeout_unreadable";
}

type StepResult = StartOutcome;

/**
 * Starts a turn from a card in one write. Every fact is read inside the thread's queue: the card, the
 * policy, the time limit, the reservation verdict, the slot table and the posse. The posse is acquired
 * with the supervisor origin and the reservation with the stable holder; the card moves to starting with
 * a new run id. Any refusal writes nothing, so no posse is left without a card.
 */
export async function startIn(
  context: StartContext,
  action: StartAction,
  card: CardRef
): Promise<StartOutcome> {
  const result = await context.services.threads.update<StepResult>(
    scopeOf(context.workspace, context.threadId),
    (file) => startStep(context, action, card, file)
  );
  if (result.status === "closed") {
    return { response: refusedWith("thread_closed") };
  }
  if (result.status === "invalid") {
    return { response: refusedWith(result.reason) };
  }
  return result.value;
}

async function startStep(
  context: StartContext,
  action: StartAction,
  card: CardRef,
  file: ThreadFile
): Promise<ThreadStep<StepResult>> {
  const { workspace, threadId, options } = context;
  const key = slotKey(slotOf(workspace, threadId, card.recipient));
  const binding = file.slots[key];
  if (binding !== undefined && inGraceAt(options, options.now())) {
    return refuse(CHECKING_SESSIONS);
  }
  const state = supervisionOf(file);
  const record = findRecord(state.records, card.messageId, card.recipient);
  if (record === undefined) return refuse("not_found");

  const facts = await readQueueFacts(context.services, workspace, threadId);
  if (facts.policy.status !== "ready") {
    return refuse("policy_not_ready", record.status);
  }
  const revision = facts.policy.policy.revision;
  const approved = isApprovedAt(file.activation, card.recipient, revision);
  const ruleRefusal = startRefusalOf(
    action,
    record,
    facts.policy.policy.attemptCap,
    approved
  );
  if (ruleRefusal) return refuse(ruleRefusal, record.status);

  const turnRead = await context.services.ledger.turnTimeoutState(workspace);
  const turnRefusal = turnRefusalOf(turnRead);
  if (turnRefusal) return refuse(turnRefusal, record.status);
  const turnTimeoutMinutes = authorizedMinutesOf(turnRead);
  if (turnTimeoutMinutes === undefined) {
    return refuse("turn_timeout_unreadable", record.status);
  }

  const runId = options.newRunId();
  const decision = judgeInQueue(facts, file, {
    messageId: card.messageId,
    recipient: card.recipient,
    holder: holderOf(card.messageId, card.recipient),
    runId
  });
  const verdict = judgeSupervision({
    reservation: { status: decision.status, reason: decision.reason },
    slot: await slotFactsOf(context.sessions, workspace, binding),
    existing: JUDGED_VIEW[action](record),
    messageAt: record.messageAt,
    floor: state.floors[card.recipient]
  });
  if (verdict.action === "none" || verdict.status !== "awaiting_confirmation") {
    return refuse(verdict.reason ?? "not_startable", record.status);
  }

  const acquired = await acquireStep(
    file,
    {
      slot: slotOf(workspace, threadId, card.recipient),
      hostId: context.sessions.presence.hostId,
      expectedGeneration: binding?.generation ?? 0
    },
    probeFor(context.sessions, workspace),
    options,
    "supervisor"
  );
  if (acquired.value.decision === "refused") {
    return refuse(acquired.value.reason, record.status);
  }
  const reserved = decision.write
    ? applyDecision(acquired.file ?? file, decision)
    : (acquired.file ?? file);

  const started = transitionRecord(record, "starting", {
    runId,
    attempt: record.attempt + 1,
    reason: undefined,
    turn: {
      generation: acquired.value.generation,
      mode: acquired.value.mode,
      fingerprint: turnFingerprintOf({
        policy: facts.policy.policy,
        cyclesPerStage: facts.cyclesPerStage,
        turnTimeoutMinutes
      }),
      continuation: action === "continue",
      ...TURN_MARK[action]
    }
  });
  if (started === undefined) return refuse("not_startable", record.status);
  const approval: ActivationApproval = {
    agentId: card.recipient,
    revision,
    at: options.now()
  };
  return {
    value: {
      response: {
        decision: "started",
        runId,
        attempt: started.attempt,
        mode: acquired.value.mode
      },
      started
    },
    file: {
      ...reserved,
      activation: ACTIVATION_AFTER[action](reserved.activation, approval),
      supervision: pruneSupervision({
        records: upsertRecord(state.records, started),
        floors: state.floors
      })
    }
  };
}

function refuse(
  reason: string,
  status?: SupervisionStatus
): ThreadStep<StepResult> {
  return { value: { response: refusedWith(reason, status) } };
}
