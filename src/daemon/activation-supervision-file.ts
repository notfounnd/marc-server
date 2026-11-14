import { isRecord } from "../core/activation-rules.js";
import { isFixedStage } from "../core/activation-stages.js";
import {
  SUPERVISION_STATUSES,
  type SupervisionRecord
} from "../core/activation-supervision-types.js";

/**
 * The optional supervision key of a thread state file. Absent is an empty state, and a present value
 * must have the shape of SupervisionState. Only the daemon writes it, so a malformed value is invalid.
 */
export function isOptionalSupervision(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.records) &&
    value.records.every(isSupervisionRecord) &&
    isFloors(value.floors)
  );
}

function isSupervisionRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isText(value.messageId) &&
    isText(value.messageAt) &&
    isText(value.recipient) &&
    typeof value.stage === "string" &&
    isFixedStage(value.stage) &&
    isStatus(value.status) &&
    isOptionalText(value.reason) &&
    isText(value.createdAt) &&
    isText(value.expiresAt) &&
    isCount(value.attempt) &&
    isOptionalText(value.runId) &&
    isOptionalTurn(value.turn) &&
    isOptionalOutcome(value.outcome)
  );
}

/** The launch block of a card. Absent before the first approval, and always whole once it is written. */
function isOptionalTurn(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isCount(value.generation) &&
    (value.mode === "new" || value.mode === "resume") &&
    isText(value.fingerprint) &&
    typeof value.continuation === "boolean" &&
    (value.pid === undefined || isCount(value.pid)) &&
    isOptionalText(value.startedAt) &&
    (value.auto === undefined || typeof value.auto === "boolean")
  );
}

function isStatus(value: unknown): value is SupervisionRecord["status"] {
  return (SUPERVISION_STATUSES as readonly unknown[]).includes(value);
}

function isFloors(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isText);
}

function isOptionalOutcome(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isOptionalCost(value.costUsd) &&
    isCount(value.denials) &&
    isOptionalText(value.failure)
  );
}

/** A cost is absent when the output was not read, and otherwise a finite, non-negative number. A file written with 0 stays valid. */
function isOptionalCost(value: unknown): boolean {
  if (value === undefined) return true;
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isText(value: unknown): boolean {
  return typeof value === "string";
}

function isOptionalText(value: unknown): boolean {
  if (value === undefined) return true;
  return isText(value);
}

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}
