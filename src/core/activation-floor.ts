import { FIXED_STAGES, type FixedStage } from "./activation-stages.js";
import type { ChatMessage } from "./types.js";

/**
 * The floor is derived, never stored: the highest cycle stamped per stage in CHAT.md. Markdown
 * is the source of truth, so a state file restored from an older copy cannot erase the cycles
 * the messages already record.
 */
export type StageFloor = Record<FixedStage, number>;

/** Counters as the state file holds them, per fixed stage. */
export type StageCycles = Record<FixedStage, number>;

export const NO_FLOOR: StageFloor = { planning: 0, execution: 0, review: 0 };

export function stampedFloorOf(messages: readonly ChatMessage[]): StageFloor {
  return Object.fromEntries(
    FIXED_STAGES.map((stage) => [stage, highestCycleIn(messages, stage)])
  ) as StageFloor;
}

/** True when a stored counter is behind a cycle the messages already stamped. */
export function isBehindFloor(cycles: StageCycles, floor: StageFloor): boolean {
  return FIXED_STAGES.some((stage) => floor[stage] > cycles[stage]);
}

/** The furthest fixed stage any stamped message carries. Used to place a recovered thread. */
export function highestStampedStage(
  messages: readonly ChatMessage[]
): FixedStage | undefined {
  return [...FIXED_STAGES]
    .reverse()
    .find((stage) => messages.some((message) => message.stage === stage));
}

/** The first message whose author has the architect role in the registry. Fixed for the thread. */
export function derivedLeadOf(
  messages: readonly ChatMessage[],
  architects: ReadonlySet<string>
): string | undefined {
  return messages.find((message) => architects.has(message.agentId))?.agentId;
}

function highestCycleIn(
  messages: readonly ChatMessage[],
  stage: FixedStage
): number {
  return messages.reduce((highest, message) => {
    const cycle = message.cycle ?? 0;
    return message.stage === stage && cycle > highest ? cycle : highest;
  }, 0);
}
