import type { ActivationValidationError, Translate } from "./types.js";

/** A failed save or recovery, read from the error text the app throws for a non-OK response. */
export type ServerFailure =
  | { kind: "invalid"; errors: ActivationValidationError[] }
  | { kind: "refused"; reason: string }
  | { kind: "unknown"; text: string };

/** Dispatch table: a server refusal reason to its message. Unknown reasons show as they come. */
const REFUSAL_LINES: Partial<Record<string, string>> = {
  thread_closed: "This thread is closed, so its policy cannot change.",
  nothing_to_recover: "Nothing to recover: every state file is healthy.",
  move_aside_conflict:
    "A state file could not be moved aside. Check the workspace folder.",
  stage_mapping_required:
    "This thread is on a stage from an earlier version. Confirm the move to Planning, then save again.",
  stage_changed:
    "The stage changed while you were looking. Nothing moved; the panel shows the current stage.",
  last_stage: "Review is the last stage. There is no next stage to advance to.",
  not_ahead: "Choose a stage ahead of the current one.",
  policy_disabled: "Turn the switch on and save before using stage actions.",
  not_ready:
    "The thread is not ready for stage actions. Save the policy and the setting first.",
  lead_changed:
    "The lead changed while you were looking. Nothing moved; the panel shows the current lead.",
  not_architect: "Only an architect profile can lead this thread.",
  same_lead: "This architect already leads the thread.",
  not_awaiting:
    "This card is no longer waiting for approval. The panel shows its current state.",
  not_declinable: "Only a card waiting for approval can be declined.",
  not_found:
    "This card is no longer in the thread. The panel shows the current state.",
  not_retryable: "Retry is not offered for this failure.",
  not_continuable: "Continue is offered only after a time limit.",
  attempts_exhausted: "This turn used all its attempts.",
  not_startable:
    "This card cannot start now. The panel shows its current state.",
  policy_not_ready: "The thread policy is not ready. Save it first.",
  turn_timeout_tampered:
    "The turn time limit was edited by hand. Save it in workspace settings to authorize it.",
  turn_timeout_unreadable:
    "The turn time limit cannot be read. Save it in workspace settings.",
  checking_sessions:
    "The daemon is checking sessions after a restart. Try again in a moment.",
  busy: "The agent is busy in another session.",
  not_listening:
    "The open session is not listening. Wake it in its terminal, or close it.",
  other_host: "The agent is open on another machine.",
  identity_unverified:
    "The open session could not be verified, so nothing was started.",
  already_decided:
    "This request was already decided. The panel shows its current state.",
  request_not_found:
    "This request is no longer open. The panel shows its current state.",
  run_not_found: "The turn is no longer running, so nothing was recorded.",
  slot_not_held: "The session is no longer held by this turn.",
  not_turn_child: "Only the turn's own client can open a permission request.",
  not_turn_process: "Only the turn's own client can open a permission request."
};

/**
 * The refusals whose state the panel already shows above the footer. The footer only says that the
 * call changed nothing, so each failure appears once.
 */
const SHOWN_ABOVE_REASONS: readonly string[] = [
  "ledger_lost",
  "ledger_invalid",
  "policy_outdated",
  "policy_tampered",
  "settings_tampered",
  "revision_mismatch",
  "ledger_restored"
];
const SHOWN_ABOVE_LINE = "Nothing was saved. The state is shown above.";

/** Dispatch table: a validation code to its message. */
const CODE_LINES: Partial<Record<string, string>> = {
  invalid_slug: "Use lowercase letters, digits and single hyphens.",
  out_of_range: "The value is out of range.",
  invalid_type: "The value has the wrong type.",
  no_participants:
    "At least one architect profile is needed to enable the policy."
};

/** No row-numbered fields remain: the stages are fixed and the participants are not edited. */
const PLACE_PATTERNS: ReadonlyArray<{ pattern: RegExp; name: string }> = [];

export function refusalTextOf(reason: string, t: Translate): string {
  if (SHOWN_ABOVE_REASONS.includes(reason)) return t(SHOWN_ABOVE_LINE);
  return t(REFUSAL_LINES[reason] ?? reason);
}

/** One validation error as a line: the place it names, then what is wrong. */
export function issueTextOf(
  error: ActivationValidationError,
  t: Translate
): string {
  const message = t(CODE_LINES[error.code] ?? error.code);
  const place = PLACE_PATTERNS.map((item) => ({
    name: item.name,
    match: item.pattern.exec(error.field)
  })).find((item) => item.match !== null);
  if (!place?.match) return message;
  return t("{{name}} {{number}} · {{message}}", {
    name: t(place.name),
    number: Number(place.match[1]) + 1,
    message
  });
}

export function serverFailureOf(error: unknown): ServerFailure {
  const text = error instanceof Error ? error.message : String(error);
  const body = parseBody(text);
  if (Array.isArray(body.errors)) {
    return {
      kind: "invalid",
      errors: body.errors as ActivationValidationError[]
    };
  }
  if (typeof body.reason === "string") {
    return { kind: "refused", reason: body.reason };
  }
  if (typeof body.error === "string") {
    return { kind: "refused", reason: body.error };
  }
  return { kind: "unknown", text };
}

function parseBody(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The lines a failed save or recovery shows. */
export function failureLinesOf(failure: ServerFailure, t: Translate): string[] {
  if (failure.kind === "invalid") {
    return failure.errors.map((error) => issueTextOf(error, t));
  }
  if (failure.kind === "refused") return [refusalTextOf(failure.reason, t)];
  return [failure.text];
}

/** Every message key of this module, for the catalog test. Table keys are not literal t() calls. */
export const FAILURE_LABEL_KEYS: string[] = [
  SHOWN_ABOVE_LINE,
  ...Object.values(REFUSAL_LINES).filter(
    (text): text is string => text !== undefined
  ),
  ...Object.values(CODE_LINES).filter(
    (text): text is string => text !== undefined
  ),
  ...PLACE_PATTERNS.map((item) => item.name),
  "{{name}} {{number}} · {{message}}"
];
