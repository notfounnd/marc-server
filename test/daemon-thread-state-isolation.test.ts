import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createSessionRegistry,
  type SessionProbe
} from "../src/daemon/session-registry.js";
import {
  clock,
  listNames,
  stateHarness,
  threadPath
} from "./daemon-thread-state-fixtures.js";

const HOST = "host-a";
const ALPHA = { workspaceId: "ws-1", threadId: "alpha", profile: "claude-dev" };
const BETA = { workspaceId: "ws-1", threadId: "beta", profile: "claude-dev" };
const BETA_OTHER = {
  workspaceId: "ws-1",
  threadId: "beta",
  profile: "codex-dev"
};
const FREE: SessionProbe = async () => ({
  state: "unbound",
  details: {
    busy: false,
    listening: false,
    reason: "test",
    pastConflict: false
  }
});

test("a write to one thread never touches another thread's file", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);
  await registry.acquire(
    { slot: BETA, expectedGeneration: 0, hostId: HOST },
    FREE
  );
  const betaBefore = await fs.readFile(
    threadPath(h.dataDir, "ws-1", "beta"),
    "utf8"
  );

  await registry.acquire(
    { slot: ALPHA, expectedGeneration: 0, hostId: HOST },
    FREE
  );

  assert.equal(
    await fs.readFile(threadPath(h.dataDir, "ws-1", "beta"), "utf8"),
    betaBefore
  );
  assert.deepEqual(await listNames(path.join(h.dataDir, "threads", "ws-1")), [
    "alpha.json",
    "alpha.meta.json",
    "beta.json",
    "beta.meta.json"
  ]);
});

test("an invalid thread file fails closed for its own thread only and is never rewritten", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);
  await registry.acquire(
    { slot: ALPHA, expectedGeneration: 0, hostId: HOST },
    FREE
  );
  await registry.acquire(
    { slot: BETA, expectedGeneration: 0, hostId: HOST },
    FREE
  );
  await fs.writeFile(threadPath(h.dataDir, "ws-1", "beta"), "{ broken", "utf8");

  assert.deepEqual(
    await registry.acquire(
      { slot: BETA_OTHER, expectedGeneration: 0, hostId: HOST },
      FREE
    ),
    { decision: "refused", reason: "registry_invalid" }
  );
  assert.equal(
    await fs.readFile(threadPath(h.dataDir, "ws-1", "beta"), "utf8"),
    "{ broken"
  );
  assert.equal(
    (await registry.read({ workspaceId: "ws-1", threadId: "alpha" })).status,
    "ready"
  );
  const alpha = await registry.acquire(
    { slot: ALPHA, expectedGeneration: 1, hostId: HOST },
    FREE
  );
  assert.equal(alpha.decision, "acquired");
});

test("concurrent operations on one thread are serialized, and each profile gets its own generation", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const registry = createSessionRegistry(h.dataDir, { now: clock }, h.threads);
  const profiles = ["claude-dev", "codex-dev", "claude-software-architect"];
  const results = await Promise.all(
    profiles.map((profile) =>
      registry.acquire(
        {
          slot: { workspaceId: "ws-1", threadId: "alpha", profile },
          expectedGeneration: 0,
          hostId: HOST
        },
        FREE
      )
    )
  );
  assert.deepEqual(
    results.map((result) => result.decision),
    ["acquired", "acquired", "acquired"]
  );
  const alpha = JSON.parse(
    await fs.readFile(threadPath(h.dataDir, "ws-1", "alpha"), "utf8")
  ) as {
    generation: number;
    slots: Record<string, unknown>;
  };
  assert.equal(alpha.generation, 3);
  assert.equal(Object.keys(alpha.slots).length, 3);
});
