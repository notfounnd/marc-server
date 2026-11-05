import type { FixedStage } from "./activation-stages.js";
import type { SlotDetails, SlotStateName } from "./session-slots.js";

/** The states of one supervision card. Only waiting and awaiting_confirmation are pending. */
export const SUPERVISION_STATUSES = [
  "waiting",
  "awaiting_confirmation",
  "starting",
  "running",
  "done",
  "failed",
  "declined",
  "expired",
  "superseded"
] as const;

export type SupervisionStatus = (typeof SUPERVISION_STATUSES)[number];

/**
 * What the turn reported: the cost delta, the permission denials, and the failure when it failed. The cost is
 * absent when the turn's output was not read: such a turn has no cost of its own, and the next turn of the same
 * session includes its spend in its delta, because the binding keeps the last total it saw.
 */
export type SupervisionOutcome = {
  costUsd?: number;
  denials: number;
  failure?: string;
};

/**
 * The launch a card was approved with. The approval writes it with the starting state, so the executor
 * can check it before the process starts: the binding generation, the mode, the fingerprint of the
 * policy, the cycles and the time limit, and whether the turn continues a timed-out one. Once the
 * process runs, its pid, its start instant as the agents source reports it, and the instant its time limit
 * ends are added. A start instant the agents source did not report is left out, never replaced by the
 * daemon's clock, because the start is the identity a reconciliation compares against.
 */
export type SupervisionTurn = {
  generation: number;
  mode: "new" | "resume";
  fingerprint: string;
  continuation: boolean;
  pid?: number;
  startedAt?: string;
  deadlineAt?: string;
  /** The instant the card went running. The presence grace of the process counts from it when no start is known. */
  runningAt?: string;
};

/** One card per mention and recipient, kept in the thread's activity state. */
export type SupervisionRecord = {
  messageId: string;
  /** The canonical timestamp of the mention. The per-recipient floor compares against it. */
  messageAt: string;
  recipient: string;
  /** The stage in which the mention was made. */
  stage: FixedStage;
  status: SupervisionStatus;
  reason?: string;
  createdAt: string;
  expiresAt: string;
  attempt: number;
  runId?: string;
  turn?: SupervisionTurn;
  outcome?: SupervisionOutcome;
};

/** The last message processed for each recipient. A pass never recreates a card at or below it. */
export type SupervisionFloors = Record<string, string>;

export type SupervisionState = {
  records: SupervisionRecord[];
  floors: SupervisionFloors;
};

/** The verdict of judgeReservation for the same message and recipient. */
export type ReservationVerdict = {
  status: "granted" | "held" | "refused";
  reason?: string;
};

export type SlotFacts = {
  state: SlotStateName;
  details: SlotDetails;
  /** The slot's session runs on this host. */
  sameHost: boolean;
  /** The identity of the occupant was verified against the live sources. */
  identityVerified: boolean;
};

/** Everything one pass of the table reads. The caller reads it inside the thread's queue. */
export type SupervisionFacts = {
  reservation: ReservationVerdict;
  slot: SlotFacts;
  existing: SupervisionRecord | undefined;
  messageAt: string;
  floor: string | undefined;
};

export type SupervisionVerdict =
  | { action: "none"; reason: string }
  | {
      action: "create" | "update";
      status: SupervisionStatus;
      reason?: string;
    };
