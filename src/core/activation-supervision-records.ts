import type {
  SupervisionFloors,
  SupervisionOutcome,
  SupervisionRecord,
  SupervisionState,
  SupervisionStatus,
  SupervisionTurn
} from "./activation-supervision-types.js";

/** Terminal cards beyond this number are pruned, oldest first. Active cards are never pruned. */
export const MAX_SUPERVISION_RECORDS = 50;

/**
 * The state machine of one card. A transition that is not listed is refused, so no card reaches
 * starting without its approval, and no card leaves a terminal state.
 */
const TRANSITIONS: Record<SupervisionStatus, readonly SupervisionStatus[]> = {
  waiting: ["awaiting_confirmation", "superseded", "expired"],
  awaiting_confirmation: [
    "waiting",
    "starting",
    "declined",
    "superseded",
    "expired"
  ],
  starting: ["running", "failed"],
  running: ["done", "failed"],
  failed: ["starting", "expired"],
  done: [],
  declined: [],
  expired: [],
  superseded: []
};

/** The cards that can expire. starting and running never do, so a live turn is never cut by the clock. */
const EXPIRABLE: readonly SupervisionStatus[] = [
  "waiting",
  "awaiting_confirmation",
  "failed"
];

/** The terminal cards: they leave the panel, count in Activity, and move the floor of their recipient. */
const SETTLED: readonly SupervisionStatus[] = [
  "done",
  "declined",
  "expired",
  "superseded"
];

export type TransitionPatch = {
  reason?: string;
  runId?: string;
  attempt?: number;
  turn?: SupervisionTurn;
  outcome?: SupervisionOutcome;
};

export function canTransition(
  from: SupervisionStatus,
  to: SupervisionStatus
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/** The card in its new state, or undefined when the transition is refused. Nothing is changed in place. */
export function transitionRecord(
  record: SupervisionRecord,
  to: SupervisionStatus,
  patch: TransitionPatch = {}
): SupervisionRecord | undefined {
  if (!canTransition(record.status, to)) return undefined;
  return { ...record, ...patch, status: to };
}

/** The expiry instant of a new card: its creation plus the policy's pending TTL. */
export function expiresAtFor(createdAt: string, ttlMinutes: number): string {
  return new Date(Date.parse(createdAt) + ttlMinutes * 60_000).toISOString();
}

/** Expires a card whose deadline has passed. Starting and running cards are returned unchanged. */
export function expireDue(
  record: SupervisionRecord,
  now: string
): SupervisionRecord {
  if (!EXPIRABLE.includes(record.status)) return record;
  if (Date.parse(now) < Date.parse(record.expiresAt)) return record;
  return transitionRecord(record, "expired") ?? record;
}

export function isPending(status: SupervisionStatus): boolean {
  return status === "waiting" || status === "awaiting_confirmation";
}

/** True when a mention is at or below the floor of its recipient, so a pass must not create its card. */
export function belowFloor(
  messageAt: string,
  floor: string | undefined
): boolean {
  if (floor === undefined) return false;
  return Date.parse(messageAt) <= Date.parse(floor);
}

/**
 * Moves the floor of a recipient to a settled card's message. The floor never moves backwards, so a
 * pruned or declined card cannot be recreated by a later pass.
 */
export function advanceFloor(
  floors: SupervisionFloors,
  record: SupervisionRecord
): SupervisionFloors {
  if (!SETTLED.includes(record.status)) return floors;
  const current = floors[record.recipient];
  if (
    current !== undefined &&
    Date.parse(current) >= Date.parse(record.messageAt)
  ) {
    return floors;
  }
  return { ...floors, [record.recipient]: record.messageAt };
}

export function findRecord(
  records: readonly SupervisionRecord[],
  messageId: string,
  recipient: string
): SupervisionRecord | undefined {
  return records.find(
    (record) => record.messageId === messageId && record.recipient === recipient
  );
}

/** Replaces the card of the same message and recipient, or appends a new one. */
export function upsertRecord(
  records: readonly SupervisionRecord[],
  record: SupervisionRecord
): SupervisionRecord[] {
  const existing = findRecord(records, record.messageId, record.recipient);
  if (existing === undefined) return [...records, record];
  return records.map((candidate) =>
    candidate === existing ? record : candidate
  );
}

/**
 * Prunes the oldest settled cards beyond the limit. Each pruned card moves its recipient's floor, so
 * the card is never recreated. Active cards are kept even above the limit.
 */
export function pruneSupervision(state: SupervisionState): SupervisionState {
  const excess = state.records.length - MAX_SUPERVISION_RECORDS;
  if (excess <= 0) return state;
  const victims = new Set(oldestSettled(state.records).slice(0, excess));
  const floors = [...victims].reduce(
    (current, record) => advanceFloor(current, record),
    state.floors
  );
  return {
    floors,
    records: state.records.filter((record) => !victims.has(record))
  };
}

function oldestSettled(
  records: readonly SupervisionRecord[]
): SupervisionRecord[] {
  return records
    .filter((record) => SETTLED.includes(record.status))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
