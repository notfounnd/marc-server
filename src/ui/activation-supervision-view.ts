import type { ActivationStageId } from "./types.js";

/** The statuses of a supervisor card, as the daemon names them. The panel shows the pending ones only. */
export type ActivationSupervisionStatus =
  | "waiting"
  | "awaiting_confirmation"
  | "starting"
  | "running"
  | "failed"
  | "done"
  | "declined"
  | "expired"
  | "superseded";

/** One open permission request of a running card, as the panel lists it. */
export type ActivationPermissionView = {
  requestId: string;
  toolName: string;
  summary: string;
  createdAt: string;
  expiresAt: string;
};

/** A supervisor card: a start awaiting approval, a wait, a running turn or a failed turn. */
export type ActivationSupervisionCard = {
  messageId: string;
  recipient: string;
  stage: ActivationStageId;
  status: ActivationSupervisionStatus;
  reason?: string;
  expiresAt: string;
  attempt: number;
  permissions: ActivationPermissionView[];
  /** The instant a running turn stops. */
  deadlineAt?: string;
  /** The turn's cost in USD, as the client reported it. */
  costUsd?: number;
  /** The whole minutes a failed turn was allowed to run. Absent when the daemon lacks one of its instants. */
  turnMinutes?: number;
  /** True when the daemon's start rule accepts Retry now. */
  canRetry: boolean;
  /** True when the daemon's start rule accepts Continue now. */
  canContinue: boolean;
};
