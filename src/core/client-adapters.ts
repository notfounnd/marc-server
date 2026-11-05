/**
 * Client adapters for the headless turns that the supervisor starts. Each adapter builds the launch,
 * the turn prompts and the reading of the output for one client. A dispatch table picks the adapter
 * by client, so a new client adds one adapter. Nothing here starts a process or does I/O: the executor
 * runs the launch and passes the output back to parseResult and failureReason.
 */

import { isRecord } from "./activation-rules.js";
import {
  clientEnv,
  commandFor,
  SESSION_FLAGS,
  type AgentLaunch,
  type AgentLaunchInput,
  type LaunchMode,
  type ToolShell
} from "./agent-launch.js";

export type HeadlessLaunchInput = {
  mode: LaunchMode;
  sessionId: string;
  prompt: string;
  /** The profile's model, passed as --model so the turn never runs on another one. */
  model: string;
  workspaceRoot: string;
  toolShell: ToolShell;
  baseEnv: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  /** Optional flags that take several values, such as --permission-prompt-tool and its name. They go last. */
  extraArgs?: readonly string[];
};

export type HeadlessPromptInput = {
  threadId: string;
  profile: string;
  messageId: string;
  author: string;
  /** The ISO instant at which the turn must stop. */
  deadline: string;
  /** The last message the profile consumed, or undefined when the profile has no cursor yet. */
  cursor: string | undefined;
};

export type HeadlessResult = {
  sessionId: string;
  isError: boolean;
  subtype: string;
  permissionDenials: unknown[];
  totalCostUsd: number;
  durationMs: number;
  resultText: string;
};

export type ParseResult =
  | { status: "parsed"; result: HeadlessResult }
  | { status: "invalid_output" };

/** What the executor observed of one turn. The executor sets the flags; the adapter only classifies them. */
export type RunOutcome = {
  /** The deadline passed and the executor stopped the process tree. */
  timedOut: boolean;
  /** The process ended by a signal or a fault that no mARC path asked for. */
  crashed: boolean;
  /** The client executable was missing when the launch started. */
  missingClient: boolean;
  exitCode: number | undefined;
  parsed: ParseResult;
  stderr: string;
};

export type FailureReason =
  | "session_not_found"
  | "auth"
  | "client_missing"
  | "timeout"
  | "crashed"
  | "invalid_output"
  | "error";

export interface ClientAdapter {
  readonly client: AgentLaunchInput["client"];
  headlessLaunch(input: HeadlessLaunchInput): AgentLaunch;
  headlessPrompt(input: HeadlessPromptInput): string;
  continuePrompt(): string;
  parseResult(stdout: string, expectedSessionId: string): ParseResult;
  failureReason(outcome: RunOutcome): FailureReason | undefined;
}

/** The prompt of a turn that resumes after the time limit. It is sent as written. */
const CONTINUE_PROMPT =
  "you were stopped by the time limit; check what was left half done and continue";

const SESSION_NOT_FOUND = /no conversation found/i;
const AUTH_HINT =
  /not logged in|\/login|invalid api key|authentication_error|401/i;

type ClaudeResultShape = {
  session_id: string;
  is_error: boolean;
  subtype: string;
  permission_denials: unknown[];
  total_cost_usd: number;
  duration_ms: number;
  result?: unknown;
};

const INVALID_OUTPUT: ParseResult = { status: "invalid_output" };

/**
 * The argument order of a headless turn. The positional prompt comes first, so a flag that takes
 * several values cannot swallow it. --permission-mode auto is the client's automatic mode. --bg is
 * never used, because it would create a copy of the session.
 */
export function claudeHeadlessArgs(input: HeadlessLaunchInput): string[] {
  return [
    input.prompt,
    "-p",
    "--output-format",
    "json",
    "--model",
    input.model,
    "--permission-mode",
    "auto",
    SESSION_FLAGS[input.mode],
    input.sessionId,
    ...(input.extraArgs ?? [])
  ];
}

function claudeHeadlessLaunch(input: HeadlessLaunchInput): AgentLaunch {
  return {
    command: commandFor("claude-code"),
    args: claudeHeadlessArgs(input),
    env: clientEnv(input),
    cwd: input.workspaceRoot
  };
}

function claudeHeadlessPrompt(input: HeadlessPromptInput): string {
  return [
    `You are the mARC profile ${input.profile}, woken by a mention from ${input.author} in message ${input.messageId} of thread marc://$${input.threadId}.`,
    "Call workspace_bootstrap first, then act under the workspace rules.",
    cursorSentence(input.cursor),
    `Your time limit ends at ${input.deadline}. Post your progress with message_post before any long piece of work, and stop when the limit is near.`,
    "This is a one-shot turn. Do not arm marc wait: the turn ends when you stop, and a waiter would keep it open."
  ].join(" ");
}

function cursorSentence(cursor: string | undefined): string {
  if (cursor === undefined) {
    return "You have no stored cursor, so read the whole thread with thread_read.";
  }
  return `Read the thread after message ${cursor} with thread_read_since.`;
}

/**
 * Reads the JSON of one headless turn. The session_id must be the one the executor expects. Any other
 * shape, or a different session, is invalid output.
 */
export function parseClaudeResult(
  stdout: string,
  expectedSessionId: string
): ParseResult {
  const value = parseJson(stdout);
  if (!isClaudeResult(value)) return INVALID_OUTPUT;
  if (value.session_id !== expectedSessionId) return INVALID_OUTPUT;
  return {
    status: "parsed",
    result: {
      sessionId: value.session_id,
      isError: value.is_error,
      subtype: value.subtype,
      permissionDenials: value.permission_denials,
      totalCostUsd: value.total_cost_usd,
      durationMs: value.duration_ms,
      resultText: textOf(value.result)
    }
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isClaudeResult(value: unknown): value is ClaudeResultShape {
  if (!isRecord(value)) return false;
  return (
    typeof value.session_id === "string" &&
    typeof value.is_error === "boolean" &&
    typeof value.subtype === "string" &&
    Array.isArray(value.permission_denials) &&
    typeof value.total_cost_usd === "number" &&
    typeof value.duration_ms === "number"
  );
}

function textOf(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

type FailureRule = {
  reason: FailureReason;
  matches: (outcome: RunOutcome) => boolean;
};

/**
 * The first matching rule names the failure. Timeout and crash come before the output, so a
 * truncated JSON cannot hide them. A failure that no rule names is an error, never a guess.
 */
const FAILURE_RULES: readonly FailureRule[] = [
  { reason: "client_missing", matches: (outcome) => outcome.missingClient },
  { reason: "timeout", matches: (outcome) => outcome.timedOut },
  { reason: "crashed", matches: (outcome) => outcome.crashed },
  {
    reason: "session_not_found",
    matches: (outcome) => SESSION_NOT_FOUND.test(textOfOutcome(outcome))
  },
  {
    reason: "auth",
    matches: (outcome) => AUTH_HINT.test(textOfOutcome(outcome))
  },
  {
    reason: "invalid_output",
    matches: (outcome) => outcome.parsed.status === "invalid_output"
  }
];

/** The failure of a turn, or undefined when the turn succeeded. */
export function claudeFailureReason(
  outcome: RunOutcome
): FailureReason | undefined {
  if (isSuccess(outcome)) return undefined;
  const rule = FAILURE_RULES.find((candidate) => candidate.matches(outcome));
  return rule?.reason ?? "error";
}

function isSuccess(outcome: RunOutcome): boolean {
  if (outcome.missingClient || outcome.timedOut || outcome.crashed) {
    return false;
  }
  if (outcome.exitCode !== 0) return false;
  return outcome.parsed.status === "parsed" && !outcome.parsed.result.isError;
}

function textOfOutcome(outcome: RunOutcome): string {
  return `${outcome.stderr}\n${resultTextOf(outcome)}`;
}

function resultTextOf(outcome: RunOutcome): string {
  if (outcome.parsed.status === "invalid_output") return "";
  return outcome.parsed.result.resultText;
}

export const claudeCodeAdapter: ClientAdapter = {
  client: "claude-code",
  headlessLaunch: claudeHeadlessLaunch,
  headlessPrompt: claudeHeadlessPrompt,
  continuePrompt: () => CONTINUE_PROMPT,
  parseResult: parseClaudeResult,
  failureReason: claudeFailureReason
};

/** The adapter table. A client without an adapter, such as codex until F5, yields undefined. */
const ADAPTERS = new Map<string, ClientAdapter>([
  [claudeCodeAdapter.client, claudeCodeAdapter]
]);

export function adapterFor(
  client: string | undefined
): ClientAdapter | undefined {
  if (client === undefined) return undefined;
  return ADAPTERS.get(client);
}
