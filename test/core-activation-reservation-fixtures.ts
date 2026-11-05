import type { ReservationInput } from "../src/core/activation-reservation.js";
import type {
  OriginMessage,
  ReservationDecision,
  ReservationRecord,
  StageBudgets
} from "../src/core/activation-reservation-types.js";

export const ARCHITECT = "claude-software-architect";
export const OTHER = "codex-software-architect";
export const T0 = "2026-11-05T10:00:00.000Z";
export const T1 = "2026-11-05T10:01:00.000Z";
export const T2 = "2026-11-05T10:02:00.000Z";

export function budgets(used = 0, max = 5): StageBudgets {
  return {
    planning: { used, max },
    execution: { used: 0, max: 5 },
    review: { used: 0, max: 5 }
  };
}

export function message(overrides: Partial<OriginMessage> = {}): OriginMessage {
  return {
    author: ARCHITECT,
    timestamp: T1,
    mentionsRecipient: true,
    ...overrides
  };
}

/** A judgment input with the defaults of an architect's first mention to Codex. */
export function input(
  overrides: Partial<ReservationInput> = {}
): ReservationInput {
  return {
    request: {
      messageId: "msg_1",
      recipient: OTHER,
      holder: "session-codex",
      runId: "run-1"
    },
    gate: { kind: "open", enabled: true },
    message: message(),
    uiMessage: false,
    authorIsArchitect: true,
    currentStage: "planning",
    attemptCap: 2,
    revision: "rev-1",
    budgets: budgets(),
    records: [],
    ...overrides
  };
}

/** A granted record of the first mention, as a first delivery leaves it. */
export function recordOf(
  overrides: Partial<ReservationRecord> = {}
): ReservationRecord {
  return {
    messageId: "msg_1",
    recipient: OTHER,
    author: ARCHITECT,
    origin: "architect",
    holder: "session-codex",
    runId: "run-1",
    runIds: ["run-1"],
    stage: "planning",
    status: "granted",
    granted: true,
    attempts: 0,
    cycle: 1,
    cycleRole: "open",
    cycleState: "open",
    messageAt: T1,
    ...overrides
  };
}

/** The fields a row asserts. A row lists only the fields it cares about. */
export function picked(
  decision: ReservationDecision,
  keys: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(
    keys.map((key) => [key, decision[key as keyof ReservationDecision]])
  );
}
