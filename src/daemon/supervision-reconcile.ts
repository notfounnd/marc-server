import type { SupervisionRecord } from "../core/activation-supervision-types.js";
import { scopeOf } from "./activation-views.js";
import type { AdoptedRun } from "./supervision-adopted-run.js";
import { processesOf } from "./process-table-os.js";
import { supervisionOf } from "./supervision-pass.js";
import {
  decideCard,
  type CardStep,
  type Context,
  type OpenCard,
  type ReconcileDeps,
  type ThreadTarget
} from "./supervision-reconcile-cards.js";
import type { ThreadFile, ThreadStep } from "./thread-store.js";

export type {
  ReconcileDeps,
  ThreadTarget
} from "./supervision-reconcile-cards.js";

/** One pass over the threads. It returns how many cards are still undecided, so the caller retries. */
export type Reconciler = {
  pass(targets: readonly ThreadTarget[]): Promise<number>;
};

type ThreadOutcome = { undecided: number; adopt: AdoptedRun[] };

const NOTHING: ThreadOutcome = { undecided: 0, adopt: [] };

/**
 * The reconciliation of the daemon's start. The first pass decides every card that was starting or running
 * when the daemon started; later passes only retry those cards, so a launch approved after the start is
 * never judged as lost. Every decision is written inside the thread's queue, after a read of the card and
 * the binding inside that step. A decision that needs absence waits until the presence grace has ended.
 */
export function createReconciler(deps: ReconcileDeps): Reconciler {
  let snapshot: Set<string> | undefined;
  return {
    async pass(targets) {
      const seen = new Set<string>();
      let undecided = 0;
      for (const target of targets) {
        undecided += await reconcileThread(deps, target, snapshot, seen);
      }
      snapshot ??= seen;
      return undecided;
    }
  };
}

async function reconcileThread(
  deps: ReconcileDeps,
  target: ThreadTarget,
  snapshot: Set<string> | undefined,
  seen: Set<string>
): Promise<number> {
  const result = await deps.services.threads.update<ThreadOutcome>(
    scopeOf(target.workspace, target.threadId),
    (file) => reconcileStep(deps, target, snapshot, seen, file)
  );
  if (result.status !== "done") return 0;
  for (const run of result.value.adopt) deps.runner.adopt?.(run);
  return result.value.undecided;
}

async function reconcileStep(
  deps: ReconcileDeps,
  target: ThreadTarget,
  snapshot: Set<string> | undefined,
  seen: Set<string>,
  file: ThreadFile
): Promise<ThreadStep<ThreadOutcome>> {
  const open = supervisionOf(file).records.filter(isOpenCard);
  for (const card of open) seen.add(card.runId);
  const cards = open.filter((card) => isDecidable(deps, card, snapshot));
  if (cards.length === 0) return { value: NOTHING };
  const context = await contextOf(deps, target);
  let next = file;
  const adopt: AdoptedRun[] = [];
  let undecided = 0;
  for (const card of cards) {
    const step: CardStep = await decideCard(context, next, card);
    next = step.file ?? next;
    if (step.adopt !== undefined) adopt.push(step.adopt);
    if (step.undecided === true) undecided += 1;
  }
  return {
    value: { undecided, adopt },
    file: next === file ? undefined : next
  };
}

/** The agents source and the process table, read once for the thread's step. */
async function contextOf(
  deps: ReconcileDeps,
  target: ThreadTarget
): Promise<Context> {
  const agents = await deps.sessions.presence.agents();
  const table = await processesOf(deps.sessions.processes).list();
  return { deps, target, agents, table };
}

function isOpenCard(record: SupervisionRecord): record is OpenCard {
  if (record.runId === undefined) return false;
  return record.status === "running" || record.status === "starting";
}

/**
 * A card is decided when the daemon started with it, and no live run of this daemon owns it. The snapshot of
 * the first pass is what makes a launch approved later invisible to the reconciliation.
 */
function isDecidable(
  deps: ReconcileDeps,
  card: OpenCard,
  snapshot: Set<string> | undefined
): boolean {
  if (snapshot !== undefined && !snapshot.has(card.runId)) return false;
  return deps.runner.isLive?.(card.runId) !== true;
}
