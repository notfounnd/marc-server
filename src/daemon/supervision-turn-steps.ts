import type { ClientAdapter } from "../core/client-adapters.js";
import type { SupervisionTurn } from "../core/activation-supervision-types.js";
import type { SessionBinding, SlotKey } from "../core/session-slots.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { TurnTimeoutRead } from "./activation-turn-timeout-ledger.js";
import type { ActivationServices } from "./activation-views.js";
import type { SessionServices } from "./session-views.js";
import { releaseBinding, withSlot } from "./session-transitions.js";
import type { ThreadFile } from "./thread-store.js";

/**
 * What the turn needs from the daemon: the queue's services, the sessions, and the clock. The steps of
 * a turn run inside the thread's queue, and this module holds the types and the pure rules they share.
 */
export type TurnHost = {
  services: ActivationServices;
  sessions: SessionServices;
  now: () => string;
};

export type TurnScope = { workspace: WorkspaceInfo; threadId: string };

/** Everything the launch reads in the second pass, so the executor makes no other read. */
export type LaunchPlan = {
  runId: string;
  messageId: string;
  recipient: string;
  threadId: string;
  author: string;
  workspaceRoot: string;
  model: string;
  adapter: ClientAdapter;
  mode: "new" | "resume";
  sessionId: string;
  continuation: boolean;
  slot: SlotKey;
  generation: number;
  ownerToken: string;
  lastCostUsd: number | undefined;
  /** The id of the recipient's own last message in the thread, or undefined when it has posted none. */
  cursor: string | undefined;
  turnTimeoutMinutes: number;
};

export type RecheckOutcome =
  | { status: "launch"; plan: LaunchPlan }
  | { status: "revoked" }
  | { status: "stale" };

/**
 * What a step that writes reports: written, not written because the card moved on, the thread closed, or
 * the thread's state could not be written at all. Only a closed thread is a silent end; the rest is an error.
 */
export type StepStatus = "done" | "stale" | "closed" | "invalid";

/** The owner token of the binding, when the binding is open and still in the generation the run was approved under. */
export function ownerTokenOf(
  binding: SessionBinding | undefined,
  turn: SupervisionTurn | undefined
): string | undefined {
  if (binding === undefined || turn === undefined) return undefined;
  if (binding.endedAt !== undefined) return undefined;
  if (binding.generation !== turn.generation) return undefined;
  return binding.owner.ownerToken;
}

/** The time limit in minutes, when the setting is authorized. Any other state has no limit to run under. */
export function authorizedMinutesOf(turn: TurnTimeoutRead): number | undefined {
  if (!("turnTimeoutMinutes" in turn)) return undefined;
  if (turn.status !== "authorized") return undefined;
  return turn.turnTimeoutMinutes;
}

/**
 * Releases a binding that the run still owns, and records the session's last cost when one was read.
 * A binding the run does not own comes back unchanged.
 */
export function releasedFile(input: {
  file: ThreadFile;
  slot: string;
  binding: SessionBinding | undefined;
  turn: SupervisionTurn | undefined;
  endedAt: string;
  lastCostUsd: number | undefined;
}): ThreadFile {
  const { file, slot, binding, turn, endedAt, lastCostUsd } = input;
  if (ownerTokenOf(binding, turn) === undefined) return file;
  if (binding === undefined) return file;
  const ended = releaseBinding(binding, endedAt);
  const next: SessionBinding =
    lastCostUsd === undefined ? ended : { ...ended, lastCostUsd };
  return withSlot(file, slot, next);
}

export function statusOf(result: {
  status: string;
  value?: StepStatus;
}): StepStatus {
  if (result.status === "done") return result.value ?? "stale";
  if (result.status === "closed") return "closed";
  return "invalid";
}
