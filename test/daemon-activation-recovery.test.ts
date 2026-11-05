import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  AUTHORIZED_CYCLES,
  CLOCK_ISO,
  policyFor,
  readJson,
  stateHarness,
  threadPath,
  workspaceInfo
} from "./daemon-thread-state-fixtures.js";
import {
  createThreadStore,
  type ThreadScope
} from "../src/daemon/thread-store.js";

const SCOPE: ThreadScope = { workspaceId: "ws-1", threadId: "thread-1" };
const STAMP = CLOCK_ISO.replace(/[:.]/g, "-");
const MOVED_NAME = `thread-1.json.invalid-${STAMP}`;

test("recovery of a healthy ledger is refused: there is nothing to recover", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  await h.ledger.setPaused("ws-1", true);

  assert.deepEqual(await h.ledger.recover(workspaceInfo(h.dataDir)), {
    decision: "refused",
    reason: "nothing_to_recover"
  });
});

test("a lost thread file is recreated empty with a recovery record, and its enabled policy reads as unauthorized", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  await fs.rm(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId));

  const report = await h.ledger.recover(workspaceInfo(h.dataDir));

  assert.equal(report.decision, "recovered");
  assert.ok("threads" in report);
  assert.deepEqual(
    report.threads.map((item) => [item.threadId, item.reason]),
    [["thread-1", "registry_lost"]]
  );
  assert.deepEqual(report.conflicts, []);
  const file = await readJson(
    threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId)
  );
  assert.deepEqual(file.recoveries, [
    { at: CLOCK_ISO, reason: "registry_lost" }
  ]);
  assert.equal(file.activation, undefined);
  assert.deepEqual(
    await h.ledger.threadState(
      SCOPE,
      { status: "ready", policy: policyFor("rev-1") },
      AUTHORIZED_CYCLES
    ),
    {
      status: "revision_mismatch",
      stages: {}
    }
  );
});

test("an invalid thread file is moved aside under a timestamped name, byte for byte, and never deleted", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await fs.mkdir(
    path.dirname(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId)),
    { recursive: true }
  );
  await fs.writeFile(
    threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId),
    "{ broken",
    "utf8"
  );

  const report = await h.ledger.recover(workspaceInfo(h.dataDir));

  assert.equal(report.decision, "recovered");
  assert.ok("threads" in report);
  assert.deepEqual(
    report.threads.map((item) => [item.reason, item.movedAside]),
    [["unreadable_json", MOVED_NAME]]
  );
  const moved = path.join(
    path.dirname(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId)),
    MOVED_NAME
  );
  assert.equal(await fs.readFile(moved, "utf8"), "{ broken");
  const file = await readJson(
    threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId)
  );
  assert.deepEqual(file.recoveries, [
    { at: CLOCK_ISO, reason: "unreadable_json", movedAside: MOVED_NAME }
  ]);
});

test("a lost workspace file is recreated paused, because the state before the loss is unknown", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await h.ledger.setPaused("ws-1", true);
  await h.ledger.setPaused("ws-1", false);
  await fs.rm(path.join(h.dataDir, "workspaces", "ws-1.json"));

  const report = await h.ledger.recover(workspaceInfo(h.dataDir));

  assert.equal(report.decision, "recovered");
  assert.ok("workspace" in report);
  assert.equal(report.workspace?.reason, "workspace_lost");
  assert.deepEqual(await h.ledger.workspaceState("ws-1"), {
    status: "ready",
    paused: true,
    pausedAt: CLOCK_ISO
  });
});

test("recovery refuses to overwrite an existing move-aside name, and leaves the invalid content in place", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const directory = path.dirname(
    threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId)
  );
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId),
    "{ broken",
    "utf8"
  );
  await fs.writeFile(
    path.join(directory, MOVED_NAME),
    "earlier evidence",
    "utf8"
  );

  assert.deepEqual(await h.ledger.recover(workspaceInfo(h.dataDir)), {
    decision: "refused",
    reason: "move_aside_conflict"
  });

  assert.equal(
    await fs.readFile(
      threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId),
      "utf8"
    ),
    "{ broken"
  );
  assert.equal(
    await fs.readFile(path.join(directory, MOVED_NAME), "utf8"),
    "earlier evidence"
  );
});

test("after recovery, the policy is authorized again only by saving it, and then the counters start at zero", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  await h.ledger.authorize(SCOPE, policyFor("rev-1"));
  await fs.rm(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId));
  await h.ledger.recover(workspaceInfo(h.dataDir));

  await h.ledger.authorize(SCOPE, policyFor("rev-2"));

  assert.deepEqual(
    await h.ledger.threadState(
      SCOPE,
      { status: "ready", policy: policyFor("rev-2") },
      AUTHORIZED_CYCLES
    ),
    {
      status: "ready",
      currentStage: "planning",
      stages: {
        planning: { cyclesUsed: 0, extensions: [] },
        execution: { cyclesUsed: 0, extensions: [] },
        review: { cyclesUsed: 0, extensions: [] }
      }
    }
  );
});

test("recovery never recreates the state of a closed thread", async (t) => {
  const h = await stateHarness();
  t.after(() => h.cleanup());
  const closedStore = createThreadStore(h.dataDir, {
    now: () => CLOCK_ISO,
    writeAtomic: async () => undefined,
    isClosed: async () => true
  });

  assert.deepEqual(await closedStore.recover(SCOPE), { kind: "closed" });
  await assert.rejects(
    fs.access(threadPath(h.dataDir, SCOPE.workspaceId, SCOPE.threadId))
  );
});
