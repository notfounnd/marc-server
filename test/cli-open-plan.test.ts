import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { runOpenCommand } from "../src/cli-open-command.js";
import {
  PROFILE,
  ROOT,
  THREAD,
  VALUES,
  assertNoSecret,
  fakeClient,
  harness,
  outputJson,
  resolvedRoot,
  sessionsReply,
  unbound
} from "./cli-open-fixtures.js";

type Plan = {
  command: string;
  args: string[];
  cwd: string;
  env: { removed: string[]; set: Record<string, string> };
};

function methods(calls: Array<{ method: string }>): string[] {
  return calls.map((call) => call.method);
}

test("a dry run reads the slot and prints the launch plan without acquiring or starting anything", async () => {
  const h = harness({ client: fakeClient({ sessions: unbound() }) });
  const code = await runOpenCommand(
    { ...VALUES, "dry-run": true },
    h.output,
    h.deps
  );

  assert.equal(code, 0);
  assert.deepEqual(methods(h.client.calls), ["sessions"]);
  assert.equal(h.launches.length, 0);
  const line = outputJson(h.lines);
  assert.equal(line.status, "dry_run");
  assert.equal(line.slotState, "unbound");
  const plan = line.launch as Plan;
  assert.equal(plan.command, "claude");
  assert.deepEqual(plan.args.slice(1), ["--session-id", "<session-id>"]);
  assert.equal(plan.args[0].includes(`marc://$${THREAD}`), true);
  assert.equal(plan.cwd, resolvedRoot());
  assert.deepEqual(plan.env.removed, ["CLAUDE_CODE_SESSION_ID", "CLAUDECODE"]);
  assert.deepEqual(plan.env.set, { CLAUDE_CODE_USE_POWERSHELL_TOOL: "0" });
  assertNoSecret(h);
});

test("a dry run for a bound slot plans a resume with no prompt", async () => {
  const h = harness({
    client: fakeClient({
      sessions: sessionsReply({
        profile: PROFILE,
        state: "ended",
        binding: { generation: 2 }
      })
    })
  });
  await runOpenCommand({ ...VALUES, "dry-run": true }, h.output, h.deps);
  const plan = outputJson(h.lines).launch as { args: string[] };
  assert.deepEqual(plan.args, ["--resume", "<session-id>"]);
});

test("the data directory comes from MARC_DAEMON_DIR when --data-dir is absent, and from .marc-daemon otherwise", async () => {
  const valuesWithoutDir = {
    thread: THREAD,
    profile: PROFILE,
    workspace: ROOT,
    "dry-run": true
  };
  const withEnv = harness({
    client: fakeClient({ sessions: unbound() }),
    env: { PATH: "/usr/bin", MARC_DAEMON_DIR: "marc-env-dir" }
  });
  await runOpenCommand(valuesWithoutDir, withEnv.output, withEnv.deps);
  assert.deepEqual(withEnv.accessDirs, [path.resolve("marc-env-dir")]);

  const withDefault = harness({
    client: fakeClient({ sessions: unbound() }),
    env: { PATH: "/usr/bin" }
  });
  await runOpenCommand(valuesWithoutDir, withDefault.output, withDefault.deps);
  assert.deepEqual(withDefault.accessDirs, [path.resolve(".marc-daemon")]);
});

test("the workspace's own .marc-daemon is the default when it exists, and MARC_DAEMON_DIR still wins over it", async () => {
  const workspaceDir = path.join(resolvedRoot(), ".marc-daemon");
  const valuesWithoutDir = {
    thread: THREAD,
    profile: PROFILE,
    workspace: ROOT,
    "dry-run": true
  };
  const found = harness({
    client: fakeClient({ sessions: unbound() }),
    env: { PATH: "/usr/bin" },
    directories: [workspaceDir]
  });
  await runOpenCommand(valuesWithoutDir, found.output, found.deps);
  assert.deepEqual(found.accessDirs, [workspaceDir]);

  const explicit = harness({
    client: fakeClient({ sessions: unbound() }),
    env: { PATH: "/usr/bin", MARC_DAEMON_DIR: "marc-env-dir" },
    directories: [workspaceDir]
  });
  await runOpenCommand(valuesWithoutDir, explicit.output, explicit.deps);
  assert.deepEqual(explicit.accessDirs, [path.resolve("marc-env-dir")]);
});
