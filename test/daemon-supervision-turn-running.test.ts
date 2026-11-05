import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import { parseReply } from "./daemon-supervision-fixtures.js";
import {
  cardAction,
  cardFor,
  fakeClient,
  mention,
  slotKeyOf,
  stateOf,
  turnThread,
  waitForCards
} from "./daemon-supervision-turn-fixtures.js";
import { waitUntilGone } from "./daemon-supervision-turn-probes.js";

function terminal(messageId: string) {
  return (cards: SupervisionRecord[]) =>
    cards.some(
      (card) =>
        card.messageId === messageId &&
        (card.status === "done" || card.status === "failed")
    );
}

test("a running write that cannot mark the card running ends the turn as an error, and stops its process", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "ignore", "0.001");
  const messageId = await mention(thread);
  const scope = { workspaceId: thread.info.id, threadId: thread.threadId };
  // The card turns running just before the launch, so the turn's own running write finds no starting card.
  thread.clock.onLaunch = () => {
    void thread.daemon.server.threads.update(scope, (file) => {
      const next = structuredClone(file);
      Object.assign(
        next.supervision?.records.find(
          (record) => record.messageId === messageId
        ) ?? {},
        { status: "running" }
      );
      return { value: true, file: next };
    });
  };

  assert.equal(
    parseReply(await cardAction(thread, "approve", messageId)).decision,
    "started"
  );
  const card = cardFor(
    await waitForCards(thread, terminal(messageId)),
    messageId
  );
  assert.equal(card.status, "failed");
  assert.equal(card.reason, "error");
  assert.equal(card.outcome?.failure, "error");
  assert.equal(
    card.outcome?.costUsd,
    undefined,
    "no output was read, so no cost"
  );

  assert.equal(thread.clock.launches, 1, "one process was launched");
  const pid = thread.clock.children[0]?.pid;
  assert.ok(pid !== undefined, "the launched process has a pid");
  await waitUntilGone(pid);

  const binding = (await stateOf(thread)).slots[slotKeyOf(thread)];
  assert.ok(binding.endedAt !== undefined, "the binding is released");
});
