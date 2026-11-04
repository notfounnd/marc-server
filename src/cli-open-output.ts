import type { EnvChanges } from "./core/agent-launch.js";

/**
 * The contract of `marc open` output: statuses, exit codes, the refusal and spawn tables, and the
 * one JSON line per outcome. Every outcome passes through here, and none of them carries a token.
 */

export type OpenStatus =
  | "dry_run"
  | "ended"
  | "thread_closed"
  | "input_error"
  | "spawn_error"
  | "owner_active"
  | "refused"
  | "continuity_unknown"
  | "retry"
  | "daemon_unavailable";

export type LaunchPlan = {
  command: string;
  args: string[];
  cwd: string;
  env: EnvChanges;
};

export type OpenOutcome = {
  status: OpenStatus;
  exitCode: number;
  reason?: string;
  threadId?: string;
  profile?: string;
  slotState?: string;
  dataDir?: string;
  launch?: LaunchPlan;
};

/** Exit code per status. The same table drives the exitCode field of the JSON line. */
const EXIT_CODES: Record<OpenStatus, number> = {
  dry_run: 0,
  ended: 0,
  thread_closed: 4,
  input_error: 5,
  spawn_error: 5,
  owner_active: 6,
  refused: 8,
  continuity_unknown: 8,
  retry: 8,
  daemon_unavailable: 9
};

/** Daemon refusal reason to status. A reason that is not listed is a plain refusal. */
const REFUSAL_STATUS: Partial<Record<string, OpenStatus>> = {
  owner_active: "owner_active",
  reserved: "owner_active",
  generation_mismatch: "retry",
  profile_unknown: "input_error",
  user_profile: "input_error"
};

/** Spawn error code to reason. Both mean the claude command could not be started. */
const SPAWN_REASONS: Partial<Record<string, string>> = {
  ENOENT: "claude_not_found",
  EINVAL: "claude_not_found"
};

const INPUT_NEXT: Partial<Record<string, string>> = {
  workspace_not_registered:
    "The daemon does not know this workspace. Register it: start the workspace MCP server with the daemon URL and token, or call workspace_register. Then run marc open again.",
  profile_unknown: "Use a profile that exists in this workspace.",
  user_profile:
    "A user profile cannot own a client session. Use an agent profile.",
  unsupported_client:
    "Only Claude Code profiles can be opened for now. Use a profile whose Model names a Claude model."
};

/** The en-US stderr line of a refusal the person must act on. Refusals without a line write only the JSON. */
const STDERR_LINES: Partial<Record<string, (outcome: OpenOutcome) => string>> =
  {
    unsupported_client: (outcome) =>
      `marc open: profile ${outcome.profile ?? "unknown"} does not run a supported client. Only Claude Code profiles can be opened for now.`
  };

export function stderrLineOf(outcome: OpenOutcome): string | undefined {
  const line = STDERR_LINES[outcome.reason ?? ""];
  if (line === undefined) return undefined;
  return line(outcome);
}

/** Tells a session that does not remember why the command ran what to do next. */
const NEXT_STEP: Record<
  OpenStatus,
  (outcome: OpenOutcome, reference: string) => string
> = {
  dry_run: () =>
    "Nothing was acquired or started. Run marc open without --dry-run to launch the client.",
  ended: () => "The client ended and the ownership was released.",
  thread_closed: (_outcome, reference) =>
    `${reference} is closed. Do not open a client for it.`,
  input_error: (outcome) =>
    INPUT_NEXT[outcome.reason ?? ""] ??
    `Fix ${outcome.reason} and run marc open again.`,
  spawn_error: (outcome) =>
    `The client did not start (${outcome.reason}) and the ownership was released. Install Claude Code, make claude available on PATH, then run marc open again.`,
  owner_active: (outcome) =>
    `The slot is held by a live owner (${outcome.slotState ?? "unknown"}). Do not force it open. Wait for the owner to end, or use another profile.`,
  refused: (outcome) =>
    `The daemon refused the slot (${outcome.reason}). Check the conflicts in the thread sessions view before opening it again.`,
  continuity_unknown: (_outcome, reference) =>
    `This profile already posted in ${reference}, but the daemon has no binding for it. If the earlier session is gone, run marc open with --new. Otherwise find that session first.`,
  retry: () =>
    "The slot changed while marc open was reading it. Run marc open again.",
  daemon_unavailable: (outcome) => daemonNext(outcome)
};

/** Discovery failures name what to check. None of them shows a token. */
const DAEMON_NEXT: Partial<Record<string, (dataDir: string) => string>> = {
  daemon_unreachable: (dataDir) =>
    `No daemon answers at the address. Start it with: marc daemon start --data-dir ${dataDir}, or pass its address with --daemon-url, then run marc open again.`,
  token_missing: () =>
    "No token was found in the data directory, in the token file that daemon.json names, or in MARC_TOKEN. Pass the data directory of the running daemon with --data-dir, then run marc open again.",
  token_rejected: () =>
    "The daemon refused the token of this environment. Check that --data-dir and --daemon-url point to the running daemon, then run marc open again."
};

function daemonNext(outcome: OpenOutcome): string {
  const dataDir = outcome.dataDir ?? "<data-dir>";
  const next = DAEMON_NEXT[outcome.reason ?? ""];
  if (next) return next(dataDir);
  return `The daemon is not usable (${outcome.reason}). Start it with: marc daemon start --data-dir ${dataDir}, then run marc open again.`;
}

/** A failure that stops marc open. Its status and reason become the outcome. */
export class OpenError extends Error {
  status: OpenStatus;
  reason: string;

  constructor(status: OpenStatus, reason: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
  }
}

export function statusOutcome(status: OpenStatus, reason: string): OpenOutcome {
  return { status, exitCode: EXIT_CODES[status], reason };
}

export function failureOutcome(error: unknown): OpenOutcome {
  if (error instanceof OpenError)
    return statusOutcome(error.status, error.reason);
  return statusOutcome("input_error", "unexpected_error");
}

export function refusalStatus(reason: string): OpenStatus {
  return REFUSAL_STATUS[reason] ?? "refused";
}

export function spawnReason(code: string | undefined): string {
  return SPAWN_REASONS[code ?? ""] ?? "spawn_failed";
}

/** One JSON line for every outcome except a client that ran: that output belongs to the client. */
export function toOutputLine(outcome: OpenOutcome, at: string): string {
  const threadReference =
    outcome.threadId === undefined ? undefined : `marc://$${outcome.threadId}`;
  return JSON.stringify({
    status: outcome.status,
    exitCode: outcome.exitCode,
    threadId: outcome.threadId,
    threadReference,
    profile: outcome.profile,
    slotState: outcome.slotState,
    reason: outcome.reason,
    dataDir: outcome.dataDir,
    launch: outcome.launch,
    at,
    next: NEXT_STEP[outcome.status](
      outcome,
      threadReference ?? "the requested thread"
    )
  });
}

/** Runs one daemon or workspace call and turns any exception into the given failure. */
export async function guard<T>(
  call: () => Promise<T>,
  status: OpenStatus,
  reason: string
): Promise<T> {
  try {
    return await call();
  } catch {
    throw new OpenError(status, reason);
  }
}
