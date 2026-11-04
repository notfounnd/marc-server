/**
 * Pure launch builder for the agent client. It returns the command, argv, environment and
 * working directory of the client. It starts no process, never uses a shell, and never adds
 * a token. The environment loses the inherited CLAUDE* variables and MARC_TOKEN, so the agent
 * does not inherit the daemon token, and it gains the tool shell.
 */

import type { SlotStateName } from "./session-slots.js";

export type LaunchMode = "new" | "resume";
export type ToolShell = "bash" | "default";

export type AgentLaunchInput = {
  client: "claude-code";
  mode: LaunchMode;
  sessionId: string;
  prompt?: string;
  workspaceRoot: string;
  toolShell: ToolShell;
  baseEnv: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
};

export type AgentLaunch = {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
};

/** Names removed from the inherited environment and the values set on it. */
export type EnvChanges = {
  removed: string[];
  set: Record<string, string>;
};

const COMMANDS: Record<AgentLaunchInput["client"], string> = {
  "claude-code": "claude"
};

/**
 * F2 heuristic: the profile's `Model:` prefix names the client that runs it. Only Claude Code
 * launches so far, so a Codex or other model maps to no client. F5 replaces this table with an
 * explicit client field in the profile, once Codex can be launched.
 */
const CLIENT_BY_MODEL_PREFIX: Record<string, AgentLaunchInput["client"]> = {
  "claude-": "claude-code"
};

/** The client that runs a profile's model, or undefined when the client is unsupported or the model is missing. */
export function clientForModel(
  model: string | undefined
): AgentLaunchInput["client"] | undefined {
  if (model === undefined) return undefined;
  const prefix = Object.keys(CLIENT_BY_MODEL_PREFIX).find((known) =>
    model.startsWith(known)
  );
  if (prefix === undefined) return undefined;
  return CLIENT_BY_MODEL_PREFIX[prefix];
}

const SESSION_FLAGS: Record<LaunchMode, string> = {
  new: "--session-id",
  resume: "--resume"
};

/** The default leaves the client's own tool choice in place, so only bash is set. */
const TOOL_SHELL_ENV: Record<ToolShell, Record<string, string>> = {
  bash: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "0" },
  default: {}
};

export function buildAgentLaunch(input: AgentLaunchInput): AgentLaunch {
  const changes = envChanges(input);
  return {
    command: COMMANDS[input.client],
    args: launchArgs(input),
    env: { ...keptEnv(input), ...changes.set },
    cwd: input.workspaceRoot
  };
}

/** The same changes buildAgentLaunch makes, as names and constant values, for dry-run output. */
export function envChanges(
  input: Pick<AgentLaunchInput, "baseEnv" | "toolShell" | "platform">
): EnvChanges {
  const platform = input.platform ?? process.platform;
  return {
    removed: Object.keys(input.baseEnv).filter((name) =>
      isStrippedVariable(name, platform)
    ),
    set: { ...TOOL_SHELL_ENV[input.toolShell] }
  };
}

/**
 * The prompt is positional, so it comes first. Flags that take several values, such as
 * --allowedTools or --mcp-config, would otherwise swallow it, so any such flag goes after it.
 */
function launchArgs(input: AgentLaunchInput): string[] {
  return [...promptArgs(input), SESSION_FLAGS[input.mode], input.sessionId];
}

function promptArgs(input: AgentLaunchInput): string[] {
  if (input.mode !== "new" || input.prompt === undefined) return [];
  return [input.prompt];
}

function keptEnv(
  input: Pick<AgentLaunchInput, "baseEnv" | "platform">
): Record<string, string> {
  const platform = input.platform ?? process.platform;
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.baseEnv)) {
    if (value !== undefined && !isStrippedVariable(name, platform)) {
      kept[name] = value;
    }
  }
  return kept;
}

/**
 * Inherited variables the client must not receive: every CLAUDE* name and the daemon token.
 * Windows environment names are case-insensitive, so both names are matched without case there.
 */
function isStrippedVariable(name: string, platform: NodeJS.Platform): boolean {
  const folded = foldCase(name, platform);
  return folded.startsWith("CLAUDE") || folded === "MARC_TOKEN";
}

function foldCase(name: string, platform: NodeJS.Platform): string {
  if (platform !== "win32") return name;
  return name.toUpperCase();
}

/**
 * The initial prompt of a new session. `marc open` and the copied native command share this one
 * text, so the two paths start a session with the same instructions.
 */
export function initialPrompt(threadId: string, profile: string): string {
  return `You are the mARC profile ${profile}. Call workspace_bootstrap, then read the thread marc://$${threadId} as ${profile} with thread_read, and act under the workspace rules.`;
}

/** Only a new session receives the prompt. A resume never does. */
export function promptFor(
  mode: LaunchMode,
  threadId: string,
  profile: string
): string | undefined {
  if (mode !== "new") return undefined;
  return initialPrompt(threadId, profile);
}

/**
 * The native command that resumes an ended session. The UI copies it; mARC never runs it, and
 * the user runs it from the workspace folder.
 */
export function nativeResumeCommand(sessionId: string): string {
  return `${COMMANDS["claude-code"]} --resume ${sessionId}`;
}

/**
 * The native command that starts a new session with the initial prompt. The prompt is single
 * quoted, so the shell never expands the marc:// reference that it contains.
 */
export function nativeNewCommand(threadId: string, profile: string): string {
  const prompt = singleQuoted(initialPrompt(threadId, profile));
  return `${COMMANDS["claude-code"]} ${prompt}`;
}

export type CopyContext = {
  threadId: string;
  profile: string;
  nativeSessionId?: string;
};

/** The copy action by state. An ended session resumes; an unbound one starts a new session. */
const COPY_COMMANDS: Partial<
  Record<SlotStateName, (context: CopyContext) => string | undefined>
> = {
  ended: (context) => resumeText(context.nativeSessionId),
  unbound: (context) => nativeNewCommand(context.threadId, context.profile)
};

/**
 * The native Claude command the UI copies for a slot, or none when the slot is open or unknown.
 * mARC never runs it. A session started this way is bound by adoption, when the profile posts.
 */
export function copyCommandFor(
  state: SlotStateName,
  context: CopyContext
): { text: string } | undefined {
  const build = COPY_COMMANDS[state];
  if (!build) return undefined;
  const text = build(context);
  if (text === undefined) return undefined;
  return { text };
}

function resumeText(nativeSessionId: string | undefined): string | undefined {
  if (nativeSessionId === undefined) return undefined;
  return nativeResumeCommand(nativeSessionId);
}

/** One POSIX shell word: single quotes, with each embedded single quote closed, escaped and reopened. */
export function singleQuoted(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}
