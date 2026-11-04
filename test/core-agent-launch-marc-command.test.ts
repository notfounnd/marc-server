import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarcCommand,
  buildWaitCommand,
  posixQuote,
  type MarcRuntime
} from "../src/mcp/listening-command.js";

const RUNTIME: MarcRuntime = {
  execPath: "C:\\Program Files\\nodejs\\node.exe",
  execArgv: ["--conditions=dev"],
  script: "C:\\Projetos\\marc\\dist\\cli.js"
};

test("buildMarcCommand puts the subcommand after the script and quotes the shell words", () => {
  const command = buildMarcCommand({
    runtime: RUNTIME,
    subcommand: "open",
    args: [
      "--workspace",
      { path: "C:\\Projetos\\marc" },
      "--thread",
      "thread-1"
    ]
  });
  assert.deepEqual(command.argv, [
    "C:\\Program Files\\nodejs\\node.exe",
    "--conditions=dev",
    "C:\\Projetos\\marc\\dist\\cli.js",
    "open",
    "--workspace",
    "C:\\Projetos\\marc",
    "--thread",
    "thread-1"
  ]);
  assert.equal(
    command.shell,
    "'C:/Program Files/nodejs/node.exe' '--conditions=dev' 'C:/Projetos/marc/dist/cli.js' 'open' '--workspace' 'C:/Projetos/marc' '--thread' 'thread-1'"
  );
});

test("a plain word is never rewritten, even when it contains backslashes", () => {
  const command = buildMarcCommand({
    runtime: { execPath: "/usr/bin/node", execArgv: [], script: "/x/cli.js" },
    subcommand: "open",
    args: ["--profile", "a\\b"]
  });
  assert.deepEqual(command.argv.slice(-2), ["--profile", "a\\b"]);
  assert.equal(command.shell.endsWith("'--profile' 'a\\b'"), true);
});

test("posixQuote escapes an embedded single quote", () => {
  assert.equal(posixQuote("it's"), "'it'\\''s'");
});

test("buildWaitCommand keeps the F1 output: the same argv and shell, pinned", () => {
  const command = buildWaitCommand({
    workspaceRoot: "C:\\Projetos\\marc",
    threadId: "t-1",
    mention: "claude-dev",
    since: "msg_1",
    runtime: {
      execPath: "C:\\node\\node.exe",
      execArgv: [],
      script: "C:\\marc\\dist\\cli.js"
    }
  });
  assert.deepEqual(command.argv, [
    "C:\\node\\node.exe",
    "C:\\marc\\dist\\cli.js",
    "wait",
    "--workspace",
    "C:\\Projetos\\marc",
    "--thread",
    "t-1",
    "--mention",
    "claude-dev",
    "--since",
    "msg_1"
  ]);
  assert.equal(
    command.shell,
    "'C:/node/node.exe' 'C:/marc/dist/cli.js' 'wait' '--workspace' 'C:/Projetos/marc' '--thread' 't-1' '--mention' 'claude-dev' '--since' 'msg_1'"
  );
});
