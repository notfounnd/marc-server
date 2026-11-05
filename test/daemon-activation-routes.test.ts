import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ARCHITECT,
  get,
  registered,
  send,
  startDaemon,
  workspaceWithThread,
  type Reply
} from "./daemon-session-http-fixtures.js";

const POLICY_BODY = { enabled: true, attemptCap: 2, pendingTtlMinutes: 1440 };

function parse<T>(reply: Reply): T {
  return JSON.parse(reply.text) as T;
}

async function started(t: { after(fn: () => unknown): void }) {
  const daemon = await startDaemon();
  t.after(() => daemon.close());
  const ws = await workspaceWithThread();
  t.after(() => fs.rm(ws.root, { recursive: true, force: true }));
  await registered(daemon, ws.info);
  const base = `/api/workspaces/${ws.info.id}/threads/${ws.threadId}/activation`;
  return { daemon, ws, base };
}

test("the empty view lists the architect participants and no budget", async (t) => {
  const { daemon, ws, base } = await started(t);
  const view = parse<Record<string, unknown>>(await get(daemon.baseUrl, base));
  assert.deepEqual(
    [
      view.threadId,
      view.policyState,
      view.enabled,
      view.policy,
      view.budget,
      view.participants
    ],
    [ws.threadId, "none", false, null, null, [ARCHITECT]]
  );
});

test("a save writes a version 2 policy, the budget shows the default five cycles, and the file holds no stages", async (t) => {
  const { daemon, ws, base } = await started(t);
  const saved = await send(
    daemon.baseUrl,
    "PUT",
    `${base}/policy`,
    POLICY_BODY
  );
  assert.equal(saved.status, 200);
  const view = parse<{
    policy: { version: number; enabled: boolean };
    budget: { max: number; cyclesPerStage: number; currentStage: string };
  }>(saved);
  assert.deepEqual(
    [
      view.policy.version,
      view.policy.enabled,
      view.budget.max,
      view.budget.cyclesPerStage,
      view.budget.currentStage
    ],
    [2, true, 5, 5, "planning"]
  );
  const onDisk = JSON.parse(
    await fs.readFile(
      path.join(ws.root, ".marc", "threads", ws.threadId, "policy.json"),
      "utf8"
    )
  ) as Record<string, unknown>;
  assert.equal("stages" in onDisk, false);
  assert.equal("participants" in onDisk, false);
});

test("an out-of-range limit is a 400 with the error, and an unknown thread is a 404", async (t) => {
  const { daemon, base, ws } = await started(t);
  const bad = await send(daemon.baseUrl, "PUT", `${base}/policy`, {
    ...POLICY_BODY,
    attemptCap: 9
  });
  assert.equal(bad.status, 400);
  const missing = await get(
    daemon.baseUrl,
    `/api/workspaces/${ws.info.id}/threads/no-such-thread/activation`
  );
  assert.equal(missing.status, 404);
});

test("the human stage actions are refused until the thread is ready, then extend and advance move the stage", async (t) => {
  const { daemon, base } = await started(t);
  const early = await send(daemon.baseUrl, "POST", `${base}/extend`, {
    expectedStage: "planning"
  });
  assert.deepEqual(
    [early.status, parse<{ reason: string }>(early).reason],
    [409, "policy_disabled"]
  );

  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  const stale = await send(daemon.baseUrl, "POST", `${base}/extend`, {
    expectedStage: "review"
  });
  assert.deepEqual(
    [stale.status, parse<{ reason: string }>(stale).reason],
    [409, "stage_changed"]
  );

  const extended = await send(daemon.baseUrl, "POST", `${base}/extend`, {
    expectedStage: "planning"
  });
  assert.equal(parse<{ budget: { max: number } }>(extended).budget.max, 10);

  const advanced = await send(daemon.baseUrl, "POST", `${base}/advance`, {
    expectedStage: "planning",
    to: "execution"
  });
  assert.equal(
    parse<{ budget: { currentStage: string } }>(advanced).budget.currentStage,
    "execution"
  );
});

test("the cycles setting is saved through the settings route and read back in force", async (t) => {
  const { daemon, ws } = await started(t);
  const settings = `/api/workspaces/${ws.info.id}/settings`;
  const saved = await send(daemon.baseUrl, "POST", settings, {
    activation: { cyclesPerStage: 3 }
  });
  assert.equal(saved.status, 200);
  const read = parse<{ activation: { cyclesPerStage: number } }>(
    await get(daemon.baseUrl, settings)
  );
  assert.equal(read.activation.cyclesPerStage, 3);

  const outOfRange = await send(daemon.baseUrl, "POST", settings, {
    activation: { cyclesPerStage: 0 }
  });
  assert.equal(outOfRange.status, 400);
});

test("a memory-only save keeps the cycles setting as it was", async (t) => {
  const { daemon, ws } = await started(t);
  const settings = `/api/workspaces/${ws.info.id}/settings`;
  await send(daemon.baseUrl, "POST", settings, {
    activation: { cyclesPerStage: 3 }
  });
  await send(daemon.baseUrl, "POST", settings, {
    memory: { autoRebuild: false }
  });
  const read = parse<{ activation: { cyclesPerStage: number } }>(
    await get(daemon.baseUrl, settings)
  );
  assert.equal(read.activation.cyclesPerStage, 3);
});

test("a hand edit of policy.json under the same revision pauses the enabled thread", async (t) => {
  const { daemon, ws, base } = await started(t);
  await send(daemon.baseUrl, "PUT", `${base}/policy`, POLICY_BODY);
  const file = path.join(
    ws.root,
    ".marc",
    "threads",
    ws.threadId,
    "policy.json"
  );
  const edited = JSON.parse(await fs.readFile(file, "utf8")) as Record<
    string,
    unknown
  >;
  await fs.writeFile(file, JSON.stringify({ ...edited, attemptCap: 4 }));

  const view = parse<{ threadPaused: boolean; warnings: string[] }>(
    await get(daemon.baseUrl, base)
  );
  assert.deepEqual(
    [view.threadPaused, view.warnings],
    [true, ["policy_tampered"]]
  );
});

test("the workspace pause flag is answered by the activation view", async (t) => {
  const { daemon, ws } = await started(t);
  const paused = await send(
    daemon.baseUrl,
    "POST",
    `/api/workspaces/${ws.info.id}/activation/pause`,
    {}
  );
  assert.equal(paused.status, 200);
  const state = parse<{ paused: boolean }>(
    await get(daemon.baseUrl, `/api/workspaces/${ws.info.id}/activation`)
  );
  assert.equal(state.paused, true);
});
