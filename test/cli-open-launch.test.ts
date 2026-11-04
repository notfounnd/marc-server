import assert from "node:assert/strict";
import test from "node:test";
import { runOpenCommand } from "../src/cli-open-command.js";
import {
  PID,
  PROFILE,
  PROMPT_PREFIX,
  SESSION,
  THREAD,
  VALUES,
  FakeChild,
  acquired,
  assertNoSecret,
  fakeClient,
  harness,
  outputJson,
  refused,
  resolvedRoot,
  sessionsReply,
  settle,
  unbound,
  WORKSPACE_ID,
  type Call
} from "./cli-open-fixtures.js";

type OwnerBody = {
  workspaceId: string;
  threadId: string;
  profile: string;
  generation: number;
  ownerToken: string;
  clientPid?: number;
};

function bodyOf(call: Call | undefined): OwnerBody {
  return call?.body as OwnerBody;
}

function methods(calls: Call[]): string[] {
  return calls.map((call) => call.method);
}

test("a new launch acquires, starts the client, renews with its pid, releases on exit, and passes the exit code", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.child.emitExit(3);

  assert.equal(await run, 3);
  assert.deepEqual(methods(h.client.calls), [
    "sessions",
    "acquire",
    "heartbeat",
    "release"
  ]);
  assert.deepEqual(h.client.calls[1].body, {
    workspaceId: WORKSPACE_ID,
    threadId: THREAD,
    profile: PROFILE,
    expectedGeneration: 0
  });
  assert.equal(bodyOf(h.client.calls[2]).clientPid, PID);
  assert.equal(bodyOf(h.client.calls[2]).generation, 1);
  assert.equal(bodyOf(h.client.calls[3]).generation, 1);
  assert.equal(bodyOf(h.client.calls[3]).ownerToken, "owner-secret-token");
  assert.deepEqual(h.lines, []);
  assertNoSecret(h);
});

test("the new launch uses the builder: prompt first, --session-id, cwd, and no inherited CLAUDE variables", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.child.emitExit(0);
  await run;

  const launch = h.launches[0];
  assert.equal(launch.command, "claude");
  assert.equal(launch.cwd, resolvedRoot());
  assert.equal(launch.args[0].startsWith(PROMPT_PREFIX), true);
  assert.equal(launch.args[0].includes(`marc://$${THREAD}`), true);
  assert.deepEqual(launch.args.slice(1), ["--session-id", SESSION]);
  assert.equal("CLAUDE_CODE_SESSION_ID" in launch.env, false);
  assert.equal("CLAUDECODE" in launch.env, false);
  assert.equal(launch.env.CLAUDE_CODE_USE_POWERSHELL_TOOL, "0");
});

test("the default tool shell leaves CLAUDE_CODE_USE_POWERSHELL_TOOL unset in the launch", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(
    { ...VALUES, "tool-shell": "default" },
    h.output,
    h.deps
  );
  await settle();
  h.child.emitSpawn();
  await settle();
  h.child.emitExit(0);
  await run;

  assert.equal("CLAUDE_CODE_USE_POWERSHELL_TOOL" in h.launches[0].env, false);
});

test("a resume sends the bound generation, starts with --resume, and never sends the prompt", async () => {
  const h = harness({
    client: fakeClient({
      sessions: sessionsReply({
        profile: PROFILE,
        state: "ended",
        binding: { generation: 2 }
      }),
      acquire: acquired("resume", 3)
    })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.child.emitExit(0);

  assert.equal(await run, 0);
  assert.equal(
    (h.client.calls[1].body as { expectedGeneration: number })
      .expectedGeneration,
    2
  );
  assert.deepEqual(h.launches[0].args, ["--resume", SESSION]);
  assert.equal(bodyOf(h.client.calls[2]).generation, 3);
  assertNoSecret(h);
});

test("a client that cannot start releases the ownership and exits 5 with claude_not_found", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitError("ENOENT");

  assert.equal(await run, 5);
  const line = outputJson(h.lines);
  assert.equal(line.status, "spawn_error");
  assert.equal(line.reason, "claude_not_found");
  assert.equal(line.exitCode, 5);
  assert.deepEqual(methods(h.client.calls), ["sessions", "acquire", "release"]);
  assert.equal(bodyOf(h.client.calls[2]).ownerToken, "owner-secret-token");
  assertNoSecret(h);
});

test("an EINVAL start failure also reports claude_not_found, while any other code is spawn_failed", async () => {
  const einval = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const first = runOpenCommand(VALUES, einval.output, einval.deps);
  await settle();
  einval.child.emitError("EINVAL");
  await first;
  assert.equal(outputJson(einval.lines).reason, "claude_not_found");

  const other = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const second = runOpenCommand(VALUES, other.output, other.deps);
  await settle();
  other.child.emitError("EACCES");
  await second;
  assert.equal(outputJson(other.lines).reason, "spawn_failed");
  assert.equal(outputJson(other.lines).exitCode, 5);
});

test("the ownership is renewed every 15 seconds with the client's pid, and the timer stops on exit", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  assert.equal(h.timers.intervals.length, 1);
  assert.equal(h.timers.intervals[0].ms, 15_000);

  h.timers.tick();
  await settle();
  h.timers.tick();
  await settle();
  const beats = h.client.calls.filter((call) => call.method === "heartbeat");
  assert.equal(beats.length, 3);
  assert.equal(
    beats.every((call) => bodyOf(call).clientPid === PID),
    true
  );

  h.child.emitExit(0);
  await run;
  assert.equal(h.timers.intervals[0].cleared, true);
});

test("a heartbeat refused with 409 warns once, keeps the client running, and stops renewing", async () => {
  const h = harness({
    client: fakeClient({
      sessions: unbound(),
      acquire: acquired("new", 1),
      heartbeats: [refused("generation_mismatch")]
    })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.timers.tick();
  await settle();

  assert.equal(
    h.client.calls.filter((call) => call.method === "heartbeat").length,
    1
  );
  assert.equal(h.warnings.length, 1);
  assert.equal(h.warnings[0].includes("generation_mismatch"), true);
  assert.equal(
    h.client.calls.some((call) => call.method === "release"),
    false
  );

  h.child.emitExit(0);
  assert.equal(await run, 0);
  assert.deepEqual(methods(h.client.calls).slice(-1), ["release"]);
  assert.deepEqual(h.lines, []);
  assertNoSecret(h);
});

test("a transport failure on a heartbeat warns once and the client keeps running", async () => {
  const client = fakeClient({
    sessions: unbound(),
    acquire: acquired("new", 1)
  });
  const failing = {
    ...client,
    heartbeat: async () => {
      throw new Error("connect ECONNREFUSED");
    }
  };
  const h = harness({ client: failing as typeof client });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.timers.tick();
  await settle();
  assert.equal(h.warnings.length, 1);
  h.child.emitExit(0);
  assert.equal(await run, 0);
});

test("stop signals are ignored while the client runs, and their listeners are removed after it ends", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  assert.deepEqual(h.signals.active(), ["SIGINT", "SIGTERM"]);
  h.child.emitExit(0);
  await run;
  assert.deepEqual(h.signals.active(), []);
});

test("the client never inherits MARC_TOKEN from the caller's environment", async () => {
  const h = harness({
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) }),
    env: {
      PATH: "/usr/bin",
      MARC_TOKEN: "caller-daemon-token",
      MARC_DAEMON_URL: "http://127.0.0.1:4187"
    }
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.child.emitExit(0);
  await run;

  assert.equal("MARC_TOKEN" in h.launches[0].env, false);
  assert.equal(h.launches[0].env.MARC_DAEMON_URL, "http://127.0.0.1:4187");
  assert.equal(
    JSON.stringify(h.launches[0]).includes("caller-daemon-token"),
    false
  );
});

test("a client that ends without an exit code (signal) returns 0 to the shell", async () => {
  const child = new FakeChild(PID);
  const h = harness({
    child,
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand(VALUES, h.output, h.deps);
  await settle();
  child.emitSpawn();
  await settle();
  child.emitExit(null);
  assert.equal(await run, 0);
});
