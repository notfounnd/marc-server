/** The Node runtime that started this process. Only the executable, its flags, and the script path. */
export type WaitRuntime = {
  execPath: string;
  execArgv: readonly string[];
  script: string;
};

export type WaitCommandInput = {
  workspaceRoot: string;
  threadId?: string;
  mention?: string;
  since?: string;
  runtime: WaitRuntime;
};

export type WaitCommand = {
  argv: string[];
  shell: string;
};

/**
 * Builds the `marc wait` command for this server. The argv never includes process arguments
 * after the script, so a token passed to the server cannot leak into the command.
 */
export function buildWaitCommand(input: WaitCommandInput): WaitCommand {
  const { runtime } = input;
  const argvWith = (toPath: (value: string) => string): string[] => [
    toPath(runtime.execPath),
    ...runtime.execArgv,
    toPath(runtime.script),
    "wait",
    "--workspace",
    toPath(input.workspaceRoot),
    "--thread",
    input.threadId ?? "<threadId>",
    "--mention",
    input.mention ?? "<agent-id>",
    "--since",
    input.since ?? "<lastMessageId>"
  ];

  return {
    argv: argvWith((value) => value),
    shell: argvWith(toPosixPath).map(posixQuote).join(" ")
  };
}

/** Quotes one word for a POSIX shell such as Git Bash: single quotes, with embedded quotes escaped. */
export function posixQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

/** The runtime of this process. The script is argv[1]; argv[2] onward is never read. */
export function currentWaitRuntime(): WaitRuntime {
  return {
    execPath: process.execPath,
    execArgv: process.execArgv,
    script: process.argv[1] ?? ""
  };
}
