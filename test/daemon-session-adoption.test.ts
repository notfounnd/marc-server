import assert from "node:assert/strict";
import test from "node:test";
import type { ObserveInput } from "../src/daemon/session-registry.js";
import {
  ARCHITECT,
  ARCHITECT_KEY,
  HOST,
  NOW,
  SESSION_A,
  SESSION_B,
  STARTED,
  createRegistryHarness,
  entry,
  iso,
  live,
  type RegistryHarness
} from "./daemon-session-fixtures.js";

function observation(
  nativeSessionId: string,
  client: { pid?: number; startedAt?: number } = {}
): ObserveInput {
  return {
    slot: ARCHITECT,
    role: "architect",
    observedAt: iso(NOW),
    identity: {
      nativeSessionId,
      clientPid: client.pid ?? 100,
      clientStartedAt: client.startedAt ?? STARTED,
      hostId: HOST
    }
  };
}

async function harness(t: {
  after(fn: () => unknown): void;
}): Promise<RegistryHarness> {
  const h = await createRegistryHarness();
  t.after(() => h.cleanup());
  return h;
}

test("a free slot is adopted with generation 1 and origin adopted", async (t) => {
  const h = await harness(t);
  const result = await h.registry.observe(observation(SESSION_A), h.probe);
  assert.deepEqual(result, { decision: "adopted", generation: 1 });
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].origin, "adopted");
  assert.equal(stored.slots[ARCHITECT_KEY].observedAt, iso(NOW));
});

test("the same verified instance refreshes without a new generation", async (t) => {
  const h = await harness(t);
  h.setAgents(live([entry(100, SESSION_A)]));
  await h.registry.observe(observation(SESSION_A), h.probe);
  const again = await h.registry.observe(observation(SESSION_A), h.probe);
  assert.deepEqual(again, { decision: "refreshed", generation: 1 });
});

test("the same UUID from another verified instance is a conflict", async (t) => {
  const h = await harness(t);
  h.setAgents(live([entry(100, SESSION_A)]));
  await h.registry.observe(observation(SESSION_A), h.probe);
  const other = await h.registry.observe(
    observation(SESSION_A, { pid: 200, startedAt: STARTED + 1 }),
    h.probe
  );
  assert.equal(other.decision, "conflict_recorded");
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].conflicts.length, 1);
});

test("/clear in the same verified instance keeps the generation and the owner token", async (t) => {
  const h = await harness(t);
  const reserved = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in reserved);
  h.setAgents(live([entry(100, reserved.nativeSessionId)]));
  const claimed = await h.registry.observe(
    observation(reserved.nativeSessionId),
    h.probe
  );
  assert.equal(claimed.decision, "claimed");

  h.setAgents(live([entry(100, SESSION_B)]));
  const result = await h.registry.observe(observation(SESSION_B), h.probe);
  assert.deepEqual(result, { decision: "reconciled", generation: 1 });
  const binding = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.equal(binding.nativeSessionId, SESSION_B);
  assert.equal(binding.previousSessionId, reserved.nativeSessionId);
  assert.ok(binding.sessionChangedAt);
  assert.equal(binding.owner.ownerToken, reserved.ownerToken);

  const beat = await h.registry.heartbeat({
    slot: ARCHITECT,
    generation: 1,
    ownerToken: reserved.ownerToken,
    clientPid: 100,
    clientStartedAt: STARTED
  });
  assert.deepEqual(beat, { decision: "renewed" });
});

test("another session while the owner is active records a conflict and keeps the owner", async (t) => {
  const h = await harness(t);
  h.setAgents(live([entry(100, SESSION_A)]));
  await h.registry.observe(observation(SESSION_A), h.probe);
  const result = await h.registry.observe(
    observation(SESSION_B, { pid: 300, startedAt: STARTED + 9 }),
    h.probe
  );
  assert.deepEqual(result, { decision: "conflict_recorded", generation: 1 });
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].nativeSessionId, SESSION_A);
});

test("a proven-ended owner is adopted by another session with generation +1", async (t) => {
  const h = await harness(t);
  h.setAgents(live([entry(100, SESSION_A)]));
  await h.registry.observe(observation(SESSION_A), h.probe);
  h.setAgents(live([]));
  const result = await h.registry.observe(
    observation(SESSION_B, { pid: 300, startedAt: STARTED + 9 }),
    h.probe
  );
  assert.deepEqual(result, { decision: "adopted", generation: 2 });
});

test("a reservation is claimed by its own verified session, keeping the owner token", async (t) => {
  const h = await harness(t);
  const reserved = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in reserved);
  h.setAgents(live([entry(100, reserved.nativeSessionId)]));
  const result = await h.registry.observe(
    observation(reserved.nativeSessionId),
    h.probe
  );
  assert.deepEqual(result, { decision: "claimed", generation: 1 });
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].owner.clientPid, 100);
  assert.equal(
    stored.slots[ARCHITECT_KEY].owner.ownerToken,
    reserved.ownerToken
  );
});

test("an unverified observation of the owner's own session is ignored", async (t) => {
  const h = await harness(t);
  const unverified = {
    ...observation(SESSION_A),
    identity: { nativeSessionId: SESSION_A, clientPid: 100, hostId: HOST }
  };
  const first = await h.registry.observe(unverified, h.probe);
  const result = await h.registry.observe(unverified, h.probe);
  assert.deepEqual(first, {
    decision: "ignored",
    reason: "identity_unverified"
  });
  assert.deepEqual(result, {
    decision: "ignored",
    reason: "identity_unverified"
  });
});

test("an unverified observation of a free slot is ignored and writes nothing", async (t) => {
  const h = await harness(t);
  const unverified = {
    ...observation(SESSION_A),
    identity: { nativeSessionId: SESSION_A, clientPid: 100, hostId: HOST }
  };
  const result = await h.registry.observe(unverified, h.probe);
  assert.deepEqual(result, {
    decision: "ignored",
    reason: "identity_unverified"
  });

  const acquired = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in acquired);
  assert.equal(acquired.generation, 1);
  assert.equal(acquired.mode, "new");
});

test("an older observation never replaces newer state", async (t) => {
  const h = await harness(t);
  await h.registry.observe(observation(SESSION_A), h.probe);
  const late = await h.registry.observe(
    {
      ...observation(SESSION_B),
      observedAt: iso(NOW - 1000),
      identity: { nativeSessionId: SESSION_B, clientPid: 300, hostId: HOST }
    },
    h.probe
  );
  assert.deepEqual(late, { decision: "ignored", reason: "stale_observation" });
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].nativeSessionId, SESSION_A);
});

const NON_ADOPTING: Array<[string, string | undefined, string]> = [
  ["a developer never adopts", "developer", "non_adopting_role"],
  ["a user profile never adopts", "user", "non_adopting_role"],
  ["an unregistered profile never adopts", undefined, "unregistered_profile"]
];

for (const [name, role, reason] of NON_ADOPTING) {
  test(name, async (t) => {
    const h = await harness(t);
    const result = await h.registry.observe(
      { ...observation(SESSION_A), role },
      h.probe
    );
    assert.deepEqual(result, { decision: "ignored", reason });
    assert.deepEqual(await h.registry.read(), {
      status: "ready",
      file: { version: 1, generation: 0, slots: {} }
    });
  });
}
