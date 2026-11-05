import assert from "node:assert/strict";
import test from "node:test";
import {
  claudeCodeAdapter,
  claudeHeadlessArgs,
  type HeadlessLaunchInput
} from "../src/core/client-adapters.js";

const SESSION = "5f0c2a6e-8d1b-4c3a-9e7f-2b6d4a1c0e88";
const CONTINUE =
  "you were stopped by the time limit; check what was left half done and continue";

const launchInput: HeadlessLaunchInput = {
  mode: "new",
  sessionId: SESSION,
  prompt: "PROMPT",
  model: "claude-haiku-5-5",
  workspaceRoot: "C:/workspace",
  toolShell: "default",
  baseEnv: {
    PATH: "/usr/bin",
    CLAUDECODE: "1",
    CLAUDE_CODE_ENTRYPOINT: "cli",
    MARC_TOKEN: "fixture-token"
  },
  platform: "linux"
};

const FIXED_ARGS = [
  "PROMPT",
  "-p",
  "--output-format",
  "json",
  "--model",
  "claude-haiku-5-5",
  "--permission-mode",
  "auto"
];

const argvRows: {
  name: string;
  input: HeadlessLaunchInput;
  args: string[];
}[] = [
  {
    name: "a new session passes --session-id after the fixed flags",
    input: launchInput,
    args: [...FIXED_ARGS, "--session-id", SESSION]
  },
  {
    name: "a resumed session passes --resume after the fixed flags",
    input: { ...launchInput, mode: "resume" },
    args: [...FIXED_ARGS, "--resume", SESSION]
  },
  {
    name: "extra flags with several values go last, after the session id",
    input: {
      ...launchInput,
      extraArgs: [
        "--permission-prompt-tool",
        "mcp__mcp-marc__permission_prompt"
      ]
    },
    args: [
      ...FIXED_ARGS,
      "--session-id",
      SESSION,
      "--permission-prompt-tool",
      "mcp__mcp-marc__permission_prompt"
    ]
  }
];

for (const row of argvRows) {
  test(`headless argv: ${row.name}`, () => {
    assert.deepStrictEqual(claudeHeadlessArgs(row.input), row.args);
    assert.deepStrictEqual(
      claudeCodeAdapter.headlessLaunch(row.input).args,
      row.args
    );
  });
}

test("headless launch runs the claude executable in the workspace, without a shell", () => {
  const launch = claudeCodeAdapter.headlessLaunch(launchInput);
  assert.equal(launch.command, "claude");
  assert.equal(launch.cwd, "C:/workspace");
  assert.equal("shell" in launch, false);
});

const envRows: {
  name: string;
  toolShell: HeadlessLaunchInput["toolShell"];
  expectedNames: string[];
}[] = [
  {
    name: "the default tool shell strips every CLAUDE* name and the daemon token",
    toolShell: "default",
    expectedNames: ["PATH"]
  },
  {
    name: "the bash tool shell adds its switch after the strip",
    toolShell: "bash",
    expectedNames: ["CLAUDE_CODE_USE_POWERSHELL_TOOL", "PATH"]
  }
];

for (const row of envRows) {
  test(`headless env: ${row.name}`, () => {
    const launch = claudeCodeAdapter.headlessLaunch({
      ...launchInput,
      toolShell: row.toolShell
    });
    assert.deepStrictEqual(Object.keys(launch.env).sort(), row.expectedNames);
    assert.equal("MARC_TOKEN" in launch.env, false);
  });
}

const promptBase = {
  threadId: "thread-x",
  profile: "reviewer",
  messageId: "msg_1",
  author: "architect",
  deadline: "2026-11-10T13:00:00.000Z"
};

const promptRows: {
  name: string;
  cursor: string | undefined;
  fragments: string[];
}[] = [
  {
    name: "the prompt names the author, the message, the thread and the deadline",
    cursor: "msg_0",
    fragments: [
      "architect",
      "msg_1",
      "marc://$thread-x",
      "2026-11-10T13:00:00.000Z"
    ]
  },
  {
    name: "the prompt reads the thread after the stored cursor",
    cursor: "msg_0",
    fragments: ["after message msg_0 with thread_read_since"]
  },
  {
    name: "the prompt reads the whole thread when the profile has no cursor",
    cursor: undefined,
    fragments: ["read the whole thread with thread_read"]
  },
  {
    name: "the prompt asks for progress before long work",
    cursor: undefined,
    fragments: [
      "Post your progress with message_post before any long piece of work"
    ]
  },
  {
    name: "the prompt forbids arming marc wait in the turn",
    cursor: undefined,
    fragments: ["Do not arm marc wait"]
  }
];

for (const row of promptRows) {
  test(`headless prompt: ${row.name}`, () => {
    const prompt = claudeCodeAdapter.headlessPrompt({
      ...promptBase,
      cursor: row.cursor
    });
    for (const fragment of row.fragments) {
      assert.ok(prompt.includes(fragment), `missing: ${fragment}`);
    }
  });
}

test("the continue prompt is the time-limit text, sent as written", () => {
  assert.equal(claudeCodeAdapter.continuePrompt(), CONTINUE);
});
