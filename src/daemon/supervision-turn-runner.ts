import type { ChildProcess } from "node:child_process";
import type { SupervisionRecord } from "../core/activation-supervision-types.js";
import {
  deadlineNotice,
  MINUTE_MS,
  STOP_GRACE_MS,
  type DeadlineNotice
} from "../core/activation-turn-timeout.js";
import type { ToolShell } from "../core/agent-launch.js";
import { permissionLaunchArgs } from "../core/supervision-permissions.js";
import { treeKillFor } from "../core/process-tree-kill.js";
import {
  errorTurnResult,
  turnResultOf,
  type TurnResult
} from "../core/supervision-turn-outcome.js";
import type {
  PermissionTarget,
  SupervisionRunner,
  SupervisionScope
} from "./supervision-runner.js";
import {
  isSameProcess,
  killTree,
  launchTurn,
  type RawOutput,
  type TurnPorts
} from "./supervision-turn-process.js";
import { finishIn } from "./supervision-turn-finish.js";
import { watchAdopted, type AdoptedRun } from "./supervision-adopted-run.js";
import { recheckIn } from "./supervision-turn-second-pass.js";
import {
  isoOf,
  listedStartOf,
  promptOf,
  runningOf,
  runOutcomeOf,
  startedAtOf,
  targetOfActive,
  targetOfAdopted,
  type ActiveRun
} from "./supervision-turn-helpers.js";
import type {
  LaunchPlan,
  TurnHost,
  TurnScope
} from "./supervision-turn-steps.js";

/** The runner of the daemon: it launches the approved turns and reports their deadline notices. */
export type TurnRunner = SupervisionRunner & {
  /** The deadline notice of a live run, or undefined when no run of that id is live. */
  notice(runId: string): DeadlineNotice | undefined;
  /** Takes over a running card the daemon found after a restart. A run already watched is not watched twice. */
  adopt(run: AdoptedRun): void;
  /** True while a turn is being launched, or is running or watched, so a reconciliation leaves it alone. */
  isLive(runId: string): boolean;
  /** The process a permission request of a live run must come from, or undefined when the run is not live. */
  permissionTarget(runId: string): PermissionTarget | undefined;
  /** Resolves when every turn started so far has ended, so the tests and the shutdown can wait for them. */
  idle(): Promise<void>;
};

export type TurnRunnerDeps = {
  host: () => TurnHost;
  ports: () => TurnPorts;
  /** Called once when a run reaches its deadline. The permission requests are denied here later. */
  onDeadline?: (runId: string) => void;
  /** Called once when a run ends, launched or adopted, for any reason. Its open permission requests are denied. */
  onTurnEnd?: (runId: string) => void;
};

/** The shell of a supervised turn. It is the client's default, as the interactive launch uses it. */
const TURN_TOOL_SHELL: ToolShell = "default";

/** Refusals of the owner heartbeat that mean the thread is gone, so nothing is written any more. */
const SILENT_REFUSALS: readonly string[] = [
  "thread_closed",
  "registry_invalid"
];

export function createSupervisionTurnRunner(deps: TurnRunnerDeps): TurnRunner {
  const runs = new Map<string, ActiveRun>();
  /** Adopted runs, so the notice and the permission target answer for them too. */
  const adopted = new Map<string, AdoptedRun>();
  /** Run ids whose start is in progress, from the start of the launch until its end. */
  const launching = new Set<string>();
  const inFlight = new Set<Promise<void>>();

  function track(work: Promise<void>): void {
    const pending: Promise<void> = work
      .catch(() => undefined)
      .finally(() => inFlight.delete(pending));
    inFlight.add(pending);
  }

  async function execute(
    scope: SupervisionScope,
    record: SupervisionRecord
  ): Promise<void> {
    const turnScope: TurnScope = {
      workspace: scope.workspace,
      threadId: scope.threadId
    };
    const host = deps.host();
    const outcome = await recheckIn(host, turnScope, record);
    if (outcome.status !== "launch") return;
    try {
      await runTurn(host, turnScope, record, outcome.plan);
    } finally {
      deps.onTurnEnd?.(outcome.plan.runId);
    }
  }

  async function runTurn(
    host: TurnHost,
    scope: TurnScope,
    record: SupervisionRecord,
    plan: LaunchPlan
  ): Promise<void> {
    const ports = deps.ports();
    const deadline = ports.now() + plan.turnTimeoutMinutes * MINUTE_MS;
    const launch = plan.adapter.headlessLaunch({
      mode: plan.mode,
      sessionId: plan.sessionId,
      prompt: promptOf(plan, new Date(deadline).toISOString()),
      model: plan.model,
      workspaceRoot: plan.workspaceRoot,
      toolShell: TURN_TOOL_SHELL,
      baseEnv: { ...process.env, MARC_SUPERVISOR_RUN_ID: plan.runId },
      platform: process.platform,
      extraArgs: permissionLaunchArgs()
    });
    const turn = launchTurn(ports, launch, process.platform);
    const pid = await turn.spawned;
    if (pid === undefined) {
      const raw = await turn.finished;
      return settle(host, scope, record, plan, raw, undefined);
    }
    const listed = await listedStartOf(host.sessions.presence, pid);
    const started = await runningOf(host, scope, record, pid, {
      startedAt: isoOf(listed),
      deadlineAt: new Date(deadline).toISOString(),
      runningAt: host.now()
    });
    if (started === "closed") {
      // The thread closed under the turn: its state is gone, so nothing is written.
      killByPid(turn.child, pid);
      await turn.finished;
      return;
    }
    if (started !== "done") {
      // The card could not be marked running. The turn ends as an error, through the same end, so the card
      // never stays in starting with a live process behind it.
      killByPid(turn.child, pid);
      await turn.finished;
      await finishIn(host, scope, record, plan.slot, errorTurnResult(), false);
      return;
    }
    const active: ActiveRun = {
      scope,
      record,
      plan,
      child: turn.child,
      pid,
      deadline,
      timers: [],
      clientStartedAt: listed,
      timedOut: false,
      lostOwner: false,
      silent: false,
      stopped: false
    };
    runs.set(plan.runId, active);
    watch(host, active);
    const raw = await turn.finished;
    stopWatching(active);
    runs.delete(plan.runId);
    return settle(host, scope, record, plan, raw, active);
  }

  /** Writes the end of the turn, unless the thread closed under it. */
  async function settle(
    host: TurnHost,
    scope: TurnScope,
    record: SupervisionRecord,
    plan: LaunchPlan,
    raw: RawOutput,
    active: ActiveRun | undefined
  ): Promise<void> {
    if (active?.silent) return;
    const run = runOutcomeOf(raw, plan, active);
    const result: TurnResult = turnResultOf(
      run,
      plan.adapter,
      plan.lastCostUsd
    );
    await finishIn(
      host,
      scope,
      record,
      plan.slot,
      result,
      active?.lostOwner ?? false
    );
  }

  /** Starts the deadline, the kill at the end of the grace period, and the owner heartbeat. */
  function watch(host: TurnHost, active: ActiveRun): void {
    const ports = deps.ports();
    const now = ports.now();
    const runId = active.plan.runId;
    active.timers.push(
      ports.setTimer(() => deps.onDeadline?.(runId), active.deadline - now)
    );
    active.timers.push(
      ports.setTimer(
        () => killAtGraceEnd(active),
        active.deadline + STOP_GRACE_MS - now
      )
    );
    void beat(host, active);
  }

  function killAtGraceEnd(active: ActiveRun): void {
    if (active.stopped) return;
    active.timedOut = true;
    killByPid(active.child, active.pid);
  }

  function killByPid(child: ChildProcess, pid: number): void {
    if (!isSameProcess(child, pid)) return;
    const planned = treeKillFor(pid, process.platform);
    if (planned.status === "planned") killTree(planned.plan);
  }

  /** Renews the owner's binding with the process as its client. A refusal ends the turn without a second owner. */
  async function beat(host: TurnHost, active: ActiveRun): Promise<void> {
    if (active.stopped) return;
    const reply = await host.sessions.registry.heartbeat({
      slot: active.plan.slot,
      generation: active.plan.generation,
      ownerToken: active.plan.ownerToken,
      clientPid: active.pid,
      clientStartedAt: await startedAtOf(host.sessions.presence, active)
    });
    if (reply.decision === "refused") {
      return onRefusal(active, reply.reason);
    }
    if (active.stopped) return;
    active.timers.push(
      deps
        .ports()
        .setTimer(() => void beat(host, active), deps.ports().heartbeatMs)
    );
  }

  function onRefusal(active: ActiveRun, reason: string): void {
    active.silent = SILENT_REFUSALS.includes(reason);
    active.lostOwner = !active.silent;
    killByPid(active.child, active.pid);
  }

  function stopWatching(active: ActiveRun): void {
    active.stopped = true;
    const ports = deps.ports();
    for (const timer of active.timers) ports.clearTimer(timer);
    active.timers.length = 0;
  }

  return {
    start(scope, record) {
      const runId = record.runId;
      if (runId !== undefined) launching.add(runId);
      track(
        execute(scope, record).finally(() => {
          if (runId !== undefined) launching.delete(runId);
        })
      );
    },
    notice(runId) {
      const deadline =
        runs.get(runId)?.deadline ?? adopted.get(runId)?.deadline;
      if (deadline === undefined) return undefined;
      return deadlineNotice(deps.ports().now(), deadline, STOP_GRACE_MS);
    },
    adopt(run) {
      if (adopted.has(run.runId)) return;
      adopted.set(run.runId, run);
      watchAdopted(
        {
          host: deps.host,
          ports: deps.ports,
          onDeadline: deps.onDeadline,
          onEnd: (runId) => {
            adopted.delete(runId);
            deps.onTurnEnd?.(runId);
          }
        },
        run
      );
    },
    permissionTarget(runId) {
      const now = deps.ports().now();
      const active = runs.get(runId);
      if (active !== undefined) return targetOfActive(active, now);
      const run = adopted.get(runId);
      if (run === undefined) return undefined;
      return targetOfAdopted(run, now);
    },
    isLive(runId) {
      return launching.has(runId) || runs.has(runId) || adopted.has(runId);
    },
    async idle() {
      while (inFlight.size > 0) {
        await Promise.all([...inFlight]);
      }
    }
  };
}
