import path from "node:path";
import type { ToolShell } from "./core/agent-launch.js";
import { resolveWorkspace } from "./core/paths.js";
import { OpenError } from "./cli-open-output.js";

/** The flags of marc open. They are parsed and checked before any daemon or workspace work. */
export type OpenValues = Record<string, string | boolean>;

export type OpenInput = {
  workspaceRoot: string;
  requestedThread: string;
  profile: string;
  dataDir: string;
  /** The daemon URL the flag or MARC_DAEMON_URL gives. Unset means discovery decides. */
  daemonUrl: string | undefined;
  toolShell: ToolShell;
  newSession: boolean;
  dryRun: boolean;
};

/** What the data directory default may check on disk. Production asks the file system; tests fix it. */
export type OpenProbes = {
  dirExists: (dirPath: string) => boolean;
};

const TOOL_SHELLS: ToolShell[] = ["bash", "default"];

/**
 * The flags of marc open. The data directory is the --data-dir flag, then MARC_DAEMON_DIR, then the
 * workspace's .marc-daemon when that directory exists, then .marc-daemon in the current directory.
 */
export function parseOpenInput(
  values: OpenValues,
  env: NodeJS.ProcessEnv,
  probes: OpenProbes
): OpenInput {
  const workspaceRoot = resolveWorkspace(textOption(values, "workspace"));
  return {
    workspaceRoot,
    requestedThread: requiredText(values, "thread"),
    profile: requiredText(values, "profile"),
    dataDir: dataDirOption(values, env, workspaceRoot, probes),
    daemonUrl: daemonUrlOption(values, env),
    toolShell: toolShellOption(values),
    newSession: flagOption(values, "new"),
    dryRun: flagOption(values, "dry-run")
  };
}

function dataDirOption(
  values: OpenValues,
  env: NodeJS.ProcessEnv,
  workspaceRoot: string,
  probes: OpenProbes
): string {
  const explicit = textOption(values, "data-dir") ?? env.MARC_DAEMON_DIR;
  if (explicit !== undefined) return path.resolve(explicit);
  return path.resolve(workspaceDataDir(workspaceRoot, probes));
}

/** The workspace's own .marc-daemon when it exists, else the same name in the current directory. */
function workspaceDataDir(workspaceRoot: string, probes: OpenProbes): string {
  const candidate = path.join(workspaceRoot, ".marc-daemon");
  if (probes.dirExists(candidate)) return candidate;
  return ".marc-daemon";
}

/** The flag wins over MARC_DAEMON_URL. A value that is not a URL is refused before any call. */
function daemonUrlOption(
  values: OpenValues,
  env: NodeJS.ProcessEnv
): string | undefined {
  const value =
    textOption(values, "daemon-url") ?? (env.MARC_DAEMON_URL || undefined);
  if (value === undefined) return undefined;
  try {
    return new URL(value).href;
  } catch {
    throw new OpenError("input_error", "daemon_url_invalid");
  }
}

function textOption(values: OpenValues, key: string): string | undefined {
  const value = values[key];
  if (value === true)
    throw new OpenError("input_error", `${key}_value_required`);
  return typeof value === "string" ? value : undefined;
}

function requiredText(values: OpenValues, key: string): string {
  const value = textOption(values, key);
  if (!value) throw new OpenError("input_error", `${key}_required`);
  return value;
}

function toolShellOption(values: OpenValues): ToolShell {
  const value = textOption(values, "tool-shell") ?? "bash";
  if (!isToolShell(value))
    throw new OpenError("input_error", "tool_shell_invalid");
  return value;
}

function isToolShell(value: string): value is ToolShell {
  return TOOL_SHELLS.some((shell) => shell === value);
}

function flagOption(values: OpenValues, key: string): boolean {
  const value = values[key];
  if (value === undefined) return false;
  if (value === true) return true;
  throw new OpenError("input_error", `${key}_takes_no_value`);
}
