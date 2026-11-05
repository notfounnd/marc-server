import type {
  SupervisionRecord,
  SupervisionTurn
} from "../core/activation-supervision-types.js";
import {
  findRecord,
  pruneSupervision,
  transitionRecord,
  upsertRecord
} from "../core/activation-supervision-records.js";
import { isStartingRun } from "../core/supervision-turn-recheck.js";
import type { TurnResult } from "../core/supervision-turn-outcome.js";
import { slotKey, type SlotKey } from "../core/session-slots.js";
import { scopeOf } from "./activation-views.js";
import { supervisionOf } from "./supervision-pass.js";
import {
  releasedFile,
  statusOf,
  type StepStatus,
  type TurnHost,
  type TurnScope
} from "./supervision-turn-steps.js";
import type { ThreadFile, ThreadStep } from "./thread-store.js";

/**
 * The card of the run is now running, with its pid, the start instant the agents source reported (when it
 * did), and the instant its time limit ends. Anything else writes nothing.
 */
export async function runningIn(
  host: TurnHost,
  scope: TurnScope,
  record: SupervisionRecord,
  pid: number,
  process: ProcessMark
): Promise<StepStatus> {
  const result = await host.services.threads.update<StepStatus>(
    scopeOf(scope.workspace, scope.threadId),
    (file) => runningStep(file, record, pid, process)
  );
  return statusOf(result);
}

/** The process facts a running card records: its start instant when known, its deadline, and when it went running. */
export type ProcessMark = {
  startedAt: string | undefined;
  deadlineAt: string;
  runningAt: string;
};

function runningStep(
  file: ThreadFile,
  record: SupervisionRecord,
  pid: number,
  process: ProcessMark
): ThreadStep<StepStatus> {
  const state = supervisionOf(file);
  const card = findRecord(state.records, record.messageId, record.recipient);
  if (!isStartingRun(card, record.runId)) return { value: "stale" };
  const running = transitionRecord(card, "running", {
    turn: withProcess(card.turn, pid, process)
  });
  if (running === undefined) return { value: "stale" };
  return {
    value: "done",
    file: {
      ...file,
      supervision: pruneSupervision({
        records: upsertRecord(state.records, running),
        floors: state.floors
      })
    }
  };
}

/** The turn with its process facts. An unknown start instant is left out, not invented from the clock. */
export function withProcess(
  turn: SupervisionTurn,
  pid: number,
  process: ProcessMark
): SupervisionTurn {
  const base: SupervisionTurn = {
    ...turn,
    pid,
    deadlineAt: process.deadlineAt,
    runningAt: process.runningAt
  };
  const startedAt = process.startedAt;
  if (startedAt === undefined) return base;
  return { ...base, startedAt };
}

/**
 * Ends the turn of a card: done, or failed with its outcome, and the binding released with the session's
 * last cost. A binding that this run no longer owns is left as it is, because another holder has it now.
 */
export async function finishIn(
  host: TurnHost,
  scope: TurnScope,
  record: SupervisionRecord,
  slot: SlotKey,
  result: TurnResult,
  lostOwner: boolean
): Promise<StepStatus> {
  const written = await host.services.threads.update<StepStatus>(
    scopeOf(scope.workspace, scope.threadId),
    (file) => finishStep(host, record, slot, result, lostOwner, file)
  );
  return statusOf(written);
}

function finishStep(
  host: TurnHost,
  record: SupervisionRecord,
  slot: SlotKey,
  result: TurnResult,
  lostOwner: boolean,
  file: ThreadFile
): ThreadStep<StepStatus> {
  const state = supervisionOf(file);
  const card = findRecord(state.records, record.messageId, record.recipient);
  if (!isEndable(card, record.runId)) return { value: "stale" };
  const next = transitionRecord(card, statusOfEnding(result), patchOf(result));
  if (next === undefined) return { value: "stale" };
  const key = slotKey(slot);
  const released = lostOwner
    ? file
    : releasedFile({
        file,
        slot: key,
        binding: file.slots[key],
        turn: card.turn,
        endedAt: host.now(),
        lastCostUsd: result.lastCostUsd
      });
  return {
    value: "done",
    file: {
      ...released,
      supervision: pruneSupervision({
        records: upsertRecord(state.records, next),
        floors: state.floors
      })
    }
  };
}

function isEndable(
  card: SupervisionRecord | undefined,
  runId: string | undefined
): card is SupervisionRecord {
  if (card === undefined || runId === undefined) return false;
  if (card.runId !== runId) return false;
  return card.status === "running" || card.status === "starting";
}

function statusOfEnding(result: TurnResult): "done" | "failed" {
  if (result.ending.status === "done") return "done";
  return "failed";
}

function patchOf(result: TurnResult): {
  reason?: string;
  outcome: TurnResult["outcome"];
} {
  if (result.ending.status === "done") {
    return { reason: undefined, outcome: result.outcome };
  }
  return { reason: result.ending.reason, outcome: result.outcome };
}
