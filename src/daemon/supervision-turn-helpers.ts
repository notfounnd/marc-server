import type { ChildProcess } from "node:child_process";
import type { SupervisionRecord } from "../core/activation-supervision-types.js";
import type { RunOutcome } from "../core/client-adapters.js";
import type { AdoptedRun } from "./supervision-adopted-run.js";
import type { PermissionTarget } from "./supervision-runner.js";
import type { SessionServices } from "./session-views.js";
import { runningIn, type ProcessMark } from "./supervision-turn-finish.js";
import type { RawOutput, TimerHandle } from "./supervision-turn-process.js";
import type {
  LaunchPlan,
  StepStatus,
  TurnHost,
  TurnScope
} from "./supervision-turn-steps.js";

/** A turn that is running: its process, its deadline and the timers that watch it. */
export type ActiveRun = {
  scope: TurnScope;
  record: SupervisionRecord;
  plan: LaunchPlan;
  child: ChildProcess;
  pid: number;
  deadline: number;
  timers: TimerHandle[];
  clientStartedAt: number | undefined;
  timedOut: boolean;
  lostOwner: boolean;
  silent: boolean;
  stopped: boolean;
};

/**
 * The running write of a turn. A write that throws is reported as invalid, so the turn ends as an error
 * instead of leaving its card in starting.
 */
export async function runningOf(
  host: TurnHost,
  scope: TurnScope,
  record: SupervisionRecord,
  pid: number,
  process: ProcessMark
): Promise<StepStatus> {
  try {
    return await runningIn(host, scope, record, pid, process);
  } catch {
    return "invalid";
  }
}

/** The start instant the agents source lists for a pid, in epoch milliseconds, or undefined when it lists none. */
export async function listedStartOf(
  presence: SessionServices["presence"],
  pid: number
): Promise<number | undefined> {
  const agents = await presence.agents();
  if (agents.status !== "available") return undefined;
  return agents.processes.find((candidate) => candidate.pid === pid)?.startedAt;
}

/** The ISO text of an epoch-millisecond instant, or undefined when there is none. */
export function isoOf(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined;
  return new Date(ms).toISOString();
}

/**
 * The headless prompt carries the recipient's own last message as its cursor, so a turn reads only what
 * came after it; with no own message, the turn reads the whole thread. A continuation asks for the
 * continue prompt, which is the same for every turn.
 */
export function promptOf(plan: LaunchPlan, deadline: string): string {
  if (plan.continuation) return plan.adapter.continuePrompt();
  return plan.adapter.headlessPrompt({
    threadId: plan.threadId,
    profile: plan.recipient,
    messageId: plan.messageId,
    author: plan.author,
    deadline,
    cursor: plan.cursor
  });
}

/** What the executor saw of the process: a timeout and a kill by a signal are told apart, and a spawn error names a missing client. */
export function runOutcomeOf(
  raw: RawOutput,
  plan: LaunchPlan,
  active: ActiveRun | undefined
): RunOutcome {
  return {
    timedOut: active?.timedOut ?? false,
    crashed:
      raw.signal !== null &&
      !(active?.timedOut ?? false) &&
      !(active?.lostOwner ?? false),
    missingClient: raw.spawnError === "ENOENT",
    exitCode: raw.exitCode,
    parsed: plan.adapter.parseResult(raw.stdout, plan.sessionId),
    stderr: raw.stderr
  };
}

/** The client's value of the process start time, from the agents source, when the source lists the pid. */
export async function startedAtOf(
  presence: SessionServices["presence"],
  active: ActiveRun
): Promise<number | undefined> {
  if (active.clientStartedAt !== undefined) return active.clientStartedAt;
  const agents = await presence.agents();
  if (agents.status !== "available") return undefined;
  active.clientStartedAt = agents.processes.find(
    (candidate) => candidate.pid === active.pid
  )?.startedAt;
  return active.clientStartedAt;
}

/**
 * The process a permission request of a launched turn must come from. A run whose owner was lost, that
 * stopped, or whose time limit has passed has no target, so the daemon refuses its requests.
 */
export function targetOfActive(
  active: ActiveRun,
  now: number
): PermissionTarget | undefined {
  if (active.stopped || active.lostOwner || active.silent) return undefined;
  if (now >= active.deadline) return undefined;
  return {
    workspaceId: active.scope.workspace.id,
    threadId: active.scope.threadId,
    pid: active.pid,
    startedAt: active.clientStartedAt,
    slot: active.plan.slot,
    generation: active.plan.generation,
    ownerToken: active.plan.ownerToken
  };
}

/** The same target for a run the daemon adopted after a restart: its process and its time limit. */
export function targetOfAdopted(
  run: AdoptedRun,
  now: number
): PermissionTarget | undefined {
  if (now >= run.deadline) return undefined;
  return {
    workspaceId: run.scope.workspace.id,
    threadId: run.scope.threadId,
    pid: run.pid,
    startedAt: run.startedAt,
    slot: run.slot,
    generation: run.generation,
    ownerToken: run.ownerToken
  };
}
