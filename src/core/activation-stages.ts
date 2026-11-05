/**
 * The three fixed stages of every thread. Ids, labels and exit conditions are not user
 * data: the user never edits them. Counting is in cycles (one architect round trip),
 * and the stage record carries the cycles used and the human grants for the stage.
 */
export const FIXED_STAGES = ["planning", "execution", "review"] as const;

export type FixedStage = (typeof FIXED_STAGES)[number];

export type CycleGrant = { at: string; cycles: number };

/** Counters of a fixed stage. Grants are human extensions, added to the stage's maximum. */
export type StageCounters = { cyclesUsed: number; extensions: CycleGrant[] };

/**
 * Counters written by F3a under the stage ids of the user's own stages. They are kept as
 * history and never read as cycles.
 */
export type LegacyCounters = { passesUsed: number; attempts: number };

export type StoredStage = StageCounters | LegacyCounters;

export function isFixedStage(value: unknown): value is FixedStage {
  return (
    typeof value === "string" &&
    (FIXED_STAGES as readonly string[]).includes(value)
  );
}

/** The next fixed stage, or undefined at review. Advance never invents a fourth stage. */
export function nextStageOf(stage: FixedStage): FixedStage | undefined {
  return FIXED_STAGES[FIXED_STAGES.indexOf(stage) + 1];
}

/** The fixed stages strictly after `stage`, in order. Empty at the last stage. */
export function stagesAheadOf(stage: FixedStage): FixedStage[] {
  return FIXED_STAGES.slice(FIXED_STAGES.indexOf(stage) + 1);
}

/** True when `to` names a fixed stage strictly after `from`. Any other value is not ahead. */
export function isAheadOf(from: FixedStage, to: unknown): to is FixedStage {
  return isFixedStage(to) && stagesAheadOf(from).includes(to);
}

/** A fixed stage strictly between `from` and `to` (both exclusive): a stage a move jumped over. */
export function isJumpedBy(
  from: FixedStage,
  to: FixedStage,
  stage: FixedStage
): boolean {
  const position = FIXED_STAGES.indexOf(stage);
  return (
    FIXED_STAGES.indexOf(from) < position && position < FIXED_STAGES.indexOf(to)
  );
}
