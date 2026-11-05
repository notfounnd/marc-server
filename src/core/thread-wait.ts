import { reconcileMentions, type WaitDecision } from "./thread-mentions.js";
import type { ChatMessage } from "./types.js";

/**
 * policyActive: the thread has an enabled policy (or one that cannot be read, which fails
 * closed). In such a thread the wait asks the reservation port instead of releasing a mention.
 */
export type WaitSnapshot = {
  messages: ChatMessage[];
  closed: boolean;
  policyActive?: boolean;
};

export type WaitTimer = { cancel(): void };

export type WaitTimers = {
  setTimer(callback: () => void, delayMs: number): WaitTimer;
};

export type WaitWatcher = { close(): void };

export type ReservationDecision = "granted" | "held" | "refused";

/** One answer of the daemon for one message. `reservation` is the key the answer's stamp uses. */
export type ReservationReply = {
  messageId: string;
  decision: ReservationDecision;
  stage: string;
  cycle?: number;
  reservation: string;
  reason?: string;
};

export type PortFailure = {
  ok: false;
  status: "daemon_unavailable" | "error";
  reason: string;
};

export type PortCheck = { ok: true } | PortFailure;

export type PortReplies =
  | { ok: true; replies: ReservationReply[] }
  | PortFailure;

/**
 * The governed port. The loop calls `check` on every governed tick, so a lost daemon ends the wait
 * on the next tick, and `reserve` for the eligible mentions, in order, with one run id.
 */
export type ReservationPort = {
  check(): Promise<PortCheck>;
  reserve(messageIds: readonly string[]): Promise<PortReplies>;
};

export type WaitDeps = {
  readSnapshot(): Promise<WaitSnapshot>;
  /** A hint only: the watcher wakes the loop early, and the periodic poll is the guarantee. */
  watch(onChange: () => void): WaitWatcher;
  timers: WaitTimers;
  /** Used only in a governed thread. Absent means a governed thread cannot be served. */
  reservations?: ReservationPort;
};

export type WaitOptions = {
  afterMessageId: string;
  mention: string;
  maxChain: number;
  timeoutMs: number;
  pollMs: number;
  signal: AbortSignal;
};

type MentionFields = Omit<
  Extract<WaitDecision, { status: "mention" }>,
  "status"
>;

export type WaitOutcome =
  | { status: "thread_closed" }
  | { status: "cursor_not_found" }
  | ({ status: "mention"; reservations?: ReservationReply[] } & MentionFields)
  | ({ status: "chain_limit" } & MentionFields)
  | { status: "activation_refused"; reservations: ReservationReply[] }
  | { status: "daemon_unavailable"; error: string }
  | { status: "timeout"; reservations?: ReservationReply[] }
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

/** Governed replies by the strongest answer present: granted, then held, then refused. */
const SUMMARY_ORDER: readonly ReservationDecision[] = [
  "granted",
  "held",
  "refused"
];

type GovernedStep = (
  fields: MentionFields,
  replies: ReservationReply[]
) => WaitOutcome | undefined;

/** Dispatch table: an undefined step keeps the wait running and remembers the held replies. */
const GOVERNED_STEP: Record<ReservationDecision, GovernedStep> = {
  granted: (fields, replies) => ({
    status: "mention",
    ...fields,
    reservations: replies
  }),
  held: () => undefined,
  refused: (_fields, replies) => ({
    status: "activation_refused",
    reservations: replies
  })
};

class WaitLoop {
  private settled = false;
  private reconciling = false;
  private reconcileQueued = false;
  private watcher: WaitWatcher | undefined;
  private timeout: WaitTimer | undefined;
  private poll: WaitTimer | undefined;
  private lastHeld: ReservationReply[] | undefined;
  private readonly onAbort = (): void => this.settle({ status: "interrupted" });

  constructor(
    private readonly options: WaitOptions,
    private readonly deps: WaitDeps,
    private readonly resolve: (outcome: WaitOutcome) => void
  ) {}

  start(): void {
    this.watcher = this.deps.watch(() => this.requestReconcile());
    this.timeout = this.deps.timers.setTimer(
      () => this.settle(this.timeoutOutcome()),
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
      await this.decide(
        snapshot.messages,
        snapshot.closed,
        snapshot.policyActive === true
      );
    } catch (error) {
      this.settle({ status: "error", error: errorMessage(error) });
    }
  }

  /** A timeout keeps the held replies, so the caller knows what was retained. */
  private timeoutOutcome(): WaitOutcome {
    if (this.lastHeld === undefined) return { status: "timeout" };
    return { status: "timeout", reservations: this.lastHeld };
  }

  /** Checked on every tick. A governed thread never releases a mention without a reservation. */
  private async decide(
    messages: ChatMessage[],
    closed: boolean,
    policyActive: boolean
  ): Promise<void> {
    if (policyActive && !closed) return this.governed(messages);
    const decision = reconcileMentions(this.input(messages, closed));
    if (decision.status === "waiting") return;
    this.settle(decision);
  }

  /** Governed path: the chain brake does not apply here, the budget decides in the daemon. */
  private async governed(messages: ChatMessage[]): Promise<void> {
    const port = this.deps.reservations;
    if (port === undefined) {
      this.settle({ status: "daemon_unavailable", error: "port_missing" });
      return;
    }
    const check = await port.check();
    if (!check.ok) {
      this.settle({ status: check.status, error: check.reason });
      return;
    }
    const decision = reconcileMentions(this.input(messages, false));
    if (decision.status === "waiting") return;
    if (decision.status === "thread_closed") return this.settle(decision);
    if (decision.status === "cursor_not_found") return this.settle(decision);
    await this.reserveFor(port, fieldsOf(decision));
  }

  private async reserveFor(
    port: ReservationPort,
    fields: MentionFields
  ): Promise<void> {
    const result = await port.reserve(fields.messageIds);
    if (!result.ok) {
      this.settle({ status: result.status, error: result.reason });
      return;
    }
    const summary = summaryOf(result.replies);
    const outcome = GOVERNED_STEP[summary](fields, result.replies);
    if (outcome === undefined) {
      this.lastHeld = result.replies.filter(
        (reply) => reply.decision === "held"
      );
      return;
    }
    this.settle(outcome);
  }

  private input(messages: ChatMessage[], closed: boolean) {
    return {
      messages,
      afterMessageId: this.options.afterMessageId,
      mention: this.options.mention,
      maxChain: this.options.maxChain,
      closed
    };
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

function fieldsOf(
  decision: Extract<WaitDecision, { messageIds: string[] }>
): MentionFields {
  return {
    messageIds: decision.messageIds,
    authors: decision.authors,
    chain: decision.chain
  };
}

function summaryOf(replies: readonly ReservationReply[]): ReservationDecision {
  const found = SUMMARY_ORDER.find((decision) =>
    replies.some((reply) => reply.decision === decision)
  );
  return found ?? "held";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
