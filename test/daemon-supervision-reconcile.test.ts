import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import type { SupervisionRecord } from "../src/core/activation-supervision-types.js";
import { PRESENCE_GRACE_MS } from "../src/daemon/supervision-facts.js";
import { isoOf } from "../src/daemon/supervision-turn-helpers.js";
import { MINUTE_MS, START_MS } from "./daemon-supervision-fixtures.js";
import {
  advance,
  cardsOf,
  stateOf,
  TEST_HEARTBEAT_MS,
  turnThread,
  waitForCards,
  type TurnThread
} from "./daemon-supervision-turn-fixtures.js";
import { isAlive, waitUntilGone } from "./daemon-supervision-turn-probes.js";
import {
  keyOf,
  OTHER_PID,
  PID,
  restart,
  seedCard,
  SESSION,
  STARTED,
  TURN_MS,
  worldOf,
  type Restarted,
  type Seed,
  type World
} from "./daemon-supervision-reconcile-fixtures.js";

/** The start instant before the grace window opened, so absence decides at once. */
function outOfGrace(thread: TurnThread): number {
  return thread.clock.ms - 2 * PRESENCE_GRACE_MS;
}

/** The start instant inside the grace window, so absence waits. */
function inGrace(thread: TurnThread): number {
  return thread.clock.ms;
}

async function cardOf(
  thread: TurnThread
): Promise<SupervisionRecord | undefined> {
  return (await cardsOf(thread))[0];
}

async function bindingEnded(thread: TurnThread): Promise<boolean> {
  const state = await stateOf(thread);
  return state.slots[keyOf(thread)]?.endedAt !== undefined;
}

async function activationOf(thread: TurnThread): Promise<string> {
  return JSON.stringify((await stateOf(thread)).activation ?? null);
}

/** Polls until the check holds, or fails after a bounded wait. The reconciliation is asynchronous. */
async function until(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("the condition did not hold in time");
}

const RUNNING_OF_SESSION = {
  pid: PID,
  startedAt: STARTED,
  sessionId: SESSION,
  status: "idle"
};
const RUNNING_ROW = { pid: PID, ppid: 1 };

/** Each row restarts a daemon over a seeded card, and states what the card must be once the start settles. */
const CASES: ReadonlyArray<{
  name: string;
  seed: Seed;
  world: (thread: TurnThread) => World;
  grace: "out" | "in";
  expect: {
    status: string;
    reason: string | null;
    ended: boolean;
    pid: number | null;
  };
}> = [
  {
    name: "a running card whose process is gone is failed as crashed, and its binding is released",
    seed: { status: "running", pid: PID, startedAt: isoOf(STARTED) },
    world: (thread) => worldOf({ startMs: thread.clock.ms }),
    grace: "out",
    expect: { status: "failed", reason: "crashed", ended: true, pid: PID }
  },
  {
    name: "a running card whose pid now runs another process is failed as crashed",
    seed: { status: "running", pid: PID, startedAt: isoOf(STARTED) },
    world: (thread) =>
      worldOf({
        startMs: thread.clock.ms,
        rows: [RUNNING_ROW],
        agents: [{ ...RUNNING_OF_SESSION, startedAt: 9999 }]
      }),
    grace: "out",
    expect: { status: "failed", reason: "crashed", ended: true, pid: PID }
  },
  {
    name: "a starting card with no process for its session is failed as crashed",
    seed: { status: "starting" },
    world: (thread) => worldOf({ startMs: thread.clock.ms }),
    grace: "out",
    expect: { status: "failed", reason: "crashed", ended: true, pid: null }
  },
  {
    name: "a starting card whose session is listed becomes running with its pid and start instant",
    seed: { status: "starting" },
    world: (thread) =>
      worldOf({
        startMs: thread.clock.ms,
        rows: [RUNNING_ROW],
        agents: [RUNNING_OF_SESSION]
      }),
    grace: "out",
    expect: { status: "running", reason: null, ended: false, pid: PID }
  },
  {
    name: "a running card is left as it is while the agents source cannot be read",
    seed: { status: "running", pid: PID, startedAt: isoOf(STARTED) },
    world: (thread) => {
      const world = worldOf({ startMs: thread.clock.ms, rows: [RUNNING_ROW] });
      world.agentsDown = true;
      return world;
    },
    grace: "out",
    expect: { status: "running", reason: null, ended: false, pid: PID }
  },
  {
    name: "a running card is kept while its process is alive and listed with the recorded start",
    seed: { status: "running", pid: PID, startedAt: isoOf(STARTED) },
    world: (thread) =>
      worldOf({
        startMs: thread.clock.ms,
        rows: [RUNNING_ROW],
        agents: [RUNNING_OF_SESSION]
      }),
    grace: "out",
    expect: { status: "running", reason: null, ended: false, pid: PID }
  },
  {
    name: "a running card whose process is gone waits while the presence grace is open",
    seed: { status: "running", pid: PID, startedAt: isoOf(STARTED) },
    world: (thread) => worldOf({ startMs: thread.clock.ms }),
    grace: "in",
    expect: { status: "running", reason: null, ended: false, pid: PID }
  },
  {
    name: "a running card whose pid an unlisted process holds is failed as crashed once that process's grace has ended",
    seed: { status: "running", pid: PID, startedAt: isoOf(STARTED) },
    world: (thread) =>
      worldOf({ startMs: thread.clock.ms, rows: [RUNNING_ROW] }),
    grace: "out",
    expect: { status: "failed", reason: "crashed", ended: true, pid: PID }
  },
  {
    name: "a running card whose pid an unlisted process holds waits while that process is inside its grace",
    seed: {
      status: "running",
      pid: PID,
      runningAt: isoOf(START_MS + 2 * MINUTE_MS)
    },
    world: (thread) =>
      worldOf({ startMs: thread.clock.ms, rows: [RUNNING_ROW] }),
    grace: "out",
    expect: { status: "running", reason: null, ended: false, pid: PID }
  }
];

for (const row of CASES) {
  test(row.name, async (t) => {
    const thread = await turnThread(t, "held");
    const world = row.world(thread);
    await seedCard(thread, row.seed);
    const before = await activationOf(thread);
    const startedAt =
      row.grace === "out" ? outOfGrace(thread) : inGrace(thread);
    const back: Restarted = await restart(thread, world, startedAt);
    t.after(() => back.close());
    await back.server.supervision.idle();
    const card = await cardOf(thread);
    const actual = {
      status: card?.status ?? "missing",
      reason: card?.reason ?? null,
      ended: await bindingEnded(thread),
      pid: card?.turn?.pid ?? null
    };
    assert.deepEqual(actual, row.expect);
    assert.equal(
      await activationOf(thread),
      before,
      "no reservation or cycle was debited"
    );
  });
}

test("a running card whose process is alive is renewed, and ends as done unobserved when the process exits", async (t) => {
  const thread = await turnThread(t, "held");
  const world = worldOf({
    startMs: thread.clock.ms,
    rows: [RUNNING_ROW],
    agents: [RUNNING_OF_SESSION]
  });
  await seedCard(thread, {
    status: "running",
    pid: PID,
    startedAt: isoOf(STARTED),
    deadlineAt: isoOf(thread.clock.ms + TURN_MS)
  });
  const back = await restart(thread, world, outOfGrace(thread));
  t.after(() => back.close());
  await until(
    async () =>
      (await stateOf(thread)).slots[keyOf(thread)]?.owner.lastHeartbeatAt !==
      undefined
  );
  world.rows = [];
  world.agents = [];
  advance(thread.clock, TEST_HEARTBEAT_MS);
  const cards = await waitForCards(
    thread,
    (found) => found[0]?.status === "done"
  );
  assert.equal(cards[0]?.outcome?.failure, "unobserved");
  assert.equal(cards[0]?.outcome?.costUsd, undefined, "unobserved, so no cost");
  assert.equal(await bindingEnded(thread), true);
});

test("a running card past its time limit is stopped through the table's identity, and ends as a timeout", async (t) => {
  const thread = await turnThread(t, "held");
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    windowsHide: true
  });
  t.after(() => child.kill());
  const pid = child.pid;
  assert.ok(pid !== undefined);
  const world = worldOf({
    startMs: thread.clock.ms,
    rows: [{ pid, ppid: process.pid }],
    agents: [{ ...RUNNING_OF_SESSION, pid }]
  });
  await seedCard(thread, {
    status: "running",
    pid,
    startedAt: isoOf(STARTED),
    deadlineAt: isoOf(thread.clock.ms - 1)
  });
  const back = await restart(thread, world, outOfGrace(thread));
  t.after(() => back.close());
  await back.server.supervision.idle();
  advance(thread.clock, TEST_HEARTBEAT_MS);
  await waitUntilGone(pid);
  assert.equal(
    isAlive(pid),
    false,
    "the daemon stopped the process it had identified"
  );
  world.rows = [];
  world.agents = [];
  await new Promise((resolve) => setTimeout(resolve, 50));
  advance(thread.clock, TEST_HEARTBEAT_MS);
  const cards = await waitForCards(
    thread,
    (found) => found[0]?.status === "failed"
  );
  assert.equal(cards[0]?.reason, "timeout");
  assert.equal(cards[0]?.outcome?.failure, "timeout");
  assert.equal(await bindingEnded(thread), true);
});

test("a starting card with two processes on its session is not decided, and resolves once one remains", async (t) => {
  const thread = await turnThread(t, "held");
  const two = [RUNNING_OF_SESSION, { ...RUNNING_OF_SESSION, pid: OTHER_PID }];
  const world = worldOf({
    startMs: thread.clock.ms,
    rows: [RUNNING_ROW, { pid: OTHER_PID, ppid: 1 }],
    agents: two
  });
  await seedCard(thread, { status: "starting" });
  const back = await restart(thread, world, outOfGrace(thread));
  t.after(() => back.close());
  await back.server.supervision.idle();
  assert.equal((await cardOf(thread))?.status, "starting");
  world.agents = two.slice(0, 1);
  world.rows = [RUNNING_ROW];
  await back.server.supervision.reconcileAll();
  const card = await cardOf(thread);
  assert.deepEqual([card?.status, card?.turn?.pid], ["running", PID]);
});

test("a dead card inside the grace window is failed once the grace has ended", async (t) => {
  const thread = await turnThread(t, "held");
  const world = worldOf({ startMs: thread.clock.ms });
  await seedCard(thread, {
    status: "running",
    pid: PID,
    startedAt: isoOf(STARTED)
  });
  const back = await restart(thread, world, inGrace(thread));
  t.after(() => back.close());
  await back.server.supervision.idle();
  assert.equal((await cardOf(thread))?.status, "running");
  advance(thread.clock, PRESENCE_GRACE_MS);
  await back.server.supervision.reconcileAll();
  await until(async () => (await cardOf(thread))?.status === "failed");
  assert.equal((await cardOf(thread))?.reason, "crashed");
});
