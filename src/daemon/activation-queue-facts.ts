import type { ActivationThreadState } from "../core/activation-budget.js";
import { cyclesValueOf, type CyclesState } from "../core/activation-cycles.js";
import { stampedFloorOf, type StageFloor } from "../core/activation-floor.js";
import {
  readThreadPolicy,
  type PolicyView
} from "../core/activation-policy-store.js";
import { messagesOfThreadInWorkspace } from "../core/threads.js";
import type { ChatMessage, WorkspaceInfo } from "../core/types.js";
import { listAgentProfiles } from "../core/workspace.js";
import { judgeActivation } from "./activation-activity.js";
import type { ThreadActivity } from "./activation-file.js";
import {
  isEnabled,
  viewOf,
  type ActivationServices
} from "./activation-views.js";

/**
 * What a judgment reads inside a thread's queue: the policy file, the workspace pause, the cycles
 * setting, CHAT.md and the architect profiles. The caller reads it in the same step that writes, so
 * the authorization it decides with is the one in force at the write. None of these reads takes the
 * thread's queue, so a step can call this without a deadlock.
 */
export type QueueFacts = {
  policy: PolicyView;
  enabled: boolean;
  paused: boolean;
  cycles: CyclesState;
  cyclesPerStage: number;
  floor: StageFloor;
  messages: ChatMessage[];
  architects: Set<string>;
};

/** Reads the facts of one thread. Only a step that is inside the thread's queue may use the result to write. */
export async function readQueueFacts(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string
): Promise<QueueFacts> {
  const policy = viewOf(await readThreadPolicy(workspace, threadId));
  const pause = await services.ledger.workspaceState(workspace.id);
  const cycles = await services.ledger.cyclesState(workspace);
  const messages = await messagesOfThreadInWorkspace(workspace, threadId);
  return {
    policy,
    enabled: isEnabled(policy),
    paused: pause.status === "ready" && pause.paused,
    cycles,
    cyclesPerStage: cyclesValueOf(cycles),
    floor: stampedFloorOf(messages),
    messages,
    architects: await architectIdsOf(workspace)
  };
}

/** The architect profiles of the registry. Only these can lead, and only these can be an origin. */
export async function architectIdsOf(
  workspace: WorkspaceInfo
): Promise<Set<string>> {
  const profiles = await listAgentProfiles(workspace.rootPath);
  return new Set(
    profiles
      .filter((profile) => profile.role === "architect")
      .map((profile) => profile.id)
  );
}

/** The cycles setting a judgment reads: the authorized value, or tampered for any other state. */
export function settingsOf(cycles: CyclesState): "authorized" | "tampered" {
  return cycles.status === "authorized" ? "authorized" : "tampered";
}

/** The pin, the setting and the floor, judged on the activation the queue holds. */
export function judgeFacts(
  facts: QueueFacts,
  activation: ThreadActivity | undefined
): ActivationThreadState {
  return judgeActivation(
    facts.policy,
    activation,
    settingsOf(facts.cycles),
    facts.floor
  );
}

/** A readiness refusal: a disabled policy, or the state the judgment found. */
export type ReadinessRefusal =
  | "policy_disabled"
  | Exclude<ActivationThreadState["status"], "ready">;

export type Readiness =
  | { decision: "ready"; cyclesPerStage: number }
  | { decision: "refused"; reason: ReadinessRefusal };

/** The readiness the human's actions need: the switch first, then the state of the thread. */
export function readinessOf(
  facts: QueueFacts,
  activation: ThreadActivity | undefined
): Readiness {
  if (!facts.enabled) return { decision: "refused", reason: "policy_disabled" };
  const state = stateOf(facts, activation);
  if (state.status !== "ready") {
    return { decision: "refused", reason: state.status };
  }
  return { decision: "ready", cyclesPerStage: facts.cyclesPerStage };
}

/**
 * A lost or invalid cycles setting is its own answer, as the ledger reports it. Any other state comes
 * from the judgment on the activation the queue holds.
 */
function stateOf(
  facts: QueueFacts,
  activation: ThreadActivity | undefined
): ActivationThreadState {
  if (facts.cycles.status === "ledger_lost") return { status: "ledger_lost" };
  if (facts.cycles.status === "ledger_invalid") {
    return { status: "ledger_invalid" };
  }
  return judgeFacts(facts, activation);
}
