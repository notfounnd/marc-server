import type {
  SupervisionRecord,
  SupervisionTurn
} from "../core/activation-supervision-types.js";
import {
  pruneSupervision,
  transitionRecord,
  upsertRecord
} from "../core/activation-supervision-records.js";
import { MINUTE_MS } from "../core/activation-turn-timeout.js";
import type { ProcessTableRead } from "../core/process-table.js";
import {
  judgeProcessView,
  lookupBySession,
  type ProcessView
} from "../core/process-identity.js";
import {
  slotKey,
  type AgentsSource,
  type SessionBinding,
  type SlotKey
} from "../core/session-slots.js";
import type { WorkspaceInfo } from "../core/types.js";
import type { ActivationServices } from "./activation-views.js";
import type { AdoptedRun } from "./supervision-adopted-run.js";
import type { SessionServices } from "./session-views.js";
import { inGraceAt, slotOf } from "./supervision-facts.js";
import { supervisionOf } from "./supervision-pass.js";
import type {
  SupervisionOptions,
  SupervisionRunner
} from "./supervision-runner.js";
import { withProcess } from "./supervision-turn-finish.js";
import { isoOf } from "./supervision-turn-helpers.js";
import {
  authorizedMinutesOf,
  ownerTokenOf,
  releasedFile,
  type TurnScope
} from "./supervision-turn-steps.js";
import type { ThreadFile } from "./thread-store.js";

export type ThreadTarget = { workspace: WorkspaceInfo; threadId: string };

export type ReconcileDeps = {
  services: ActivationServices;
  sessions: SessionServices;
  runner: SupervisionRunner;
  options: SupervisionOptions;
};

/** A card the reconciliation can decide: a launch that was starting or running when the daemon went away. */
export type OpenCard = SupervisionRecord & {
  runId: string;
  status: "running" | "starting";
};

/** What the agents source and the process table said, read once for one thread's step. */
export type Context = {
  deps: ReconcileDeps;
  target: ThreadTarget;
  agents: AgentsSource;
  table: ProcessTableRead;
};

/** The outcome of one card: its file when it writes, a run to take over, or that it is still undecided. */
export type CardStep = {
  file?: ThreadFile;
  adopt?: AdoptedRun;
  undecided?: boolean;
};

type Decider = (
  context: Context,
  file: ThreadFile,
  card: OpenCard
) => Promise<CardStep>;

/** The decision of each state of a card, as a dispatch table. */
const DECIDERS: Record<OpenCard["status"], Decider> = {
  running: decideRunning,
  starting: decideStarting
};

export function decideCard(
  context: Context,
  file: ThreadFile,
  card: OpenCard
): Promise<CardStep> {
  return DECIDERS[card.status](context, file, card);
}

/** A running card: the process recorded on it decides, by the same identity rules the turn uses. */
async function decideRunning(
  context: Context,
  file: ThreadFile,
  card: OpenCard
): Promise<CardStep> {
  const turn = card.turn;
  if (turn === undefined || turn.pid === undefined) {
    return crashed(context, file, card);
  }
  const binding = file.slots[slotKey(slotOfCard(context, card))];
  if (ownerTokenOf(binding, turn) === undefined) {
    return crashed(context, file, card);
  }
  const known = knownStartOf(turn, binding);
  const view = judgeProcessView({
    pid: turn.pid,
    startedAt: known,
    sessionId: binding?.nativeSessionId,
    since: sinceOf(turn, known),
    now: context.deps.options.turn.now(),
    agents: context.agents,
    table: context.table
  });
  return viewStep(context, file, card, view, {
    known,
    deadline: deadlineOf(turn, context)
  });
}

/**
 * A starting card: the agents source is searched by the session the binding names. One match is the turn's
 * process; none is absence, and two are ambiguous, so neither is decided here.
 */
async function decideStarting(
  context: Context,
  file: ThreadFile,
  card: OpenCard
): Promise<CardStep> {
  const binding = file.slots[slotKey(slotOfCard(context, card))];
  if (binding === undefined || ownerTokenOf(binding, card.turn) === undefined) {
    return crashed(context, file, card);
  }
  const lookup = lookupBySession(context.agents, binding.nativeSessionId);
  if (lookup.status === "found") {
    return foundStep(context, file, card, lookup.process);
  }
  if (lookup.status === "absent") return absentStep(context, file, card);
  return { undecided: true };
}

type Listed = { pid: number; startedAt: number; sessionId: string };

async function foundStep(
  context: Context,
  file: ThreadFile,
  card: OpenCard,
  listed: Listed
): Promise<CardStep> {
  const view = judgeProcessView({
    pid: listed.pid,
    startedAt: listed.startedAt,
    sessionId: listed.sessionId,
    since: listed.startedAt,
    now: context.deps.options.turn.now(),
    agents: context.agents,
    table: context.table
  });
  if (view === "alive") return adoptStarting(context, file, card, listed);
  return viewStep(context, file, card, view, {
    known: listed.startedAt,
    deadline: 0
  });
}

function absentStep(
  context: Context,
  file: ThreadFile,
  card: OpenCard
): Promise<CardStep> {
  if (isGraceOpen(context)) return Promise.resolve({ undecided: true });
  return crashed(context, file, card);
}

/**
 * Writes the card running with the process it found, and takes the run over. The deadline is the authorized
 * time limit counted from the reconciliation, or the present instant when no limit is authorized.
 */
async function adoptStarting(
  context: Context,
  file: ThreadFile,
  card: OpenCard,
  listed: Listed
): Promise<CardStep> {
  const now = context.deps.options.turn.now();
  const read = await context.deps.services.ledger.turnTimeoutState(
    context.target.workspace
  );
  const minutes = authorizedMinutesOf(read);
  const deadline = minutes === undefined ? now : now + minutes * MINUTE_MS;
  const turn = card.turn;
  if (turn === undefined) return crashed(context, file, card);
  const running = transitionRecord(card, "running", {
    turn: withProcess(turn, listed.pid, {
      startedAt: isoOf(listed.startedAt),
      deadlineAt: new Date(deadline).toISOString(),
      runningAt: new Date(now).toISOString()
    })
  });
  if (running === undefined) return { undecided: true };
  const next = withCard(file, running);
  return {
    file: next,
    adopt: runOf(context, running, next, listed.startedAt, deadline)
  };
}

/**
 * Maps the view of a process to the card's outcome. Alive is taken over, whether or not its start instant is
 * known: its session already identified it. Unknown waits. The rest is gone.
 */
function viewStep(
  context: Context,
  file: ThreadFile,
  card: OpenCard,
  view: ProcessView,
  process: { known: number | undefined; deadline: number }
): Promise<CardStep> {
  if (view === "alive") {
    const adopt = runOf(context, card, file, process.known, process.deadline);
    return Promise.resolve({ adopt });
  }
  if (view === "unknown") return Promise.resolve({ undecided: true });
  return goneStep(context, file, card);
}

function goneStep(
  context: Context,
  file: ThreadFile,
  card: OpenCard
): Promise<CardStep> {
  if (isGraceOpen(context)) return Promise.resolve({ undecided: true });
  return crashed(context, file, card);
}

function isGraceOpen(context: Context): boolean {
  const { options } = context.deps;
  return inGraceAt(options, options.now());
}

/** The run to take over. The card is running and its binding was checked for ownership before. */
function runOf(
  context: Context,
  record: SupervisionRecord,
  file: ThreadFile,
  startedAt: number | undefined,
  deadline: number
): AdoptedRun {
  const turn = record.turn;
  const slot = slotOfCard(context, record);
  const binding = file.slots[slotKey(slot)];
  return {
    scope: turnScopeOf(context.target),
    runId: record.runId ?? "",
    record,
    slot,
    generation: turn?.generation ?? 0,
    ownerToken: ownerTokenOf(binding, turn) ?? "",
    pid: turn?.pid ?? 0,
    startedAt,
    sessionId: binding?.nativeSessionId ?? "",
    since: turn === undefined ? undefined : sinceOf(turn, startedAt),
    deadline
  };
}

/** Ends a card as crashed, and releases its binding when this card still owns it. The reservation stays debited. */
function crashed(
  context: Context,
  file: ThreadFile,
  card: OpenCard
): Promise<CardStep> {
  const failed = transitionRecord(card, "failed", { reason: "crashed" });
  if (failed === undefined) return Promise.resolve({ undecided: true });
  const key = slotKey(slotOfCard(context, card));
  const released = releasedFile({
    file,
    slot: key,
    binding: file.slots[key],
    turn: card.turn,
    endedAt: context.deps.options.now(),
    lastCostUsd: undefined
  });
  return Promise.resolve({ file: withCard(released, failed) });
}

function withCard(file: ThreadFile, record: SupervisionRecord): ThreadFile {
  const state = supervisionOf(file);
  return {
    ...file,
    supervision: pruneSupervision({
      records: upsertRecord(state.records, record),
      floors: state.floors
    })
  };
}

/** The start instant the card recorded, or else the one the binding recorded for the same pid. */
function knownStartOf(
  turn: SupervisionTurn,
  binding: SessionBinding | undefined
): number | undefined {
  if (turn.startedAt !== undefined) return Date.parse(turn.startedAt);
  if (binding?.owner.clientPid !== turn.pid) return undefined;
  return binding?.owner.clientStartedAt;
}

/**
 * The instant the presence grace of the process counts from: its start when one is known, else the instant
 * the card went running. Undefined only for a card that recorded neither.
 */
function sinceOf(
  turn: SupervisionTurn,
  known: number | undefined
): number | undefined {
  if (known !== undefined) return known;
  if (turn.runningAt === undefined) return undefined;
  return Date.parse(turn.runningAt);
}

/** The deadline the card recorded. A card without one is due at once, so the grace kill is never skipped. */
function deadlineOf(turn: SupervisionTurn, context: Context): number {
  const parsed = Date.parse(turn.deadlineAt ?? "");
  if (Number.isNaN(parsed)) return context.deps.options.turn.now();
  return parsed;
}

function slotOfCard(context: Context, card: SupervisionRecord): SlotKey {
  return slotOf(
    context.target.workspace,
    context.target.threadId,
    card.recipient
  );
}

function turnScopeOf(target: ThreadTarget): TurnScope {
  return { workspace: target.workspace, threadId: target.threadId };
}
