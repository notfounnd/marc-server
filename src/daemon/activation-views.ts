import {
  budgetView,
  isThreadPaused,
  ledgerWarnings,
  type ActivationThreadState,
  type BudgetView,
  type BudgetWarning
} from "../core/activation-budget.js";
import { cyclesValueOf } from "../core/activation-cycles.js";
import { derivedLeadOf, stampedFloorOf } from "../core/activation-floor.js";
import type { StageHistoryEntry } from "../core/activation-advance.js";
import {
  readThreadPolicy,
  type PolicyView,
  type ThreadPolicyRead
} from "../core/activation-policy-store.js";
import {
  participantsOf,
  type ActivationPolicy
} from "../core/activation-policy.js";
import type { ValidationError } from "../core/activation-rules.js";
import { effectiveLeadOf, type LeadChange } from "../core/activation-lead.js";
import {
  FIXED_STAGES,
  isFixedStage,
  stagesAheadOf,
  type FixedStage
} from "../core/activation-stages.js";
import { messagesOfThreadInWorkspace } from "../core/threads.js";
import type { WorkspaceInfo } from "../core/types.js";
import { listAgentProfiles } from "../core/workspace.js";
import type { ActivationLedger } from "./activation-ledger.js";
import type { ThreadScope, ThreadStore } from "./thread-store.js";
import type { WorkspaceStore } from "./workspace-store.js";
import {
  DEFAULT_SUPERVISION_OPTIONS,
  type SupervisionOptions
} from "./supervision-runner.js";
import {
  supervisionCardsOf,
  type OpenRequestsOf,
  type SupervisionCardView
} from "./supervision-views.js";

/** Everything the activation routes need. Only the daemon's UI routes use it; MCP has no tool for it. */
export type ActivationServices = {
  threads: ThreadStore;
  workspaces: WorkspaceStore;
  ledger: ActivationLedger;
  /** The supervisor's ids, clock and runner. Absent means the production defaults. */
  supervision?: SupervisionOptions;
};

export type ActivationBody = {
  threadId: string;
  policyState: "none" | "outdated" | "ready" | "invalid";
  policy: ActivationPolicy | null;
  enabled: boolean;
  policyErrors?: ValidationError[];
  /** Architect-role profiles, computed live. Read-only in the panel. */
  participants: string[];
  budget: BudgetView | null;
  /** An F3a stage the thread still stands on. A save asks the human to map it to planning. */
  legacyStage: string | null;
  paused: boolean | null;
  /** True when an enabled policy is not backed by a matching authorization: the thread is paused. */
  threadPaused: boolean;
  warnings: BudgetWarning[];
  /**
   * The lead: the recorded human choice, else the first architect author in CHAT.md. Null until an
   * architect has posted and no change was recorded.
   */
  lead: string | null;
  /** Human changes of the lead, oldest first. */
  leadChanges: LeadChange[];
  /** The fixed stages strictly ahead of the current one: where a human advance can go. */
  nextStages: FixedStage[];
  /** Reservations retained by a hold, for the panel. */
  holds: HoldView[];
  /** Stage moves, oldest first. */
  stageHistory: StageHistoryEntry[];
  /** The supervisor's cards still on the panel. No run id, outcome or process data. */
  supervision: SupervisionCardView[];
};

type ExtrasView = {
  holds: HoldView[];
  stageHistory: StageHistoryEntry[];
  lead: string | undefined;
  leadChanges: LeadChange[];
  currentStage: FixedStage;
  supervision: SupervisionCardView[];
};

const NO_EXTRAS: ExtrasView = {
  holds: [],
  stageHistory: [],
  lead: undefined,
  leadChanges: [],
  currentStage: FIXED_STAGES[0],
  supervision: []
};

export type HoldView = {
  messageId: string;
  recipient: string;
  stage: string;
  reason: string;
};

export async function activationBody(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string
): Promise<ActivationBody> {
  const scope = scopeOf(workspace, threadId);
  const profiles = await listAgentProfiles(workspace.rootPath);
  const stored = await readThreadPolicy(workspace, threadId);
  const view = viewOf(stored);
  const cycles = await services.ledger.cyclesState(workspace);
  const messages = await messagesOfThreadInWorkspace(workspace, threadId);
  const state = await services.ledger.threadState(
    scope,
    view,
    cycles,
    stampedFloorOf(messages)
  );
  const enabled = isEnabled(view);
  const budget =
    view.status === "ready"
      ? budgetView(enabled, state, cyclesValueOf(cycles))
      : null;
  const extras = await extrasView(
    services.threads,
    scope,
    openRequestsOf(services),
    attemptCapOf(view)
  );
  const architects = new Set(participantsOf(profiles));
  const lead = effectiveLeadOf(
    derivedLeadOf(messages, architects),
    extras.lead,
    architects
  );
  return {
    threadId,
    policyState: stored.status,
    policy: view.status === "ready" ? view.policy : null,
    enabled,
    ...invalidFields(stored),
    participants: participantsOf(profiles),
    budget,
    legacyStage: legacyStageOf(state),
    paused: await pausedFlag(services, workspace.id),
    threadPaused: isThreadPaused(state, enabled),
    warnings: budget ? budget.warnings : ledgerWarnings(state, enabled),
    lead: lead ?? null,
    leadChanges: extras.leadChanges,
    nextStages: stagesAheadOf(extras.currentStage),
    holds: extras.holds,
    stageHistory: extras.stageHistory,
    supervision: extras.supervision
  };
}

/** The held reservations, the stage history and the lead, from the thread's state file. Missing or invalid state shows none. */
/** The open permission requests of a run, read from the daemon's store that the turns and the routes share. */
function openRequestsOf(services: ActivationServices): OpenRequestsOf {
  const store = (services.supervision ?? DEFAULT_SUPERVISION_OPTIONS)
    .permissions;
  return (runId) => store.openFor(runId);
}

/** The attempt cap of the policy, which Retry and Continue are judged against. Undefined while the policy is not ready. */
function attemptCapOf(view: PolicyView): number | undefined {
  if (view.status !== "ready") return undefined;
  return view.policy.attemptCap;
}

async function extrasView(
  threads: ThreadStore,
  scope: ThreadScope,
  openOf: OpenRequestsOf,
  attemptCap: number | undefined
): Promise<ExtrasView> {
  const view = await threads.read(scope);
  if (view.status === "invalid") return NO_EXTRAS;
  const reservations = view.file.reservations ?? [];
  return {
    holds: reservations
      .filter((record) => record.status === "held")
      .map((record) => ({
        messageId: record.messageId,
        recipient: record.recipient,
        stage: record.stage,
        reason: record.reason ?? ""
      })),
    stageHistory: view.file.stageHistory ?? [],
    lead: view.file.lead,
    leadChanges: view.file.leadChanges ?? [],
    currentStage: currentStageOf(view.file.activation?.currentStage),
    supervision: supervisionCardsOf(view.file.supervision, openOf, attemptCap)
  };
}

/** The stage a thread stands on: its fixed stored stage, or the first one when there is none. */
function currentStageOf(stage: string | undefined): FixedStage {
  if (isFixedStage(stage)) return stage;
  return FIXED_STAGES[0];
}

export function scopeOf(
  workspace: WorkspaceInfo,
  threadId: string
): ThreadScope {
  return { workspaceId: workspace.id, threadId };
}

/** An unreadable policy is shown as absent to the state, and its errors are shown to the human. */
export function viewOf(stored: ThreadPolicyRead): PolicyView {
  if (stored.status === "invalid") return { status: "none" };
  return stored;
}

function invalidFields(stored: ThreadPolicyRead): {
  policyErrors?: ValidationError[];
} {
  if (stored.status !== "invalid") return {};
  return { policyErrors: stored.errors };
}

export function isEnabled(view: PolicyView): boolean {
  if (view.status === "outdated") return view.enabled;
  if (view.status === "ready") return view.policy.enabled;
  return false;
}

function legacyStageOf(state: ActivationThreadState): string | null {
  if (!("currentStage" in state)) return null;
  const stage = state.currentStage;
  if (stage === undefined || isFixedStage(stage)) return null;
  return stage;
}

async function pausedFlag(
  services: ActivationServices,
  workspaceId: string
): Promise<boolean | null> {
  const state = await services.ledger.workspaceState(workspaceId);
  return state.status === "ready" ? state.paused : null;
}
