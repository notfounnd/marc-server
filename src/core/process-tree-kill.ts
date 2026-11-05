/**
 * Plan for stopping the process tree of a turn that the supervisor started. The module only plans:
 * the executor runs the plan, and it first confirms the PID and the start time of the process it
 * launched. A session that a human opened is never planned here.
 */

export type TreeKillPlan =
  | {
      platform: "win32";
      command: "taskkill";
      args: readonly string[];
    }
  | {
      platform: "posix";
      signal: "SIGKILL";
      /** The turn's process group, which is its own PID because the launch starts it detached. */
      processGroup: number;
    };

export type TreeKillResult =
  | { status: "planned"; plan: TreeKillPlan }
  | { status: "refused"; reason: "invalid_pid" };

export type TurnSpawnOptions = {
  /** POSIX starts the turn in its own process group, so the group can be killed as a unit. */
  detached: boolean;
  windowsHide: true;
  shell: false;
  stdio: ["ignore", "pipe", "pipe"];
};

type PlatformFamily = "win32" | "posix";

const PLANNERS: Record<PlatformFamily, (pid: number) => TreeKillPlan> = {
  win32: (pid) => ({
    platform: "win32",
    command: "taskkill",
    args: ["/T", "/F", "/PID", String(pid)]
  }),
  posix: (pid) => ({
    platform: "posix",
    signal: "SIGKILL",
    processGroup: pid
  })
};

/** The plan that stops the tree of the process with this PID on this platform. */
export function treeKillFor(
  pid: number,
  platform: NodeJS.Platform
): TreeKillResult {
  if (!isStoppablePid(pid)) return { status: "refused", reason: "invalid_pid" };
  return { status: "planned", plan: PLANNERS[familyOf(platform)](pid) };
}

/** The options the launch passes to spawn, so that the tree can be killed by the plan above. */
export function turnSpawnOptionsFor(
  platform: NodeJS.Platform
): TurnSpawnOptions {
  return {
    detached: familyOf(platform) === "posix",
    windowsHide: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  };
}

/** PID 0 and PID 1 are never a turn, so a plan never targets them. */
function isStoppablePid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 1;
}

function familyOf(platform: NodeJS.Platform): PlatformFamily {
  if (platform === "win32") return "win32";
  return "posix";
}
