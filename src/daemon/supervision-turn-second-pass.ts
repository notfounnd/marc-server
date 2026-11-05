import { clientOf } from "../core/agent-launch.js";
import { adapterFor, type ClientAdapter } from "../core/client-adapters.js";
import type {
  SupervisionRecord,
  SupervisionTurn
} from "../core/activation-supervision-types.js";
import {
  findRecord,
  pruneSupervision,
  transitionRecord,
  upsertRecord
} from "../core/activation-supervision-records.js";
import {
  isStartingRun,
  judgeRecheck,
  turnFingerprintOf,
  type RecheckFacts,
  type StartingRun
} from "../core/supervision-turn-recheck.js";
import { slotKey, type SessionBinding } from "../core/session-slots.js";
import type { AgentProfileSummary, ChatMessage } from "../core/types.js";
import { listAgentProfiles } from "../core/workspace.js";
import type { TurnTimeoutRead } from "./activation-turn-timeout-ledger.js";
import { readQueueFacts, type QueueFacts } from "./activation-queue-facts.js";
import { scopeOf } from "./activation-views.js";
import { slotOf } from "./supervision-facts.js";
import { supervisionOf } from "./supervision-pass.js";
import {
  authorizedMinutesOf,
  ownerTokenOf,
  releasedFile,
  type LaunchPlan,
  type RecheckOutcome,
  type TurnHost,
  type TurnScope
} from "./supervision-turn-steps.js";
import type { ThreadFile, ThreadStep } from "./thread-store.js";

/**
 * The second pass, as one step of the thread's queue. It reads the card, the policy, the pause, the time
 * limit, the binding and the recipient's eligibility. A revoked card is written as failed with the reason
 * revoked, and its binding is released when this run still owns it. Nothing else is written.
 */
export async function recheckIn(
  host: TurnHost,
  scope: TurnScope,
  record: SupervisionRecord
): Promise<RecheckOutcome> {
  const result = await host.services.threads.update<RecheckOutcome>(
    scopeOf(scope.workspace, scope.threadId),
    (file) => recheckStep(host, scope, record, file)
  );
  if (result.status !== "done") return { status: "stale" };
  return result.value;
}

async function recheckStep(
  host: TurnHost,
  scope: TurnScope,
  record: SupervisionRecord,
  file: ThreadFile
): Promise<ThreadStep<RecheckOutcome>> {
  const card = findRecord(
    supervisionOf(file).records,
    record.messageId,
    record.recipient
  );
  if (!isStartingRun(card, record.runId)) return { value: { status: "stale" } };

  const { workspace, threadId } = scope;
  const facts = await readQueueFacts(host.services, workspace, threadId);
  const slot = slotOf(workspace, threadId, record.recipient);
  const binding = file.slots[slotKey(slot)];
  const profile = (await listAgentProfiles(workspace.rootPath)).find(
    (candidate) => candidate.id === record.recipient
  );
  const base = launchOf({
    card,
    facts,
    turn: await host.services.ledger.turnTimeoutState(workspace),
    profile,
    binding,
    recipient: record.recipient
  });
  if (base === undefined) {
    return revokeStep(host, card, file, slotKey(slot), binding);
  }
  return {
    value: {
      status: "launch",
      plan: {
        ...base,
        runId: card.runId,
        messageId: card.messageId,
        recipient: record.recipient,
        threadId,
        author: authorOf(facts.messages, card.messageId),
        workspaceRoot: workspace.rootPath,
        slot,
        lastCostUsd: binding?.lastCostUsd,
        cursor: cursorOf(facts.messages, record.recipient)
      }
    }
  };
}

type LaunchBase = Omit<
  LaunchPlan,
  | "runId"
  | "messageId"
  | "recipient"
  | "threadId"
  | "author"
  | "workspaceRoot"
  | "slot"
  | "lastCostUsd"
  | "cursor"
>;

/**
 * The launch facts of a card that still matches its approval, or undefined when any of them is revoked.
 * The verdict decides the match; the checks after it only give the types their values.
 */
function launchOf(input: {
  card: StartingRun;
  facts: QueueFacts;
  turn: TurnTimeoutRead;
  profile: AgentProfileSummary | undefined;
  binding: SessionBinding | undefined;
  recipient: string;
}): LaunchBase | undefined {
  const { card, facts, turn, profile, binding } = input;
  const minutes = authorizedMinutesOf(turn);
  const adapter = adapterOf(profile);
  const ownerToken = ownerTokenOf(binding, card.turn);
  const verdict = judgeRecheck(
    recheckFactsOf({
      facts,
      minutes,
      turn: card.turn,
      ownerToken,
      eligible: profile?.model !== undefined && adapter !== undefined,
      recipient: input.recipient
    })
  );
  if (verdict.status === "revoked") return undefined;
  if (profile?.model === undefined || adapter === undefined) return undefined;
  if (ownerToken === undefined || minutes === undefined) return undefined;
  if (binding === undefined) return undefined;
  return {
    model: profile.model,
    adapter,
    mode: card.turn.mode,
    sessionId: binding.nativeSessionId,
    continuation: card.turn.continuation,
    generation: card.turn.generation,
    ownerToken,
    turnTimeoutMinutes: minutes
  };
}

function recheckFactsOf(input: {
  facts: QueueFacts;
  minutes: number | undefined;
  turn: SupervisionTurn;
  ownerToken: string | undefined;
  eligible: boolean;
  recipient: string;
}): RecheckFacts {
  const { facts, minutes, turn } = input;
  const fingerprint = fingerprintOf(facts, minutes);
  return {
    policyReady: facts.enabled && facts.policy.status === "ready",
    cyclesAuthorized: facts.cycles.status === "authorized",
    paused: facts.paused,
    turnAuthorized: minutes !== undefined,
    fingerprintMatches:
      fingerprint !== undefined && fingerprint === turn.fingerprint,
    ownerMatches: input.ownerToken !== undefined,
    eligible: input.eligible && facts.architects.has(input.recipient)
  };
}

function revokeStep(
  host: TurnHost,
  card: StartingRun,
  file: ThreadFile,
  slot: string,
  binding: SessionBinding | undefined
): ThreadStep<RecheckOutcome> {
  const state = supervisionOf(file);
  const failed = transitionRecord(card, "failed", { reason: "revoked" });
  if (failed === undefined) return { value: { status: "stale" } };
  const released = releasedFile({
    file,
    slot,
    binding,
    turn: card.turn,
    endedAt: host.now(),
    lastCostUsd: undefined
  });
  return {
    value: { status: "revoked" },
    file: {
      ...released,
      supervision: pruneSupervision({
        records: upsertRecord(state.records, failed),
        floors: state.floors
      })
    }
  };
}

function fingerprintOf(
  facts: QueueFacts,
  minutes: number | undefined
): string | undefined {
  if (minutes === undefined || facts.policy.status !== "ready")
    return undefined;
  return turnFingerprintOf({
    policy: facts.policy.policy,
    cyclesPerStage: facts.cyclesPerStage,
    turnTimeoutMinutes: minutes
  });
}

function adapterOf(
  profile: AgentProfileSummary | undefined
): ClientAdapter | undefined {
  if (profile === undefined) return undefined;
  return adapterFor(clientOf(profile));
}

/**
 * The recipient's own last message in the thread, read when the turn is approved again. A turn reads the
 * thread after it, so it only reads what came since, not the whole thread. Undefined when it posted none.
 */
function cursorOf(
  messages: ChatMessage[],
  recipient: string
): string | undefined {
  const own = messages.filter((message) => message.agentId === recipient);
  return own[own.length - 1]?.id;
}

function authorOf(messages: ChatMessage[], messageId: string): string {
  return (
    messages.find((message) => message.id === messageId)?.agentId ?? "unknown"
  );
}
