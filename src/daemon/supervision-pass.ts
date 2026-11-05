import { judgeSupervision } from "../core/activation-supervision.js";
import {
  advanceFloor,
  belowFloor,
  expiresAtFor,
  findRecord,
  isPending,
  pruneSupervision,
  transitionRecord,
  upsertRecord
} from "../core/activation-supervision-records.js";
import type {
  SupervisionRecord,
  SupervisionState,
  SupervisionVerdict
} from "../core/activation-supervision-types.js";
import type { FixedStage } from "../core/activation-stages.js";
import { slotKey } from "../core/session-slots.js";
import { mentionsProfile } from "../core/thread-mentions.js";
import type { ChatMessage, WorkspaceInfo } from "../core/types.js";
import { readQueueFacts, type QueueFacts } from "./activation-queue-facts.js";
import { judgeInQueue } from "./activation-reservation-store.js";
import type { ActivationServices } from "./activation-views.js";
import { scopeOf } from "./activation-views.js";
import type { ThreadFile } from "./thread-store.js";
import type { SessionServices } from "./session-views.js";
import {
  CHECKING_SESSIONS,
  holderOf,
  inGraceAt,
  slotFactsOf,
  slotOf,
  supportedArchitectsOf
} from "./supervision-facts.js";
import type { SupervisionOptions } from "./supervision-runner.js";

/** The request a verdict is judged with. It is never written, so its run id only names the judgment. */
const VERDICT_RUN = "verdict";

export type PassInput = {
  services: ActivationServices;
  sessions: SessionServices;
  options: SupervisionOptions;
  workspace: WorkspaceInfo;
  threadId: string;
};

/** Changed means the thread's supervision state was written. Closed or unreadable threads are unchanged. */
export type PassOutcome = "changed" | "unchanged";

/** One mention and one architect it names, the unit a pass judges. */
type Pair = { message: ChatMessage; recipient: string };

export const EMPTY_SUPERVISION: SupervisionState = { records: [], floors: {} };

export function supervisionOf(file: ThreadFile): SupervisionState {
  return file.supervision ?? EMPTY_SUPERVISION;
}

/**
 * One pass over a thread: every mention of a supported architect is judged inside a single queue step,
 * and only the cards change. Nothing is written to the reservations, so a verdict never debits a cycle.
 * A thread that is not enabled, or whose policy is not ready, is left alone.
 */
export async function runSupervisionPass(
  input: PassInput
): Promise<PassOutcome> {
  const result = await input.services.threads.update<boolean>(
    scopeOf(input.workspace, input.threadId),
    async (file) => {
      const facts = await readQueueFacts(
        input.services,
        input.workspace,
        input.threadId
      );
      const ttlMinutes = pendingTtlOf(facts);
      if (ttlMinutes === undefined) return { value: false };
      const recipients = await supportedArchitectsOf(input.workspace);
      const pairs = mentionPairs(facts.messages, recipients);
      const current = supervisionOf(file);
      const next = await judgePairs(
        input,
        facts,
        file,
        current,
        pairs,
        ttlMinutes
      );
      if (next === current) return { value: false };
      return { value: true, file: { ...file, supervision: next } };
    }
  );
  if (result.status !== "done") return "unchanged";
  return result.value ? "changed" : "unchanged";
}

/** The pending TTL of a ready and enabled policy. Anything else answers undefined: no card is judged. */
function pendingTtlOf(facts: QueueFacts): number | undefined {
  if (!facts.enabled) return undefined;
  if (facts.policy.status !== "ready") return undefined;
  return facts.policy.policy.pendingTtlMinutes;
}

/** Mentions that name a supported architect, excluding the architect's own message. */
function mentionPairs(
  messages: readonly ChatMessage[],
  recipients: readonly string[]
): Pair[] {
  return messages.flatMap((message) =>
    recipients
      .filter(
        (recipient) =>
          recipient !== message.agentId &&
          mentionsProfile(message.body, recipient)
      )
      .map((recipient) => ({ message, recipient }))
  );
}

async function judgePairs(
  input: PassInput,
  facts: QueueFacts,
  file: ThreadFile,
  start: SupervisionState,
  pairs: readonly Pair[],
  ttlMinutes: number
): Promise<SupervisionState> {
  let state = start;
  for (const pair of pairs) {
    state = await judgePair(input, facts, file, state, pair, ttlMinutes);
  }
  return state;
}

async function judgePair(
  input: PassInput,
  facts: QueueFacts,
  file: ThreadFile,
  state: SupervisionState,
  pair: Pair,
  ttlMinutes: number
): Promise<SupervisionState> {
  const { message, recipient } = pair;
  const existing = findRecord(state.records, message.id, recipient);
  const decision = judgeInQueue(facts, file, {
    messageId: message.id,
    recipient,
    holder: holderOf(message.id, recipient),
    runId: VERDICT_RUN
  });
  const binding =
    file.slots[slotKey(slotOf(input.workspace, input.threadId, recipient))];
  const deferred =
    inGraceAt(input.options, input.options.now()) &&
    binding !== undefined &&
    decision.status === "granted" &&
    (existing === undefined || isPending(existing.status));
  const verdict = await verdictOf({
    input,
    binding,
    existing,
    pair,
    replied: repliedAfter(facts.messages, pair),
    granted: decision,
    deferred,
    floor: state.floors[recipient]
  });
  return applyVerdict(state, {
    verdict,
    existing,
    pair,
    stage: decision.stage,
    now: input.options.now(),
    ttlMinutes
  });
}

/** True when the recipient posted after the mention, so the mention needs no card. */
function repliedAfter(messages: readonly ChatMessage[], pair: Pair): boolean {
  const mentioned = Date.parse(pair.message.timestamp);
  return messages.some(
    (message) =>
      message.agentId === pair.recipient &&
      Date.parse(message.timestamp) > mentioned
  );
}

type VerdictInput = {
  input: PassInput;
  binding: ThreadFile["slots"][string] | undefined;
  existing: SupervisionRecord | undefined;
  pair: Pair;
  replied: boolean;
  granted: { status: "granted" | "held" | "refused"; reason?: string };
  deferred: boolean;
  floor: string | undefined;
};

/**
 * The verdict of one pair, by dispatch: a reply comes first, then a presence-dependent card in the grace
 * window, and otherwise the slot table of the supervision judgment.
 */
async function verdictOf(context: VerdictInput): Promise<SupervisionVerdict> {
  if (context.replied) return repliedVerdict(context.existing);
  if (context.deferred) return checkingVerdict(context);
  const slot = await slotFactsOf(
    context.input.sessions,
    context.input.workspace,
    context.binding
  );
  return judgeSupervision({
    reservation: {
      status: context.granted.status,
      reason: context.granted.reason
    },
    slot,
    existing: context.existing,
    messageAt: context.pair.message.timestamp,
    floor: context.floor
  });
}

/** A pending card of a mention the recipient answered is superseded. Anything else needs no card. */
function repliedVerdict(
  existing: SupervisionRecord | undefined
): SupervisionVerdict {
  if (existing !== undefined && isPending(existing.status)) {
    return { action: "update", status: "superseded", reason: "replied" };
  }
  return { action: "none", reason: "replied" };
}

/** Inside the grace window a presence-dependent card waits for "checking_sessions", with the same write rule. */
function checkingVerdict(context: VerdictInput): SupervisionVerdict {
  const { existing, pair, floor } = context;
  if (existing !== undefined) {
    return { action: "update", status: "waiting", reason: CHECKING_SESSIONS };
  }
  if (belowFloor(pair.message.timestamp, floor)) {
    return { action: "none", reason: "below_floor" };
  }
  return { action: "create", status: "waiting", reason: CHECKING_SESSIONS };
}

type ApplyInput = {
  verdict: SupervisionVerdict;
  existing: SupervisionRecord | undefined;
  pair: Pair;
  stage: FixedStage;
  now: string;
  ttlMinutes: number;
};

function applyVerdict(
  state: SupervisionState,
  input: ApplyInput
): SupervisionState {
  const card = cardOf(input);
  if (card === undefined) return state;
  return pruneSupervision({
    records: upsertRecord(state.records, card),
    floors: advanceFloor(state.floors, card)
  });
}

/** The card a verdict writes. An existing card changes by an allowed transition only; a new one is born waiting or awaiting. */
function cardOf(input: ApplyInput): SupervisionRecord | undefined {
  const { verdict, existing } = input;
  if (verdict.action === "none") return undefined;
  if (existing !== undefined) {
    return transitionRecord(existing, verdict.status, {
      reason: verdict.reason
    });
  }
  const { pair, stage, now, ttlMinutes } = input;
  return {
    messageId: pair.message.id,
    messageAt: pair.message.timestamp,
    recipient: pair.recipient,
    stage,
    status: verdict.status,
    ...(verdict.reason === undefined ? {} : { reason: verdict.reason }),
    createdAt: now,
    expiresAt: expiresAtFor(now, ttlMinutes),
    attempt: 0
  };
}
