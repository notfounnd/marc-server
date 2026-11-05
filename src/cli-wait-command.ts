import { randomUUID } from "node:crypto";
import { listAgentProfilesInWorkspace } from "./core/agents.js";
import type { WaitAuthor, WaitChain } from "./core/thread-mentions.js";
import { resolveThreadId } from "./core/thread-resolution.js";
import {
  createWaitRuntimeDeps,
  workspaceInfoFor
} from "./core/thread-wait-runtime.js";
import {
  waitForMention,
  type ReservationPort,
  type ReservationReply,
  type WaitOptions,
  type WaitOutcome
} from "./core/thread-wait.js";
import { tryWithWorkspaceWriteLock } from "./core/write-coordination.js";
import { resolveWorkspace } from "./core/paths.js";
import type { GovernedConfig } from "./cli-wait-governed.js";
import {
  EXIT_CODES,
  NEXT_STEP,
  reservationListsOf,
  type WaitStatus
} from "./cli-wait-status.js";

export type WaitValues = Record<string, string | boolean>;

export type WaitCommandOptions = {
  sessionDefault: string | undefined;
  print: (line: string) => void;
};

type WaitInput = {
  workspaceRoot: string;
  threadId: string;
  mention: string;
  afterMessageId: string;
  maxChain: number;
  timeoutMinutes: number;
  sessionId: string | undefined;
  dataDir: string | undefined;
  daemonUrl: string | undefined;
};

type SessionLock = "held" | "busy" | "unavailable";

type WaitResult = {
  status: WaitStatus;
  threadId?: string;
  mention?: string;
  afterMessageId?: string;
  messageIds?: string[];
  authors?: WaitAuthor[];
  chain?: WaitChain;
  reservations?: ReservationReply[];
  sessionLock?: SessionLock;
  error?: string;
};

const DEFAULT_MAX_CHAIN = 3;
const DEFAULT_TIMEOUT_MINUTES = 120;
const POLL_MS = 2000;
const LOCK_STALE_MS = 30000;
const STOP_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

/** Runs `marc wait`. Prints exactly one JSON line and returns the exit code. */
export async function runWaitCommand(
  values: WaitValues,
  options: WaitCommandOptions
): Promise<number> {
  const controller = new AbortController();
  const stopListening = listenForStopSignals(controller);
  try {
    const result = await executeWait(values, options, controller.signal).catch(
      errorResult
    );
    options.print(toOutputLine(result, new Date()));
    return EXIT_CODES[result.status];
  } finally {
    stopListening();
  }
}

export function parseWaitInput(
  values: WaitValues,
  sessionDefault: string | undefined
): WaitInput {
  return {
    workspaceRoot: resolveWorkspace(textOption(values, "workspace")),
    threadId: requiredOption(values, "thread"),
    mention: requiredOption(values, "mention"),
    afterMessageId: requiredOption(values, "since"),
    maxChain: integerOption(
      values,
      "max-chain",
      DEFAULT_MAX_CHAIN,
      1,
      Infinity
    ),
    timeoutMinutes: integerOption(
      values,
      "timeout-minutes",
      DEFAULT_TIMEOUT_MINUTES,
      1,
      1440
    ),
    sessionId: (textOption(values, "session") ?? sessionDefault) || undefined,
    dataDir: textOption(values, "data-dir"),
    daemonUrl: textOption(values, "daemon-url")
  };
}

async function executeWait(
  values: WaitValues,
  options: WaitCommandOptions,
  signal: AbortSignal
): Promise<WaitResult> {
  const input = parseWaitInput(values, options.sessionDefault);
  const base = { mention: input.mention, afterMessageId: input.afterMessageId };
  const resolution = await resolveThreadId(input.workspaceRoot, input.threadId);
  if (!resolution.ok) {
    return { status: "error", ...base, error: resolution.error.message };
  }

  const info = workspaceInfoFor(input.workspaceRoot);
  const profiles = await listAgentProfilesInWorkspace(info);
  if (!profiles.some((profile) => profile.id === input.mention)) {
    return {
      status: "error",
      ...base,
      error: `Profile not found: ${input.mention}.`
    };
  }

  const threadId = resolution.threadId;
  const governed = governedConfigOf(input, info, threadId);
  const run = await runWait(input, info, threadId, governed, signal);
  return { ...base, threadId, ...run.outcome, sessionLock: run.sessionLock };
}

/** The governed port's configuration. One run id per execution: a re-arm is a new delivery. */
function governedConfigOf(
  input: WaitInput,
  info: { id: string; rootPath: string },
  threadId: string
): GovernedConfig {
  return {
    workspaceRoot: info.rootPath,
    workspaceId: info.id,
    threadId,
    mention: input.mention,
    holder: input.sessionId,
    runId: randomUUID(),
    dataDir: input.dataDir,
    daemonUrl: input.daemonUrl,
    env: process.env
  };
}

async function runWait(
  input: WaitInput,
  info: ReturnType<typeof workspaceInfoFor>,
  threadId: string,
  governed: GovernedConfig,
  signal: AbortSignal
): Promise<{
  outcome: WaitOutcome | { status: "already_waiting" };
  sessionLock: SessionLock;
}> {
  const waitOptions: WaitOptions = {
    afterMessageId: input.afterMessageId,
    mention: input.mention,
    maxChain: input.maxChain,
    timeoutMs: input.timeoutMinutes * 60_000,
    pollMs: POLL_MS,
    signal
  };
  const port = lazyGovernedPort(governed);
  const loop = async (): Promise<WaitOutcome> =>
    waitForMention(waitOptions, {
      ...(await createWaitRuntimeDeps(info, threadId)),
      reservations: port
    });

  if (input.sessionId === undefined) {
    return { outcome: await loop(), sessionLock: "unavailable" };
  }
  const attempt = await tryWithWorkspaceWriteLock(
    info.marcPath,
    `wait:${threadId}:${input.sessionId}`,
    loop,
    { staleAfterMs: LOCK_STALE_MS }
  );
  if (!attempt.acquired) {
    return { outcome: { status: "already_waiting" }, sessionLock: "busy" };
  }
  return { outcome: attempt.value, sessionLock: "held" };
}

/**
 * The governed port loads the daemon client only when a governed tick needs it, so a manual
 * wait never imports the daemon modules.
 */
function lazyGovernedPort(config: GovernedConfig): ReservationPort {
  let port: Promise<ReservationPort> | undefined;
  const load = (): Promise<ReservationPort> => {
    port ??= import("./cli-wait-governed.js").then((module) =>
      module.createGovernedPort(config)
    );
    return port;
  };
  return {
    check: async () => (await load()).check(),
    reserve: async (messageIds) => (await load()).reserve(messageIds)
  };
}

function toOutputLine(result: WaitResult, at: Date): string {
  const threadReference =
    result.threadId === undefined ? undefined : `marc://$${result.threadId}`;
  return JSON.stringify({
    status: result.status,
    exitCode: EXIT_CODES[result.status],
    threadId: result.threadId,
    threadReference,
    mention: result.mention,
    afterMessageId: result.afterMessageId,
    messageIds: result.messageIds,
    authors: result.authors,
    chain: result.chain,
    ...reservationListsOf(result.reservations),
    sessionLock: result.sessionLock,
    error: result.error,
    at: at.toISOString(),
    next: NEXT_STEP[result.status](
      result,
      threadReference ?? "the requested thread"
    )
  });
}

function errorResult(error: unknown): WaitResult {
  const message = error instanceof Error ? error.message : String(error);
  return { status: "error", error: message };
}

function textOption(values: WaitValues, key: string): string | undefined {
  const value = values[key];
  if (value === true) throw new Error(`--${key} needs a value.`);
  return typeof value === "string" ? value : undefined;
}

function requiredOption(values: WaitValues, key: string): string {
  const value = textOption(values, key);
  if (!value) throw new Error(`--${key} is required.`);
  return value;
}

function integerOption(
  values: WaitValues,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = textOption(values, key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${key} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function listenForStopSignals(controller: AbortController): () => void {
  const stop = (): void => controller.abort();
  STOP_SIGNALS.forEach((signal) => process.on(signal, stop));
  return () => STOP_SIGNALS.forEach((signal) => process.off(signal, stop));
}
