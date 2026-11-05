import {
  FIXED_STAGES,
  type FixedStage,
  type StageCounters
} from "../core/activation-stages.js";
import { isBehindFloor, type StageFloor } from "../core/activation-floor.js";
import { cyclesCountersOf, storedCyclesOf } from "./activation-activity.js";
import type { ThreadActivity } from "./activation-file.js";

/** The pin of a state rebuilt by the human's recovery. It never matches a policy revision, so the thread stays paused until a save. */
export const RECOVERED_PIN = "recovered";

/**
 * The activity a recovery writes when the stored counters are behind the stamped floor. Each
 * fixed stage keeps the larger of the stored and the stamped cycles. Extensions and every other
 * key stay. Without an activation, a pinned placeholder carries the counters until the next save.
 * Undefined means nothing needs to change.
 */
export function raisedActivity(
  activation: ThreadActivity | undefined,
  floor: StageFloor,
  fallbackStage: FixedStage
): ThreadActivity | undefined {
  if (!isBehindFloor(storedCyclesOf(activation), floor)) return undefined;
  const base = activation ?? recoveredActivity(fallbackStage);
  return {
    ...base,
    stages: { ...base.stages, ...raisedCounters(base, floor) }
  };
}

function raisedCounters(
  base: ThreadActivity,
  floor: StageFloor
): Record<string, StageCounters> {
  return Object.fromEntries(
    FIXED_STAGES.map((stage) => {
      const counters = cyclesCountersOf(base.stages[stage]);
      return [
        stage,
        {
          cyclesUsed: Math.max(counters.cyclesUsed, floor[stage]),
          extensions: counters.extensions
        }
      ];
    })
  );
}

function recoveredActivity(stage: FixedStage): ThreadActivity {
  return {
    authorizedRevision: RECOVERED_PIN,
    authorizedHash: RECOVERED_PIN,
    currentStage: stage,
    stages: {}
  };
}
