/**
 * H8 decision: between the correction and "keep the query as typed". Pure: the
 * limits are fixed before any measurement and are inclusive.
 */

/** Apply the correction from this probability on. */
export const APPLY_LIMIT = 0.9;
/** Suggest the correction from this probability on, below APPLY_LIMIT. */
export const SUGGEST_LIMIT = 0.6;

export type ChoiceDecision = "apply" | "suggest" | "none";

/**
 * "keep" wins when it is more likely, and an exact tie takes no action. Otherwise
 * the correction is applied at or above APPLY_LIMIT, suggested at or above
 * SUGGEST_LIMIT, and ignored below it.
 */
export function decideChoice(pCorrection: number, pKeep: number): ChoiceDecision {
  if (pKeep > pCorrection) return "none";
  if (pCorrection === pKeep) return "none";
  if (pCorrection >= APPLY_LIMIT) return "apply";
  if (pCorrection >= SUGGEST_LIMIT) return "suggest";
  return "none";
}
