import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PAUSE_HISTORY_LIMIT } from "../src/core/activation-pauses.js";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import { createActivationLedger } from "../src/daemon/activation-ledger.js";
import { createThreadStore } from "../src/daemon/thread-store.js";
import { createWorkspaceStore } from "../src/daemon/workspace-store.js";
import {
  policyFor,
  readJson,
  threadPath,
  workspaceInfo
} from "./daemon-thread-state-fixtures.js";

const BASE_MS = Date.parse("2026-11-04T12:00:00.000Z");

/** A clock that advances one millisecond per call, so every write has a distinct moment. */
function tickingClock(): { now: () => string } {
  let tick = 0;
  return { now: () => new Date(BASE_MS + tick++).toISOString() };
}

async function harness(t: { after(fn: () => unknown): void }) {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marc-pause-history-")
  );
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const clock = tickingClock();
  const deps = { now: clock.now, writeAtomic: writeFileAtomically };
  const threads = createThreadStore(dataDir, deps);
  const workspaces = createWorkspaceStore(dataDir, deps);
  return {
    dataDir,
    clock,
    threads,
    workspaces,
    ledger: createActivationLedger({ threads, workspaces }, clock.now)
  };
}

test("the pause history is bounded: after 201 pauses the oldest interval is dropped and the history says where it becomes complete", async (t) => {
  const h = await harness(t);
  const pauseCycle = async () => {
    await h.ledger.setPaused("ws-1", true);
    await h.ledger.setPaused("ws-1", false);
  };
  for (let cycle = 0; cycle < PAUSE_HISTORY_LIMIT; cycle += 1)
    await pauseCycle();
  const before = await readJson(
    path.join(h.dataDir, "workspaces", "ws-1.json")
  );
  const oldest = (before.pauseHistory as Array<{ resumedAt?: string }>)[0];

  await pauseCycle();

  const after = await readJson(path.join(h.dataDir, "workspaces", "ws-1.json"));
  const intervals = after.pauseHistory as Array<{
    pausedAt: string;
    resumedAt?: string;
  }>;
  assert.equal(intervals.length, PAUSE_HISTORY_LIMIT);
  // The dropped interval ended at the first resumption; that moment is where the history becomes complete.
  assert.equal(after.historyCompleteSince, oldest?.resumedAt);
  assert.notEqual(intervals[0]?.pausedAt, oldest?.resumedAt);
  assert.notEqual(intervals.at(-1)?.resumedAt, undefined);
});

test("pausing a workspace that is already paused records no second interval", async (t) => {
  const h = await harness(t);
  await h.ledger.setPaused("ws-1", true);
  await h.ledger.setPaused("ws-1", true);

  const file = await readJson(path.join(h.dataDir, "workspaces", "ws-1.json"));
  assert.equal((file.pauseHistory as unknown[]).length, 1);
  assert.equal(file.historyCompleteSince, undefined);
});

test("a recovered workspace starts paused with a history that is incomplete before the recovery", async (t) => {
  const h = await harness(t);
  await h.ledger.setPaused("ws-1", true);
  await fs.rm(path.join(h.dataDir, "workspaces", "ws-1.json"));

  await h.ledger.recover(workspaceInfo(h.dataDir));

  const file = await readJson(path.join(h.dataDir, "workspaces", "ws-1.json"));
  assert.equal(file.paused, true);
  assert.equal(
    (file.pauseHistory as Array<{ pausedAt: string }>)[0]?.pausedAt,
    file.historyCompleteSince
  );
});

test("a thread file records the moment the daemon created it, and the value survives later writes", async (t) => {
  const h = await harness(t);
  const scope = { workspaceId: "ws-1", threadId: "thread-1" };
  await h.ledger.authorize(scope, policyFor("rev-1"));
  const created = (
    await readJson(threadPath(h.dataDir, scope.workspaceId, scope.threadId))
  ).createdAt;

  await h.ledger.authorize(scope, policyFor("rev-2"));

  const after = (
    await readJson(threadPath(h.dataDir, scope.workspaceId, scope.threadId))
  ).createdAt;
  assert.equal(typeof created, "string");
  assert.equal(after, created);
});
