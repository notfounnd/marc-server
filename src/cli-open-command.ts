import fs from "node:fs/promises";
import {
  buildAgentLaunch,
  promptFor,
  type AgentLaunch
} from "./core/agent-launch.js";
import { listAgentProfilesInWorkspace } from "./core/agents.js";
import { parseMessages } from "./core/markdown.js";
import {
  resolveThreadId,
  type ThreadResolution
} from "./core/thread-resolution.js";
import { inspectThreadFiles } from "./core/thread-summary-paths.js";
import { workspaceInfoFor } from "./core/thread-wait-runtime.js";
import type {
  AgentProfileSummary,
  ChatMessage,
  WorkspaceInfo
} from "./core/types.js";
import { parseOpenInput, type OpenValues } from "./cli-open-input.js";
import { requireProfile } from "./cli-open-profile.js";
import {
  connectDaemon,
  productionDaemonFiles,
  type DaemonFiles
} from "./cli-open-discovery.js";
import {
  failureOutcome,
  guard,
  OpenError,
  refusalStatus,
  stderrLineOf,
  toOutputLine,
  type OpenOutcome
} from "./cli-open-output.js";
import {
  blocksContinuity,
  createDaemonClient,
  endOutcome,
  planDryRun,
  refusalReason,
  runOwnedClient,
  spawnLaunch,
  type AcquireRequest,
  type DaemonAccess,
  type DaemonClient,
  type LaunchedChild,
  type SessionSignals,
  type SessionTimers
} from "./cli-open-session.js";

/**
 * `marc open`: acquires the slot through the daemon, runs the Claude Code client with stdio
 * inherited, renews the ownership while it runs, and releases it when the client ends. Its
 * outcomes are one JSON line each (see cli-open-output.ts); a client that ran writes its own.
 */

export type OpenOutput = {
  print: (line: string) => void;
  writeWarning: (line: string) => void;
};

export type ThreadState = { messages: ChatMessage[]; closed: boolean };

export type OpenWorkspace = {
  resolveThread: (
    workspaceRoot: string,
    requested: string
  ) => Promise<ThreadResolution>;
  profiles: (info: WorkspaceInfo) => Promise<AgentProfileSummary[]>;
  thread: (info: WorkspaceInfo, threadId: string) => Promise<ThreadState>;
};

/** Every effect of marc open. Production wires the real ones; tests inject fakes. */
export type OpenDeps = {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  now: () => string;
  daemonFiles: DaemonFiles;
  createClient: (access: DaemonAccess) => DaemonClient;
  spawn: (launch: AgentLaunch) => LaunchedChild;
  timers: SessionTimers;
  signals: SessionSignals;
  workspace: OpenWorkspace;
};

/** What marc open has learned so far. A failure reports it, so the output names the slot. */
type Context = Pick<
  OpenOutcome,
  "threadId" | "profile" | "slotState" | "dataDir"
>;

type SlotRead = { state: string; generation: number };

type Grant = {
  mode: "new" | "resume";
  nativeSessionId: string;
  generation: number;
  ownerToken: string;
};

type GrantBody = Partial<Grant> & { decision?: string };

type SlotBody = {
  profile: string;
  state: string;
  binding: { generation: number } | null;
};

export async function runOpenCommand(
  values: OpenValues,
  output: OpenOutput,
  deps: OpenDeps = productionOpenDeps()
): Promise<number> {
  const context: Context = {};
  const outcome = await executeOpen(values, output, deps, context).catch(
    failureOutcome
  );
  if (outcome.status !== "ended") {
    output.print(toOutputLine({ ...context, ...outcome }, deps.now()));
  }
  warnRefusal({ ...context, ...outcome }, output);
  return outcome.exitCode;
}

/** A refusal the person must act on also names itself on stderr, in one line. */
function warnRefusal(outcome: OpenOutcome, output: OpenOutput): void {
  const warning = stderrLineOf(outcome);
  if (warning !== undefined) output.writeWarning(warning);
}

export function productionOpenDeps(): OpenDeps {
  return {
    env: process.env,
    platform: process.platform,
    now: () => new Date().toISOString(),
    daemonFiles: productionDaemonFiles,
    createClient: (access) => createDaemonClient(access),
    spawn: spawnLaunch,
    timers: {
      setInterval: (callback, ms) => setInterval(callback, ms),
      clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout)
    },
    signals: {
      on: (signal, listener) => {
        process.on(signal, listener);
      },
      off: (signal, listener) => {
        process.off(signal, listener);
      }
    },
    workspace: {
      resolveThread: (workspaceRoot, requested) =>
        resolveThreadId(workspaceRoot, requested),
      profiles: (info) => listAgentProfilesInWorkspace(info),
      thread: readThreadState
    }
  };
}

async function executeOpen(
  values: OpenValues,
  output: OpenOutput,
  deps: OpenDeps,
  context: Context
): Promise<OpenOutcome> {
  const input = parseOpenInput(values, deps.env, deps.daemonFiles);
  context.profile = input.profile;
  context.dataDir = input.dataDir;
  const info = workspaceInfoFor(input.workspaceRoot);
  const threadId = await resolveThread(deps, input);
  context.threadId = threadId;
  await requireProfile(deps.workspace.profiles, info, input.profile);
  const thread = await guard(
    () => deps.workspace.thread(info, threadId),
    "input_error",
    "thread_read_failed"
  );
  if (thread.closed) throw new OpenError("thread_closed", "thread_closed");

  const client = await connectDaemon(
    { explicitUrl: input.daemonUrl, dataDir: input.dataDir, env: deps.env },
    deps.daemonFiles,
    deps.createClient
  );
  const slot = await readSlot(client, info.id, threadId, input.profile);
  context.slotState = slot.state;
  if (blocksContinuity(slot.state, thread.messages, input)) {
    throw new OpenError("continuity_unknown", "profile_posted_without_binding");
  }
  if (input.dryRun) {
    return planDryRun(input, threadId, slot.state, deps.env, deps.platform);
  }

  const grant = await acquire(client, {
    workspaceId: info.id,
    threadId,
    profile: input.profile,
    expectedGeneration: slot.generation
  });
  const launch = buildAgentLaunch({
    client: "claude-code",
    mode: grant.mode,
    sessionId: grant.nativeSessionId,
    prompt: promptFor(grant.mode, threadId, input.profile),
    workspaceRoot: input.workspaceRoot,
    toolShell: input.toolShell,
    baseEnv: deps.env,
    platform: deps.platform
  });
  const end = await runOwnedClient(
    launch,
    {
      workspaceId: info.id,
      threadId,
      profile: input.profile,
      generation: grant.generation,
      ownerToken: grant.ownerToken
    },
    {
      client,
      spawn: deps.spawn,
      timers: deps.timers,
      signals: deps.signals,
      writeWarning: output.writeWarning
    }
  );
  return endOutcome(end);
}

async function resolveThread(
  deps: OpenDeps,
  input: { workspaceRoot: string; requestedThread: string }
): Promise<string> {
  const resolution = await guard(
    () =>
      deps.workspace.resolveThread(input.workspaceRoot, input.requestedThread),
    "input_error",
    "thread_resolution_failed"
  );
  if (!resolution.ok) throw new OpenError("input_error", resolution.error.code);
  return resolution.threadId;
}

async function readSlot(
  client: DaemonClient,
  workspaceId: string,
  threadId: string,
  profile: string
): Promise<SlotRead> {
  const reply = await guard(
    () => client.sessions(workspaceId, threadId),
    "daemon_unavailable",
    "daemon_unreachable"
  );
  if (reply.status === 404) {
    throw new OpenError("input_error", "workspace_not_registered");
  }
  if (reply.status !== 200) {
    throw new OpenError("daemon_unavailable", "daemon_error");
  }
  const slot = slotsOf(reply.body).find(
    (candidate) => candidate.profile === profile
  );
  if (!slot) throw new OpenError("input_error", "profile_unknown");
  return { state: slot.state, generation: slot.binding?.generation ?? 0 };
}

/** A 409 refusal maps to a status through the refusal table; anything else is a daemon error. */
async function acquire(
  client: DaemonClient,
  body: AcquireRequest
): Promise<Grant> {
  const reply = await guard(
    () => client.acquire(body),
    "daemon_unavailable",
    "daemon_unreachable"
  );
  if (reply.status === 200) return grantOf(reply.body);
  if (reply.status === 409) {
    const reason = refusalReason(reply.body);
    throw new OpenError(refusalStatus(reason), reason);
  }
  throw grantError();
}

function grantOf(body: unknown): Grant {
  const grant = body as GrantBody | undefined;
  if (grant?.decision !== "acquired") throw grantError();
  if (grant.mode !== "new" && grant.mode !== "resume") throw grantError();
  if (typeof grant.nativeSessionId !== "string") throw grantError();
  if (typeof grant.ownerToken !== "string") throw grantError();
  if (typeof grant.generation !== "number") throw grantError();
  return {
    mode: grant.mode,
    nativeSessionId: grant.nativeSessionId,
    generation: grant.generation,
    ownerToken: grant.ownerToken
  };
}

function grantError(): OpenError {
  return new OpenError("daemon_unavailable", "daemon_error");
}

function slotsOf(body: unknown): SlotBody[] {
  const slots = (body as { slots?: unknown } | undefined)?.slots;
  return Array.isArray(slots) ? (slots as SlotBody[]) : [];
}

async function readThreadState(
  info: WorkspaceInfo,
  threadId: string
): Promise<ThreadState> {
  const files = await inspectThreadFiles(info, threadId);
  return {
    messages: parseMessages(await fs.readFile(files.chatPath, "utf8")),
    closed: await fs.stat(files.summaryPath).then(
      () => true,
      () => false
    )
  };
}
