import type { SupervisionRecord } from "../core/activation-supervision-types.js";
import { STOP_GRACE_MS } from "../core/activation-turn-timeout.js";
import type { SlotKey } from "../core/session-slots.js";
import {
  judgeProcessView,
  type ProcessView
} from "../core/process-identity.js";
import { treeKillFor } from "../core/process-tree-kill.js";
import type { TurnResult } from "../core/supervision-turn-outcome.js";
import { processesOf } from "./process-table-os.js";
import type { SessionServices } from "./session-views.js";
import { finishIn } from "./supervision-turn-finish.js";
import {
  killTree,
  type TimerHandle,
  type TurnPorts
} from "./supervision-turn-process.js";
import type { TurnHost, TurnScope } from "./supervision-turn-steps.js";

/** A running card the daemon takes over after a restart: its process, its owner and its time limit. */
export type AdoptedRun = {
  scope: TurnScope;
  runId: string;
  record: SupervisionRecord;
  slot: SlotKey;
  generation: number;
  ownerToken: string;
  pid: number;
  /** The process start instant in epoch milliseconds, when a source reported it. */
  startedAt: number | undefined;
  /** The native session the binding names, which identifies the process when no start instant is known. */
  sessionId: string;
  /** The instant the presence grace of the process counts from, in epoch milliseconds, when it is known. */
  since: number | undefined;
  /** The instant the time limit ends, in epoch milliseconds. */
  deadline: number;
};

export type AdoptedDeps = {
  host: () => TurnHost;
  ports: () => TurnPorts;
  onDeadline?: (runId: string) => void;
  /** Called once the watch ends, so the runner drops the run's deadline. */
  onEnd: (runId: string) => void;
};

type Watch = {
  run: AdoptedRun;
  deps: AdoptedDeps;
  timer: TimerHandle | undefined;
  stopped: boolean;
  deadlineFired: boolean;
  timedOut: boolean;
  lostOwner: boolean;
};

/** The owner refusals that mean the thread is gone, so nothing is written any more. */
const SILENT_REFUSALS: readonly string[] = [
  "thread_closed",
  "registry_invalid"
];

/**
 * Watches a process the daemon did not launch in this run. Each tick judges the process, renews the owner
 * while the process is the same one, fires the deadline, and ends the card when the process is gone.
 * A tick that cannot decide changes nothing and waits for the next one.
 */
export function watchAdopted(deps: AdoptedDeps, run: AdoptedRun): void {
  const watch: Watch = {
    run,
    deps,
    timer: undefined,
    stopped: false,
    deadlineFired: false,
    timedOut: false,
    lostOwner: false
  };
  runTick(watch);
}

function runTick(watch: Watch): void {
  void tick(watch).catch(() => scheduleNext(watch));
}

async function tick(watch: Watch): Promise<void> {
  watch.timer = undefined;
  if (watch.stopped) return;
  const host = watch.deps.host();
  const view = await viewOf(host.sessions, watch.run, watch.deps.ports().now());
  if (view === "gone" || view === "other") {
    await finishIn(
      host,
      watch.run.scope,
      watch.run.record,
      watch.run.slot,
      endingOf(watch),
      watch.lostOwner
    );
    return stop(watch);
  }
  fireDeadlineIfDue(watch);
  if (view !== "alive") return scheduleNext(watch);
  const renewal = await renew(watch, host);
  if (renewal === "silent") return stop(watch);
  if (renewal === "lost") watch.lostOwner = true;
  enforce(watch);
  scheduleNext(watch);
}

async function viewOf(
  sessions: SessionServices,
  run: AdoptedRun,
  now: number
): Promise<ProcessView> {
  const agents = await sessions.presence.agents();
  const table = await processesOf(sessions.processes).list();
  return judgeProcessView({
    pid: run.pid,
    startedAt: run.startedAt,
    sessionId: run.sessionId,
    since: run.since,
    now,
    agents,
    table
  });
}

/** Renews the owner while the process is the same. A refusal of a closed thread ends in silence. */
async function renew(
  watch: Watch,
  host: TurnHost
): Promise<"renewed" | "silent" | "lost"> {
  const { run } = watch;
  const reply = await host.sessions.registry.heartbeat({
    slot: run.slot,
    generation: run.generation,
    ownerToken: run.ownerToken,
    clientPid: run.pid,
    clientStartedAt: run.startedAt
  });
  if (reply.decision !== "refused") return "renewed";
  if (SILENT_REFUSALS.includes(reply.reason)) return "silent";
  return "lost";
}

/** Fires the deadline once. The permission requests are denied from it, whatever the view is. */
function fireDeadlineIfDue(watch: Watch): void {
  const now = watch.deps.ports().now();
  if (watch.deadlineFired || now < watch.run.deadline) return;
  watch.deadlineFired = true;
  watch.deps.onDeadline?.(watch.run.runId);
}

/**
 * Stops the process when the owner is lost, or when the grace after the time limit has ended. It is
 * called only after the same tick proved the process is the same, so the kill never reaches another one.
 */
function enforce(watch: Watch): void {
  if (watch.lostOwner) return killTreeOf(watch.run.pid);
  const now = watch.deps.ports().now();
  if (now < watch.run.deadline + STOP_GRACE_MS) return;
  watch.timedOut = true;
  killTreeOf(watch.run.pid);
}

function killTreeOf(pid: number): void {
  const planned = treeKillFor(pid, process.platform);
  if (planned.status === "planned") killTree(planned.plan);
}

function scheduleNext(watch: Watch): void {
  if (watch.stopped) return;
  const ports = watch.deps.ports();
  watch.timer = ports.setTimer(() => runTick(watch), ports.heartbeatMs);
}

function stop(watch: Watch): void {
  watch.stopped = true;
  if (watch.timer !== undefined) watch.deps.ports().clearTimer(watch.timer);
  watch.timer = undefined;
  watch.deps.onEnd(watch.run.runId);
}

/**
 * How the card ends. A process this daemon had to stop ends as a timeout, so the card can offer Continue.
 * A lost owner ends as a crash without releasing anything. Any other end is done, unobserved: the output
 * pipe was lost with the daemon that launched the process, so no cost is claimed.
 */
function endingOf(watch: Watch): TurnResult {
  if (watch.lostOwner) return failedWith("crashed");
  if (watch.timedOut) return failedWith("timeout");
  return {
    ending: { status: "done" },
    outcome: { denials: 0, failure: "unobserved" }
  };
}

function failedWith(reason: "crashed" | "timeout"): TurnResult {
  return {
    ending: { status: "failed", reason },
    outcome: { denials: 0, failure: reason }
  };
}
