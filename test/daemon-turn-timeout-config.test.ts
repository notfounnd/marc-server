import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { ARCHITECT, get, send } from "./daemon-session-http-fixtures.js";
import {
  cardPost,
  cardsOf,
  parseReply,
  pass,
  postIn,
  SECOND,
  supervisedThread,
  type Thread
} from "./daemon-supervision-fixtures.js";

function settingsPath(thread: Thread): string {
  return `/api/workspaces/${thread.info.id}/settings`;
}

function configFileOf(thread: Thread): string {
  return path.join(thread.info.marcPath, "marc.config.json");
}

async function activationOf(thread: Thread): Promise<Record<string, unknown>> {
  const reply = await get(thread.daemon.baseUrl, settingsPath(thread));
  return parseReply(reply).activation as Record<string, unknown>;
}

async function awaitingCard(thread: Thread): Promise<string> {
  const message = await postIn(
    thread,
    ARCHITECT,
    `Please review marc://@${SECOND} now.`
  );
  await pass(thread);
  return message.id;
}

test("the time limit defaults to 60 minutes before any save", async (t) => {
  const thread = await supervisedThread(t);
  assert.equal((await activationOf(thread)).turnTimeoutMinutes, 60);
});

const INVALID_VALUES = [5, 481, 90.5, "90"];

for (const value of INVALID_VALUES) {
  test(`a time limit of ${JSON.stringify(value)} is refused with 400`, async (t) => {
    const thread = await supervisedThread(t);
    const reply = await send(
      thread.daemon.baseUrl,
      "POST",
      settingsPath(thread),
      {
        activation: { turnTimeoutMinutes: value }
      }
    );
    assert.equal(reply.status, 400);
  });
}

test("saving the time limit through the route authorizes it", async (t) => {
  const thread = await supervisedThread(t);
  const saved = await send(
    thread.daemon.baseUrl,
    "POST",
    settingsPath(thread),
    {
      activation: { turnTimeoutMinutes: 90 }
    }
  );
  assert.equal(saved.status, 200);
  assert.equal((await activationOf(thread)).turnTimeoutMinutes, 90);
  const id = await awaitingCard(thread);
  const reply = await cardPost(thread, "approve", id);
  assert.equal(reply.status, 200);
  assert.equal(thread.runs.starts.length, 1);
});

test("a hand edit of marc.config.json is tampered: the authorized value stays and approvals are refused", async (t) => {
  const thread = await supervisedThread(t);
  await send(thread.daemon.baseUrl, "POST", settingsPath(thread), {
    activation: { turnTimeoutMinutes: 90 }
  });
  await fs.writeFile(
    configFileOf(thread),
    JSON.stringify({ activation: { turnTimeoutMinutes: 120 } }),
    "utf8"
  );
  assert.equal((await activationOf(thread)).turnTimeoutMinutes, 90);
  const id = await awaitingCard(thread);
  const reply = await cardPost(thread, "approve", id);
  assert.deepEqual(
    [reply.status, parseReply(reply).reason],
    [409, "turn_timeout_tampered"]
  );
  assert.deepEqual(thread.runs.starts, []);
  assert.equal((await cardsOf(thread))[0]?.status, "awaiting_confirmation");
});
