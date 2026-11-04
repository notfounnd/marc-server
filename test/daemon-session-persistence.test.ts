import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ARCHITECT,
  HOST,
  NOW,
  SESSION_B,
  createRegistryHarness,
  iso,
  type RegistryHarness
} from "./daemon-session-fixtures.js";

async function harness(t: {
  after(fn: () => unknown): void;
}): Promise<RegistryHarness> {
  const h = await createRegistryHarness();
  t.after(() => h.cleanup());
  return h;
}

test("an invalid file fails closed for reads and writes and is never rewritten", async (t) => {
  const h = await harness(t);
  await h.writeRaw("{ not json");
  const before = await h.readFile();
  const view = await h.registry.read();
  assert.deepEqual(view, { status: "invalid", reason: "unreadable_json" });
  const acquire = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.deepEqual(acquire, {
    decision: "refused",
    reason: "registry_invalid"
  });
  const observe = await h.registry.observe(
    {
      slot: ARCHITECT,
      role: "architect",
      observedAt: iso(NOW),
      identity: { nativeSessionId: SESSION_B, clientPid: 300, hostId: HOST }
    },
    h.probe
  );
  assert.deepEqual(observe, {
    decision: "ignored",
    reason: "registry_invalid"
  });
  assert.equal(await h.readFile(), before);
});

test("a file with the wrong shape is reported as invalid", async (t) => {
  const h = await harness(t);
  await h.writeRaw(
    JSON.stringify({ version: 1, generation: 0, slots: { x: {} } })
  );
  assert.deepEqual(await h.registry.read(), {
    status: "invalid",
    reason: "invalid_shape"
  });
});

test("writes are atomic on the real filesystem and leave no temporary files", async (t) => {
  const h = await harness(t);
  await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  const stored = await h.readRegistry();
  assert.equal(stored.version, 1);
  assert.equal(stored.generation, 1);
  assert.deepEqual((await fs.readdir(h.dataDir)).sort(), [
    "sessions.json",
    "sessions.meta.json"
  ]);
});

test("the first write creates the meta marker with the initialization time", async (t) => {
  const h = await harness(t);
  await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  const marker = await fs.readFile(
    path.join(h.dataDir, "sessions.meta.json"),
    "utf8"
  );
  assert.deepEqual(JSON.parse(marker), { version: 1, initializedAt: iso(NOW) });
});

test("a lost registry refuses writes, is never recreated, and starts fresh only once the marker is removed too", async (t) => {
  const h = await harness(t);
  await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  await fs.rm(path.join(h.dataDir, "sessions.json"));
  const listing = (await fs.readdir(h.dataDir)).sort();

  assert.deepEqual(await h.registry.read(), {
    status: "invalid",
    reason: "registry_lost"
  });
  assert.deepEqual(
    await h.registry.acquire(
      { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
      h.probe
    ),
    { decision: "refused", reason: "registry_invalid" }
  );
  assert.deepEqual(
    await h.registry.observe(
      {
        slot: ARCHITECT,
        role: "architect",
        observedAt: iso(NOW),
        identity: { nativeSessionId: SESSION_B, clientPid: 300, hostId: HOST }
      },
      h.probe
    ),
    { decision: "ignored", reason: "registry_invalid" }
  );
  assert.deepEqual(
    await h.registry.recordConflict({ slot: ARCHITECT, sessionId: SESSION_B }),
    { decision: "refused", reason: "registry_invalid" }
  );
  assert.deepEqual((await fs.readdir(h.dataDir)).sort(), listing);

  await fs.rm(path.join(h.dataDir, "sessions.meta.json"));
  assert.deepEqual(await h.registry.read(), {
    status: "ready",
    file: { version: 1, generation: 0, slots: {} }
  });
  const fresh = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in fresh);
  assert.equal(fresh.mode, "new");
});

test("a failed write leaves the previous registry intact", async (t) => {
  const h = await harness(t);
  const reserved = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in reserved);
  const before = await h.readFile();
  h.failWrites();
  await assert.rejects(
    h.registry.heartbeat({
      slot: ARCHITECT,
      generation: 1,
      ownerToken: reserved.ownerToken
    })
  );
  assert.equal(await h.readFile(), before);
});

test("recording a conflict on an unknown slot is refused", async (t) => {
  const h = await harness(t);
  assert.deepEqual(
    await h.registry.recordConflict({ slot: ARCHITECT, sessionId: SESSION_B }),
    { decision: "refused", reason: "not_bound" }
  );
});
