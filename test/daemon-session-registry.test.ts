import assert from "node:assert/strict";
import test from "node:test";
import type { AcquireResult } from "../src/daemon/session-registry.js";
import {
  ARCHITECT,
  ARCHITECT_KEY,
  HOST,
  NOW,
  SESSION_A,
  SESSION_B,
  STARTED,
  UNAVAILABLE,
  createRegistryHarness,
  entry,
  iso,
  live,
  type RegistryHarness
} from "./daemon-session-fixtures.js";

function acquiredToken(result: AcquireResult): string {
  assert.ok(
    "ownerToken" in result,
    `expected acquired, got ${result.decision}`
  );
  return result.ownerToken;
}

async function harness(t: {
  after(fn: () => unknown): void;
}): Promise<RegistryHarness> {
  const h = await createRegistryHarness();
  t.after(() => h.cleanup());
  return h;
}

test("generation advances on acquire and resume uses the next generation", async (t) => {
  const h = await harness(t);
  const first = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in first);
  assert.equal(first.generation, 1);
  assert.equal(first.mode, "new");

  const released = await h.registry.release({
    slot: ARCHITECT,
    generation: 1,
    ownerToken: first.ownerToken
  });
  assert.deepEqual(released, { decision: "released" });

  const resumed = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 1, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in resumed);
  assert.equal(resumed.generation, 2);
  assert.equal(resumed.mode, "resume");
  assert.equal(resumed.nativeSessionId, first.nativeSessionId);
});

test("acquire is refused while a reservation holds the slot", async (t) => {
  const h = await harness(t);
  await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  const blocked = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 1, hostId: HOST },
    h.probe
  );
  assert.deepEqual(blocked, { decision: "refused", reason: "reserved" });
});

test("acquire with a stale expected generation is refused", async (t) => {
  const h = await harness(t);
  const stale = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 7, hostId: HOST },
    h.probe
  );
  assert.deepEqual(stale, {
    decision: "refused",
    reason: "generation_mismatch"
  });
});

test("a live reservation blocks adoption: the conflict is recorded and the owner kept", async (t) => {
  const h = await harness(t);
  const reserved = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in reserved);
  const result = await h.registry.observe(
    {
      slot: ARCHITECT,
      role: "architect",
      observedAt: iso(NOW),
      identity: { nativeSessionId: SESSION_B, clientPid: 300, hostId: HOST }
    },
    h.probe
  );
  assert.equal(result.decision, "conflict_recorded");
  const after = await h.readRegistry();
  assert.equal(
    after.slots[ARCHITECT_KEY].nativeSessionId,
    reserved.nativeSessionId
  );
  assert.equal(after.slots[ARCHITECT_KEY].conflicts.length, 1);
  assert.equal(
    after.slots[ARCHITECT_KEY].owner.ownerToken,
    reserved.ownerToken
  );
});

test("an expired reservation with proof of absence can be acquired again", async (t) => {
  const h = await harness(t);
  await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  h.advance(60_000);
  const next = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 1, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in next);
  assert.equal(next.mode, "resume");
  assert.equal(next.generation, 2);
});

test("an expired reservation without an agents source stays unknown and blocks acquire", async (t) => {
  const h = await harness(t);
  await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  h.advance(60_000);
  h.setAgents(UNAVAILABLE);
  const blocked = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 1, hostId: HOST },
    h.probe
  );
  assert.deepEqual(blocked, { decision: "refused", reason: "owner_unknown" });
});

test("a live MCP lease for the reserved session keeps an expired reservation unknown and blocks acquire", async (t) => {
  const h = await harness(t);
  const reserved = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.ok("ownerToken" in reserved);
  h.advance(60_000);
  h.setLeases([
    { nativeSessionId: reserved.nativeSessionId, pid: 555, hostId: HOST }
  ]);
  const stored = await h.readRegistry();
  const state = await h.probe(stored.slots[ARCHITECT_KEY]);
  assert.equal(state.state, "unknown");
  assert.equal(state.details.reason, "lease_alive_unlisted");
  const blocked = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 1, hostId: HOST },
    h.probe
  );
  assert.deepEqual(blocked, { decision: "refused", reason: "owner_unknown" });
  assert.equal((await h.readRegistry()).generation, 1);
});

test("heartbeat and release refuse a wrong token or generation and change nothing", async (t) => {
  const h = await harness(t);
  const token = acquiredToken(
    await h.registry.acquire(
      { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
      h.probe
    )
  );
  const before = await h.readFile();
  const rows = [
    {
      name: "heartbeat with a wrong token",
      run: () =>
        h.registry.heartbeat({
          slot: ARCHITECT,
          generation: 1,
          ownerToken: "wrong"
        }),
      expected: { decision: "refused", reason: "not_owner" }
    },
    {
      name: "heartbeat with a wrong generation",
      run: () =>
        h.registry.heartbeat({
          slot: ARCHITECT,
          generation: 9,
          ownerToken: token
        }),
      expected: {
        decision: "refused",
        reason: "generation_mismatch",
        currentGeneration: 1
      }
    },
    {
      name: "release with a wrong token",
      run: () =>
        h.registry.release({
          slot: ARCHITECT,
          generation: 1,
          ownerToken: "wrong"
        }),
      expected: { decision: "refused", reason: "not_owner" }
    }
  ];
  for (const row of rows) {
    assert.deepEqual(await row.run(), row.expected, row.name);
    assert.equal(await h.readFile(), before, `${row.name} changed the file`);
  }
});

test("heartbeat renews and release ends the owner, and a second release is refused", async (t) => {
  const h = await harness(t);
  const token = acquiredToken(
    await h.registry.acquire(
      { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
      h.probe
    )
  );
  const renewed = await h.registry.heartbeat({
    slot: ARCHITECT,
    generation: 1,
    ownerToken: token,
    clientPid: 100,
    clientStartedAt: 1_793_747_271_627
  });
  assert.deepEqual(renewed, { decision: "renewed" });
  const released = await h.registry.release({
    slot: ARCHITECT,
    generation: 1,
    ownerToken: token
  });
  assert.deepEqual(released, { decision: "released" });
  const again = await h.registry.release({
    slot: ARCHITECT,
    generation: 1,
    ownerToken: token
  });
  assert.deepEqual(again, { decision: "refused", reason: "ended" });
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].owner.ownerToken, undefined);
  assert.ok(stored.slots[ARCHITECT_KEY].endedAt);
});

test("concurrent acquires are serialized: exactly one wins", async (t) => {
  const h = await harness(t);
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map(() =>
      h.registry.acquire(
        { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
        h.probe
      )
    )
  );
  const winners = results.filter((result) => "ownerToken" in result);
  assert.equal(winners.length, 1);
  const stored = await h.readRegistry();
  assert.equal(stored.generation, 1);
});

test("concurrent observations are serialized: no conflict is lost", async (t) => {
  const h = await harness(t);
  h.setAgents(live([entry(100, SESSION_A, STARTED)]));
  await h.registry.observe(
    {
      slot: ARCHITECT,
      role: "architect",
      observedAt: iso(NOW),
      identity: {
        nativeSessionId: SESSION_A,
        clientPid: 100,
        clientStartedAt: STARTED,
        hostId: HOST
      }
    },
    h.probe
  );
  const others = ["s-1", "s-2", "s-3", "s-4", "s-5"];
  await Promise.all(
    others.map((session) =>
      h.registry.observe(
        {
          slot: ARCHITECT,
          role: "architect",
          observedAt: iso(NOW),
          identity: { nativeSessionId: session, clientPid: 300, hostId: HOST }
        },
        h.probe
      )
    )
  );
  const stored = await h.readRegistry();
  assert.equal(stored.slots[ARCHITECT_KEY].conflicts.length, 5);
  assert.equal(stored.slots[ARCHITECT_KEY].nativeSessionId, SESSION_A);
});
