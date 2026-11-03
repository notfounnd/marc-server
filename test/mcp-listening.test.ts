import assert from "node:assert/strict";
import test from "node:test";
import { WORKSPACE_SKILL } from "../src/core/marc-ops-skill.js";
import { MARC_HELPER_TOPICS, marcHelper } from "../src/mcp/helper.js";
import {
  buildWaitCommand,
  currentWaitRuntime,
  posixQuote,
  type WaitCommandInput
} from "../src/mcp/listening-command.js";

type CommandCase = {
  name: string;
  input: WaitCommandInput;
  expectedArgv: string[];
  expectedShell: string;
};

const WINDOWS_RUNTIME = {
  execPath: "C:\\Program Files\\nodejs\\node.exe",
  execArgv: ["--import", "tsx"],
  script: "C:\\Projetos\\marc\\src\\cli.ts"
};

const POSIX_RUNTIME = {
  execPath: "/usr/bin/node",
  execArgv: [],
  script: "/srv/marc/src/cli.ts"
};

const COMMAND_CASES: CommandCase[] = [
  {
    name: "Windows paths with spaces are quoted and use forward slashes in the shell form",
    input: {
      workspaceRoot: "C:\\Projetos\\My Repo",
      threadId: "thread-x",
      mention: "claude-dev",
      since: "msg_1",
      runtime: WINDOWS_RUNTIME
    },
    expectedArgv: [
      "C:\\Program Files\\nodejs\\node.exe",
      "--import",
      "tsx",
      "C:\\Projetos\\marc\\src\\cli.ts",
      "wait",
      "--workspace",
      "C:\\Projetos\\My Repo",
      "--thread",
      "thread-x",
      "--mention",
      "claude-dev",
      "--since",
      "msg_1"
    ],
    expectedShell:
      "'C:/Program Files/nodejs/node.exe' '--import' 'tsx' 'C:/Projetos/marc/src/cli.ts' 'wait' '--workspace' 'C:/Projetos/My Repo' '--thread' 'thread-x' '--mention' 'claude-dev' '--since' 'msg_1'"
  },
  {
    name: "missing identifiers stay as placeholders",
    input: { workspaceRoot: "/srv/repo", runtime: POSIX_RUNTIME },
    expectedArgv: [
      "/usr/bin/node",
      "/srv/marc/src/cli.ts",
      "wait",
      "--workspace",
      "/srv/repo",
      "--thread",
      "<threadId>",
      "--mention",
      "<agent-id>",
      "--since",
      "<lastMessageId>"
    ],
    expectedShell:
      "'/usr/bin/node' '/srv/marc/src/cli.ts' 'wait' '--workspace' '/srv/repo' '--thread' '<threadId>' '--mention' '<agent-id>' '--since' '<lastMessageId>'"
  },
  {
    name: "a single quote in the workspace path is escaped for POSIX shells",
    input: {
      workspaceRoot: "C:\\it's here",
      threadId: "thread-x",
      mention: "claude-dev",
      since: "msg_1",
      runtime: POSIX_RUNTIME
    },
    expectedArgv: [
      "/usr/bin/node",
      "/srv/marc/src/cli.ts",
      "wait",
      "--workspace",
      "C:\\it's here",
      "--thread",
      "thread-x",
      "--mention",
      "claude-dev",
      "--since",
      "msg_1"
    ],
    expectedShell:
      "'/usr/bin/node' '/srv/marc/src/cli.ts' 'wait' '--workspace' 'C:/it'\\''s here' '--thread' 'thread-x' '--mention' 'claude-dev' '--since' 'msg_1'"
  }
];

COMMAND_CASES.forEach((commandCase) =>
  test(`buildWaitCommand: ${commandCase.name}`, () => {
    const command = buildWaitCommand(commandCase.input);

    assert.deepStrictEqual(command.argv, commandCase.expectedArgv);
    assert.equal(command.shell, commandCase.expectedShell);
  })
);

const QUOTE_CASES: Array<{ value: string; expected: string }> = [
  { value: "plain", expected: "'plain'" },
  { value: "", expected: "''" },
  { value: "$HOME and `tick`", expected: "'$HOME and `tick`'" },
  { value: "it's", expected: "'it'\\''s'" }
];

QUOTE_CASES.forEach((quoteCase) =>
  test(`posixQuote: quotes ${JSON.stringify(quoteCase.value)} as one word`, () => {
    assert.equal(posixQuote(quoteCase.value), quoteCase.expected);
  })
);

test("buildWaitCommand: a token passed after the script never reaches the command", () => {
  const original = process.argv;
  process.argv = [
    process.execPath,
    "/srv/marc/src/cli.ts",
    "mcp",
    "--token",
    "s3cret-token-value"
  ];
  try {
    const command = buildWaitCommand({
      workspaceRoot: "/srv/repo",
      threadId: "thread-x",
      mention: "claude-dev",
      since: "msg_1",
      runtime: currentWaitRuntime()
    });

    assert.equal(JSON.stringify(command).includes("s3cret-token-value"), false);
    assert.equal(command.argv.includes("--token"), false);
  } finally {
    process.argv = original;
  }
});

test("marc_helper: MARC_HELPER_TOPICS offers listening before all", () => {
  assert.equal(MARC_HELPER_TOPICS.includes("listening"), true);
  assert.equal(MARC_HELPER_TOPICS[MARC_HELPER_TOPICS.length - 1], "all");
});

test("marc_helper: the listening topic carries a ready command for this server", () => {
  const helper = marcHelper("listening", {
    workspaceRoot: "/srv/repo",
    runtime: POSIX_RUNTIME
  }) as Record<string, unknown>;

  assert.equal("command" in helper, true);
  const command = helper.command as { shell: string };
  assert.match(command.shell, /'wait' '--workspace' '\/srv\/repo'/);
  assert.match(String((helper.notes as string[]).join(" ")), /130 interrupted/);
});

test("marc_helper: other topics and all carry no command", () => {
  const overview = marcHelper("overview") as Record<string, unknown>;
  const all = marcHelper("all") as Record<string, unknown>;
  const topics = all.topics as Record<string, unknown>;

  assert.equal("command" in overview, false);
  assert.equal("listening" in topics, true);
  assert.equal("command" in all, false);
});

test("the managed skill has the listening section before Audit Discipline", () => {
  const listening = WORKSPACE_SKILL.indexOf("## Listening for Mentions");
  const audit = WORKSPACE_SKILL.indexOf("## Audit Discipline");

  assert.ok(listening > 0);
  assert.ok(listening < audit);
  assert.match(WORKSPACE_SKILL, /Never stop a waiter by process name\./);
  assert.match(WORKSPACE_SKILL, /marc_helper` with topic `listening`/);
});
