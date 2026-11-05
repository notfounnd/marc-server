import { createHash } from "node:crypto";
import { canonicalJson } from "./activation-policy-hash.js";
import type { RawActivity } from "./activation-cycles.js";
import { isRecord } from "./activation-rules.js";
import { DEFAULT_TURN_TIMEOUT_MINUTES } from "./activation-turn-timeout-limits.js";

export {
  DEFAULT_TURN_TIMEOUT_MINUTES,
  MAX_TURN_TIMEOUT_MINUTES,
  MIN_TURN_TIMEOUT_MINUTES,
  isTurnTimeoutMinutes
} from "./activation-turn-timeout-limits.js";

/**
 * The time limit of one supervised turn is a workspace setting in marc.config.json
 * (activation.turnTimeoutMinutes). It follows the cycles setting: the file is trusted only through
 * the authorization the daemon records when the human saves the value in the UI, and a hash inside
 * the JSON is not authorization. This module holds the pure rules. Reading the file and recording the
 * authorization belong to the daemon.
 */

export const MINUTE_MS = 60_000;
/** The last part of the limit in which every mARC tool response carries the time left. */
export const WARNING_WINDOW_MS = 10 * MINUTE_MS;
/** The time a turn has, after its deadline, to stop by itself before the process tree is killed. */
export const STOP_GRACE_MS = 2 * MINUTE_MS;

export type TurnTimeoutAuthorization = {
  turnTimeoutMinutes: number;
  /** Content pin of the effective value, as turnTimeoutContentHash computes it. */
  hash: string;
  at: string;
};

export type TurnTimeoutState = {
  status: "authorized" | "tampered";
  turnTimeoutMinutes: number;
};

/** The content pin of the setting: the effective value, with the default applied when the key is absent. */
export function turnTimeoutContentHash(turnTimeoutMinutes: unknown): string {
  return createHash("sha256")
    .update(canonicalJson({ turnTimeoutMinutes }), "utf8")
    .digest("hex");
}

/** Absent section or absent key means the default. Anything else is taken as written, so a hand edit changes the pin. */
export function effectiveTurnTimeoutOf(activation: unknown): unknown {
  if (activation === undefined) return DEFAULT_TURN_TIMEOUT_MINUTES;
  if (!isRecord(activation)) return activation;
  if (!("turnTimeoutMinutes" in activation)) {
    return DEFAULT_TURN_TIMEOUT_MINUTES;
  }
  return activation.turnTimeoutMinutes;
}

/** The activation section of a parsed marc.config.json. A file that is not an object is unreadable. */
export function rawTurnTimeoutOf(config: unknown): RawActivity {
  if (!isRecord(config)) return { status: "unreadable" };
  return { status: "readable", activation: config.activation };
}

/**
 * Authorized when the effective content matches the recorded pin, or the default pin when nothing was
 * recorded. The authorized value is the recorded one, never the file's value.
 */
export function turnTimeoutStateOf(
  raw: RawActivity,
  authorization: TurnTimeoutAuthorization | undefined
): TurnTimeoutState {
  const turnTimeoutMinutes =
    authorization?.turnTimeoutMinutes ?? DEFAULT_TURN_TIMEOUT_MINUTES;
  const matches = matchesPin(raw, authorization);
  return {
    status: matches ? "authorized" : "tampered",
    turnTimeoutMinutes
  };
}

function matchesPin(
  raw: RawActivity,
  authorization: TurnTimeoutAuthorization | undefined
): boolean {
  if (raw.status === "unreadable") return false;
  const pin =
    authorization?.hash ?? turnTimeoutContentHash(DEFAULT_TURN_TIMEOUT_MINUTES);
  return turnTimeoutContentHash(effectiveTurnTimeoutOf(raw.activation)) === pin;
}

export type DeadlineNotice =
  | { kind: "none" }
  | { kind: "warning"; minutesLeft: number; message: string }
  | { kind: "stop"; message: string }
  | { kind: "kill" };

type DeadlinePhase = "running" | "warning" | "stop" | "kill";

export const STOP_NOW_MESSAGE =
  "stop now: do not start a new change, post your progress and stop";

export function warningMessage(minutesLeft: number): string {
  return `${minutesLeft} minutes left: finish the current change, post your progress and stop`;
}

/**
 * What a tool response tells the turn at a given instant. Nothing until the last ten minutes, then the
 * time left, then "stop now" after the deadline, and a kill once the grace period has run out.
 */
export function deadlineNotice(
  now: number,
  deadline: number,
  grace: number
): DeadlineNotice {
  return NOTICE_BY_PHASE[phaseOf(now, deadline, grace)](now, deadline);
}

function phaseOf(now: number, deadline: number, grace: number): DeadlinePhase {
  if (now >= deadline + grace) return "kill";
  if (now >= deadline) return "stop";
  if (deadline - now <= WARNING_WINDOW_MS) return "warning";
  return "running";
}

const NOTICE_BY_PHASE: Record<
  DeadlinePhase,
  (now: number, deadline: number) => DeadlineNotice
> = {
  running: () => ({ kind: "none" }),
  warning: (now, deadline) => {
    const minutesLeft = Math.ceil((deadline - now) / MINUTE_MS);
    return {
      kind: "warning",
      minutesLeft,
      message: warningMessage(minutesLeft)
    };
  },
  stop: () => ({ kind: "stop", message: STOP_NOW_MESSAGE }),
  kill: () => ({ kind: "kill" })
};
