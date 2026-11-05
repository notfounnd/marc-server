import {
  isFixedStage,
  type CycleGrant,
  type FixedStage
} from "../core/activation-stages.js";
import {
  destinationOf,
  type AdvanceRefusal,
  type StageHistoryEntry
} from "../core/activation-advance.js";
import {
  STAGE_HISTORY_LIMIT,
  closeHolds
} from "../core/activation-reservation-records.js";
import type { WorkspaceInfo } from "../core/types.js";
import { cyclesCountersOf } from "./activation-activity.js";
import type { ThreadActivity, ThreadExtras } from "./activation-file.js";
import { reasonOf, type LedgerReason } from "./activation-ledger.js";
import {
  readinessOf,
  readQueueFacts,
  type ReadinessRefusal
} from "./activation-queue-facts.js";
import { scopeOf, type ActivationServices } from "./activation-views.js";
import type { ThreadFile, ThreadStep, ThreadUpdate } from "./thread-store.js";

/**
 * The stage actions of the human and of the lead. Each judges its readiness, and the stage the caller
 * saw, inside the thread's queue, in the step that writes: the stage must still be the current one, or
 * nothing moves. Advancing ends every retained hold with `stage_advanced`, writes one history entry,
 * and never creates a fourth stage. Neither touches the messages or the policy file.
 */

export type StageRefusalReason =
  | ReadinessRefusal
  | "not_ready"
  | "stage_changed"
  | "not_ahead"
  | "last_stage"
  | AdvanceRefusal
  | LedgerReason;

export type StageActionOutcome =
  | { decision: "done"; stage: FixedStage; droppedHolds?: number }
  | { decision: "refused"; reason: StageRefusalReason };

export type StageActionInput = {
  services: ActivationServices;
  workspace: WorkspaceInfo;
  threadId: string;
  now: () => string;
  /** The stage the caller saw. It must still be the current one, or nothing moves. */
  expectedStage: string;
};

/** The human's advance names its destination. Any fixed stage strictly ahead is allowed. */
export type HumanAdvanceInput = StageActionInput & { to: string };

/** Who moved the stage. An agent move names its agent and the operation the daemon granted. */
export type MoveActor =
  | { by: "human" }
  | { by: "agent"; agentId: string; operationId: string };

type ReadyStage = Extract<Checked, { decision: "ready" }>;

/** The stage the human's action may act on, with the cycles setting in force when it was judged. */
type GateResult =
  | { decision: "refused"; reason: StageRefusalReason }
  | (ReadyStage & { cyclesPerStage: number });

/** Adds the authorized cycles per stage to the current stage, recorded as a grant with its time. */
export async function extendStage(
  input: StageActionInput
): Promise<StageActionOutcome> {
  const result = await input.services.threads.update<StageActionOutcome>(
    scopeOf(input.workspace, input.threadId),
    async (file) => {
      const gate = await gateIn(input, file);
      if (gate.decision === "refused") return refusedStep(gate.reason);
      const grant: CycleGrant = {
        at: input.now(),
        cycles: gate.cyclesPerStage
      };
      return {
        value: { decision: "done", stage: gate.stage },
        file: {
          ...file,
          activation: withGrant(gate.activation, gate.stage, grant)
        }
      };
    }
  );
  return outcomeOf(result);
}

/**
 * The human's advance. It moves to the named stage, which must be strictly ahead of the current
 * one. The current stage may be exhausted: the human can always move on, and the budgets of the
 * stages jumped over are lost, not transferred.
 */
export async function advanceStage(
  input: HumanAdvanceInput
): Promise<StageActionOutcome> {
  const result = await input.services.threads.update<StageActionOutcome>(
    scopeOf(input.workspace, input.threadId),
    async (file) => {
      const gate = await gateIn(input, file);
      if (gate.decision === "refused") return refusedStep(gate.reason);
      return movedValue(file, gate, input.to, {
        at: input.now(),
        actor: { by: "human" }
      });
    }
  );
  return outcomeOf(result);
}

/** The value and the file of a move to a destination that is ahead, or the refusal that forbids it. */
export function movedValue(
  file: ThreadFile,
  checked: ReadyStage,
  to: unknown,
  move: { at: string; actor: MoveActor }
): ThreadStep<StageActionOutcome> {
  const destination = destinationOf(checked.stage, to);
  if (destination.decision === "refused") return { value: destination };
  const moved = moveFile(
    file,
    checked.activation,
    checked.stage,
    destination.stage,
    move
  );
  return {
    value: {
      decision: "done",
      stage: destination.stage,
      droppedHolds: moved.droppedHolds
    },
    file: moved.file
  };
}

/**
 * The file after a stage move: the new stage, every held reservation ended with `stage_advanced`,
 * and one history entry. Grants stay as they are. Used by the human and by the lead.
 */
export function moveFile(
  file: ThreadFile,
  activation: ThreadActivity,
  from: FixedStage,
  to: FixedStage,
  move: { at: string; actor: MoveActor }
): { file: ThreadFile; droppedHolds: number } {
  const closed = closeHolds(file.reservations ?? []);
  const entry: StageHistoryEntry = {
    at: move.at,
    from,
    to,
    droppedHolds: closed.dropped,
    ...actorFields(move.actor)
  };
  return {
    droppedHolds: closed.dropped,
    file: {
      ...file,
      activation: { ...activation, currentStage: to },
      reservations: closed.records,
      stageHistory: appendHistory(file.stageHistory, entry)
    }
  };
}

export type Checked =
  | { decision: "ready"; stage: FixedStage; activation: ThreadActivity }
  | { decision: "refused"; reason: StageRefusalReason };

/** Stage compare-and-set: the activation must exist, be fixed, and still be the stage the caller saw. */
export function checkedStage(
  activation: ThreadActivity | undefined,
  expectedStage: string
): Checked {
  if (activation === undefined)
    return { decision: "refused", reason: "not_ready" };
  if (activation.currentStage !== expectedStage) {
    return { decision: "refused", reason: "stage_changed" };
  }
  const stage = activation.currentStage;
  if (!isFixedStage(stage)) return { decision: "refused", reason: "not_ready" };
  return { decision: "ready", stage, activation };
}

export function outcomeOf(
  result: ThreadUpdate<StageActionOutcome>
): StageActionOutcome {
  if (result.status === "invalid") {
    return { decision: "refused", reason: reasonOf(result.reason) };
  }
  if (result.status === "closed") {
    return { decision: "refused", reason: "thread_closed" };
  }
  return result.value;
}

/**
 * The human's gate, judged inside the queue: the readiness first, then the stage the caller saw. The
 * readiness and the cycles setting come from the facts read in this same step.
 */
async function gateIn(
  input: StageActionInput,
  file: ThreadFile
): Promise<GateResult> {
  const facts = await readQueueFacts(
    input.services,
    input.workspace,
    input.threadId
  );
  const ready = readinessOf(facts, file.activation);
  if (ready.decision === "refused") return ready;
  const checked = checkedStage(file.activation, input.expectedStage);
  if (checked.decision === "refused") return checked;
  return { ...checked, cyclesPerStage: ready.cyclesPerStage };
}

function refusedStep(
  reason: StageRefusalReason
): ThreadStep<StageActionOutcome> {
  return { value: { decision: "refused", reason } };
}

function actorFields(
  actor: MoveActor
): Pick<StageHistoryEntry, "by" | "agentId" | "operationId"> {
  if (actor.by === "human") return { by: "human" };
  return {
    by: "agent",
    agentId: actor.agentId,
    operationId: actor.operationId
  };
}

function appendHistory(
  history: ThreadExtras["stageHistory"],
  entry: StageHistoryEntry
): StageHistoryEntry[] {
  return [...(history ?? []), entry].slice(-STAGE_HISTORY_LIMIT);
}

function withGrant(
  activation: ThreadActivity,
  stage: FixedStage,
  grant: CycleGrant
): ThreadActivity {
  const counters = cyclesCountersOf(activation.stages[stage]);
  return {
    ...activation,
    stages: {
      ...activation.stages,
      [stage]: {
        cyclesUsed: counters.cyclesUsed,
        extensions: [...counters.extensions, grant]
      }
    }
  };
}
