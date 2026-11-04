import { spawn } from "node:child_process";
import {
  buildAgentLaunch,
  envChanges,
  promptFor,
  type AgentLaunch,
  type LaunchMode
} from "./core/agent-launch.js";
import type { ChatMessage } from "./core/types.js";
import type { OpenInput } from "./cli-open-input.js";
import {
  spawnReason,
  statusOutcome,
  type OpenOutcome
} from "./cli-open-output.js";

/**
 * The owner side of `marc open`: the daemon HTTP calls, the launch plan, the child client with
 * its heartbeat, and the release. The owner token only travels in request bodies and the
 * authorization header of this module. Nothing here writes the token to a message or an error.
 */

export const HEARTBEAT_MS = 15_000;

const STOP_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

export type DaemonAccess = { baseUrl: string; token: string };

export type DaemonReply = { status: number; body: unknown };

export type AcquireRequest = {
  workspaceId: string;
  threadId: string;
  profile: string;
  expectedGeneration: number;
};

export type OwnerRef = {
  workspaceId: string;
  threadId: string;
  profile: string;
  generation: number;
  ownerToken: string;
};

export type DaemonClient = {
  /** GET /api/status. It needs the token, so its answer proves that the token is accepted. */
  status(): Promise<DaemonReply>;
  sessions(workspaceId: string, threadId: string): Promise<DaemonReply>;
  acquire(body: AcquireRequest): Promise<DaemonReply>;
  heartbeat(body: OwnerRef & { clientPid?: number }): Promise<DaemonReply>;
  release(body: OwnerRef): Promise<DaemonReply>;
};

/** The child process as this module needs it. The production adapter wraps Node's ChildProcess. */
export type LaunchedChild = {
  readonly pid: number | undefined;
  onSpawn(listener: () => void): void;
  onExit(listener: (code: number | null) => void): void;
  onError(listener: (error: NodeJS.ErrnoException) => void): void;
};

export type SessionTimers = {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

export type SessionSignals = {
  on(signal: NodeJS.Signals, listener: () => void): void;
  off(signal: NodeJS.Signals, listener: () => void): void;
};

export type SessionDeps = {
  client: DaemonClient;
  spawn: (launch: AgentLaunch) => LaunchedChild;
  timers: SessionTimers;
  signals: SessionSignals;
  writeWarning: (line: string) => void;
};

export type ClientEnd =
  | { kind: "exited"; exitCode: number }
  | { kind: "spawn_failed"; code: string | undefined };

/**
 * Starts the client after acquire, renews the ownership while it runs, and releases it when the
 * client ends or fails to start. Stop signals are ignored so the client owns Ctrl+C.
 */
export async function runOwnedClient(
  launch: AgentLaunch,
  owner: OwnerRef,
  deps: SessionDeps
): Promise<ClientEnd> {
  const restoreSignals = ignoreStopSignals(deps.signals);
  const child = deps.spawn(launch);
  const beat = startHeartbeat(child, owner, deps);
  const end = await childEnd(child);
  await beat.stop();
  await releaseOwner(owner, deps);
  restoreSignals();
  return end;
}

/** Production adapter: the client inherits stdio, and no shell is involved. */
export function spawnLaunch(launch: AgentLaunch): LaunchedChild {
  const child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: "inherit",
    shell: false
  });
  return {
    get pid() {
      return child.pid;
    },
    onSpawn: (listener) => {
      child.once("spawn", listener);
    },
    onExit: (listener) => {
      child.once("exit", (code) => listener(code));
    },
    onError: (listener) => {
      child.once("error", listener);
    }
  };
}

/** One function per daemon route. The token is only sent as a bearer header. */
export function createDaemonClient(
  access: DaemonAccess,
  fetcher: typeof fetch = fetch
): DaemonClient {
  const call = async (
    method: string,
    route: string,
    body?: unknown
  ): Promise<DaemonReply> => {
    const response = await fetcher(new URL(route, access.baseUrl), {
      method,
      headers: {
        authorization: `Bearer ${access.token}`,
        "content-type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: parseJson(await response.text()) };
  };
  return {
    status: () => call("GET", "/api/status"),
    sessions: (workspaceId, threadId) =>
      call(
        "GET",
        `/api/workspaces/${encodeURIComponent(workspaceId)}/threads/${encodeURIComponent(threadId)}/sessions`
      ),
    acquire: (body) => call("POST", "/api/sessions/acquire", body),
    heartbeat: (body) => call("POST", "/api/sessions/heartbeat", body),
    release: (body) => call("POST", "/api/sessions/release", body)
  };
}

/** The refusal reason of a 409 owner reply, for a warning line. It never carries the token. */
export function refusalReason(body: unknown): string {
  if (typeof body !== "object" || body === null) return "unknown";
  const reason = (body as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : "unknown";
}

type Beat = { stop: () => Promise<void> };

/**
 * Renews the ownership right after the client starts, then every 15 seconds. A 409 stops the
 * renewals and leaves the client running. stop waits for a renewal still in flight, so it
 * cannot reach the daemon after the release.
 */
function startHeartbeat(
  child: LaunchedChild,
  owner: OwnerRef,
  deps: SessionDeps
): Beat {
  let handle: unknown;
  let stopped = false;
  let warned = false;
  let pending: Promise<void> = Promise.resolve();

  const halt = (): void => {
    stopped = true;
    if (handle !== undefined) deps.timers.clearInterval(handle);
  };
  const renew = async (): Promise<void> => {
    const reply = await sendHeartbeat(child, owner, deps);
    if (reply?.status === 200) return;
    if (reply?.status === 409) {
      halt();
      deps.writeWarning(
        `marc open: the daemon refused the heartbeat (${refusalReason(reply.body)}). The client keeps running, but its ownership is no longer renewed.`
      );
      return;
    }
    if (warned) return;
    warned = true;
    deps.writeWarning(
      "marc open: a heartbeat did not reach the daemon. The client keeps running and marc open keeps trying every 15 seconds."
    );
  };
  const beat = (): void => {
    if (stopped) return;
    pending = renew();
  };
  child.onSpawn(() => {
    if (stopped) return;
    handle = deps.timers.setInterval(beat, HEARTBEAT_MS);
    beat();
  });
  return {
    stop: async () => {
      halt();
      await pending;
    }
  };
}

async function sendHeartbeat(
  child: LaunchedChild,
  owner: OwnerRef,
  deps: SessionDeps
): Promise<DaemonReply | undefined> {
  try {
    return await deps.client.heartbeat({ ...owner, clientPid: child.pid });
  } catch {
    return undefined;
  }
}

function childEnd(child: LaunchedChild): Promise<ClientEnd> {
  return new Promise((resolve) => {
    child.onExit((code) => resolve({ kind: "exited", exitCode: code ?? 0 }));
    child.onError((error) =>
      resolve({ kind: "spawn_failed", code: error.code })
    );
  });
}

async function releaseOwner(owner: OwnerRef, deps: SessionDeps): Promise<void> {
  try {
    const reply = await deps.client.release(owner);
    if (reply.status === 200) return;
    deps.writeWarning(
      `marc open: the daemon did not confirm the release (${refusalReason(reply.body)}).`
    );
  } catch {
    deps.writeWarning("marc open: the release did not reach the daemon.");
  }
}

function ignoreStopSignals(signals: SessionSignals): () => void {
  const ignore = (): void => undefined;
  STOP_SIGNALS.forEach((signal) => signals.on(signal, ignore));
  return () => STOP_SIGNALS.forEach((signal) => signals.off(signal, ignore));
}

/** The launch a dry run shows. The session ID is a placeholder, because only the daemon assigns it. */
export function planDryRun(
  input: OpenInput,
  threadId: string,
  state: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): OpenOutcome {
  const mode: LaunchMode = state === "unbound" ? "new" : "resume";
  const launch = buildAgentLaunch({
    client: "claude-code",
    mode,
    sessionId: "<session-id>",
    prompt: promptFor(mode, threadId, input.profile),
    workspaceRoot: input.workspaceRoot,
    toolShell: input.toolShell,
    baseEnv: env,
    platform
  });
  return {
    status: "dry_run",
    exitCode: 0,
    launch: {
      command: launch.command,
      args: launch.args,
      cwd: launch.cwd,
      env: envChanges({ baseEnv: env, toolShell: input.toolShell, platform })
    }
  };
}

/** A profile that has posted in an unbound thread may have lost its binding with the registry. */
export function blocksContinuity(
  state: string,
  messages: ChatMessage[],
  input: OpenInput
): boolean {
  if (input.newSession || state !== "unbound") return false;
  return messages.some((message) => message.agentId === input.profile);
}

export function endOutcome(end: ClientEnd): OpenOutcome {
  if (end.kind === "exited") {
    return { status: "ended", exitCode: end.exitCode };
  }
  return statusOutcome("spawn_error", spawnReason(end.code));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
