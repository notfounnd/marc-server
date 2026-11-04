import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { copyCommandFor, initialPrompt } from "../src/core/agent-launch.js";
import type { WorkspaceInfo } from "../src/core/types.js";
import { DEFAULT_DAEMON_URL } from "../src/daemon/config.js";
import {
  openCommandFor,
  type OpenServices
} from "../src/daemon/session-views.js";
import {
  threadSuffix,
  type MarcRuntime
} from "../src/mcp/listening-command.js";

const ROOT = path.join("/work", "repo");
const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "repo",
  rootPath: ROOT,
  marcPath: path.join(ROOT, ".marc")
};
const THREAD = "sessions-view-134b5983";
const PROFILE = "claude-dev";
const BUILT_RUNTIME: MarcRuntime = {
  execPath: "/usr/bin/node",
  execArgv: [],
  script: "/srv/marc/dist/cli.js"
};

/** Services whose data directory and URL are the defaults, unless a test overrides them. */
function services(overrides: Partial<OpenServices>): OpenServices {
  return {
    dataDir: path.join(ROOT, ".marc-daemon"),
    daemonUrl: () => DEFAULT_DAEMON_URL,
    marcRuntime: () => BUILT_RUNTIME,
    ...overrides
  };
}

test("the thread suffix is the eight hex digits at the end, and a thread without one stays whole", () => {
  assert.equal(threadSuffix(THREAD), "134b5983");
  assert.equal(threadSuffix("thread-1"), "thread-1");
});

test("the short open command omits the data directory and the URL when they are the defaults", () => {
  const command = openCommandFor(
    services({}),
    WORKSPACE,
    THREAD,
    PROFILE,
    false
  );

  assert.deepEqual(command.argv, [
    "/usr/bin/node",
    "/srv/marc/dist/cli.js",
    "open",
    "--workspace",
    ROOT,
    "--thread",
    "134b5983",
    "--profile",
    PROFILE
  ]);
});

test("the short open command names the data directory and the URL when they differ from the defaults", () => {
  const command = openCommandFor(
    services({
      dataDir: path.join("/elsewhere", ".marc-daemon"),
      daemonUrl: () => "http://127.0.0.1:5999"
    }),
    WORKSPACE,
    THREAD,
    PROFILE,
    false
  );

  assert.deepEqual(command.argv.slice(-4), [
    "--data-dir",
    path.join("/elsewhere", ".marc-daemon"),
    "--daemon-url",
    "http://127.0.0.1:5999"
  ]);
});

test("--new is the last word only when the caller asks for a new session", () => {
  const plain = openCommandFor(services({}), WORKSPACE, THREAD, PROFILE, false);
  const fresh = openCommandFor(services({}), WORKSPACE, THREAD, PROFILE, true);

  assert.equal(plain.argv.includes("--new"), false);
  assert.equal(fresh.argv.at(-1), "--new");
  assert.equal(fresh.shell.endsWith(" '--new'"), true);
});

test("a plain marc on PATH gives the command a short start with no script", () => {
  const command = openCommandFor(
    services({ marcRuntime: () => ({ execPath: "marc", execArgv: [] }) }),
    WORKSPACE,
    THREAD,
    PROFILE,
    false
  );

  assert.equal(command.argv[0], "marc");
  assert.equal(command.argv[1], "open");
  assert.equal(command.shell.startsWith("'marc' 'open' '--workspace' "), true);
});

test("every word of the shell form is single quoted, with the workspace path in forward slashes", () => {
  const command = openCommandFor(
    services({}),
    WORKSPACE,
    THREAD,
    PROFILE,
    false
  );

  assert.equal(
    command.shell,
    `'/usr/bin/node' '/srv/marc/dist/cli.js' 'open' '--workspace' '${ROOT.replace(/\\/g, "/")}' '--thread' '134b5983' '--profile' '${PROFILE}'`
  );
});

test("an ended slot copies the native resume command, and an ended slot without a session copies nothing", () => {
  assert.deepEqual(
    copyCommandFor("ended", {
      threadId: THREAD,
      profile: PROFILE,
      nativeSessionId: "abc-123"
    }),
    { text: "claude --resume abc-123" }
  );
  assert.equal(
    copyCommandFor("ended", { threadId: THREAD, profile: PROFILE }),
    undefined
  );
});

test("an unbound slot copies the native new-session command with the initial prompt", () => {
  assert.deepEqual(
    copyCommandFor("unbound", { threadId: THREAD, profile: PROFILE }),
    { text: `claude '${initialPrompt(THREAD, PROFILE)}'` }
  );
});

test("an open, reserved, unknown or conflicting slot copies nothing", () => {
  const context = { threadId: THREAD, profile: PROFILE, nativeSessionId: "x" };

  ["online", "reserved", "unknown", "conflict"].forEach((state) => {
    const key = state as "online" | "reserved" | "unknown" | "conflict";
    assert.equal(copyCommandFor(key, context), undefined, state);
  });
});
