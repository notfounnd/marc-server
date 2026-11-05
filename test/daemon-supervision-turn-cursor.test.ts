import assert from "node:assert/strict";
import { test } from "node:test";
import { appendMessageInWorkspace } from "../src/core/threads.js";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import { SECOND } from "./daemon-supervision-fixtures.js";
import {
  cardAction,
  fakeClient,
  launchedArgv,
  mention,
  turnThread,
  waitForCards,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";

const WHOLE_THREAD =
  "You have no stored cursor, so read the whole thread with thread_read.";

function afterCursor(messageId: string): string {
  return `Read the thread after message ${messageId} with thread_read_since.`;
}

function terminal(messageId: string) {
  return (cards: SupervisionRecord[]) =>
    cards.some(
      (card) =>
        card.messageId === messageId &&
        (card.status === "done" || card.status === "failed")
    );
}

/** A message the recipient posts itself, as an earlier turn of its own would. Returns the stored id. */
async function postAsRecipient(
  thread: TurnThread,
  body: string
): Promise<string> {
  const message = await appendMessageInWorkspace(thread.info, thread.threadId, {
    agentId: SECOND,
    body,
    role: "architect"
  });
  return message.id;
}

/**
 * Each row posts the recipient's own messages, then approves a new turn. The prompt names the last of them
 * as the cursor, or sends the whole-thread reading when the recipient has posted none.
 */
const CURSOR_ROWS: readonly {
  name: string;
  own: string[];
  sentence: (lastOwnId: string | undefined) => string;
}[] = [
  {
    name: "a recipient with its own messages reads the thread after its last one",
    own: ["first note", "second note"],
    sentence: (lastOwnId) => afterCursor(lastOwnId ?? "")
  },
  {
    name: "a recipient with no message of its own reads the whole thread",
    own: [],
    sentence: () => WHOLE_THREAD
  }
];

for (const row of CURSOR_ROWS) {
  test(`new turn prompt: ${row.name}`, async (t) => {
    const thread = await turnThread(t, "production");
    fakeClient(thread, "success", "0.001");
    const ids: string[] = [];
    for (const body of row.own) {
      ids.push(await postAsRecipient(thread, body));
    }
    const messageId = await mention(thread);
    await cardAction(thread, "approve", messageId);
    await waitForCards(thread, terminal(messageId));

    const argv = await launchedArgv(thread);
    assert.equal(argv.mode, "new");
    assert.ok(argv.prompt.includes(row.sentence(ids.at(-1))));
  });
}

test("a resumed turn reads the thread after the recipient's own last message, not the whole thread", async (t) => {
  const thread = await turnThread(t, "production");
  fakeClient(thread, "success", "0.001");
  const first = await mention(thread);
  await cardAction(thread, "approve", first);
  await waitForCards(thread, terminal(first));

  const own = await postAsRecipient(thread, "a note after the first turn");
  fakeClient(thread, "success", "0.005");
  const second = await mention(thread);
  await cardAction(thread, "approve", second);
  await waitForCards(thread, terminal(second));

  const argv = await launchedArgv(thread);
  assert.equal(argv.mode, "resume");
  assert.ok(argv.prompt.includes(afterCursor(own)));
  assert.ok(!argv.prompt.includes(WHOLE_THREAD));
});
