import { isFixedStage, type FixedStage } from "./activation-stages.js";
import type {
  OriginMessage,
  ReservationRecord,
  ReservationRequest,
  StageBudget,
  StageBudgets,
  ThreadGate
} from "./activation-reservation-types.js";

/**
 * The inputs of one judgment, read inside the thread's queue. The caller reads them and the judge
 * never reads files: a closed or unreadable thread is passed as a gate, with no records at all.
 */
export type ReservationInput = {
  request: ReservationRequest;
  gate: ThreadGate;
  /** The canonical message from CHAT.md, or undefined when the id is not in the thread. */
  message?: OriginMessage;
  /** True when the message id is in the list kept by the UI route. */
  uiMessage: boolean;
  /** True when the author's profile has the architect role in the registry. */
  authorIsArchitect: boolean;
  currentStage: FixedStage;
  attemptCap: number;
  revision?: string;
  budgets: StageBudgets;
  records: readonly ReservationRecord[];
  prunedThrough?: string;
};

/** Who may wake an agent: an architect's message, or a message the UI route posted. */
export type Origin = "architect" | "ui" | "ineligible";

/** The facts the dispatch table reads. Built once per judgment, never mutated. */
export type Facts = {
  input: ReservationInput;
  message: OriginMessage;
  origin: Origin;
  stage: FixedStage;
  record?: ReservationRecord;
  budget: StageBudget;
};

/** A stand-in for a message that does not exist. Its origin is ineligible, so it is never recorded. */
const MISSING_MESSAGE: OriginMessage = {
  author: "",
  timestamp: "",
  mentionsRecipient: false
};

export function factsOf(input: ReservationInput): Facts {
  const message = input.message ?? MISSING_MESSAGE;
  const stage = stageOf(message.stage, input.currentStage);
  return {
    input,
    message,
    origin: originOf(input, message),
    stage,
    record: input.records.find(
      (record) =>
        record.messageId === input.request.messageId &&
        record.recipient === input.request.recipient
    ),
    budget: input.budgets[stage]
  };
}

/** The stored record, or the one a first delivery creates. Only a grant or a hold writes it. */
export function baseOf(facts: Facts): ReservationRecord {
  return facts.record ?? freshRecord(facts);
}

/** The run id joins the admitted list once; a replay of an admitted run is not a new admission. */
export function admittedRun(
  record: ReservationRecord,
  facts: Facts
): Pick<ReservationRecord, "runId" | "runIds"> {
  const runId = facts.input.request.runId;
  const admitted = record.runIds.includes(runId);
  return {
    runId,
    runIds: admitted ? record.runIds : [...record.runIds, runId]
  };
}

/**
 * A run spends an attempt when it was never admitted. The admitted list is the only evidence: a
 * retention admits no run, so the run a pause held is not admitted, and it spends one when granted.
 * The last run seen on the record does not count.
 */
export function isNewRun(record: ReservationRecord, runId: string): boolean {
  return !record.runIds.includes(runId);
}

function originOf(input: ReservationInput, message: OriginMessage): Origin {
  if (!message.mentionsRecipient) return "ineligible";
  if (input.uiMessage) return "ui";
  if (input.authorIsArchitect) return "architect";
  return "ineligible";
}

/** The origin stage is the stamp the message carries; a message with no stamp belongs to the current stage. */
function stageOf(stamp: string | undefined, current: FixedStage): FixedStage {
  return isFixedStage(stamp) ? stamp : current;
}

function freshRecord(facts: Facts): ReservationRecord {
  const { request } = facts.input;
  return {
    messageId: request.messageId,
    recipient: request.recipient,
    author: facts.message.author,
    origin: facts.origin === "ui" ? "ui" : "architect",
    holder: request.holder,
    runId: request.runId,
    runIds: [],
    stage: facts.stage,
    status: "held",
    granted: false,
    attempts: 0,
    cycleRole: "none",
    messageAt: facts.message.timestamp
  };
}
