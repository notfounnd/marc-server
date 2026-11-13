import {
  isCyclesPerStage,
  type CyclesAuthorization
} from "../core/activation-cycles.js";
import type { PauseInterval } from "../core/activation-pauses.js";
import type { SupervisionState } from "../core/activation-supervision-types.js";
import {
  isTurnTimeoutMinutes,
  type TurnTimeoutAuthorization
} from "../core/activation-turn-timeout.js";
import { isOptionalSupervision } from "./activation-supervision-file.js";
import type {
  LegacyCounters,
  StageCounters
} from "../core/activation-stages.js";
import type { StageHistoryEntry } from "../core/activation-advance.js";
import type { LeadChange } from "../core/activation-lead.js";
import type { ReservationRecord } from "../core/activation-reservation-types.js";
import { IDENTITY_CHECKS } from "../core/waiter-identity.js";

/**
 * Shapes of the activation state kept beside the session slots. The counters live
 * in the thread state file, and the pause and the cycles authorization live in the
 * workspace file. Unknown keys are preserved by every writer, so later phases can add
 * fields without a format break.
 */
export type ThreadActivity = {
  authorizedRevision: string;
  /** sha256 of the authorized policy content, as policyContentHash computes it. */
  authorizedHash: string;
  currentStage: string;
  /** Fixed-stage counters after normalization. F3a counters may still be here until a save. */
  stages: Record<string, StageCounters | LegacyCounters>;
  /** F3a counters kept as history. Never read as cycles. */
  legacyStages?: Record<string, LegacyCounters>;
};

export type RecoveryRecord = {
  at: string;
  reason: string;
  movedAside?: string;
};

/** Activation keys inside a thread state file, next to the F2 registry fields. */
export type ThreadExtras = {
  /** When the daemon first created the state. The thread's own creation time is the earlier bound. */
  createdAt?: string;
  activation?: ThreadActivity;
  recoveries?: RecoveryRecord[];
  /** Reservations by message and recipient. Bounded; the pruning floor is `prunedThrough`. */
  reservations?: ReservationRecord[];
  /** Newest message time among the pruned reservations. It only moves forward. */
  prunedThrough?: string;
  /** Stage moves, human or agent, bounded. */
  stageHistory?: StageHistoryEntry[];
  /** Messages posted through the UI route. Bounded; a message missing here is not a UI origin. */
  uiMessages?: Array<{ messageId: string; at: string }>;
  /** The lead the human recorded. Absent means the lead is the derived first architect. */
  lead?: string;
  /** Human changes of the lead, oldest first, bounded. */
  leadChanges?: LeadChange[];
  /** The supervisor's cards and the per-recipient floors. Absent means an empty state. */
  supervision?: SupervisionState;
};

/** The workspace file: the current pause and the bounded history of closed and open pauses. */
export type WorkspaceFile = {
  version: 1;
  paused: boolean;
  pausedAt?: string;
  pauseHistory?: PauseInterval[];
  /** Pauses that ended before this moment may be missing from pauseHistory. */
  historyCompleteSince?: string;
  /** The last UI save of the cycles setting. The only trusted source of its value. */
  cyclesAuthorization?: CyclesAuthorization;
  /** The last UI save of the turn time limit. The only trusted source of its value. */
  turnTimeoutAuthorization?: TurnTimeoutAuthorization;
  recoveries?: RecoveryRecord[];
};

export function emptyWorkspaceFile(): WorkspaceFile {
  return { version: 1, paused: false };
}

export function isWorkspaceFile(value: unknown): value is WorkspaceFile {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.paused === "boolean" &&
    isOptionalText(value.pausedAt) &&
    isOptionalText(value.historyCompleteSince) &&
    isOptionalIntervals(value.pauseHistory) &&
    isOptionalCyclesAuthorization(value.cyclesAuthorization) &&
    isOptionalTurnTimeoutAuthorization(value.turnTimeoutAuthorization) &&
    isOptionalRecoveries(value.recoveries)
  );
}

function isOptionalTurnTimeoutAuthorization(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isTurnTimeoutMinutes(value.turnTimeoutMinutes) &&
    isText(value.hash) &&
    isText(value.at)
  );
}

function isOptionalCyclesAuthorization(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isText(value.revision) &&
    isCyclesPerStage(value.cyclesPerStage) &&
    isText(value.hash) &&
    isText(value.at)
  );
}

/** Optional keys only: an F2 registry without them stays valid. */
export function isThreadExtras(value: Record<string, unknown>): boolean {
  return (
    isOptionalText(value.createdAt) &&
    isOptionalRecoveries(value.recoveries) &&
    isOptionalActivation(value.activation) &&
    isOptionalReservations(value.reservations) &&
    isOptionalText(value.prunedThrough) &&
    isOptionalHistory(value.stageHistory) &&
    isOptionalUiMessages(value.uiMessages) &&
    isOptionalText(value.lead) &&
    isOptionalLeadChanges(value.leadChanges) &&
    isOptionalSupervision(value.supervision)
  );
}

function isOptionalLeadChanges(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      isRecord(entry) &&
      isText(entry.at) &&
      isOptionalText(entry.from) &&
      isText(entry.to) &&
      entry.by === "human"
  );
}

function isOptionalReservations(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(isReservationRecord);
}

function isReservationRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isText(value.messageId) &&
    isText(value.recipient) &&
    isText(value.author) &&
    isText(value.holder) &&
    isText(value.runId) &&
    isTextList(value.runIds) &&
    isText(value.stage) &&
    isText(value.messageAt) &&
    isOneOf(value.status, RESERVATION_STATUSES) &&
    isOneOf(value.cycleRole, CYCLE_ROLES) &&
    typeof value.granted === "boolean" &&
    isCount(value.attempts) &&
    isOptionalCount(value.cycle) &&
    isOptionalText(value.reason) &&
    isOptionalText(value.answeredBy) &&
    isOptionalText(value.revision) &&
    isOptionalIdentityCheck(value.identityCheck)
  );
}

function isOptionalIdentityCheck(value: unknown): boolean {
  if (value === undefined) return true;
  return isOneOf(value, IDENTITY_CHECKS);
}

function isOptionalHistory(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      isRecord(entry) &&
      isText(entry.at) &&
      isText(entry.from) &&
      isText(entry.to) &&
      isOneOf(entry.by, ["human", "agent"]) &&
      isCount(entry.droppedHolds)
  );
}

function isOptionalUiMessages(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) => isRecord(entry) && isText(entry.messageId) && isText(entry.at)
  );
}

const RESERVATION_STATUSES = ["granted", "held", "refused"];
const CYCLE_ROLES = ["open", "close", "none"];

function isOneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function isTextList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isText);
}

function isOptionalCount(value: unknown): boolean {
  return value === undefined || isCount(value);
}

function isOptionalIntervals(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      isRecord(entry) &&
      isText(entry.pausedAt) &&
      isOptionalText(entry.resumedAt)
  );
}

function isOptionalActivation(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isText(value.authorizedRevision) &&
    isText(value.authorizedHash) &&
    isText(value.currentStage) &&
    isRecordOf(value.stages, isStoredStage) &&
    isOptionalLegacyStages(value.legacyStages)
  );
}

/** A fixed-stage record or an F3a counter record. Both stay readable until the next save. */
function isStoredStage(value: unknown): boolean {
  return isCycleCounters(value) || isLegacyCounters(value);
}

function isCycleCounters(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isCount(value.cyclesUsed) &&
    Array.isArray(value.extensions) &&
    value.extensions.every(isCycleGrant)
  );
}

function isCycleGrant(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isText(value.at) && isCount(value.cycles);
}

function isLegacyCounters(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isCount(value.passesUsed) && isCount(value.attempts);
}

function isOptionalLegacyStages(value: unknown): boolean {
  if (value === undefined) return true;
  return isRecordOf(value, isLegacyCounters);
}

function isOptionalRecoveries(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      isRecord(entry) &&
      isText(entry.at) &&
      isText(entry.reason) &&
      isOptionalText(entry.movedAside)
  );
}

function isRecordOf(
  value: unknown,
  check: (entry: unknown) => boolean
): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every(check);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || isText(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}
