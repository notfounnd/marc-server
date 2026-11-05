import assert from "node:assert/strict";
import { test } from "node:test";
import { send } from "./daemon-session-http-fixtures.js";
import { parseReply } from "./daemon-supervision-fixtures.js";
import {
  cardAction,
  cardFor,
  cardsOf,
  fakeClient,
  mention,
  slotKeyOf,
  stateOf,
  turnThread
} from "./daemon-supervision-turn-fixtures.js";

test("a workspace paused between the approval and the start revokes the card, and no process starts", async (t) => {
  const thread = await turnThread(t, "held");
  fakeClient(thread, "success", "0.001");
  const messageId = await mention(thread);
  assert.equal(
    parseReply(await cardAction(thread, "approve", messageId)).decision,
    "started"
  );
  const record = thread.held.find((held) => held.messageId === messageId);
  assert.ok(record, "the approved start reached the runner");

  const paused = await send(
    thread.daemon.baseUrl,
    "POST",
    `/api/workspaces/${thread.info.id}/activation/pause`,
    {}
  );
  assert.equal(paused.status, 200);

  await thread.daemon.server.turnRunner.start(
    { workspace: thread.info, threadId: thread.threadId },
    record
  );
  await thread.daemon.server.turnRunner.idle();

  const card = cardFor(await cardsOf(thread), messageId);
  assert.equal(card.status, "failed");
  assert.equal(card.reason, "revoked");
  assert.equal(thread.clock.launches, 0, "no process was launched");
  const binding = (await stateOf(thread)).slots[slotKeyOf(thread)];
  assert.ok(binding.endedAt !== undefined, "the binding is released");
});
