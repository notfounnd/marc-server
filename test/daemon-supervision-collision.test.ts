import assert from "node:assert/strict";
import { test } from "node:test";
import { cyclesCountersOf } from "../src/daemon/activation-activity.js";
import { holderOf } from "../src/daemon/supervision-facts.js";
import { send } from "./daemon-session-http-fixtures.js";
import { parseReply, SECOND } from "./daemon-supervision-fixtures.js";
import { keyOf } from "./daemon-supervision-reconcile-fixtures.js";
import {
  cardAction,
  mention,
  stateOf,
  turnThread,
  waitForCards,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";

/**
 * The verified waiter and the supervisor's approval contend for one mention. The slot has one bound session,
 * which is the waiter's, so the waiter is verified against it. Whichever reserves first, the other is refused
 * already_reserved, and the mention is debited exactly once.
 */
const WAITER_SESSION = "session-collision";
const WAITER_RUN = "run-waiter";

type Actor = "waiter" | "supervisor";
type Outcome = { decision: string; reason: string };

/** The decision of a granted reservation, and of an approval that starts a turn. */
const GRANTED: Record<Actor, string> = {
  waiter: "granted",
  supervisor: "started"
};

/** The holder each actor reserves under: the waiter's session, or the supervisor's own holder for the mention. */
const HOLDER: Record<Actor, (messageId: string) => string> = {
  waiter: () => WAITER_SESSION,
  supervisor: (messageId) => holderOf(messageId, SECOND)
};

const ORDERS: ReadonlyArray<{ name: string; order: readonly [Actor, Actor] }> =
  [
    {
      name: "the verified waiter reserves first, and the supervisor's approval is refused already_reserved",
      order: ["waiter", "supervisor"]
    },
    {
      name: "the supervisor's approval reserves first, and the verified waiter is refused already_reserved",
      order: ["supervisor", "waiter"]
    }
  ];

/** Writes the slot's binding as the waiter's session, with the client the waiter runs under. */
async function bindWaiterSession(
  thread: TurnThread,
  endedAt: string | undefined
): Promise<void> {
  const scope = { workspaceId: thread.info.id, threadId: thread.threadId };
  const at = new Date(thread.clock.ms).toISOString();
  await thread.daemon.server.threads.update(scope, (file) => {
    const next = structuredClone(file);
    next.generation = 1;
    next.slots[keyOf(thread)] = {
      workspaceId: thread.info.id,
      threadId: thread.threadId,
      profile: SECOND,
      client: "claude-code",
      nativeSessionId: WAITER_SESSION,
      hostId: "supervision-host",
      origin: "supervisor",
      generation: 1,
      owner: {
        ownerToken: "collision-owner",
        clientPid: process.ppid,
        reservedAt: at
      },
      boundAt: at,
      endedAt,
      conflicts: []
    };
    return { value: true, file: next };
  });
}

/**
 * The waiter's binding client is the test process's parent, and the waiter is this process. An approval
 * replaces the binding and drops its client, so the client is written again before the waiter reserves.
 */
async function ensureClient(thread: TurnThread): Promise<void> {
  const scope = { workspaceId: thread.info.id, threadId: thread.threadId };
  await thread.daemon.server.threads.update(scope, (file) => {
    const next = structuredClone(file);
    const binding = next.slots[keyOf(thread)];
    assert.ok(binding, "the slot is bound");
    next.slots[keyOf(thread)] = {
      ...binding,
      owner: { ...binding.owner, clientPid: process.ppid }
    };
    return { value: true, file: next };
  });
}

function outcomeOf(reply: Record<string, unknown>): Outcome {
  return {
    decision: String(reply.decision),
    reason: String(reply.reason ?? "")
  };
}

const STEPS: Record<
  Actor,
  (thread: TurnThread, messageId: string) => Promise<Outcome>
> = {
  waiter: async (thread, messageId) => {
    await ensureClient(thread);
    const reply = await send(
      thread.daemon.baseUrl,
      "POST",
      `${thread.base}/reservations`,
      {
        messageId,
        recipient: SECOND,
        holder: HOLDER.waiter(messageId),
        runId: WAITER_RUN,
        pid: process.pid
      }
    );
    return outcomeOf(parseReply(reply));
  },
  supervisor: async (thread, messageId) =>
    outcomeOf(parseReply(await cardAction(thread, "approve", messageId)))
};

for (const row of ORDERS) {
  test(row.name, async (t) => {
    const thread = await turnThread(t, "held");
    await bindWaiterSession(thread, new Date(thread.clock.ms).toISOString());
    const messageId = await mention(thread);
    await waitForCards(thread, (cards) =>
      cards.some(
        (card) =>
          card.messageId === messageId &&
          card.status === "awaiting_confirmation"
      )
    );
    const [first, second] = row.order;
    const firstOutcome = await STEPS[first](thread, messageId);
    const secondOutcome = await STEPS[second](thread, messageId);
    assert.deepEqual(firstOutcome, { decision: GRANTED[first], reason: "" });
    assert.deepEqual(secondOutcome, {
      decision: "refused",
      reason: "already_reserved"
    });
    const state = await stateOf(thread);
    const records = (state.reservations ?? []).filter(
      (record) => record.messageId === messageId && record.recipient === SECOND
    );
    assert.equal(records.length, 1, "one reservation for the mention");
    assert.equal(
      records[0]?.holder,
      HOLDER[first](messageId),
      "the first actor holds it"
    );
    const planning = cyclesCountersOf(state.activation?.stages.planning);
    assert.equal(planning.cyclesUsed, 1, "debited exactly once");
  });
}
