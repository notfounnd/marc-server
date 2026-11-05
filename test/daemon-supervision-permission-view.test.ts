import assert from "node:assert/strict";
import { test } from "node:test";
import { TOKEN, get, send } from "./daemon-session-http-fixtures.js";
import {
  awaitingCard,
  cardPost,
  editState,
  parseReply,
  supervisedThread
} from "./daemon-supervision-fixtures.js";
import {
  seedBinding,
  TABLE_CHILD,
  VALID_BODY,
  targetOf
} from "./daemon-supervision-permission-fixtures.js";

type View = {
  supervision: { messageId: string; permissions: Record<string, unknown>[] }[];
};

test("supervision permissions view: the panel lists a running card's open requests, and never the token", async (t) => {
  const started: { runId?: string }[] = [];
  const thread = await supervisedThread(t, {
    supervision: {
      runner: {
        start: (_scope, record) => void started.push(record),
        permissionTarget: () => targetOf(thread)
      }
    },
    processes: { list: async () => TABLE_CHILD }
  });
  const id = await awaitingCard(thread);
  const approved = await cardPost(thread, "approve", id);
  assert.equal(approved.status, 200);
  await seedBinding(thread);
  const runId = started[0]?.runId;
  assert.equal(typeof runId, "string");
  const created = await send(
    thread.daemon.baseUrl,
    "POST",
    `/api/supervision/runs/${runId}/permissions`,
    VALID_BODY
  );
  assert.equal(created.status, 201);

  const starting = parseReply(
    await get(thread.daemon.baseUrl, thread.base)
  ) as View;
  assert.deepStrictEqual(
    starting.supervision.find((card) => card.messageId === id)?.permissions,
    []
  );

  await editState(thread, (file) => {
    const card = file.supervision?.records.find(
      (record) => record.messageId === id
    );
    assert.ok(card);
    card.status = "running";
    card.runId = runId;
  });
  const running = await get(thread.daemon.baseUrl, thread.base);
  const shown = (parseReply(running) as View).supervision.find(
    (card) => card.messageId === id
  );
  assert.ok(shown);
  assert.equal(shown.permissions.length, 1);
  assert.deepStrictEqual(Object.keys(shown.permissions[0]).sort(), [
    "createdAt",
    "expiresAt",
    "requestId",
    "summary",
    "toolName"
  ]);
  assert.equal(shown.permissions[0].toolName, "Write");
  assert.equal(running.text.includes(TOKEN), false);
  assert.equal(running.text.includes(String(runId)), false);
});
