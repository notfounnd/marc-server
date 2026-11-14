import assert from "node:assert/strict";
import { test } from "node:test";
import { registerAgent } from "../src/core/workspace.js";
import { releaseBinding } from "../src/daemon/session-transitions.js";
import type { ThreadFile } from "../src/daemon/thread-store.js";
import { ARCHITECT, send } from "./daemon-session-http-fixtures.js";
import {
  awaitingCard,
  cardPost,
  cardsOf,
  editState,
  MINUTE_MS,
  parseReply,
  pass,
  postIn,
  SECOND,
  slotKeyOf,
  stateOf,
  supervisedThread,
  type Thread
} from "./daemon-supervision-fixtures.js";

/** A third architect profile, not approved in the thread, for the case that keeps its card. */
const THIRD = "codex-third-architect";

/** The policy body the fixtures save; saving it again is a new authorization of the same content. */
function savePolicy(thread: Thread, enabled: boolean): Promise<unknown> {
  return send(thread.daemon.baseUrl, "PUT", `${thread.base}/policy`, {
    enabled,
    attemptCap: 2,
    pendingTtlMinutes: 1440
  });
}

/** The first turn of the second architect: its awaiting card is approved, and the turn starts once. */
async function approveFirst(thread: Thread): Promise<void> {
  const id = await awaitingCard(thread);
  const reply = await cardPost(thread, "approve", id);
  assert.equal(parseReply(reply).decision, "started");
}

/** The turn ends and its binding is released, so the slot is free for the next mention. */
async function endTurn(thread: Thread): Promise<void> {
  const at = new Date(thread.clock.ms).toISOString();
  await editState(thread, (file) => {
    const binding = file.slots[slotKeyOf(thread)];
    assert.ok(binding);
    file.slots[slotKeyOf(thread)] = releaseBinding(binding, at);
  });
}

/** A later mention of the second architect, in a later minute, passed once. */
async function mentionAgain(thread: Thread, agentId: string): Promise<string> {
  thread.clock.ms += MINUTE_MS;
  const message = await postIn(
    thread,
    ARCHITECT,
    `Please review marc://@${agentId} again.`
  );
  await pass(thread);
  return message.id;
}

function statusesOf(cards: Array<{ status: string }>): string[] {
  return cards.map((card) => card.status);
}

test("the first approval of an architect starts once, and the thread records it", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  assert.deepEqual(statusesOf(await cardsOf(thread)), [
    "awaiting_confirmation"
  ]);
  const reply = await cardPost(thread, "approve", id);
  assert.equal(parseReply(reply).decision, "started");
  assert.equal(thread.runs.starts.length, 1);
  assert.equal(thread.runs.starts[0]?.turn?.auto, undefined);
  const activation = (await stateOf(thread)).activation;
  assert.deepEqual(
    activation?.approvals?.map((item) => item.agentId),
    [SECOND]
  );
  assert.equal(
    activation?.approvals?.[0]?.revision,
    activation?.authorizedRevision
  );
});

test("a later mention of the approved architect starts on its own, marked automatic", async (t) => {
  const thread = await supervisedThread(t);
  await approveFirst(thread);
  await endTurn(thread);
  const later = await mentionAgain(thread, SECOND);
  assert.equal(thread.runs.starts.length, 2);
  assert.equal(thread.runs.starts[1]?.messageId, later);
  assert.equal(thread.runs.starts[1]?.turn?.auto, true);
  assert.deepEqual(statusesOf(await cardsOf(thread)), ["starting", "starting"]);
});

test("an architect the human did not approve keeps its card", async (t) => {
  const thread = await supervisedThread(t);
  await approveFirst(thread);
  await endTurn(thread);
  await registerAgent(thread.root, {
    id: THIRD,
    role: "architect",
    model: "claude-opus-5-5",
    description: "Third architect for the approval tests."
  });
  await mentionAgain(thread, THIRD);
  assert.equal(thread.runs.starts.length, 1);
  const cards = await cardsOf(thread);
  assert.deepEqual(
    cards.map((card) => card.recipient),
    [SECOND, THIRD]
  );
  assert.equal(cards[1]?.status, "awaiting_confirmation");
});

test("saving the policy again clears the approval, so the next mention asks for a card", async (t) => {
  const thread = await supervisedThread(t);
  await approveFirst(thread);
  await endTurn(thread);
  await savePolicy(thread, true);
  assert.equal((await stateOf(thread)).activation?.approvals, undefined);
  await mentionAgain(thread, SECOND);
  assert.equal(thread.runs.starts.length, 1);
  assert.deepEqual(statusesOf(await cardsOf(thread)), [
    "starting",
    "awaiting_confirmation"
  ]);
});

test("switching the policy off and on again clears the approval", async (t) => {
  const thread = await supervisedThread(t);
  await approveFirst(thread);
  await endTurn(thread);
  await savePolicy(thread, false);
  await savePolicy(thread, true);
  assert.equal((await stateOf(thread)).activation?.approvals, undefined);
  await mentionAgain(thread, SECOND);
  assert.equal(thread.runs.starts.length, 1);
  assert.equal((await cardsOf(thread))[1]?.status, "awaiting_confirmation");
});

test("an exhausted cycle balance starts nothing on its own, and the card waits", async (t) => {
  const thread = await supervisedThread(t);
  await approveFirst(thread);
  await endTurn(thread);
  await editState(thread, (file: ThreadFile) => {
    const activation = file.activation;
    assert.ok(activation);
    activation.stages.planning = { cyclesUsed: 5, extensions: [] };
  });
  await mentionAgain(thread, SECOND);
  assert.equal(thread.runs.starts.length, 1);
  assert.equal((await cardsOf(thread))[1]?.status, "waiting");
});

test("a paused workspace starts nothing on its own", async (t) => {
  const thread = await supervisedThread(t);
  await approveFirst(thread);
  await endTurn(thread);
  await send(
    thread.daemon.baseUrl,
    "POST",
    `/api/workspaces/${thread.info.id}/activation/pause`,
    {}
  );
  await mentionAgain(thread, SECOND);
  assert.equal(thread.runs.starts.length, 1);
  assert.equal((await cardsOf(thread))[1]?.status, "waiting");
});

test("a failed turn of an approved architect is not repeated on its own", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  const reply = await cardPost(thread, "approve", id);
  assert.equal(parseReply(reply).decision, "started");
  await endTurn(thread);
  await editState(thread, (file: ThreadFile) => {
    const card = file.supervision?.records[0];
    assert.ok(card);
    card.status = "failed";
    card.reason = "crashed";
  });
  await pass(thread);
  assert.equal(thread.runs.starts.length, 1);
  assert.deepEqual(statusesOf(await cardsOf(thread)), ["failed"]);
});

test("a refused approval writes no approval", async (t) => {
  const thread = await supervisedThread(t);
  const id = await awaitingCard(thread);
  await send(
    thread.daemon.baseUrl,
    "POST",
    `/api/workspaces/${thread.info.id}/activation/pause`,
    {}
  );
  const reply = await cardPost(thread, "approve", id);
  assert.equal(parseReply(reply).reason, "workspace_paused");
  assert.equal(thread.runs.starts.length, 0);
  assert.equal((await stateOf(thread)).activation?.approvals, undefined);
});
