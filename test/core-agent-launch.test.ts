import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAgentLaunch,
  envChanges,
  type AgentLaunchInput
} from "../src/core/agent-launch.js";

const SESSION = "33333333-3333-4333-8333-333333333333";
const PROMPT = "You are the mARC profile claude-dev. Call workspace_bootstrap.";
const ROOT = "C:\\Projetos\\marc";

function input(overrides: Partial<AgentLaunchInput> = {}): AgentLaunchInput {
  return {
    client: "claude-code",
    mode: "new",
    sessionId: SESSION,
    prompt: PROMPT,
    workspaceRoot: ROOT,
    toolShell: "bash",
    baseEnv: { PATH: "C:\\Windows" },
    platform: "linux",
    ...overrides
  };
}

test("a new session puts the prompt first, then --session-id with the session ID", () => {
  const launch = buildAgentLaunch(input());
  assert.deepEqual(launch.args, [PROMPT, "--session-id", SESSION]);
});

test("the prompt precedes every flag, so a multi-value flag added later cannot swallow it", () => {
  const launch = buildAgentLaunch(input());
  assert.equal(launch.args[0], PROMPT);
  assert.ok(launch.args.indexOf("--session-id") > launch.args.indexOf(PROMPT));
});

test("a new session without a prompt has only the session flag", () => {
  const launch = buildAgentLaunch(input({ prompt: undefined }));
  assert.deepEqual(launch.args, ["--session-id", SESSION]);
});

test("a resume uses --resume with the session ID and never sends the prompt", () => {
  const launch = buildAgentLaunch(input({ mode: "resume" }));
  assert.deepEqual(launch.args, ["--resume", SESSION]);
});

test("the command is claude, run in the workspace root, and the result has no shell", () => {
  const launch = buildAgentLaunch(input());
  assert.equal(launch.command, "claude");
  assert.equal(launch.cwd, ROOT);
  assert.deepEqual(Object.keys(launch).sort(), [
    "args",
    "command",
    "cwd",
    "env"
  ]);
});

test("bash sets CLAUDE_CODE_USE_POWERSHELL_TOOL=0 and keeps the other variables", () => {
  const launch = buildAgentLaunch(
    input({ baseEnv: { PATH: "/bin", HOME: "/home/u" }, toolShell: "bash" })
  );
  assert.deepEqual(launch.env, {
    PATH: "/bin",
    HOME: "/home/u",
    CLAUDE_CODE_USE_POWERSHELL_TOOL: "0"
  });
});

test("the default tool shell leaves the client's own tool choice in place", () => {
  const launch = buildAgentLaunch(
    input({ baseEnv: { PATH: "/bin" }, toolShell: "default" })
  );
  assert.deepEqual(launch.env, { PATH: "/bin" });
});

test("an inherited CLAUDE_CODE_USE_POWERSHELL_TOOL is removed on the default shell", () => {
  const launch = buildAgentLaunch(
    input({
      baseEnv: { PATH: "/bin", CLAUDE_CODE_USE_POWERSHELL_TOOL: "1" },
      toolShell: "default"
    })
  );
  assert.deepEqual(launch.env, { PATH: "/bin" });
});

test("on linux every inherited CLAUDE variable is removed, and the prefix is case-sensitive", () => {
  const launch = buildAgentLaunch(
    input({
      baseEnv: {
        PATH: "/bin",
        CLAUDE_CODE_SESSION_ID: "stale",
        CLAUDECODE: "1",
        CLAUDE_CONFIG_DIR: "/cfg",
        Claude_Keep: "kept"
      }
    })
  );
  assert.deepEqual(launch.env, {
    PATH: "/bin",
    Claude_Keep: "kept",
    CLAUDE_CODE_USE_POWERSHELL_TOOL: "0"
  });
});

test("on win32 the CLAUDE prefix is matched in any case", () => {
  const launch = buildAgentLaunch(
    input({
      platform: "win32",
      baseEnv: {
        PATH: "C:\\Windows",
        claude_code_session_id: "stale",
        Claude_Config: "/cfg",
        CLAUDE_X: "1"
      }
    })
  );
  assert.deepEqual(launch.env, {
    PATH: "C:\\Windows",
    CLAUDE_CODE_USE_POWERSHELL_TOOL: "0"
  });
});

test("undefined inherited values are dropped and the base environment is not mutated", () => {
  const baseEnv = { PATH: "/bin", EMPTY: undefined };
  const before = { ...baseEnv };
  const launch = buildAgentLaunch(input({ baseEnv }));
  assert.deepEqual(launch.env, {
    PATH: "/bin",
    CLAUDE_CODE_USE_POWERSHELL_TOOL: "0"
  });
  assert.deepEqual(baseEnv, before);
});

test("an inherited MARC_TOKEN is removed, so the agent never receives the daemon token", () => {
  const launch = buildAgentLaunch(
    input({
      baseEnv: {
        PATH: "/bin",
        MARC_TOKEN: "daemon-secret",
        MARC_DAEMON_URL: "http://127.0.0.1:4187"
      }
    })
  );
  assert.deepEqual(launch.env, {
    PATH: "/bin",
    MARC_DAEMON_URL: "http://127.0.0.1:4187",
    CLAUDE_CODE_USE_POWERSHELL_TOOL: "0"
  });
  assert.equal(JSON.stringify(launch).includes("daemon-secret"), false);
});

test("on win32 MARC_TOKEN is removed in any case", () => {
  const launch = buildAgentLaunch(
    input({
      platform: "win32",
      baseEnv: { PATH: "C:\\Windows", marc_token: "daemon-secret" }
    })
  );
  assert.deepEqual(launch.env, {
    PATH: "C:\\Windows",
    CLAUDE_CODE_USE_POWERSHELL_TOOL: "0"
  });
});

test("on linux the MARC_TOKEN match is case-sensitive, as the other environment names are", () => {
  const launch = buildAgentLaunch(
    input({ baseEnv: { marc_token: "kept-on-linux" } })
  );
  assert.equal(launch.env.marc_token, "kept-on-linux");
});

test("the environment changes name a removed MARC_TOKEN and never show its value", () => {
  const changes = envChanges({
    baseEnv: { MARC_TOKEN: "daemon-secret", PATH: "/bin" },
    toolShell: "default",
    platform: "linux"
  });
  assert.deepEqual(changes.removed, ["MARC_TOKEN"]);
  assert.equal(JSON.stringify(changes).includes("daemon-secret"), false);
});

test("the builder never adds MARC_TOKEN or a daemon token to the environment", () => {
  const launch = buildAgentLaunch(input({ baseEnv: {} }));
  assert.equal("MARC_TOKEN" in launch.env, false);
  assert.deepEqual(Object.keys(launch.env), [
    "CLAUDE_CODE_USE_POWERSHELL_TOOL"
  ]);
});

test("the environment changes name the removed variables and the constant values set", () => {
  const changes = envChanges({
    baseEnv: { CLAUDE_X: "1", PATH: "/bin" },
    toolShell: "bash",
    platform: "linux"
  });
  assert.deepEqual(changes, {
    removed: ["CLAUDE_X"],
    set: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "0" }
  });
});

test("the default tool shell sets nothing in the environment changes", () => {
  const changes = envChanges({
    baseEnv: { PATH: "/bin" },
    toolShell: "default",
    platform: "linux"
  });
  assert.deepEqual(changes, { removed: [], set: {} });
});
