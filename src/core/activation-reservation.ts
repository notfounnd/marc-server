import {
  applyCycleUpdates,
  expiredBy,
  openCycleOf,
  pruneRecords,
  replaceRecord
} from "./activation-reservation-records.js";
import {
  admittedRun,
  baseOf,
  factsOf,
  isNewRun,
  type Facts,
  type ReservationInput
} from "./activation-reservation-facts.js";
import type {
  CycleUpdate,
  ReservationDecision,
  ReservationRecord,
  ReservationStatus
} from "./activation-reservation-types.js";
import type { IdentityCheck } from "./waiter-identity.js";

export type { ReservationInput } from "./activation-reservation-facts.js";

/** What a step decides: the status, the cycle it touches, the debit, and the records it changes. */
type Stop = {
  status: ReservationStatus;
  reason?: string;
  cycle?: number;
  debit: number;
  record?: ReservationRecord;
  cycleUpdates: CycleUpdate[];
};

type Step = (facts: Facts) => Stop | undefined;

/**
 * Pure judgment of one reservation request. The daemon calls it inside the thread's queue. The seven
 * steps run in the order of decision 12: the first step that answers stops the table.
 */
export function judgeReservation(input: ReservationInput): ReservationDecision {
  const facts = factsOf(input);
  return commit(facts, firstStop(facts));
}

/** Steps 1 to 7 in order. The last one always answers for an architect origin. */
const STEPS: readonly Step[] = [
  closedStep,
  unreadableStep,
  originStep,
  gateStep,
  dedupeStep,
  admitStep,
  openStep
];

function firstStop(facts: Facts): Stop {
  for (const step of STEPS) {
    const stop = step(facts);
    if (stop) return stop;
  }
  return refuse("ineligible_origin");
}

/** Step 1: a closed thread refuses. Nothing is written. */
function closedStep(facts: Facts): Stop | undefined {
  if (facts.input.gate.kind !== "closed") return undefined;
  return refuse("thread_closed");
}

/** Step 2: lost or invalid state holds without writing, so no file is recreated. */
function unreadableStep(facts: Facts): Stop | undefined {
  const { gate } = facts.input;
  if (gate.kind !== "unreadable") return undefined;
  return { status: "held", reason: gate.reason, debit: 0, cycleUpdates: [] };
}

/** Step 3: the author and the mentions come from the canonical message only. */
function originStep(facts: Facts): Stop | undefined {
  if (facts.origin !== "ineligible") return undefined;
  return refuse("ineligible_origin");
}

/** Step 4: a disabled policy refuses; a pause or a state that resolves in the panel holds and is recorded. */
function gateStep(facts: Facts): Stop | undefined {
  const { gate } = facts.input;
  if (gate.kind !== "open") return undefined;
  if (!gate.enabled) return refuse("policy_disabled");
  if (gate.hold === undefined) return undefined;
  if (heldByOther(facts)) return refuse("already_reserved");
  return holdWith(facts, gate.hold, gate.identityCheck);
}

/** Step 5: deduplication by message and recipient, the holder check, replays, stale holds and attempts. */
function dedupeStep(facts: Facts): Stop | undefined {
  const { record } = facts;
  if (record === undefined) return expiredStep(facts);
  if (record.holder !== facts.input.request.holder) {
    return refuse("already_reserved");
  }
  if (record.status === "refused") {
    return refuse(record.reason ?? "ineligible_origin");
  }
  if (isReplay(record, facts)) return replayStop(record);
  if (isStaleHold(record, facts)) {
    return refuse("stage_advanced", terminal(record, "stage_advanced"));
  }
  if (isExhausted(record, facts)) {
    return refuse("attempts_exhausted", terminal(record, "attempts_exhausted"));
  }
  return undefined;
}

/** Step 6: a granted record is re-delivered; UI origin opens nothing; the reverse direction closes a cycle. */
function admitStep(facts: Facts): Stop | undefined {
  const { record } = facts;
  if (record?.granted) return redeliveryStop(facts, record);
  if (facts.origin === "ui") return uiGrantStop(facts);
  const opener = openCycleOf(
    facts.input.records,
    facts.stage,
    facts.input.request.recipient,
    facts.message.author
  );
  if (opener === undefined) return undefined;
  return closeStop(facts, opener);
}

/** Step 7: an architect's mention opens a cycle and debits one, when the origin stage has budget. */
function openStep(facts: Facts): Stop | undefined {
  if (facts.origin !== "architect") return undefined;
  if (facts.budget.used >= facts.budget.max) {
    return holdWith(facts, "budget_exhausted");
  }
  const superseded = openCycleOf(
    facts.input.records,
    facts.stage,
    facts.message.author,
    facts.input.request.recipient
  );
  return grantStop(
    facts,
    {
      ...baseOf(facts),
      ...admittedRun(baseOf(facts), facts),
      cycleRole: "open",
      cycle: facts.budget.used + 1,
      cycleState: "open"
    },
    1,
    supersedeUpdates(superseded)
  );
}

function expiredStep(facts: Facts): Stop | undefined {
  if (!expiredBy(facts.message.timestamp, facts.input.prunedThrough)) {
    return undefined;
  }
  return refuse("reservation_expired");
}

function heldByOther(facts: Facts): boolean {
  return (
    facts.record !== undefined &&
    facts.record.holder !== facts.input.request.holder
  );
}

function isReplay(record: ReservationRecord, facts: Facts): boolean {
  return (
    record.status === "granted" &&
    record.runIds.includes(facts.input.request.runId)
  );
}

/**
 * A retained hold of a record that was never granted ends when its stage moves. A granted record is
 * never a stale hold: its grant stands, and its redelivery is judged as a redelivery.
 */
function isStaleHold(record: ReservationRecord, facts: Facts): boolean {
  return (
    record.status === "held" &&
    !record.granted &&
    record.stage !== facts.input.currentStage
  );
}

/** Only a new run of an already granted record spends an attempt, and only up to the cap. */
function isExhausted(record: ReservationRecord, facts: Facts): boolean {
  return (
    record.granted &&
    isNewRun(record, facts.input.request.runId) &&
    record.attempts >= facts.input.attemptCap
  );
}

function replayStop(record: ReservationRecord): Stop {
  return { status: "granted", cycle: record.cycle, debit: 0, cycleUpdates: [] };
}

/**
 * A redelivery never debits. A run that is not admitted yet spends one attempt when it is granted,
 * including a run that a pause held. A run already admitted replays and spends nothing.
 */
function redeliveryStop(facts: Facts, record: ReservationRecord): Stop {
  const spends = isNewRun(record, facts.input.request.runId);
  return grantStop(
    facts,
    {
      ...record,
      ...admittedRun(record, facts),
      attempts: spends ? record.attempts + 1 : record.attempts
    },
    0,
    []
  );
}

function uiGrantStop(facts: Facts): Stop {
  return grantStop(
    facts,
    {
      ...baseOf(facts),
      ...admittedRun(baseOf(facts), facts),
      cycleRole: "none",
      cycle: undefined,
      cycleState: undefined
    },
    0,
    []
  );
}

function closeStop(facts: Facts, opener: ReservationRecord): Stop {
  return grantStop(
    facts,
    {
      ...baseOf(facts),
      ...admittedRun(baseOf(facts), facts),
      cycleRole: "close",
      cycle: opener.cycle,
      cycleState: undefined
    },
    0,
    [
      {
        messageId: opener.messageId,
        recipient: opener.recipient,
        state: "closed"
      }
    ]
  );
}

function supersedeUpdates(
  superseded: ReservationRecord | undefined
): CycleUpdate[] {
  if (superseded === undefined) return [];
  return [
    {
      messageId: superseded.messageId,
      recipient: superseded.recipient,
      state: "superseded"
    }
  ];
}

function grantStop(
  facts: Facts,
  next: ReservationRecord,
  debit: number,
  cycleUpdates: CycleUpdate[]
): Stop {
  return {
    status: "granted",
    cycle: next.cycle,
    debit,
    record: {
      ...next,
      status: "granted",
      granted: true,
      reason: undefined,
      identityCheck: undefined,
      revision: facts.input.revision ?? next.revision
    },
    cycleUpdates
  };
}

/** A hold replaces the check of an earlier hold: only an identity hold carries one. */
function holdWith(
  facts: Facts,
  reason: string,
  identityCheck?: IdentityCheck
): Stop {
  return {
    status: "held",
    reason,
    debit: 0,
    record: {
      ...baseOf(facts),
      status: "held",
      reason,
      runId: facts.input.request.runId,
      identityCheck
    },
    cycleUpdates: []
  };
}

function refuse(reason: string, record?: ReservationRecord): Stop {
  return { status: "refused", reason, debit: 0, record, cycleUpdates: [] };
}

function terminal(
  record: ReservationRecord,
  reason: string
): ReservationRecord {
  return { ...record, status: "refused", reason };
}

function commit(facts: Facts, stop: Stop): ReservationDecision {
  const replaced = replaceRecord(facts.input.records, stop.record);
  const updated = applyCycleUpdates(replaced, stop.cycleUpdates);
  const pruned = pruneRecords(updated, facts.input.prunedThrough);
  return {
    status: stop.status,
    reason: stop.reason,
    stage: facts.stage,
    cycle: stop.cycle,
    write: changesState(facts, stop, pruned.records.length),
    records: pruned.records,
    prunedThrough: pruned.prunedThrough,
    debit: stop.debit
  };
}

/**
 * A poll that changes nothing does not write: the same record, no debit, no cycle update and no
 * pruning. Only a change to the state is persisted.
 */
function changesState(
  facts: Facts,
  stop: Stop,
  resultingLength: number
): boolean {
  if (stop.debit > 0 || stop.cycleUpdates.length > 0) return true;
  if (resultingLength !== facts.input.records.length) return true;
  if (stop.record === undefined) return false;
  return JSON.stringify(stop.record) !== JSON.stringify(facts.record);
}
