import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { runOpenCommand } from "../src/cli-open-command.js";
import {
  DATA_DIR,
  PROFILE,
  PROMPT_PREFIX,
  SESSION,
  VALUES,
  acquired,
  assertNoSecret,
  fakeClient,
  fakeWorkspace,
  unreachableClient,
  harness,
  outputJson,
  postedBy,
  sessionsReply,
  settle,
  unbound
} from "./cli-open-fixtures.js";
import { ROWS } from "./cli-open-refusal-rows.js";

for (const row of ROWS) {
  test(`marc open: ${row.name}`, async () => {
    const h = row.harness();
    const code = await runOpenCommand(row.values, h.output, h.deps);

    assert.equal(code, row.exitCode);
    const line = outputJson(h.lines);
    assert.equal(line.status, row.status);
    assert.equal(line.reason, row.reason);
    assert.equal(line.exitCode, row.exitCode);
    assert.equal(
      h.client.calls.filter((call) => call.method === "acquire").length,
      row.acquires
    );
    assert.deepEqual(h.launches, []);
    assert.equal(
      h.client.calls.some((call) => call.method === "release"),
      false
    );
    assertNoSecret(h);
  });
}

test("a closed thread never reads the daemon", async () => {
  const h = harness({
    workspace: fakeWorkspace({ closed: true }),
    client: fakeClient({ sessions: unbound() })
  });
  await runOpenCommand(VALUES, h.output, h.deps);
  assert.deepEqual(h.accessDirs, []);
  assert.deepEqual(h.client.calls, []);
});

test("a daemon that does not answer names the data directory and the command that starts the daemon", async () => {
  const h = harness({ client: unreachableClient() });
  await runOpenCommand(VALUES, h.output, h.deps);
  const line = outputJson(h.lines);
  assert.equal(line.reason, "daemon_unreachable");
  assert.equal(line.dataDir, path.resolve(DATA_DIR));
  assert.equal(
    String(line.next).includes(
      `marc daemon start --data-dir ${path.resolve(DATA_DIR)}`
    ),
    true
  );
});

test("--new bypasses continuity_unknown, and the new session starts with the prompt", async () => {
  const h = harness({
    workspace: fakeWorkspace({ messages: [postedBy(PROFILE)] }),
    client: fakeClient({ sessions: unbound(), acquire: acquired("new", 1) })
  });
  const run = runOpenCommand({ ...VALUES, new: true }, h.output, h.deps);
  await settle();
  h.child.emitSpawn();
  await settle();
  h.child.emitExit(0);

  assert.equal(await run, 0);
  assert.equal(h.client.calls[1].method, "acquire");
  assert.equal(h.launches[0].args[0].startsWith(PROMPT_PREFIX), true);
  assert.deepEqual(h.launches[0].args.slice(1), ["--session-id", SESSION]);
});

test("continuity applies only to unbound slots: an ended slot resumes even when the profile has posted", async () => {
  const h = harness({
    workspace: fakeWorkspace({ messages: [postedBy(PROFILE)] }),
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
  assert.deepEqual(h.launches[0].args, ["--resume", SESSION]);
});
