import type { FixedStage } from "./activation-stages.js";
import type { IdentityCheck } from "./waiter-identity.js";

/** Delivery state of a reservation. A granted record keeps `granted` after a later hold or refusal. */
export type ReservationStatus = "granted" | "held" | "refused";

/** The side of a cycle this reservation touched. "none" covers a UI-origin mention, which opens no cycle. */
export type CycleRole = "open" | "close" | "none";

/** An open cycle waits for its answer, is closed by the reverse direction, or is superseded by a repeat. */
export type CycleState = "open" | "closed" | "superseded";

/** One record per message and recipient, kept in the thread's state file. Never in CHAT.md. */
export type ReservationRecord = {
  messageId: string;
  /** The waiter's profile: the agent this mention wakes. */
  recipient: string;
  /** The message author's profile. */
  author: string;
  origin: "architect" | "ui";
  /** The waiter's session. Another holder is refused. */
  holder: string;
  /** The run id of the last delivery seen for this record. */
  runId: string;
  /** Run ids admitted as a grant. A replay of one of them never spends an attempt. */
  runIds: string[];
  stage: FixedStage;
  status: ReservationStatus;
  reason?: string;
  /** The identity check that held this record, set only by an identity hold. A grant removes it. */
  identityCheck?: IdentityCheck;
  /** True once a grant happened. A later hold or refusal never erases it. */
  granted: boolean;
  /** Re-deliveries admitted after the first grant. */
  attempts: number;
  cycle?: number;
  cycleRole: CycleRole;
  cycleState?: CycleState;
  revision?: string;
  /** The canonical message timestamp. The pruning floor compares against it. */
  messageAt: string;
  /** The message that carried this grant's stamp, once confirmed. */
  answeredBy?: string;
};

/** What a waiter asks: the message, the recipient it wakes, the waiter's session and the delivery run. */
export type ReservationRequest = {
  messageId: string;
  recipient: string;
  holder: string;
  runId: string;
};

/** The thread as the reservation sees it, judged inside the thread's queue. */
export type ThreadGate =
  | { kind: "closed" }
  | { kind: "unreadable"; reason: "ledger_lost" | "ledger_invalid" }
  | {
      kind: "open";
      enabled: boolean;
      hold?: string;
      /** The identity check behind an identity hold. Absent for every other hold. */
      identityCheck?: IdentityCheck;
    };

/** The canonical message, read from CHAT.md. The daemon never trusts a sender supplied by the caller. */
export type OriginMessage = {
  author: string;
  timestamp: string;
  stage?: string;
  mentionsRecipient: boolean;
};

export type StageBudget = { used: number; max: number };

export type StageBudgets = Record<FixedStage, StageBudget>;

/** The judged result. `write` tells the daemon whether to persist `records` and the debit. */
export type ReservationDecision = {
  status: ReservationStatus;
  reason?: string;
  stage: FixedStage;
  cycle?: number;
  write: boolean;
  records: ReservationRecord[];
  prunedThrough?: string;
  debit: number;
};

/** A cycle whose state changes because of this decision. */
export type CycleUpdate = {
  messageId: string;
  recipient: string;
  state: CycleState;
};
