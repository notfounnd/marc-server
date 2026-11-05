import assert from "node:assert/strict";
import { test } from "node:test";
import { createThread } from "../src/core/workspace.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import type { ThreadFile } from "../src/daemon/thread-store.js";
import { ARCHITECT, send } from "./daemon-session-http-fixtures.js";
import {
  awaitingCard,
  cardPost,
  cardsOf,
  DEVELOPER,
  editState,
  MINUTE_MS,
  parseReply,
  pass,
  postIn,
  SECOND,
  slotKeyOf,
  START_MS,
  stateOf,
  supervisedThread,
  USER,
  type Thread
} from "./daemon-supervision-fixtures.js";

/** Edits the first card of the thread state, through the daemon's queue. */
async function editCard(
  thread: Thread,
  edit: (card: SupervisionRecord, file: ThreadFile) => void
): Promise<void> {
  await editState(thread, (file) => {
    const card = file.supervision?.records[0];
    assert.ok(card);
    edit(card, file);
  });
}

/** A released binding: the executor's end of a turn, so the slot is free again. */
function releaseSlot(thread: Thread, file: ThreadFile): void {
  const binding = file.slots[slotKeyOf(thread)];
  assert.ok(binding);
  binding.endedAt = new Date(thread.clock.ms).toISOString();
}

/** A released binding for the second architect: the slot the grace window must not judge yet. */
async function seedReleasedBinding(thread: Thread): Promise<void> {
  const at = new Date(thread.clock.ms).toISOString();
  await editState(thread, (file) => {
    file.slots[slotKeyOf(thread)] = {
      workspaceId: thread.info.id,
      threadId: thread.threadId,
      profile: SECOND,
      client: "claude-code",
      nativeSessionId: "seeded-session",
      hostId: "supervision-host",
      origin: "open",
      generation: 1,
      owner: { ownerToken: "seeded-owner", reservedAt: at },
      boundAt: at,
      conflicts: [],
      endedAt: at
    } as ThreadFile["slots"][string];
  });
}

async function pause(thread: Thread): Promise<void> {
  await send(
    thread.daemon.baseUrl,
    "POST",
    `/api/workspaces/${thread.info.id}/activation/pause`,
    {}
  );
}

test("a mention made before the start becomes an awaiting card and starts nothing", async (t) => {
  const thread = await supervisedThread(t);
  const message = await postIn(
    thread,
    ARCHITECT,
    `Please review marc://@${SECOND} now.`
  );
  await pass(thread);
  const [card] = await cardsOf(thread);
  assert.deepEqual(
    [card?.messageId, card?.recipient, card?.status, card?.attempt],
    [message.id, SECOND, "awaiting_confirmation", 0]
  );
  assert.deepEqual(thread.runs.starts, []);
});

const NOT_WOKEN = [
  {
    name: "a developer is named by an architect",
    author: ARCHITECT,
    recipient: DEVELOPER,
    role: "architect"
  },
  {
    name: "a user message is written without the UI",
    author: USER,
    recipient: SECOND,
    role: "user"
  }
];

for (const row of NOT_WOKEN) {
  test(`no card when ${row.name}`, async (t) => {
    const thread = await supervisedThread(t);
    await postIn(
      thread,
      row.author,
      `Look at marc://@${row.recipient}.`,
      row.role
    );
    await pass(thread);
    assert.deepEqual(await cardsOf(thread), []);
    assert.deepEqual(thread.runs.starts, []);
  });
}

test("a mention in another thread does not create a card here", async (t) => {
  const thread = await supervisedThread(t);
  const other = await createThread(thread.root, "Other thread");
  await postIn(
    { ...thread, threadId: other.id },
    ARCHITECT,
    `Please review marc://@${SECOND} now.`
  );
  await pass(thread);
  assert.deepEqual(await cardsOf(thread), []);
});

test("approve starts the turn once under the supervisor origin, and a repeat is refused", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  const first = await cardPost(thread, "approve", id);
  assert.equal(first.status, 200);
  assert.deepEqual(
    [
      parseReply(first).decision,
      parseReply(first).attempt,
      parseReply(first).mode
    ],
    ["started", 1, "new"]
  );
  assert.equal(thread.runs.starts.length, 1);
  const state = await stateOf(thread);
  assert.equal(state.slots[slotKeyOf(thread)]?.origin, "supervisor");
  const second = await cardPost(thread, "approve", id);
  assert.deepEqual(
    [second.status, parseReply(second).reason, parseReply(second).status],
    [409, "not_awaiting", "starting"]
  );
  assert.equal(thread.runs.starts.length, 1);
});

test("two concurrent approvals: one starts the turn and the other is refused", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  const replies = await Promise.all([
    cardPost(thread, "approve", id),
    cardPost(thread, "approve", id)
  ]);
  assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 409]);
  assert.equal(thread.runs.starts.length, 1);
});

test("an approval under a pause writes nothing and the card stays awaiting", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  await pause(thread);
  const reply = await cardPost(thread, "approve", id);
  assert.deepEqual(
    [reply.status, parseReply(reply).reason],
    [409, "workspace_paused"]
  );
  const state = await stateOf(thread);
  assert.equal(state.slots[slotKeyOf(thread)], undefined);
  assert.equal(state.reservations?.length ?? 0, 0);
  assert.equal((await cardsOf(thread))[0]?.status, "awaiting_confirmation");
  assert.deepEqual(thread.runs.starts, []);
});

test("decline dismisses an awaiting card, and its floor keeps it from coming back", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  const reply = await cardPost(thread, "decline", id);
  assert.equal(parseReply(reply).decision, "declined");
  await pass(thread);
  const cards = await cardsOf(thread);
  assert.deepEqual(
    cards.map((card) => card.status),
    ["declined"]
  );
});

test("a waiting card cannot be declined: it leaves by expiry or when its state resolves", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  await pause(thread);
  await pass(thread);
  assert.equal((await cardsOf(thread))[0]?.status, "waiting");
  const reply = await cardPost(thread, "decline", id);
  assert.deepEqual(
    [reply.status, parseReply(reply).reason, parseReply(reply).status],
    [409, "not_awaiting", "waiting"]
  );
});

test("inside the grace window a bound recipient waits for checking_sessions, and approve is refused there", async (t) => {
  const thread = await supervisedThread(t);
  thread.clock.ms = START_MS + 10 * 1000;
  await seedReleasedBinding(thread);
  const message = await postIn(
    thread,
    ARCHITECT,
    `Please review marc://@${SECOND} now.`
  );
  await pass(thread);
  const [card] = await cardsOf(thread);
  assert.deepEqual(
    [card?.messageId, card?.status, card?.reason],
    [message.id, "waiting", "checking_sessions"]
  );
  const reply = await cardPost(thread, "approve", message.id);
  assert.deepEqual(
    [reply.status, parseReply(reply).reason],
    [409, "checking_sessions"]
  );
  thread.clock.ms += 2 * MINUTE_MS;
  await pass(thread);
  assert.equal((await cardsOf(thread))[0]?.status, "awaiting_confirmation");
});

test("retry restarts a failed card below the cap, keeping the session", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  await cardPost(thread, "approve", id);
  await editCard(thread, (card, file) => {
    card.status = "failed";
    card.reason = "timeout";
    releaseSlot(thread, file);
  });
  const reply = await cardPost(thread, "retry", id);
  assert.deepEqual(
    [reply.status, parseReply(reply).attempt, parseReply(reply).mode],
    [200, 2, "resume"]
  );
  assert.equal(thread.runs.starts.length, 2);
});

test("retry is refused at the attempt cap", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  await cardPost(thread, "approve", id);
  await editCard(thread, (card, file) => {
    card.status = "failed";
    card.reason = "timeout";
    card.attempt = 2;
    releaseSlot(thread, file);
  });
  const reply = await cardPost(thread, "retry", id);
  assert.deepEqual(
    [reply.status, parseReply(reply).reason],
    [409, "attempts_exhausted"]
  );
});

const CONTINUE_ROWS = [
  { reason: "timeout", status: 200, refusal: undefined },
  { reason: "crashed", status: 409, refusal: "not_continuable" }
];

for (const row of CONTINUE_ROWS) {
  test(`continue for a ${row.reason} failure answers ${row.status}`, async (t) => {
    const thread = await supervisedThread(t);
    const id = await awaitingCard(thread);
    await cardPost(thread, "approve", id);
    await editCard(thread, (card, file) => {
      card.status = "failed";
      card.reason = row.reason;
      releaseSlot(thread, file);
    });
    const reply = await cardPost(thread, "continue", id);
    assert.equal(reply.status, row.status);
    assert.equal(parseReply(reply).reason, row.refusal);
  });
}

test("a pending card expires after its TTL, and the floor keeps it from coming back", async (t) => {
  const thread = await supervisedThread(t);
  await awaitingCard(thread);
  thread.clock.ms += 25 * 60 * MINUTE_MS;
  await thread.daemon.server.supervision.sweepAll();
  await pass(thread);
  const cards = await cardsOf(thread);
  assert.deepEqual(
    cards.map((card) => card.status),
    ["expired"]
  );
});
