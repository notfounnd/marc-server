import type {
  ActivationBudget,
  ActivationPolicy,
  ActivationStageId,
  ThreadActivationView
} from "./types.js";
import { FAILURE_LABEL_KEYS } from "./thread-activation-failures.js";
import { STATUS_LABEL_KEYS } from "./thread-activation-status.js";

/** The daemon defaults for the two limits the panel does not edit. */
export const DEFAULT_ATTEMPT_CAP = 2;
export const DEFAULT_PENDING_TTL_MINUTES = 1440;

/** The message key of each fixed stage. Their ids are not user data. */
export const STAGE_NAME_KEYS: Record<ActivationStageId, string> = {
  planning: "Planning",
  execution: "Execution",
  review: "Review"
};

/** The name of a stage in the panel and in message stamps. An unknown stage shows its own text. */
export function stageNameKeyOf(stage: string): string {
  return STAGE_NAME_KEYS[stage as ActivationStageId] ?? stage;
}

/** The only thing the switch edits. Stages and participants are not part of the draft. */
export type PolicyDraft = { enabled: boolean };

/** The body the policy route expects. stageMapping is sent only when the stored stage needs the human's mapping. */
export type ActivationForm = {
  enabled: boolean;
  attemptCap: number;
  pendingTtlMinutes: number;
  stageMapping?: { from: string; to: "planning" };
};

/** The draft a form starts from: the stored switch, or off when no policy is readable. */
export function draftOf(view: ThreadActivationView | undefined): PolicyDraft {
  return { enabled: view?.enabled ?? false };
}

/** The body the daemon expects. The limits keep their saved values, or the daemon defaults. */
export function formOf(
  draft: PolicyDraft,
  prior: ActivationPolicy | null,
  legacyStage: string | null
): ActivationForm {
  return {
    enabled: draft.enabled,
    attemptCap: prior?.attemptCap ?? DEFAULT_ATTEMPT_CAP,
    pendingTtlMinutes: prior?.pendingTtlMinutes ?? DEFAULT_PENDING_TTL_MINUTES,
    ...mappingOf(legacyStage)
  };
}

function mappingOf(legacyStage: string | null): {
  stageMapping?: { from: string; to: "planning" };
} {
  if (legacyStage === null) return {};
  return { stageMapping: { from: legacyStage, to: "planning" } };
}

/** One segment per cycle of the effective maximum: the used ones are filled. */
export function segmentsOf(budget: ActivationBudget): boolean[] {
  const used = budget.cyclesUsed ?? 0;
  return Array.from({ length: budget.max }, (_, index) => index < used);
}

/** Every message key of the panel, for the catalog test. Table keys are not literal t() calls. */
export const ACTIVATION_LABEL_KEYS: string[] = [
  ...STATUS_LABEL_KEYS,
  ...FAILURE_LABEL_KEYS,
  ...Object.values(STAGE_NAME_KEYS)
];
