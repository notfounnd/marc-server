import {
  FIXED_STAGES,
  isFixedStage,
  type FixedStage,
  type StoredStage
} from "./activation-stages.js";

/** What the daemon knows about a thread's activation when it answers a request. */
export type ActivationThreadState =
  | {
      status: "ready";
      currentStage: FixedStage;
      stages: Record<string, StoredStage>;
    }
  | {
      status: "revision_mismatch";
      currentStage?: string;
      stages: Record<string, StoredStage>;
    }
  | {
      /** The revision matches but the content does not: a hand edit of policy.json. */
      status: "policy_tampered";
      currentStage?: string;
      stages: Record<string, StoredStage>;
    }
  | {
      /** The thread is enabled, but the cycles setting is not backed by an authorization. */
      status: "settings_tampered";
      currentStage?: string;
      stages: Record<string, StoredStage>;
    }
  | {
      /** An F3a version 1 policy: an enabled one needs a save before it can count. */
      status: "policy_outdated";
      currentStage?: string;
      stages: Record<string, StoredStage>;
    }
  | {
      /** The stored counters are behind the cycles stamped in CHAT.md: the state was restored from an older copy. */
      status: "ledger_restored";
      currentStage?: string;
      stages: Record<string, StoredStage>;
    }
  | { status: "ledger_lost" }
  | { status: "ledger_invalid" };

export type BudgetWarning =
  | "budget_last_cycle"
  | "budget_exhausted"
  | "revision_mismatch"
  | "ledger_restored"
  | "policy_tampered"
  | "settings_tampered"
  | "policy_outdated"
  | "ledger_lost"
  | "ledger_invalid";

export type BudgetView = {
  currentStage: FixedStage;
  /** Null while the counts are unknown (lost or invalid state file). */
  cyclesUsed: number | null;
  /** The authorized cycles per stage, never the value the file currently holds. */
  cyclesPerStage: number;
  /** Human extensions granted in the current stage. */
  granted: number;
  /** Effective maximum: cyclesPerStage plus the stage's grants. */
  max: number;
  remaining: number | null;
  warnings: BudgetWarning[];
};

/**
 * Budget for the current stage. Warnings come from two tables: one for the ledger state
 * and one for the counts. Ledger warnings that depend on the policy only show when the
 * policy is enabled, so a disabled thread keeps the manual flow with no warning.
 */
export function budgetView(
  enabled: boolean,
  state: ActivationThreadState,
  cyclesPerStage: number
): BudgetView {
  const stage = currentStageOf(state);
  const used = cyclesUsedIn(state, stage);
  const granted = grantedIn(state, stage);
  const max = cyclesPerStage + granted;
  return {
    currentStage: stage,
    cyclesUsed: used,
    cyclesPerStage,
    granted,
    max,
    remaining: used === null ? null : Math.max(0, max - used),
    warnings: [...ledgerWarnings(state, enabled), ...countWarnings(used, max)]
  };
}

/** Warnings about the ledger state. The policy-dependent ones are shown only when enabled. */
export function ledgerWarnings(
  state: ActivationThreadState,
  enabled: boolean
): BudgetWarning[] {
  return LEDGER_WARNINGS[state.status](enabled);
}

const LEDGER_WARNINGS: Record<
  ActivationThreadState["status"],
  (enabled: boolean) => BudgetWarning[]
> = {
  ready: () => [],
  revision_mismatch: gatedBy("revision_mismatch"),
  ledger_restored: gatedBy("ledger_restored"),
  policy_tampered: gatedBy("policy_tampered"),
  settings_tampered: gatedBy("settings_tampered"),
  policy_outdated: gatedBy("policy_outdated"),
  ledger_lost: () => ["ledger_lost"],
  ledger_invalid: () => ["ledger_invalid"]
};

function gatedBy(
  warning: BudgetWarning
): (enabled: boolean) => BudgetWarning[] {
  return (enabled) => (enabled ? [warning] : []);
}

/** A thread is paused for activation when its enabled policy is not backed by a matching authorization. */
export function isThreadPaused(
  state: ActivationThreadState,
  enabled: boolean
): boolean {
  return enabled && state.status !== "ready";
}

/**
 * The count warnings. The last-cycle warning fires when exactly one cycle remains, and only
 * for a stage with at least two cycles, so a single-cycle stage goes from unused to exhausted.
 */
const COUNT_WARNINGS: ReadonlyArray<{
  warning: BudgetWarning;
  applies: (used: number, max: number) => boolean;
}> = [
  { warning: "budget_exhausted", applies: (used, max) => used >= max },
  {
    warning: "budget_last_cycle",
    applies: (used, max) => max >= 2 && used + 1 === max
  }
];

function countWarnings(used: number | null, max: number): BudgetWarning[] {
  if (used === null) return [];
  return COUNT_WARNINGS.filter((rule) => rule.applies(used, max)).map(
    (rule) => rule.warning
  );
}

/** A stored or unknown stage falls back to the first fixed stage. It never moves forward by itself. */
export function currentStageOf(state: ActivationThreadState): FixedStage {
  if (!("currentStage" in state)) return FIXED_STAGES[0];
  return isFixedStage(state.currentStage)
    ? state.currentStage
    : FIXED_STAGES[0];
}

/** Cycles used in a stage, or null while the state file is lost or invalid. Legacy counters are not cycles. */
export function cyclesUsedIn(
  state: ActivationThreadState,
  stage: FixedStage
): number | null {
  if (state.status === "ledger_lost" || state.status === "ledger_invalid") {
    return null;
  }
  const entry = state.stages[stage];
  if (entry === undefined || !("cyclesUsed" in entry)) return 0;
  return entry.cyclesUsed;
}

function grantedIn(state: ActivationThreadState, stage: FixedStage): number {
  if (state.status === "ledger_lost" || state.status === "ledger_invalid") {
    return 0;
  }
  const entry = state.stages[stage];
  if (entry === undefined || !("extensions" in entry)) return 0;
  return entry.extensions.reduce((sum, grant) => sum + grant.cycles, 0);
}
