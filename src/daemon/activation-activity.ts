import type { ActivationThreadState } from "../core/activation-budget.js";
import { policyContentHash } from "../core/activation-policy-hash.js";
import type { ActivationPolicy } from "../core/activation-policy.js";
import type { PolicyView } from "../core/activation-policy-store.js";
import {
  NO_FLOOR,
  isBehindFloor,
  type StageFloor
} from "../core/activation-floor.js";
import {
  FIXED_STAGES,
  isFixedStage,
  type FixedStage,
  type LegacyCounters,
  type StageCounters,
  type StoredStage
} from "../core/activation-stages.js";
import type { ActivationApproval, ThreadActivity } from "./activation-file.js";

/**
 * Pure rules of the thread's activation state. The ledger applies them inside each
 * thread's queue, so a check and its write never interleave with another request.
 */
export type AuthorizationPin = { revision: string; hash: string };

/** The human's confirmation that an F3a stage becomes planning. */
export type StageMappingChoice = { from: string; to: string };

export type StageDecision =
  | { decision: "ready"; stage: FixedStage }
  | { decision: "mapping_required"; from: string; to: "planning" };

export function pinOf(policy: ActivationPolicy): AuthorizationPin {
  return { revision: policy.revision, hash: policyContentHash(policy) };
}

/**
 * The stage an authorized save leaves the thread on. A fixed stage is kept. An unknown
 * (F3a) stage needs the human's explicit mapping to planning, never a silent reset.
 */
export function stageForSave(
  previous: ThreadActivity | undefined,
  confirmed: StageMappingChoice | undefined
): StageDecision {
  const stored = previous?.currentStage;
  if (stored === undefined) return { decision: "ready", stage: "planning" };
  if (isFixedStage(stored)) return { decision: "ready", stage: stored };
  if (confirmed?.from === stored && confirmed.to === "planning") {
    return { decision: "ready", stage: "planning" };
  }
  return { decision: "mapping_required", from: stored, to: "planning" };
}

/**
 * The activity after an authorized save. Fixed-stage counters keep cycles and grants; any
 * F3a counter moves to legacyStages as history. Passes are never converted into cycles.
 * The approvals are not carried over: a save clears them, so each architect asks again.
 */
export function activityAfterSave(
  previous: ThreadActivity | undefined,
  pin: AuthorizationPin,
  stage: FixedStage
): ThreadActivity {
  return {
    authorizedRevision: pin.revision,
    authorizedHash: pin.hash,
    currentStage: stage,
    stages: fixedCountersOf(previous?.stages),
    legacyStages: {
      ...previous?.legacyStages,
      ...legacyCountersOf(previous?.stages)
    }
  };
}

/** Adds the approval of one architect, replacing its earlier one. An architect keeps at most one approval. */
export function withApproval(
  activation: ThreadActivity,
  approval: ActivationApproval
): ThreadActivity {
  const others = (activation.approvals ?? []).filter(
    (item) => item.agentId !== approval.agentId
  );
  return { ...activation, approvals: [...others, approval] };
}

/** The architects whose approval is valid under the policy revision in force. An approval of another revision never counts. */
export function approvedAgentsOf(
  activation: ThreadActivity | undefined,
  revision: string | undefined
): string[] {
  if (revision === undefined) return [];
  return (activation?.approvals ?? [])
    .filter((item) => item.revision === revision)
    .map((item) => item.agentId);
}

export function isApprovedAt(
  activation: ThreadActivity | undefined,
  agentId: string,
  revision: string | undefined
): boolean {
  return approvedAgentsOf(activation, revision).includes(agentId);
}

/**
 * Judges the stored state against the policy file and the cycles authorization. Order:
 * the enabled outdated policy, then the policy pin, then the settings pin. A disabled
 * policy never warns, so the thread keeps the manual flow.
 */
export function judgeActivation(
  policy: PolicyView,
  activation: ThreadActivity | undefined,
  settings: "authorized" | "tampered",
  floor: StageFloor = NO_FLOOR
): ActivationThreadState {
  if (policy.status === "outdated" && policy.enabled) {
    return stateWith("policy_outdated", activation);
  }
  if (policy.status !== "ready")
    return stateWith("revision_mismatch", activation);
  if (!activation) return stateWith("revision_mismatch", activation);
  if (activation.authorizedRevision !== policy.policy.revision) {
    return stateWith("revision_mismatch", activation);
  }
  if (activation.authorizedHash !== policyContentHash(policy.policy)) {
    return stateWith("policy_tampered", activation);
  }
  if (settings === "tampered")
    return stateWith("settings_tampered", activation);
  const stage = activation.currentStage;
  if (!isFixedStage(stage)) return stateWith("revision_mismatch", activation);
  if (isBehindFloor(storedCyclesOf(activation), floor)) {
    return stateWith("ledger_restored", activation);
  }
  return { status: "ready", currentStage: stage, stages: activation.stages };
}

/** The cycles each fixed stage has used, as stored. A missing or F3a entry counts as none. */
export function storedCyclesOf(
  activation: ThreadActivity | undefined
): Record<FixedStage, number> {
  return Object.fromEntries(
    FIXED_STAGES.map((stage) => [
      stage,
      cyclesCountersOf(activation?.stages[stage]).cyclesUsed
    ])
  ) as Record<FixedStage, number>;
}

type JudgedStatus =
  | "revision_mismatch"
  | "policy_tampered"
  | "settings_tampered"
  | "policy_outdated"
  | "ledger_restored";

function stateWith(
  status: JudgedStatus,
  activation: ThreadActivity | undefined
): ActivationThreadState {
  const stages: Record<string, StoredStage> = activation?.stages ?? {};
  if (activation === undefined) return { status, stages };
  return { status, currentStage: activation.currentStage, stages };
}

function fixedCountersOf(
  stages: Record<string, StoredStage> | undefined
): Record<string, StageCounters> {
  return Object.fromEntries(
    FIXED_STAGES.map((stage) => [stage, cyclesCountersOf(stages?.[stage])])
  );
}

/** The fixed-stage counters of an entry. A missing or F3a entry counts as no cycles used. */
export function cyclesCountersOf(
  entry: StoredStage | undefined
): StageCounters {
  if (entry !== undefined && "cyclesUsed" in entry) return entry;
  return { cyclesUsed: 0, extensions: [] };
}

function legacyCountersOf(
  stages: Record<string, StoredStage> | undefined
): Record<string, LegacyCounters> {
  const entries = Object.entries(stages ?? {});
  return Object.fromEntries(
    entries.filter(
      (pair): pair is [string, LegacyCounters] => "passesUsed" in pair[1]
    )
  );
}
