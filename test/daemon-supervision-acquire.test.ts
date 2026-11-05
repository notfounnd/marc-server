import assert from "node:assert/strict";
import { test } from "node:test";
import type { Reply } from "./daemon-session-http-fixtures.js";
import {
  acquireSlot,
  awaitingCard,
  cardPost,
  cardsOf,
  parseReply,
  slotKeyOf,
  stateOf,
  supervisedThread,
  type Thread
} from "./daemon-supervision-fixtures.js";

/** The two requests that dispute the slot: marc open's acquire, and the approval of the card. */
type Call = "acquire" | "approve";

const CALLS: Record<
  Call,
  (thread: Thread, messageId: string) => Promise<Reply>
> = {
  acquire: (thread) => acquireSlot(thread, 0),
  approve: (thread, messageId) => cardPost(thread, "approve", messageId)
};

const LOSER: Record<Call, Call> = { acquire: "approve", approve: "acquire" };

/**
 * What the winner leaves behind. The loser writes nothing, so there is one posse (generation 1) and no
 * card starts on the loser's behalf. When acquire wins, the card may be awaiting or waiting: the watcher's
 * pass judges a reserved slot as busy, and that depends on when the pass runs. It is never starting.
 */
const WINNERS: Record<
  Call,
  { origin: string; starts: number; cards: string[] }
> = {
  acquire: {
    origin: "open",
    starts: 0,
    cards: ["awaiting_confirmation", "waiting"]
  },
  approve: { origin: "supervisor", starts: 1, cards: ["starting"] }
};

const ORDERS: Array<{ name: string; first: Call; second: Call }> = [
  { name: "marc open acquires first", first: "acquire", second: "approve" },
  { name: "approve starts first", first: "approve", second: "acquire" }
];

function replyOf(replies: Map<Call, Reply>, call: Call): Reply {
  const reply = replies.get(call);
  assert.ok(reply);
  return reply;
}

/** Exactly one winner answered 200, the other was refused, and the winner's side effects are the only ones. */
async function assertOneWinner(
  thread: Thread,
  replies: Map<Call, Reply>,
  winner: Call
): Promise<void> {
  const expected = WINNERS[winner];
  assert.equal(replyOf(replies, winner).status, 200);
  assert.equal(replyOf(replies, LOSER[winner]).status, 409);
  const state = await stateOf(thread);
  const binding = state.slots[slotKeyOf(thread)];
  assert.equal(binding?.origin, expected.origin);
  assert.equal(binding?.generation, 1);
  assert.equal(thread.runs.starts.length, expected.starts);
  const [card] = await cardsOf(thread);
  assert.ok(expected.cards.includes(card?.status ?? ""));
}

for (const row of ORDERS) {
  test(`${row.name}: the first request wins and the second writes nothing`, async (t) => {
    const thread = await supervisedThread(t);
    const id = await awaitingCard(thread);
    const first = await CALLS[row.first](thread, id);
    const second = await CALLS[row.second](thread, id);
    const replies = new Map<Call, Reply>([
      [row.first, first],
      [row.second, second]
    ]);
    await assertOneWinner(thread, replies, row.first);
  });
}

test("the two requests sent together: exactly one wins and the loser writes nothing", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  const [acquire, approve] = await Promise.all([
    CALLS.acquire(thread, id),
    CALLS.approve(thread, id)
  ]);
  const replies = new Map<Call, Reply>([
    ["acquire", acquire],
    ["approve", approve]
  ]);
  const winners = [...replies.entries()]
    .filter(([, reply]) => reply.status === 200)
    .map(([call]) => call);
  assert.equal(winners.length, 1);
  const [winner] = winners;
  assert.ok(winner);
  await assertOneWinner(thread, replies, winner);
});

test("approve first: the marc open acquire is refused as reserved and changes nothing", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  const approve = await CALLS.approve(thread, id);
  assert.equal(approve.status, 200);
  const before = (await stateOf(thread)).slots[slotKeyOf(thread)];
  const acquire = await acquireSlot(thread, 1);
  assert.deepEqual(
    [acquire.status, parseReply(acquire).reason],
    [409, "reserved"]
  );
  const after = (await stateOf(thread)).slots[slotKeyOf(thread)];
  assert.deepEqual(after, before);
});
