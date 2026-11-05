import { slugify } from "./ids.js";
import {
  isAheadOf,
  stagesAheadOf,
  type FixedStage
} from "./activation-stages.js";
import type { ChatMessage } from "./types.js";

/**
 * One entry of the thread's stage history. `by` says who moved the stage. An agent move names
 * its agent and its operation, and the message that carries the move is recorded once it is
 * written. No native session id is stored.
 */
export type StageHistoryEntry = {
  at: string;
  from: FixedStage;
  to: FixedStage;
  by: "human" | "agent";
  agentId?: string;
  operationId?: string;
  messageId?: string;
  droppedHolds: number;
};

export type AdvanceRefusal =
  | "not_lead"
  | "identity_unverified"
  | "stage_changed"
  | "stage_exhausted";

/** What the agent gate knows. The queue fills every fact from the thread's own state and messages. */
export type AgentAdvanceFacts = {
  lead: boolean;
  identityVerified: boolean;
  stageMatches: boolean;
  exhausted: boolean;
};

/** Dispatch table in the order of the agent gate. The first failed check gives the refusal. */
const ADVANCE_CHECKS: ReadonlyArray<{
  reason: AdvanceRefusal;
  failed: (facts: AgentAdvanceFacts) => boolean;
}> = [
  { reason: "not_lead", failed: (facts) => !facts.lead },
  { reason: "identity_unverified", failed: (facts) => !facts.identityVerified },
  { reason: "stage_changed", failed: (facts) => !facts.stageMatches },
  { reason: "stage_exhausted", failed: (facts) => facts.exhausted }
];

export function agentAdvanceRefusal(
  facts: AgentAdvanceFacts
): AdvanceRefusal | undefined {
  return ADVANCE_CHECKS.find((check) => check.failed(facts))?.reason;
}

export type Destination =
  | { decision: "ready"; stage: FixedStage }
  | { decision: "refused"; reason: "last_stage" | "not_ahead" };

/**
 * The target of an advance. The last stage has no target; any other target must be a fixed stage
 * strictly after the current one. Skipping stages is allowed, and the skipped budgets are lost.
 */
export function destinationOf(from: FixedStage, to: unknown): Destination {
  if (stagesAheadOf(from).length === 0) {
    return { decision: "refused", reason: "last_stage" };
  }
  if (!isAheadOf(from, to)) return { decision: "refused", reason: "not_ahead" };
  return { decision: "ready", stage: to };
}

export type AdvanceRecordInput = {
  agentId: string;
  operationId: string;
  messageId: string;
};

export type AdvanceRecordDecision =
  | { decision: "answered"; history: StageHistoryEntry[] }
  | { decision: "already" }
  | { decision: "refused"; reason: string };

/** Marks the advance as carried by this message. Repeating the same message changes nothing. */
export function confirmAdvanceRecord(
  history: readonly StageHistoryEntry[] | undefined,
  input: AdvanceRecordInput
): AdvanceRecordDecision {
  const entries = history ?? [];
  const index = entries.findIndex(
    (entry) =>
      entry.operationId === input.operationId && entry.agentId === input.agentId
  );
  if (index < 0) return { decision: "refused", reason: "advance_not_found" };
  const current = entries[index];
  if (current.messageId === input.messageId) return { decision: "already" };
  if (current.messageId !== undefined) {
    return { decision: "refused", reason: "already_answered" };
  }
  return {
    decision: "answered",
    history: entries.map((entry, position) =>
      position === index ? { ...entry, messageId: input.messageId } : entry
    )
  };
}

/**
 * A message is a valid answer only when CHAT.md holds it in this thread, written by this agent.
 * The author is compared under the same slug the writer stores.
 */
export function isWrittenBy(
  messages: readonly ChatMessage[],
  input: { messageId: string; threadId: string; agentId: string }
): boolean {
  const message = messages.find((item) => item.id === input.messageId);
  if (message === undefined) return false;
  return (
    message.threadId === input.threadId &&
    message.agentId === slugify(input.agentId)
  );
}
