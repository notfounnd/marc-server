import fs from "node:fs";
import path from "node:path";

/**
 * The Node runtime that started this process: the executable, its flags, and the script path.
 * A plain `marc` command on PATH has no script, so its script is absent.
 */
export type MarcRuntime = {
  execPath: string;
  execArgv: readonly string[];
  script?: string;
};

export type WaitRuntime = MarcRuntime;

/** A path is written with forward slashes in the shell command; any other word is kept as written. */
export type MarcArg = string | { path: string };

export type MarcCommandInput = {
  runtime: MarcRuntime;
  subcommand: string;
  args: MarcArg[];
};

export type MarcCommand = {
  argv: string[];
  shell: string;
};

export type WaitCommandInput = {
  workspaceRoot: string;
  threadId?: string;
  mention?: string;
  since?: string;
  runtime: WaitRuntime;
};

export type WaitCommand = MarcCommand;

/**
 * Builds a `marc` subcommand for this server. The argv never includes process arguments
 * after the script, so a token passed to the server cannot leak into the command.
 */
export function buildMarcCommand(input: MarcCommandInput): MarcCommand {
  const { runtime } = input;
  const wordsWith = (toPath: (value: string) => string): string[] => [
    toPath(runtime.execPath),
    ...runtime.execArgv,
    ...scriptWords(runtime, toPath),
    input.subcommand,
    ...input.args.map((arg) => argWord(arg, toPath))
  ];

  return {
    argv: wordsWith((value) => value),
    shell: wordsWith(toPosixPath).map(posixQuote).join(" ")
  };
}

/** Builds the `marc wait` command for this server. */
export function buildWaitCommand(input: WaitCommandInput): WaitCommand {
  return buildMarcCommand({
    runtime: input.runtime,
    subcommand: "wait",
    args: [
      "--workspace",
      { path: input.workspaceRoot },
      "--thread",
      input.threadId ?? "<threadId>",
      "--mention",
      input.mention ?? "<agent-id>",
      "--since",
      input.since ?? "<lastMessageId>"
    ]
  });
}

/** The inputs of the short `marc open` command. The defaults are the values the command omits. */
export type OpenCommandInput = {
  runtime: MarcRuntime;
  workspaceRoot: string;
  threadId: string;
  profile: string;
  dataDir: string;
  daemonUrl: string;
  defaultDaemonUrl: string;
  newSession: boolean;
};

/**
 * The short `marc open` command for a slot: the workspace, the thread's 8-hex suffix and the profile.
 * The data directory and the URL appear only when they differ from the defaults, and --new only
 * when asked. It never carries the token.
 */
export function buildOpenCommand(input: OpenCommandInput): MarcCommand {
  return buildMarcCommand({
    runtime: input.runtime,
    subcommand: "open",
    args: [
      "--workspace",
      { path: input.workspaceRoot },
      "--thread",
      threadSuffix(input.threadId),
      "--profile",
      input.profile,
      ...dataDirArgs(input),
      ...daemonUrlArgs(input),
      ...newArgs(input.newSession)
    ]
  });
}

/** The 8-hex suffix of a thread ID, which `marc open` resolves. A thread ID without one stays whole. */
export function threadSuffix(threadId: string): string {
  return threadId.match(/-([0-9a-f]{8})$/)?.[1] ?? threadId;
}

/** The data directory is named only when it is not the workspace's .marc-daemon, which marc open finds by itself. */
function dataDirArgs(input: OpenCommandInput): MarcArg[] {
  const workspaceDir = path.join(input.workspaceRoot, ".marc-daemon");
  if (path.resolve(input.dataDir) === path.resolve(workspaceDir)) return [];
  return ["--data-dir", { path: input.dataDir }];
}

/** The daemon URL is named only when it is not the default address. */
function daemonUrlArgs(input: OpenCommandInput): MarcArg[] {
  if (input.daemonUrl === input.defaultDaemonUrl) return [];
  return ["--daemon-url", input.daemonUrl];
}

function newArgs(newSession: boolean): MarcArg[] {
  if (!newSession) return [];
  return ["--new"];
}

/** Quotes one word for a POSIX shell such as Git Bash: single quotes, with embedded quotes escaped. */
export function posixQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function scriptWords(
  runtime: MarcRuntime,
  toPath: (value: string) => string
): string[] {
  if (runtime.script === undefined) return [];
  return [toPath(runtime.script)];
}

function argWord(arg: MarcArg, toPath: (value: string) => string): string {
  if (typeof arg === "string") return arg;
  return toPath(arg.path);
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

/** What the shared builder may check on this machine. Tests fix these; production reads disk and PATH. */
export type RuntimeProbes = {
  platform: NodeJS.Platform;
  pathFolders: readonly string[];
  isFile: (filePath: string) => boolean;
  isExecutable: (filePath: string) => boolean;
};

type ShortRule = (
  runtime: MarcRuntime,
  probes: RuntimeProbes
) => MarcRuntime | undefined;

/**
 * Rules in order. The first rule that yields a runtime wins. When none does, the runtime keeps
 * its execPath, execArgv and script, as the server started it.
 */
const SHORT_RUNTIME_RULES: readonly ShortRule[] = [
  distEntryRule,
  pathCommandRule
];

/**
 * The runtime the copied commands start from. A source entry runs through a dev loader, and the
 * copied command must not carry one. An installed `marc` on PATH is shorter still.
 */
export function shortMarcRuntime(
  runtime: MarcRuntime,
  probes: RuntimeProbes
): MarcRuntime {
  const found = SHORT_RUNTIME_RULES.reduce<MarcRuntime | undefined>(
    (current, rule) => current ?? rule(runtime, probes),
    undefined
  );
  return found ?? runtime;
}

/**
 * A source entry such as `src/cli.ts` is built to `dist/cli.js` in the same package. The short
 * runtime runs that build with plain node and no execArgv, so no dev loader is copied.
 */
function distEntryRule(
  runtime: MarcRuntime,
  probes: RuntimeProbes
): MarcRuntime | undefined {
  const script = runtime.script;
  if (script === undefined || !script.endsWith(".ts")) return undefined;
  const distCli = path.join(
    path.dirname(path.dirname(script)),
    "dist",
    "cli.js"
  );
  if (!probes.isFile(distCli)) return undefined;
  return { execPath: runtime.execPath, execArgv: [], script: distCli };
}

const MARC_NAMES: Partial<Record<NodeJS.Platform, readonly string[]>> = {
  win32: ["marc", "marc.cmd", "marc.exe"]
};

const DEFAULT_MARC_NAMES: readonly string[] = ["marc"];

/** An executable `marc` on PATH is run by name, with no script and no execArgv. */
function pathCommandRule(
  _runtime: MarcRuntime,
  probes: RuntimeProbes
): MarcRuntime | undefined {
  const names = MARC_NAMES[probes.platform] ?? DEFAULT_MARC_NAMES;
  const found = probes.pathFolders
    .flatMap((folder) => names.map((name) => path.join(folder, name)))
    .some((candidate) => probes.isExecutable(candidate));
  if (!found) return undefined;
  return { execPath: "marc", execArgv: [] };
}

/** The probes of this machine: the PATH folders, file and execute checks, and the platform. */
export function productionRuntimeProbes(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): RuntimeProbes {
  return {
    platform,
    pathFolders: (env.PATH ?? "")
      .split(path.delimiter)
      .filter((folder) => folder.length > 0),
    isFile: isFileAt,
    isExecutable: canExecute
  };
}

function isFileAt(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function canExecute(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The runtime of this process. The script is argv[1]; argv[2] onward is never read. */
export function processMarcRuntime(): MarcRuntime {
  return {
    execPath: process.execPath,
    execArgv: process.execArgv,
    script: process.argv[1] ?? ""
  };
}

/** The runtime the copied `marc open` commands start from, in this process and machine. */
export function currentMarcRuntime(): MarcRuntime {
  return shortMarcRuntime(
    processMarcRuntime(),
    productionRuntimeProbes(process.env, process.platform)
  );
}

export function currentWaitRuntime(): WaitRuntime {
  return currentMarcRuntime();
}
