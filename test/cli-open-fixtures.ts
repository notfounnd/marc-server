import assert from "node:assert/strict";
import path from "node:path";
import type { AgentLaunch } from "../src/core/agent-launch.js";
import type { ThreadResolution } from "../src/core/thread-resolution.js";
import { workspaceInfoFor } from "../src/core/thread-wait-runtime.js";
import type { ChatMessage } from "../src/core/types.js";
import type {
  OpenDeps,
  OpenOutput,
  OpenWorkspace
} from "../src/cli-open-command.js";
import type { DaemonAccess, DaemonReply } from "../src/cli-open-session.js";
import type { DaemonRuntime } from "../src/cli-open-discovery.js";
import {
  FakeChild,
  FakeClient,
  FakeSignals,
  FakeTimers,
  fakeClient
} from "./cli-open-doubles.js";

export {
  FakeChild,
  FakeSignals,
  FakeTimers,
  RELEASED,
  RENEWED,
  fakeClient,
  refused,
  unreachableClient,
  type Call,
  type ClientReplies,
  type FakeClient
} from "./cli-open-doubles.js";

/** Shared fixtures for marc open. Nothing here starts a real client or touches the network. */

export const DAEMON_TOKEN = "daemon-secret-token";
export const OWNER_TOKEN = "owner-secret-token";
export const SESSION = "55555555-5555-4555-8555-555555555555";
export const THREAD = "open-thread";
export const PROFILE = "claude-dev";
export const ARCHITECT = "claude-software-architect";
export const CODEX = "codex-software-architect";
export const ROOT = "marc-open-workspace";
export const WORKSPACE_ID = workspaceInfoFor(ROOT).id;
export const DATA_DIR = "marc-open-daemon";
export const PID = 4321;
export const PROMPT_PREFIX = "You are the mARC profile claude-dev.";

/** The token file the foreground daemon writes into its data directory, as discovery reads it. */
export const TOKEN_FILE = path.join(path.resolve(DATA_DIR), "token");

export const VALUES = {
  thread: THREAD,
  profile: PROFILE,
  workspace: ROOT,
  "data-dir": DATA_DIR
};

export function acquired(
  mode: "new" | "resume",
  generation: number
): DaemonReply {
  return {
    status: 200,
    body: {
      decision: "acquired",
      mode,
      nativeSessionId: SESSION,
      generation,
      ownerToken: OWNER_TOKEN
    }
  };
}

type SlotFixture = { profile: string; state: string; binding: object | null };

/** The GET view: one slot per non-user profile, shaped as the daemon returns it. */
export function sessionsReply(slot: SlotFixture): DaemonReply {
  const other = { profile: ARCHITECT, state: "unbound", binding: null };
  return {
    status: 200,
    body: { registry: { status: "ready" }, slots: [slot, other], warnings: [] }
  };
}

/** The GET view of a slot that has never been bound. */
export function unbound(): DaemonReply {
  return sessionsReply({ profile: PROFILE, state: "unbound", binding: null });
}

/** A chat message posted by the given profile in the fixture thread. */
export function postedBy(agentId: string): ChatMessage {
  return {
    id: "msg_1",
    threadId: THREAD,
    timestamp: "2026-11-04T11:00:00.000Z",
    agentId,
    body: "Earlier message",
    artifacts: []
  };
}

export type WorkspaceOptions = {
  resolution?: ThreadResolution;
  closed?: boolean;
  messages?: ChatMessage[];
};

/**
 * Resolves the thread, lists four profiles (a user, and a Codex profile that no client supports),
 * and reads the thread. Each profile carries its Model, which decides the client.
 */
export function fakeWorkspace(options: WorkspaceOptions = {}): OpenWorkspace {
  return {
    resolveThread: async () =>
      options.resolution ?? { ok: true, threadId: THREAD },
    profiles: async () => [
      { id: PROFILE, role: "developer", model: "claude-haiku-5-5" },
      { id: ARCHITECT, role: "architect", model: "claude-opus-5-5" },
      { id: CODEX, role: "architect", model: "gpt-6.1-sol" },
      { id: "ui-user", role: "user", model: "human" }
    ],
    thread: async () => ({
      messages: options.messages ?? [],
      closed: options.closed ?? false
    })
  };
}

export type Harness = {
  deps: OpenDeps;
  client: FakeClient;
  child: FakeChild;
  timers: FakeTimers;
  signals: FakeSignals;
  launches: AgentLaunch[];
  /** The data directories discovery read the runtime state of, in order. */
  accessDirs: string[];
  /** The access each created client was given: URL and token. Tests check it; output never shows it. */
  accesses: DaemonAccess[];
  lines: string[];
  warnings: string[];
  output: OpenOutput;
};

export type HarnessOptions = {
  client?: FakeClient;
  child?: FakeChild;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  workspace?: OpenWorkspace;
  readRuntime?: (dataDir: string) => Promise<DaemonRuntime | undefined>;
  files?: Record<string, string>;
  /** The directories that exist on disk, as the default data directory check sees them. */
  directories?: string[];
};

export function harness({
  client = fakeClient({
    sessions: sessionsReply({
      profile: PROFILE,
      state: "unbound",
      binding: null
    }),
    acquire: acquired("new", 1)
  }),
  child = new FakeChild(PID),
  env = {
    PATH: "/usr/bin",
    CLAUDE_CODE_SESSION_ID: "stale-session",
    CLAUDECODE: "1"
  },
  platform = "linux",
  workspace = fakeWorkspace(),
  readRuntime = async () => undefined,
  files = { [TOKEN_FILE]: DAEMON_TOKEN },
  directories = []
}: HarnessOptions = {}): Harness {
  const timers = new FakeTimers();
  const signals = new FakeSignals();
  const launches: AgentLaunch[] = [];
  const accessDirs: string[] = [];
  const accesses: DaemonAccess[] = [];
  const lines: string[] = [];
  const warnings: string[] = [];
  const deps: OpenDeps = {
    env,
    platform,
    now: () => "2026-11-04T12:00:00.000Z",
    daemonFiles: {
      readRuntime: async (dataDir) => {
        accessDirs.push(dataDir);
        return readRuntime(dataDir);
      },
      readText: async (filePath) => files[filePath],
      dirExists: (dirPath) => directories.includes(dirPath)
    },
    createClient: (access) => {
      accesses.push(access);
      return client;
    },
    spawn: (launch) => {
      launches.push(launch);
      return child;
    },
    timers,
    signals,
    workspace
  };
  return {
    deps,
    client,
    child,
    timers,
    signals,
    launches,
    accessDirs,
    accesses,
    lines,
    warnings,
    output: {
      print: (line) => lines.push(line),
      writeWarning: (line) => warnings.push(line)
    }
  };
}

/** Lets every queued promise and immediate run, so the command reaches its next await. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function outputJson(lines: string[]): Record<string, unknown> {
  assert.equal(lines.length, 1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

/** Asserts that no line, warning or launch argument carries a token. */
export function assertNoSecret(h: Harness): void {
  const everything = [
    ...h.lines,
    ...h.warnings,
    ...h.launches.flatMap((launch) => [
      ...launch.args,
      JSON.stringify(launch.env)
    ])
  ].join("\n");
  assert.equal(everything.includes(DAEMON_TOKEN), false);
  assert.equal(everything.includes(OWNER_TOKEN), false);
}

export function resolvedRoot(): string {
  return path.resolve(ROOT);
}
