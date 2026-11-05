import type { SupervisionOutcome } from "./activation-supervision-types.js";
import type {
  ClientAdapter,
  FailureReason,
  RunOutcome
} from "./client-adapters.js";

/** How a supervised turn ended: done, or failed with the reason its adapter named. */
export type TurnEnding =
  | { status: "done" }
  | { status: "failed"; reason: FailureReason };

export type TurnResult = {
  ending: TurnEnding;
  outcome: SupervisionOutcome;
  /** The session's total cost as this turn reported it. Undefined when the output carried no total. */
  lastCostUsd?: number;
};

/**
 * The cost of one turn. The client reports the session's running total, so a turn that resumes a session
 * costs the difference from the last total seen. A total below the last one means the session restarted,
 * so the whole total is the cost. The first turn of a session costs its total.
 */
export function costDeltaOf(total: number, last: number | undefined): number {
  if (last === undefined || total < last) return total;
  return total - last;
}

/** The result of one turn from what the executor observed and the adapter's reading of it. */
export function turnResultOf(
  run: RunOutcome,
  adapter: ClientAdapter,
  lastCostUsd: number | undefined
): TurnResult {
  const reason = adapter.failureReason(run);
  const costs = costsOf(run, lastCostUsd);
  return {
    ending: endingOf(reason),
    outcome: {
      ...costOutcomeOf(costs.costUsd),
      denials: costs.denials,
      ...failureOf(reason)
    },
    lastCostUsd: costs.lastCostUsd
  };
}

/** The cost of an outcome, present only when the output was read. */
function costOutcomeOf(costUsd: number | undefined): { costUsd?: number } {
  return costUsd === undefined ? {} : { costUsd };
}

/**
 * The end of a turn the executor could not record: the card fails with the error reason, and no cost is
 * claimed, since the turn's output was never read. The binding keeps the last total it had.
 */
export function errorTurnResult(): TurnResult {
  return {
    ending: { status: "failed", reason: "error" },
    outcome: { denials: 0, failure: "error" }
  };
}

function endingOf(reason: FailureReason | undefined): TurnEnding {
  if (reason === undefined) return { status: "done" };
  return { status: "failed", reason };
}

function failureOf(reason: FailureReason | undefined): { failure?: string } {
  if (reason === undefined) return {};
  return { failure: reason };
}

/** Output without a valid result has no cost and no denials, and keeps the last total it had. */
function costsOf(
  run: RunOutcome,
  lastCostUsd: number | undefined
): { costUsd?: number; denials: number; lastCostUsd: number | undefined } {
  if (run.parsed.status === "invalid_output") {
    return { denials: 0, lastCostUsd };
  }
  const result = run.parsed.result;
  return {
    costUsd: costDeltaOf(result.totalCostUsd, lastCostUsd),
    denials: result.permissionDenials.length,
    lastCostUsd: result.totalCostUsd
  };
}
