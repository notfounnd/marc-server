import type { WorkspaceInfo } from "../core/types.js";
import type { ActivationServices } from "./activation-views.js";
import type { SessionServices } from "./session-views.js";
import { PRESENCE_GRACE_MS } from "./supervision-facts.js";
import { runSupervisionPass } from "./supervision-pass.js";
import {
  createReconciler,
  type ThreadTarget
} from "./supervision-reconcile.js";
import type { SupervisionOptions } from "./supervision-runner.js";
import { sweepThreadIn } from "./supervision-sweep.js";
import { startIn, type CardRef } from "./supervision-start.js";

/** The expiry sweep runs this often, and its timer never keeps the process alive. */
export const SWEEP_INTERVAL_MS = 5 * 60_000;

/** An undecided card is looked at again this often. The timer never keeps the process alive. */
export const RECONCILE_RETRY_MS = 15_000;

export type SupervisionHost = {
  services: ActivationServices;
  sessions: SessionServices;
  options: SupervisionOptions;
  listWorkspaces(): Promise<WorkspaceInfo[]>;
  /** Tells the UI a thread's supervision state changed. */
  notify(workspace: WorkspaceInfo, threadId: string): void;
};

export type SupervisionService = {
  /** A change in a thread folder: one pass over that thread. A failed pass is ignored, as the listener must not throw. */
  onThreadChange(workspace: WorkspaceInfo, threadId: string): void;
  /** The reconciliation of the start, then the startup pass; the pass at the grace's end; and the expiry sweep. */
  start(): void;
  stop(): void;
  /** Resolves when every pass and sweep started so far has finished, so the daemon can close cleanly. */
  idle(): Promise<void>;
  passAll(): Promise<void>;
  sweepAll(): Promise<void>;
  /** One reconciliation pass over every thread, as the start runs it; undecided cards are retried. */
  reconcileAll(): Promise<void>;
};

export function createSupervisionService(
  host: SupervisionHost
): SupervisionService {
  const timers: NodeJS.Timeout[] = [];
  const inFlight = new Set<Promise<void>>();
  const reconciler = createReconciler({
    services: host.services,
    sessions: host.sessions,
    runner: host.options.runner,
    options: host.options
  });
  let retry: NodeJS.Timeout | undefined;
  let stopped = false;

  /** Runs one piece of background work and keeps it in flight until it ends, so idle can wait for it. */
  function run(work: () => Promise<void>): void {
    const pending: Promise<void> = work()
      .catch(() => undefined)
      .finally(() => inFlight.delete(pending));
    inFlight.add(pending);
  }

  async function passThread(
    workspace: WorkspaceInfo,
    threadId: string
  ): Promise<void> {
    if (stopped) return;
    const pass = await runSupervisionPass({
      services: host.services,
      sessions: host.sessions,
      options: host.options,
      workspace,
      threadId
    });
    if (pass.outcome === "changed") host.notify(workspace, threadId);
    for (const card of pass.autoCards) {
      await startApproved(workspace, threadId, card);
    }
  }

  /**
   * Starts an awaiting card of an approved architect, judged in the same queue as an Approve. A refusal
   * writes nothing and leaves the card awaiting, so the next pass tries again; nothing retries at once.
   */
  async function startApproved(
    workspace: WorkspaceInfo,
    threadId: string,
    card: CardRef
  ): Promise<void> {
    const outcome = await startIn(
      {
        services: host.services,
        sessions: host.sessions,
        options: host.options,
        workspace,
        threadId
      },
      "auto",
      card
    );
    if (outcome.started === undefined) return;
    host.options.runner.start({ workspace, threadId }, outcome.started);
    host.notify(workspace, threadId);
  }

  /** Threads are listed from their state files, so the pass writes nothing else in the workspace. */
  async function passAll(): Promise<void> {
    for (const workspace of await host.listWorkspaces()) {
      for (const scope of await host.services.threads.scopes(workspace.id)) {
        await passThread(workspace, scope.threadId);
      }
    }
  }

  async function sweepAll(): Promise<void> {
    if (stopped) return;
    const now = host.options.now();
    const workspaces = new Map(
      (await host.listWorkspaces()).map((workspace) => [
        workspace.id,
        workspace
      ])
    );
    for (const scope of await host.services.threads.scopes()) {
      const workspace = workspaces.get(scope.workspaceId);
      if (workspace === undefined) continue;
      const outcome = await sweepThreadIn(host.services, scope, now);
      if (outcome === "changed") host.notify(workspace, scope.threadId);
    }
  }

  /** Decides the cards the last daemon run left in starting or running. A card still undecided is retried. */
  async function reconcileAll(): Promise<void> {
    if (stopped) return;
    const targets: ThreadTarget[] = [];
    for (const workspace of await host.listWorkspaces()) {
      for (const scope of await host.services.threads.scopes(workspace.id)) {
        targets.push({ workspace, threadId: scope.threadId });
      }
    }
    const undecided = await reconciler.pass(targets);
    if (undecided > 0) scheduleRetry();
  }

  function scheduleRetry(): void {
    if (stopped) return;
    if (retry !== undefined) clearTimeout(retry);
    retry = setTimeout(() => run(reconcileAll), RECONCILE_RETRY_MS);
    retry.unref();
  }

  return {
    onThreadChange(workspace, threadId) {
      run(() => passThread(workspace, threadId));
    },
    start() {
      run(async () => {
        await reconcileAll();
        await passAll();
      });
      const remaining = Math.max(
        0,
        host.options.startedAt + PRESENCE_GRACE_MS - Date.now()
      );
      timers.push(setTimeout(() => run(passAll), remaining));
      const sweep = setInterval(() => run(sweepAll), SWEEP_INTERVAL_MS);
      sweep.unref();
      timers.push(sweep);
    },
    stop() {
      stopped = true;
      if (retry !== undefined) clearTimeout(retry);
      retry = undefined;
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      timers.length = 0;
    },
    async idle() {
      while (inFlight.size > 0) {
        await Promise.all([...inFlight]);
      }
    },
    passAll,
    sweepAll,
    reconcileAll
  };
}
