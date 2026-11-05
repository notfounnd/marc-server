import {
  spawn,
  type ChildProcess,
  type SpawnOptions
} from "node:child_process";
import type { AgentLaunch } from "../core/agent-launch.js";
import {
  turnSpawnOptionsFor,
  type TreeKillPlan
} from "../core/process-tree-kill.js";

/** The spawn the turn uses. Tests inject a fake one; the default is the platform's spawn, without a shell. */
export type SpawnPort = (
  command: string,
  args: readonly string[],
  options: SpawnOptions
) => ChildProcess;

/** A timer handle, opaque to the runner. */
export type TimerHandle = unknown;

/** The ports the supervised turns read the clock, the timers and the spawn from. Injected for tests. */
export type TurnPorts = {
  spawn: SpawnPort;
  now: () => number;
  setTimer: (fire: () => void, ms: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  heartbeatMs: number;
};

/** The owner heartbeat, as the session routes use for an open session. */
export const HEARTBEAT_MS = 15_000;
/** The most output of one stream the executor keeps. A longer stream is cut and marked. */
export const OUTPUT_LIMIT = 1024 * 1024;
const TRUNCATED_MARK = "\n[output truncated]";

export const DEFAULT_TURN_PORTS: TurnPorts = {
  spawn: (command, args, options) => spawn(command, args, options),
  now: () => Date.now(),
  setTimer: (fire, ms) => setTimeout(fire, ms).unref(),
  clearTimer: (handle) => clearTimeout(handle as NodeJS.Timeout),
  heartbeatMs: HEARTBEAT_MS
};

/** What a turn wrote and how it ended. A spawn that never started has no exit code and an error code. */
export type RawOutput = {
  exitCode: number | undefined;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  spawnError?: string;
};

export type LaunchedTurn = {
  child: ChildProcess;
  /** Resolves with the pid once the process has spawned, or undefined when it could not start. */
  spawned: Promise<number | undefined>;
  /** Resolves once the process has ended, with what it wrote. */
  finished: Promise<RawOutput>;
};

/** Starts one headless turn with the launch the adapter built. Nothing is passed to a shell. */
export function launchTurn(
  ports: TurnPorts,
  launch: AgentLaunch,
  platform: NodeJS.Platform
): LaunchedTurn {
  const child = ports.spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    ...turnSpawnOptionsFor(platform)
  });
  return {
    child,
    spawned: spawnedOf(child),
    finished: finishedOf(child)
  };
}

function spawnedOf(child: ChildProcess): Promise<number | undefined> {
  return new Promise((resolve) => {
    child.once("spawn", () => resolve(child.pid));
    child.once("error", () => resolve(undefined));
  });
}

function finishedOf(child: ChildProcess): Promise<RawOutput> {
  const stdout = new Capture();
  const stderr = new Capture();
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => stdout.add(chunk));
  child.stderr?.on("data", (chunk: string) => stderr.add(chunk));
  return new Promise((resolve) => {
    const finish = (raw: Partial<RawOutput>) =>
      resolve({
        exitCode: raw.exitCode,
        signal: raw.signal ?? null,
        stdout: stdout.text,
        stderr: stderr.text,
        spawnError: raw.spawnError
      });
    child.once("error", (error: NodeJS.ErrnoException) =>
      finish({ spawnError: error.code ?? "error" })
    );
    child.once("close", (exitCode, signal) =>
      finish({ exitCode: exitCode ?? undefined, signal })
    );
  });
}

/** Keeps at most OUTPUT_LIMIT characters of one stream. Later chunks are dropped once it is full. */
class Capture {
  text = "";
  private full = false;

  add(chunk: string): void {
    if (this.full) return;
    const room = OUTPUT_LIMIT - this.text.length;
    if (chunk.length <= room) {
      this.text += chunk;
      return;
    }
    this.text += chunk.slice(0, room) + TRUNCATED_MARK;
    this.full = true;
  }
}

/** True when the handle still is the process with this pid: it has not exited, so the pid cannot be reused. */
export function isSameProcess(child: ChildProcess, pid: number): boolean {
  return (
    child.pid === pid && child.exitCode === null && child.signalCode === null
  );
}

/** The executor of each plan family. A plan names its family, so the table always matches. */
const KILLERS: Record<TreeKillPlan["platform"], (plan: TreeKillPlan) => void> =
  {
    win32: (plan) => {
      if (plan.platform !== "win32") return;
      spawn(plan.command, plan.args, {
        shell: false,
        windowsHide: true,
        stdio: "ignore"
      }).on("error", () => undefined);
    },
    posix: (plan) => {
      if (plan.platform !== "posix") return;
      process.kill(-plan.processGroup, plan.signal);
    }
  };

/** Runs a tree-kill plan. A group that is already gone is not an error. */
export function killTree(plan: TreeKillPlan): void {
  try {
    KILLERS[plan.platform](plan);
  } catch {
    return;
  }
}
