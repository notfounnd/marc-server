import {
  agentAdvanceRefusal,
  confirmAdvanceRecord,
  destinationOf,
  isWrittenBy,
  type AdvanceRecordDecision
} from "../core/activation-advance.js";
import { derivedLeadOf } from "../core/activation-floor.js";
import { effectiveLeadOf } from "../core/activation-lead.js";
import type { FixedStage } from "../core/activation-stages.js";
import { messagesOfThreadInWorkspace } from "../core/threads.js";
import type { WorkspaceInfo } from "../core/types.js";
import {
  slotKey,
  type SessionBinding,
  type SlotState
} from "../core/session-slots.js";
import type { ObservedIdentity, ResolvedIdentity } from "./presence.js";
import type { SessionServices } from "./session-routes.js";
import type { RegistryView } from "./session-registry.js";
import { probeFor } from "./session-views.js";
import { reasonOf } from "./activation-ledger.js";
import {
  budgetsOf,
  stageOfActivation
} from "./activation-reservation-store.js";
import {
  judgeFacts,
  readQueueFacts,
  type QueueFacts
} from "./activation-queue-facts.js";
import { scopeOf, type ActivationServices } from "./activation-views.js";
import { moveFile } from "./activation-stage-actions.js";
import type { ThreadFile, ThreadStep, ThreadUpdate } from "./thread-store.js";

/**
 * The identity checks, as three injectable parts: the presence resolution, the registry read and the
 * slot probe. Production builds them from the daemon's session services; a test injects its own.
 */
export type IdentityDeps = {
  resolve(identity: ObservedIdentity): Promise<ResolvedIdentity>;
  read(): Promise<RegistryView>;
  probe(binding: SessionBinding): Promise<SlotState>;
};

/**
 * The agent's advance request. The identity is verified before the queue; everything else the gate
 * judges is read inside the thread's queue, in the same step that writes the move.
 */
export type AgentAdvanceInput = {
  services: ActivationServices;
  workspace: WorkspaceInfo;
  threadId: string;
  agentId: string;
  expectedStage: string;
  advanceTo: string;
  identityVerified: boolean;
  /** The operation the daemon grants to this move. The confirmation names it. */
  operationId: string;
  now: () => string;
};

/** A granted advance names its operation and its destination, which the message is stamped with. */
export type AgentAdvanceOutcome =
  | {
      decision: "done";
      stage: FixedStage;
      operationId: string;
      droppedHolds: number;
    }
  | { decision: "refused"; reason: string };

export type AdvanceConfirmInput = {
  agentId: string;
  operationId: string;
  messageId: string;
};

export type AdvanceConfirmOutcome =
  | { decision: "answered" | "already" }
  | { decision: "refused"; reason: string };

/** The production dependencies: the daemon's presence, its session registry and its slot probe. */
export function identityDepsOf(
  sessions: SessionServices,
  workspace: WorkspaceInfo
): IdentityDeps {
  return {
    resolve: (identity) => sessions.presence.resolveIdentity(identity),
    read: () => sessions.registry.read(),
    probe: probeFor(sessions, workspace)
  };
}

/**
 * The identity the MCP sent is the live session of this slot: the process at the client's pid carries
 * a verified start time, it owns the slot, and the slot is online. Anything else is not verified.
 */
export async function verifyIdentityIn(
  deps: IdentityDeps,
  workspace: WorkspaceInfo,
  threadId: string,
  agentId: string,
  identity: ObservedIdentity | undefined
): Promise<boolean> {
  if (identity === undefined) return false;
  const resolved = await deps.resolve(identity);
  const registry = await deps.read();
  if (registry.status === "invalid") return false;
  const key = slotKey({
    workspaceId: workspace.id,
    threadId,
    profile: agentId
  });
  const binding = registry.file.slots[key];
  if (binding === undefined) return false;
  if (!isSameInstance(binding, resolved)) return false;
  const state = await deps.probe(binding);
  return state.state === "online";
}

/**
 * The agent's advance, granted or refused inside the thread's queue. The readiness of the policy and
 * of the cycles setting, the lead, the stage the agent saw, the budget of that stage and the
 * destination are judged from the facts the queue reads in that same step, so no earlier snapshot can
 * decide. The budget is the last question and refuses only an exhausted stage. The human's advance
 * never runs this gate.
 */
export async function agentAdvanceIn(
  input: AgentAdvanceInput
): Promise<AgentAdvanceOutcome> {
  const result = await input.services.threads.update<AgentAdvanceOutcome>(
    scopeOf(input.workspace, input.threadId),
    async (file) =>
      advanceStep(
        file,
        input,
        await readQueueFacts(input.services, input.workspace, input.threadId)
      )
  );
  return advanceOutcomeOf(result);
}

/**
 * Confirms the advance once the message is written: the operation is marked with the message, and
 * only a message of this thread, written by this agent, can carry it. Repeating the same confirmation
 * changes nothing.
 */
export async function confirmAdvanceIn(
  services: ActivationServices,
  workspace: WorkspaceInfo,
  threadId: string,
  input: AdvanceConfirmInput
): Promise<AdvanceConfirmOutcome> {
  const messages = await messagesOfThreadInWorkspace(workspace, threadId);
  const written = isWrittenBy(messages, {
    messageId: input.messageId,
    threadId,
    agentId: input.agentId
  });
  if (!written) return { decision: "refused", reason: "message_not_written" };
  const result = await services.threads.update<AdvanceRecordDecision>(
    scopeOf(workspace, threadId),
    (file) => {
      const decision = confirmAdvanceRecord(file.stageHistory, input);
      if (decision.decision !== "answered") return { value: decision };
      return {
        value: decision,
        file: { ...file, stageHistory: decision.history }
      };
    }
  );
  return confirmOutcomeOf(result);
}

function advanceStep(
  file: ThreadFile,
  input: AgentAdvanceInput,
  facts: QueueFacts
): ThreadStep<AgentAdvanceOutcome> {
  const activation = file.activation;
  const judged = judgeFacts(facts, activation);
  const readiness = readinessReason(facts, judged.status);
  if (readiness !== undefined) return refusedStep(readiness);
  if (activation === undefined) return refusedStep("not_ready");
  const current = stageOfActivation(activation);
  const budget = budgetsOf(activation, facts.cyclesPerStage)[current];
  const refusal = agentAdvanceRefusal({
    lead:
      effectiveLeadOf(
        derivedLeadOf(facts.messages, facts.architects),
        file.lead,
        facts.architects
      ) === input.agentId,
    identityVerified: input.identityVerified,
    stageMatches: activation.currentStage === input.expectedStage,
    exhausted: budget.used >= budget.max
  });
  if (refusal !== undefined) return refusedStep(refusal);
  const destination = destinationOf(current, input.advanceTo);
  if (destination.decision === "refused")
    return refusedStep(destination.reason);
  const moved = moveFile(file, activation, current, destination.stage, {
    at: input.now(),
    actor: {
      by: "agent",
      agentId: input.agentId,
      operationId: input.operationId
    }
  });
  return {
    value: {
      decision: "done",
      stage: destination.stage,
      operationId: input.operationId,
      droppedHolds: moved.droppedHolds
    },
    file: moved.file
  };
}

/** The readiness refusal: a disabled policy, or the state the judge found. Ready passes. */
function readinessReason(
  facts: QueueFacts,
  status: string
): string | undefined {
  if (!facts.enabled) return "policy_disabled";
  if (status !== "ready") return status;
  return undefined;
}

function refusedStep(reason: string): ThreadStep<AgentAdvanceOutcome> {
  return { value: { decision: "refused", reason } };
}

function advanceOutcomeOf(
  result: ThreadUpdate<AgentAdvanceOutcome>
): AgentAdvanceOutcome {
  if (result.status === "invalid") {
    return { decision: "refused", reason: reasonOf(result.reason) };
  }
  if (result.status === "closed") {
    return { decision: "refused", reason: "thread_closed" };
  }
  return result.value;
}

function confirmOutcomeOf(
  result: ThreadUpdate<AdvanceRecordDecision>
): AdvanceConfirmOutcome {
  if (result.status === "invalid") {
    return { decision: "refused", reason: reasonOf(result.reason) };
  }
  if (result.status === "closed") {
    return { decision: "refused", reason: "thread_closed" };
  }
  const value = result.value;
  if (value.decision === "refused") return value;
  return { decision: value.decision };
}

function isSameInstance(
  binding: SessionBinding,
  resolved: ResolvedIdentity
): boolean {
  if (resolved.clientStartedAt === undefined) return false;
  return (
    binding.owner.clientPid === resolved.clientPid &&
    binding.owner.clientStartedAt === resolved.clientStartedAt
  );
}
