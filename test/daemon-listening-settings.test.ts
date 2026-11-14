import assert from "node:assert/strict";
import { test } from "node:test";
import { get, send } from "./daemon-session-http-fixtures.js";
import {
  parseReply,
  supervisedThread,
  type Thread
} from "./daemon-supervision-fixtures.js";

function settingsPath(thread: Thread): string {
  return `/api/workspaces/${thread.info.id}/settings`;
}

async function listeningOf(thread: Thread): Promise<Record<string, unknown>> {
  const reply = await get(thread.daemon.baseUrl, settingsPath(thread));
  return parseReply(reply).listening as Record<string, unknown>;
}

const INVALID_BODIES: Array<{ name: string; body: unknown }> = [
  { name: "a string value", body: { listening: { defaultOn: "yes" } } },
  { name: "a number value", body: { listening: { defaultOn: 1 } } },
  { name: "a string section", body: { listening: "on" } },
  { name: "a list section", body: { listening: [true] } }
];

for (const row of INVALID_BODIES) {
  test(`a listening default save with ${row.name} is refused with 400`, async (t) => {
    const thread = await supervisedThread(t);
    const reply = await send(
      thread.daemon.baseUrl,
      "POST",
      settingsPath(thread),
      row.body
    );
    assert.equal(reply.status, 400);
    assert.deepEqual(await listeningOf(thread), { defaultOn: false });
  });
}

test("the listening default is off before any save", async (t) => {
  const thread = await supervisedThread(t);
  assert.deepEqual(await listeningOf(thread), { defaultOn: false });
});

test("saving the listening default through the route is accepted and read back", async (t) => {
  const thread = await supervisedThread(t);
  const saved = await send(
    thread.daemon.baseUrl,
    "POST",
    settingsPath(thread),
    { listening: { defaultOn: true } }
  );
  assert.equal(saved.status, 200);
  assert.deepEqual(await listeningOf(thread), { defaultOn: true });
});

test("saving the listening default does not authorize the activation values", async (t) => {
  const thread = await supervisedThread(t);
  const before = parseReply(
    await get(thread.daemon.baseUrl, settingsPath(thread))
  ).activation;
  const saved = await send(
    thread.daemon.baseUrl,
    "POST",
    settingsPath(thread),
    { listening: { defaultOn: true } }
  );
  assert.equal(saved.status, 200);
  assert.deepEqual(
    parseReply(await get(thread.daemon.baseUrl, settingsPath(thread)))
      .activation,
    before
  );
});

test("a memory save through the route keeps the listening default", async (t) => {
  const thread = await supervisedThread(t);
  await send(thread.daemon.baseUrl, "POST", settingsPath(thread), {
    listening: { defaultOn: true }
  });
  const saved = await send(
    thread.daemon.baseUrl,
    "POST",
    settingsPath(thread),
    { memory: { autoRebuild: false } }
  );
  assert.equal(saved.status, 200);
  assert.deepEqual(await listeningOf(thread), { defaultOn: true });
});
