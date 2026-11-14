import type { FixedStage } from "../core/activation-stages.js";
import type {
  SupervisionRecord,
  SupervisionState,
  SupervisionStatus,
  SupervisionTurn
} from "../core/activation-supervision-types.js";
import type { PermissionRequestView } from "../core/supervision-permissions.js";
import type { ActivitySupervision } from "../core/thread-activity-markdown.js";
import { startRefusalOf, type StartAction } from "./supervision-start.js";

/**
 * A card as the panel shows it. No run id, pid, host or session id: nothing a process could use. The
 * turn fields show what the turn is and what it cost, never the process that ran it.
 */
export type SupervisionCardView = {
  messageId: string;
  recipient: string;
  stage: FixedStage;
  status: SupervisionStatus;
  reason?: string;
  expiresAt: string;
  attempt: number;
  /** The open permission requests of a running card. Empty on every other card. */
  permissions: PermissionRequestView[];
  /** The instant a running turn stops. Present only on a running card whose time limit was recorded. */
  deadlineAt?: string;
  /** The turn's cost in USD as the client reported it. Present once the card has an outcome. */
  costUsd?: number;
  /** The whole minutes a failed turn was allowed to run. Absent when the card lacks one of its two instants. */
  turnMinutes?: number;
  /** True when the start rule accepts Retry for this card now. */
  canRetry: boolean;
  /** True when the start rule accepts Continue for this card now. */
  canContinue: boolean;
};

/** The open requests of a run, for the panel. A card with no run shows none. */
export type OpenRequestsOf = (runId: string) => PermissionRequestView[];

const NO_REQUESTS: OpenRequestsOf = () => [];

/** The statuses of a card that has left the panel. They count in Activity, and nothing else shows them. */
const LEFT_PANEL: readonly SupervisionStatus[] = [
  "done",
  "declined",
  "expired",
  "superseded"
];

const MINUTE_MS = 60_000;

/**
 * The cards still on the panel: pending, starting, running and failed. The attempt cap of the policy is
 * needed for Retry and Continue; without a readable policy neither is offered.
 */
export function supervisionCardsOf(
  state: SupervisionState | undefined,
  openOf: OpenRequestsOf = NO_REQUESTS,
  attemptCap?: number
): SupervisionCardView[] {
  return (state?.records ?? [])
    .filter((record) => !LEFT_PANEL.includes(record.status))
    .map((record) => viewOf(record, openOf, attemptCap));
}

function viewOf(
  record: SupervisionRecord,
  openOf: OpenRequestsOf,
  attemptCap: number | undefined
): SupervisionCardView {
  return {
    messageId: record.messageId,
    recipient: record.recipient,
    stage: record.stage,
    status: record.status,
    ...(record.reason === undefined ? {} : { reason: record.reason }),
    expiresAt: record.expiresAt,
    attempt: record.attempt,
    permissions: permissionsOf(record, openOf),
    ...deadlineFieldOf(record),
    ...costFieldOf(record),
    ...turnMinutesFieldOf(record),
    canRetry: offers(record, "retry", attemptCap),
    canContinue: offers(record, "continue", attemptCap)
  };
}

/** Only a running card can have open requests: its turn is the one that asks. */
function permissionsOf(
  record: SupervisionRecord,
  openOf: OpenRequestsOf
): PermissionRequestView[] {
  if (record.status !== "running" || record.runId === undefined) return [];
  return openOf(record.runId);
}

function deadlineFieldOf(record: SupervisionRecord): { deadlineAt?: string } {
  if (record.status !== "running") return {};
  const deadlineAt = record.turn?.deadlineAt;
  return deadlineAt === undefined ? {} : { deadlineAt };
}

/** The turn's cost, only when the turn's output was read. A turn that timed out without output shows no cost. */
function costFieldOf(record: SupervisionRecord): { costUsd?: number } {
  const costUsd = record.outcome?.costUsd;
  return costUsd === undefined ? {} : { costUsd };
}

function turnMinutesFieldOf(record: SupervisionRecord): {
  turnMinutes?: number;
} {
  if (record.status !== "failed") return {};
  const minutes = turnMinutesOf(record.turn);
  return minutes === undefined ? {} : { turnMinutes: minutes };
}

/** The whole minutes between the start and the deadline of a turn, or undefined when either instant is missing. */
function turnMinutesOf(turn: SupervisionTurn | undefined): number | undefined {
  if (turn?.deadlineAt === undefined || turn.runningAt === undefined) {
    return undefined;
  }
  const minutes = Math.round(
    (Date.parse(turn.deadlineAt) - Date.parse(turn.runningAt)) / MINUTE_MS
  );
  return Number.isFinite(minutes) ? minutes : undefined;
}

/** Offers an action when the same rule the start uses accepts the card now. Without a cap, nothing is offered. */
function offers(
  record: SupervisionRecord,
  action: Exclude<StartAction, "approve" | "auto">,
  attemptCap: number | undefined
): boolean {
  if (attemptCap === undefined) return false;
  return startRefusalOf(action, record, attemptCap) === undefined;
}

/**
 * The counts Activity keeps: the turns the supervisor started, the failed cards, the expired cards and the
 * estimated cost of the turns. Only counts and a sum. No id, pid or host is kept here.
 */
export function supervisionCountsOf(
  state: SupervisionState | undefined
): ActivitySupervision {
  const records = state?.records ?? [];
  return {
    activations: records.reduce((sum, record) => sum + record.attempt, 0),
    failures: countOf(records, "failed"),
    expired: countOf(records, "expired"),
    costUsd: records.reduce(
      (sum, record) => sum + (record.outcome?.costUsd ?? 0),
      0
    )
  };
}

function countOf(
  records: readonly SupervisionRecord[],
  status: SupervisionStatus
): number {
  return records.filter((record) => record.status === status).length;
}
