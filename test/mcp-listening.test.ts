import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { WORKSPACE_SKILL } from "../src/core/marc-ops-skill.js";
import { MARC_HELPER_TOPICS, marcHelper } from "../src/mcp/helper.js";
import {
  buildMarcCommand,
  buildWaitCommand,
  currentWaitRuntime,
  posixQuote,
  productionRuntimeProbes,
  shortMarcRuntime,
  type MarcRuntime,
  type RuntimeProbes,
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

const SOURCE_RUNTIME: MarcRuntime = {
  execPath: "/usr/bin/node",
  execArgv: ["--import", "tsx"],
  script: path.join("/srv/marc", "src", "cli.ts")
};

const BUILT_CLI = path.join("/srv/marc", "dist", "cli.js");
const MARC_ON_PATH = path.join("/usr/local/bin", "marc");

/** Probes with the given files, executables and PATH folders; the rest is fixed for the test. */
function probesWith(options: {
  files?: string[];
  executables?: string[];
  pathFolders?: string[];
  platform?: NodeJS.Platform;
}): RuntimeProbes {
  const files = options.files ?? [];
  const executables = options.executables ?? [];
  return {
    platform: options.platform ?? "linux",
    pathFolders: options.pathFolders ?? [],
    isFile: (filePath) => files.includes(filePath),
    isExecutable: (filePath) => executables.includes(filePath)
  };
}

test("a source entry with a built dist/cli.js runs that build with plain node and no execArgv", () => {
  const runtime = shortMarcRuntime(
    SOURCE_RUNTIME,
    probesWith({ files: [BUILT_CLI] })
  );
  const command = buildMarcCommand({
    runtime,
    subcommand: "open",
    args: ["--thread", "134b5983"]
  });

  assert.deepEqual(runtime, {
    execPath: "/usr/bin/node",
    execArgv: [],
    script: BUILT_CLI
  });
  assert.deepEqual(command.argv, [
    "/usr/bin/node",
    BUILT_CLI,
    "open",
    "--thread",
    "134b5983"
  ]);
  assert.equal(command.shell.includes("tsx"), false);
});

test("a runtime without a built entry or a marc on PATH keeps its runtime, and a built entry is kept as it is", () => {
  const built: MarcRuntime = {
    execPath: "/usr/bin/node",
    execArgv: [],
    script: BUILT_CLI
  };

  assert.deepEqual(
    shortMarcRuntime(SOURCE_RUNTIME, probesWith({})),
    SOURCE_RUNTIME
  );
  assert.deepEqual(
    shortMarcRuntime(built, probesWith({ files: [BUILT_CLI] })),
    built
  );
});

test("an executable marc on PATH is run by name, with no script and no execArgv", () => {
  const runtime = shortMarcRuntime(
    SOURCE_RUNTIME,
    probesWith({
      pathFolders: ["/bin", "/usr/local/bin"],
      executables: [MARC_ON_PATH]
    })
  );
  const command = buildMarcCommand({
    runtime,
    subcommand: "open",
    args: ["--profile", "claude-dev"]
  });

  assert.deepEqual(runtime, { execPath: "marc", execArgv: [] });
  assert.deepEqual(command.argv, ["marc", "open", "--profile", "claude-dev"]);
  assert.equal(command.shell, "'marc' 'open' '--profile' 'claude-dev'");
});

test("the built entry wins over a marc on PATH, because the rules run in order", () => {
  const runtime = shortMarcRuntime(
    SOURCE_RUNTIME,
    probesWith({
      files: [BUILT_CLI],
      pathFolders: ["/usr/local/bin"],
      executables: [MARC_ON_PATH]
    })
  );

  assert.deepEqual(runtime.script, BUILT_CLI);
});

test("on Windows marc.cmd and marc.exe on PATH count as marc", () => {
  const folder = "C:\\tools";
  const found = (name: string) =>
    shortMarcRuntime(
      SOURCE_RUNTIME,
      probesWith({
        platform: "win32",
        pathFolders: [folder],
        executables: [path.join(folder, name)]
      })
    );

  assert.deepEqual(found("marc.cmd"), { execPath: "marc", execArgv: [] });
  assert.deepEqual(found("marc.exe"), { execPath: "marc", execArgv: [] });
});

test("a file named marc.cmd does not count outside Windows, and a missing marc keeps the runtime", () => {
  const onLinux = probesWith({
    platform: "linux",
    pathFolders: ["/usr/local/bin"],
    executables: [path.join("/usr/local/bin", "marc.cmd")]
  });

  assert.deepEqual(shortMarcRuntime(SOURCE_RUNTIME, onLinux), SOURCE_RUNTIME);
});

test("PATH folders are split on the platform delimiter, and empty entries are dropped", () => {
  const probes = productionRuntimeProbes(
    { PATH: ["/x", "", "/y"].join(path.delimiter) },
    "linux"
  );

  assert.deepEqual(probes.pathFolders, ["/x", "/y"]);
  assert.equal(probes.platform, "linux");
});
