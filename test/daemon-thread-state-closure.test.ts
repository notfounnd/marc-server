import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { writeFileAtomically } from "../src/core/write-coordination.js";
import {
  createSessionRegistry,
  type SessionProbe
} from "../src/daemon/session-registry.js";
import { removeClosedThreads } from "../src/daemon/thread-cleanup.js";
import { createThreadStore } from "../src/daemon/thread-store.js";
import {
  createThread,
  initWorkspace,
  writeThreadSummary
} from "../src/core/workspace.js";
import {
  clock,
  listNames,
  stateHarness,
  threadPath
} from "./daemon-thread-state-fixtures.js";

const HOST = "host-a";
const FREE: SessionProbe = async () => ({
  state: "unbound",
  details: {
    busy: false,
    listening: false,
    reason: "test",
    pastConflict: false
  }
});

/**
 * A registry and its thread store that share one closure answer. The store asks it inside
 * each thread's queue, exactly as the daemon's store does.
 */
function closureHarness(dataDir: string, closed: { value: boolean }) {
  const deps = {
    now: clock,
    writeAtomic: writeFileAtomically,
    isClosed: async () => closed.value
  };
  const store = createThreadStore(dataDir, deps);
  let counter = 0;
  const registry = createSessionRegistry(
    dataDir,
    {
      now: clock,
      newSessionId: () => `session-${++counter}`,
      newOwnerToken: () => `token-${++counter}`,
      isClosed: deps.isClosed
    },
    store
  );
  return { store, registry };
}

const SLOT = {
  workspaceId: "ws-1",
  threadId: "thread-1",
  profile: "claude-dev"
};
const SLOT_BETA = {
  workspaceId: "ws-1",
  threadId: "thread-1",
  profile: "codex-dev"
};
const SCOPE = { workspaceId: "ws-1", threadId: "thread-1" };

test("a closed thread refuses acquire and leaves no state file behind", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { registry } = closureHarness(h.dataDir, { value: true });

  assert.deepEqual(
    await registry.acquire(
      { slot: SLOT, expectedGeneration: 0, hostId: HOST },
      FREE
    ),
    {
      decision: "refused",
      reason: "thread_closed"
    }
  );
  await assert.rejects(
    fs.access(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId))
  );
});

test("a late heartbeat, release and conflict after closure are refused and do not recreate the state file", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const closed = { value: false };
  const { store, registry } = closureHarness(h.dataDir, closed);
  const acquired = (await registry.acquire(
    { slot: SLOT, expectedGeneration: 0, hostId: HOST },
    FREE
  )) as {
    decision: string;
    generation: number;
    ownerToken: string;
  };
  assert.equal(acquired.decision, "acquired");
  const owner = {
    slot: SLOT,
    generation: acquired.generation,
    ownerToken: acquired.ownerToken
  };

  closed.value = true;
  await store.remove(SCOPE);

  assert.deepEqual(await registry.heartbeat(owner), {
    decision: "refused",
    reason: "thread_closed"
  });
  assert.deepEqual(await registry.release(owner), {
    decision: "refused",
    reason: "thread_closed"
  });
  assert.deepEqual(
    await registry.recordConflict({ slot: SLOT, sessionId: "late-session" }),
    {
      decision: "refused",
      reason: "thread_closed"
    }
  );
  await assert.rejects(
    fs.access(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId))
  );
});

test("a late observation (post adoption) after closure is ignored and does not recreate the state file", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { registry } = closureHarness(h.dataDir, { value: true });

  const observed = await registry.observe(
    {
      slot: SLOT_BETA,
      role: "architect",
      observedAt: "2026-11-04T12:00:00.000Z",
      identity: {
        nativeSessionId: "11111111-1111-4111-8111-111111111111",
        clientPid: 300,
        hostId: HOST
      }
    },
    FREE
  );

  assert.deepEqual(observed, { decision: "ignored", reason: "thread_closed" });
  await assert.rejects(
    fs.access(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId))
  );
});

test("the store reports a closed thread as closed, and writes nothing", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const { store } = closureHarness(h.dataDir, { value: true });

  assert.deepEqual(
    await store.update(SCOPE, () => ({
      value: "written",
      file: { version: 1, generation: 1, slots: {} }
    })),
    { status: "closed" }
  );
  await assert.rejects(
    fs.access(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId))
  );
});

test("startup cleanup is idempotent: a second pass over the same workspace changes nothing", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const root = await fs.mkdtemp(path.join(h.dataDir, "..", "marc-closure-ws-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = await initWorkspace(root);
  const closedThread = await createThread(root, "Closed work");
  await writeThreadSummary(root, { threadId: closedThread.id, body: "Done." });
  const { registry, store } = closureHarness(h.dataDir, { value: false });
  await registry.acquire(
    {
      slot: {
        workspaceId: info.id,
        threadId: closedThread.id,
        profile: "claude-dev"
      },
      expectedGeneration: 0,
      hostId: HOST
    },
    FREE
  );

  await removeClosedThreads([info], store);
  const afterFirst = await listNames(path.join(h.dataDir, "threads", info.id));
  await removeClosedThreads([info], store);

  assert.deepEqual(
    await listNames(path.join(h.dataDir, "threads", info.id)),
    afterFirst
  );
  assert.deepEqual(afterFirst, []);
});
