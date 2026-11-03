import { reconcileMentions, type WaitDecision } from "./thread-mentions.js";
import type { ChatMessage } from "./types.js";

export type WaitSnapshot = { messages: ChatMessage[]; closed: boolean };

export type WaitTimer = { cancel(): void };

export type WaitTimers = {
  setTimer(callback: () => void, delayMs: number): WaitTimer;
};

export type WaitWatcher = { close(): void };

export type WaitDeps = {
  readSnapshot(): Promise<WaitSnapshot>;
  /** A hint only: the watcher wakes the loop early, and the periodic poll is the guarantee. */
  watch(onChange: () => void): WaitWatcher;
  timers: WaitTimers;
};

export type WaitOptions = {
  afterMessageId: string;
  mention: string;
  maxChain: number;
  timeoutMs: number;
  pollMs: number;
  signal: AbortSignal;
};

export type WaitOutcome =
  | Exclude<WaitDecision, { status: "waiting" }>
  | { status: "timeout" }
  | { status: "interrupted" }
  | { status: "error"; error: string };

/**
 * Waits until a decision other than `waiting`. The watcher starts before the first
 * reconciliation, so a message written in between is read rather than lost.
 */
export function waitForMention(
  options: WaitOptions,
  deps: WaitDeps
): Promise<WaitOutcome> {
  if (options.signal.aborted) return Promise.resolve({ status: "interrupted" });
  return new Promise<WaitOutcome>((resolve) => {
    new WaitLoop(options, deps, resolve).start();
  });
}

class WaitLoop {
  private settled = false;
  private reconciling = false;
  private reconcileQueued = false;
  private watcher: WaitWatcher | undefined;
  private timeout: WaitTimer | undefined;
  private poll: WaitTimer | undefined;
  private readonly onAbort = (): void => this.settle({ status: "interrupted" });

  constructor(
    private readonly options: WaitOptions,
    private readonly deps: WaitDeps,
    private readonly resolve: (outcome: WaitOutcome) => void
  ) {}

  start(): void {
    this.watcher = this.deps.watch(() => this.requestReconcile());
    this.timeout = this.deps.timers.setTimer(
      () => this.settle({ status: "timeout" }),
      this.options.timeoutMs
    );
    this.armPoll();
    this.options.signal.addEventListener("abort", this.onAbort, { once: true });
    this.requestReconcile();
  }

  private requestReconcile(): void {
    if (this.settled) return;
    if (this.reconciling) {
      this.reconcileQueued = true;
      return;
    }
    this.reconciling = true;
    void this.reconcileOnce().finally(() => this.reconcileDone());
  }

  private reconcileDone(): void {
    this.reconciling = false;
    if (!this.reconcileQueued) return;
    this.reconcileQueued = false;
    this.requestReconcile();
  }

  private async reconcileOnce(): Promise<void> {
    try {
      const snapshot = await this.deps.readSnapshot();
      this.decide(snapshot.messages, snapshot.closed);
    } catch (error) {
      this.settle({ status: "error", error: errorMessage(error) });
    }
  }

  private decide(messages: ChatMessage[], closed: boolean): void {
    const decision = reconcileMentions({
      messages,
      afterMessageId: this.options.afterMessageId,
      mention: this.options.mention,
      maxChain: this.options.maxChain,
      closed
    });
    if (decision.status === "waiting") return;
    this.settle(decision);
  }

  private armPoll(): void {
    this.poll = this.deps.timers.setTimer(
      () => this.onPoll(),
      this.options.pollMs
    );
  }

  private onPoll(): void {
    if (this.settled) return;
    this.armPoll();
    this.requestReconcile();
  }

  private settle(outcome: WaitOutcome): void {
    if (this.settled) return;
    this.settled = true;
    this.timeout?.cancel();
    this.poll?.cancel();
    this.options.signal.removeEventListener("abort", this.onAbort);
    this.watcher?.close();
    this.resolve(outcome);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
