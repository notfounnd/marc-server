import assert from "node:assert/strict";
import test from "node:test";
import type {
  AcquireResult,
  ObserveInput,
  ObserveResult,
  OwnerResult
} from "../src/daemon/session-registry.js";
import {
  ARCHITECT,
  ARCHITECT_KEY,
  HOST,
  NOW,
  STARTED,
  createRegistryHarness,
  entry,
  iso,
  live,
  type RegistryHarness
} from "./daemon-session-fixtures.js";

// The harness mints ids as "session-N"; the listed process must carry the bound id.
const RESUMED_STARTED = STARTED + 1000;

type Acquired = Extract<AcquireResult, { decision: "acquired" }>;

async function harness(t: {
  after(fn: () => unknown): void;
}): Promise<RegistryHarness> {
  const h = await createRegistryHarness();
  t.after(() => h.cleanup());
  return h;
}

/** Marc open reserves the slot, then the client registers its pid through a heartbeat. */
async function openClient(h: RegistryHarness): Promise<Acquired> {
  const result = await h.registry.acquire(
    { slot: ARCHITECT, expectedGeneration: 0, hostId: HOST },
    h.probe
  );
  assert.equal(result.decision, "acquired");
  const acquired = result as Acquired;
  h.setAgents(live([entry(100, acquired.nativeSessionId)]));
  const beat = await h.registry.heartbeat({
    slot: ARCHITECT,
    generation: acquired.generation,
    ownerToken: acquired.ownerToken,
    clientPid: 100,
    clientStartedAt: STARTED
  });
  assert.deepEqual(beat, { decision: "renewed" });
  return acquired;
}

/** The client exits: its pid leaves the listing, and the binding is still held. */
function exitClient(h: RegistryHarness): void {
  h.setAgents(live([]));
}

/** The native resume: a new pid carries the same UUID, and its first post observes it. */
async function resumeClient(
  h: RegistryHarness,
  nativeSessionId: string
): Promise<ObserveResult> {
  h.setAgents(live([entry(200, nativeSessionId, RESUMED_STARTED)]));
  return firstPost(h, nativeSessionId);
}

/** The first verified post of the process at pid 200, against whatever the listing shows now. */
async function firstPost(
  h: RegistryHarness,
  nativeSessionId: string
): Promise<ObserveResult> {
  const input: ObserveInput = {
    slot: ARCHITECT,
    role: "architect",
    observedAt: iso(NOW + 2000),
    identity: {
      nativeSessionId,
      clientPid: 200,
      clientStartedAt: RESUMED_STARTED,
      hostId: HOST
    }
  };
  return h.registry.observe(input, h.probe);
}

async function oldTokenCalls(
  h: RegistryHarness,
  acquired: Acquired
): Promise<{ beat: OwnerResult; release: OwnerResult }> {
  const call = {
    slot: ARCHITECT,
    generation: acquired.generation,
    ownerToken: acquired.ownerToken
  };
  const beat = await h.registry.heartbeat({
    ...call,
    clientPid: 100,
    clientStartedAt: STARTED
  });
  const release = await h.registry.release(call);
  return { beat, release };
}

test("ended by release, then the native resume: the first post takes over with generation +1 and no conflict", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  exitClient(h);
  const released = await h.registry.release({
    slot: ARCHITECT,
    generation: acquired.generation,
    ownerToken: acquired.ownerToken
  });
  assert.deepEqual(released, { decision: "released" });
  const ended = await h.probe((await h.readRegistry()).slots[ARCHITECT_KEY]);
  assert.equal(ended.state, "ended");

  h.setAgents(live([entry(200, acquired.nativeSessionId, RESUMED_STARTED)]));
  const beforePost = await h.probe(
    (await h.readRegistry()).slots[ARCHITECT_KEY]
  );
  assert.equal(beforePost.state, "online");
  assert.equal(beforePost.details.reason, "session_resumed");

  const result = await resumeClient(h, acquired.nativeSessionId);
  assert.deepEqual(result, { decision: "resumed", generation: 2 });

  const stored = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.equal(stored.generation, 2);
  assert.equal(stored.nativeSessionId, acquired.nativeSessionId);
  assert.equal(stored.endedAt, undefined);
  assert.deepEqual(stored.owner, {
    clientPid: 200,
    clientStartedAt: RESUMED_STARTED
  });
  assert.deepEqual(stored.conflicts, []);
  const after = await h.probe(stored);
  assert.equal(after.state, "online");
  assert.equal(after.details.reason, "owner_listed");

  const old = await oldTokenCalls(h, acquired);
  assert.deepEqual(old.beat, { decision: "refused", reason: "not_owner" });
  assert.deepEqual(old.release, { decision: "refused", reason: "not_owner" });
});

test("a marc open binding that still holds its owner token: the resume bumps the generation and the old token gets 409", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  exitClient(h);
  const ended = await h.probe((await h.readRegistry()).slots[ARCHITECT_KEY]);
  assert.equal(ended.state, "ended");
  assert.equal(ended.details.reason, "owner_absent");

  const result = await resumeClient(h, acquired.nativeSessionId);
  assert.deepEqual(result, { decision: "resumed", generation: 2 });

  const stored = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.equal(stored.owner.ownerToken, undefined);
  const old = await oldTokenCalls(h, acquired);
  assert.deepEqual(old.beat, { decision: "refused", reason: "not_owner" });
  assert.deepEqual(old.release, { decision: "refused", reason: "not_owner" });
});

test("two processes carrying the session keep refusing: the observer conflicts and the owner stays", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  exitClient(h);
  h.setAgents(
    live([
      entry(200, acquired.nativeSessionId, RESUMED_STARTED),
      entry(300, acquired.nativeSessionId, RESUMED_STARTED + 1000)
    ])
  );
  const result = await firstPost(h, acquired.nativeSessionId);
  assert.deepEqual(result, { decision: "conflict_recorded", generation: 1 });
  const stored = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.equal(stored.owner.clientPid, 100);
  assert.equal(stored.conflicts.length, 1);
});

test("an unverified observation of a resumable session is ignored and writes nothing", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  exitClient(h);
  h.setAgents(live([entry(200, acquired.nativeSessionId, RESUMED_STARTED)]));
  const before = await h.readFile();
  const result = await h.registry.observe(
    {
      slot: ARCHITECT,
      role: "architect",
      observedAt: iso(NOW + 2000),
      identity: {
        nativeSessionId: acquired.nativeSessionId,
        clientPid: 200,
        hostId: HOST
      }
    },
    h.probe
  );
  assert.deepEqual(result, {
    decision: "ignored",
    reason: "identity_unverified"
  });
  assert.equal(await h.readFile(), before);
});

/** A conflict recorded against the bound session itself, as an earlier raw resume left it. */
async function recordSelfConflict(
  h: RegistryHarness,
  nativeSessionId: string
): Promise<void> {
  const recorded = await h.registry.recordConflict({
    slot: ARCHITECT,
    sessionId: nativeSessionId
  });
  assert.deepEqual(recorded, { decision: "recorded" });
}

test("a recorded self-conflict, then the native resume after a release: the first post takes over with generation +1 and keeps the one history entry", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  await recordSelfConflict(h, acquired.nativeSessionId);
  exitClient(h);
  const released = await h.registry.release({
    slot: ARCHITECT,
    generation: acquired.generation,
    ownerToken: acquired.ownerToken
  });
  assert.deepEqual(released, { decision: "released" });

  h.setAgents(live([entry(200, acquired.nativeSessionId, RESUMED_STARTED)]));
  const beforePost = await h.probe(
    (await h.readRegistry()).slots[ARCHITECT_KEY]
  );
  assert.equal(beforePost.state, "online");
  assert.equal(beforePost.details.reason, "session_resumed");
  assert.equal(beforePost.details.pastConflict, true);

  const result = await firstPost(h, acquired.nativeSessionId);
  assert.deepEqual(result, { decision: "resumed", generation: 2 });
  const stored = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.deepEqual(stored.owner, {
    clientPid: 200,
    clientStartedAt: RESUMED_STARTED
  });
  assert.equal(stored.generation, 2);
  assert.equal(stored.conflicts.length, 1);
  const after = await h.probe(stored);
  assert.equal(after.state, "online");
  assert.equal(after.details.reason, "owner_listed");
  assert.equal(after.details.pastConflict, true);
});

test("a recorded self-conflict on a binding that still holds its owner token: the first post takes over with generation +1", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  await recordSelfConflict(h, acquired.nativeSessionId);
  exitClient(h);

  const result = await resumeClient(h, acquired.nativeSessionId);
  assert.deepEqual(result, { decision: "resumed", generation: 2 });
  const stored = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.equal(stored.owner.clientPid, 200);
  assert.equal(stored.owner.ownerToken, undefined);
  assert.equal(stored.conflicts.length, 1);
  const old = await oldTokenCalls(h, acquired);
  assert.deepEqual(old.beat, { decision: "refused", reason: "not_owner" });
});

test("a recorded conflict from another listed session still blocks the first post: the owner stays", async (t) => {
  const h = await harness(t);
  const acquired = await openClient(h);
  await recordSelfConflict(h, acquired.nativeSessionId);
  const other = await h.registry.recordConflict({
    slot: ARCHITECT,
    sessionId: "other-session"
  });
  assert.deepEqual(other, { decision: "recorded" });
  exitClient(h);
  h.setAgents(
    live([
      entry(200, acquired.nativeSessionId, RESUMED_STARTED),
      entry(300, "other-session", RESUMED_STARTED + 5)
    ])
  );

  const result = await firstPost(h, acquired.nativeSessionId);
  assert.deepEqual(result, { decision: "conflict_recorded", generation: 1 });
  const stored = (await h.readRegistry()).slots[ARCHITECT_KEY];
  assert.equal(stored.owner.clientPid, 100);
  assert.equal(stored.generation, 1);
});
