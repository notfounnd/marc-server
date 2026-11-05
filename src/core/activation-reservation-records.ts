import type { FixedStage } from "./activation-stages.js";
import type {
  CycleState,
  CycleUpdate,
  ReservationRecord
} from "./activation-reservation-types.js";

/** Bounds of the lists kept in the thread's state file. Pruning moves a floor, never forgets a grant silently. */
export const RESERVATION_LIMIT = 200;
export const STAGE_HISTORY_LIMIT = 50;
export const UI_MESSAGE_LIMIT = 500;

/** The stamp a message carries: the stage, and the cycle when a grant opened or closed one. */
export type MessageStamp = { stage: FixedStage; cycle?: number };

/** The stamp prepared for an author, plus the key of the open reservation it answers. */
export type PreparedStamp = MessageStamp & { reservation?: string };

export type ConfirmInput = {
  agentId: string;
  messageId: string;
  reservation: string;
};

export type ConfirmDecision =
  | { decision: "answered"; records: ReservationRecord[] }
  | { decision: "already" }
  | { decision: "refused"; reason: string };

/** The open cycle in one direction of one stage: the author woke the recipient and nothing answered yet. */
export function openCycleOf(
  records: readonly ReservationRecord[],
  stage: FixedStage,
  author: string,
  recipient: string
): ReservationRecord | undefined {
  return records.find(
    (record) =>
      record.cycleRole === "open" &&
      record.cycleState === "open" &&
      record.stage === stage &&
      record.author === author &&
      record.recipient === recipient
  );
}

/** Replaces the record with the same message and recipient, or appends it. Undefined means no change. */
export function replaceRecord(
  records: readonly ReservationRecord[],
  record: ReservationRecord | undefined
): ReservationRecord[] {
  if (record === undefined) return [...records];
  const found = records.some((item) => sameKey(item, record));
  if (!found) return [...records, record];
  return records.map((item) => (sameKey(item, record) ? record : item));
}

export function applyCycleUpdates(
  records: readonly ReservationRecord[],
  updates: readonly CycleUpdate[]
): ReservationRecord[] {
  return records.map((record) => {
    const update = updates.find((item) => sameKey(item, record));
    return update ? { ...record, cycleState: update.state } : record;
  });
}

/**
 * Bounds the list. Only records that are not open cycles are pruned, oldest first. The floor
 * is monotonic: it only moves forward, to the newest message time among the pruned records.
 */
export function pruneRecords(
  records: readonly ReservationRecord[],
  prunedThrough: string | undefined
): { records: ReservationRecord[]; prunedThrough?: string } {
  const overflow = records.length - RESERVATION_LIMIT;
  if (overflow <= 0) return { records: [...records], prunedThrough };
  const dropped = records.filter(isPrunable).slice(0, overflow);
  return {
    records: records.filter((record) => !dropped.includes(record)),
    prunedThrough: latestTimestamp(
      prunedThrough,
      dropped.map((record) => record.messageAt)
    )
  };
}

/** A message at or before the floor, with no record, has expired. The boundary is inclusive. */
export function expiredBy(
  timestamp: string,
  floor: string | undefined
): boolean {
  return floor !== undefined && Date.parse(timestamp) <= Date.parse(floor);
}

/**
 * Ends every retained hold of a reservation that was never granted, with `stage_advanced`. A grant
 * that a pause retained is not a hold of this kind: its grant stands, and it is not counted.
 */
export function closeHolds(records: readonly ReservationRecord[]): {
  records: ReservationRecord[];
  dropped: number;
} {
  return {
    records: records.map((record): ReservationRecord => endIfHeld(record)),
    dropped: records.filter(isEndableHold).length
  };
}

function endIfHeld(record: ReservationRecord): ReservationRecord {
  if (!isEndableHold(record)) return record;
  return { ...record, status: "refused", reason: "stage_advanced" };
}

function isEndableHold(record: ReservationRecord): boolean {
  return record.status === "held" && !record.granted;
}

export function reservationKey(
  record: Pick<ReservationRecord, "messageId" | "recipient">
): string {
  return `${record.messageId}:${record.recipient}`;
}

/** The author's open grant: granted to this agent, not refused, and not yet answered by a post. */
export function prepareStamp(
  records: readonly ReservationRecord[],
  currentStage: FixedStage,
  agentId: string
): PreparedStamp {
  const open = records
    .filter(
      (record) =>
        record.recipient === agentId &&
        record.granted &&
        record.status !== "refused" &&
        record.answeredBy === undefined
    )
    .at(-1);
  if (open === undefined) return { stage: currentStage };
  return {
    stage: open.stage,
    ...(open.cycle === undefined ? {} : { cycle: open.cycle }),
    reservation: reservationKey(open)
  };
}

/** Marks the grant as answered by this message. Repeating the same message changes nothing. */
export function confirmReservation(
  records: readonly ReservationRecord[],
  input: ConfirmInput
): ConfirmDecision {
  const index = records.findIndex(
    (record) =>
      reservationKey(record) === input.reservation &&
      record.recipient === input.agentId &&
      record.granted
  );
  if (index < 0)
    return { decision: "refused", reason: "reservation_not_found" };
  const current = records[index];
  if (current.answeredBy === input.messageId) return { decision: "already" };
  if (current.answeredBy !== undefined) {
    return { decision: "refused", reason: "already_answered" };
  }
  return {
    decision: "answered",
    records: records.map((record, position) =>
      position === index ? { ...record, answeredBy: input.messageId } : record
    )
  };
}

export function latestTimestamp(
  current: string | undefined,
  values: readonly string[]
): string | undefined {
  const all = current === undefined ? values : [current, ...values];
  return all.reduce<string | undefined>(
    (latest, value) =>
      latest === undefined || Date.parse(value) > Date.parse(latest)
        ? value
        : latest,
    undefined
  );
}

export function cycleStateIsOpen(state: CycleState | undefined): boolean {
  return state === "open";
}

function isPrunable(record: ReservationRecord): boolean {
  return !(record.cycleRole === "open" && cycleStateIsOpen(record.cycleState));
}

function sameKey(
  left: { messageId: string; recipient: string },
  right: { messageId: string; recipient: string }
): boolean {
  return (
    left.messageId === right.messageId && left.recipient === right.recipient
  );
}
