import { lexicalRanksByThread } from "./hybrid-ranking.js";
import {
  catalogRowsAt,
  groupsOf,
  type CatalogRow,
  type DepthGroup
} from "./funnel-groups.js";
import { MEMORY_DEPTH_LAYERS } from "./search-depth.js";
import {
  planStepPairs,
  stepAllowance,
  stepPassages,
  validateFunnelBudget,
  type StepPlan
} from "./funnel-budget.js";
import { admittedOf, type FunnelAdmitted } from "./funnel-admission.js";
import {
  selectFinalists,
  selectRerankPassages,
  type RerankSelectionMode
} from "./funnel-selection.js";
import {
  consolidateThreads,
  rerankingEvidence,
  type RankedEvidence
} from "./semantic-ranking.js";
import type { MemoryLayer } from "./sources/contract.js";
import type { MemorySearchChannels, MemorySearchDepth } from "./types.js";

export { MissingRerankScore, type FunnelAdmitted } from "./funnel-admission.js";

/** When a multi-step search stops early. `none` never stops before the last depth. */
export type FunnelStopRule = "none" | "high" | "high-or-medium";

export type FunnelConfig = {
  /** Depths searched in order. One depth is the explicit funnel. */
  depths: readonly MemorySearchDepth[];
  stopOn: FunnelStopRule;
  /** Budgeted variants share the pairs of the query; unbudgeted ones score every request. */
  budgeted: boolean;
  /**
   * Passages per finalist: the step share or every passage of the catalog up to the depth, or the
   * consolidated passages of M0 (the channel passages, or the identity alone when there are none).
   */
  passages: "budget" | "all" | "consolidated";
  /** Finalists: by the funnel rule, or every candidate group. */
  finalists: "funnel" | "all";
};

/** The inputs of one case: channels per depth, the catalog, captured scores and the parameters. */
export type FunnelCaseInput = {
  queryVector: readonly number[];
  channelsByDepth: Partial<Record<MemorySearchDepth, MemorySearchChannels>>;
  /** Vector of every record that a channel holds, keyed by recordId. */
  vectors: ReadonlyMap<string, readonly number[]>;
  /**
   * Every identity and passage of each group, from the index, not only from the channels. The
   * passages of a finalist come from here, up to the layers of the depth.
   */
  catalog: ReadonlyMap<string, readonly CatalogRow[]>;
  /** Reranker score of each pair of the effective query, keyed by recordId. */
  scores: ReadonlyMap<string, number>;
  ftsRecordIds: ReadonlySet<string>;
  budget: number;
  k: number;
  mode: RerankSelectionMode;
  /**
   * Band cuts: an eligibility at or above a cut reaches that band. Without cuts no band is set, so a
   * variant whose stop rule reads the bands cannot run without them.
   */
  cuts?: { high: number; medium: number };
};

export type FunnelStop =
  | "single-step"
  | "high-band"
  | "medium-band"
  | "deepest-layer"
  | "budget";

export type FunnelStepSummary = {
  depth: MemorySearchDepth;
  allowance: number;
  spent: number;
  /** Pairs this step scored for the first time, in request order. */
  scored: string[];
  /** Pairs this step reused from an earlier step, at no cost. */
  cached: string[];
  truncated: boolean;
  droppedFinalists: string[];
  /**
   * Groups this step admitted, in its admission order. The reach of a step is read from this list with
   * the reach rule of its variant. Finalists that were not admitted are not listed: admission filters them.
   */
  admitted: FunnelAdmitted[];
  /**
   * The finalists this step kept, in finalist order, each with the pair record ids it selected and
   * that were usable at the step (scored now or reused). A finalist without a usable pair is not kept.
   */
  finalists: Array<{ groupId: string; recordIds: string[] }>;
};

export type FunnelRunResult = {
  admitted: FunnelAdmitted[];
  /** Layers of the deepest step that ran. */
  layersSearched: MemoryLayer[];
  /** Pairs requested by the steps: scored, reused and unscored. */
  pairsRequested: number;
  /** Pairs scored for the first time, which is never more than the budget. */
  pairsUnique: number;
  stopReason: FunnelStop;
  steps: FunnelStepSummary[];
};

type StepOutcome = {
  depth: MemorySearchDepth;
  plan: StepPlan;
  admitted: FunnelAdmitted[];
  finalists: Array<{ groupId: string; recordIds: string[] }>;
};

type RunState = { spent: number; reusable: Set<string> };

/** Runs the funnel over the depths of a config and returns the admitted groups and the trace. */
export function runFunnel(
  input: FunnelCaseInput,
  config: FunnelConfig
): FunnelRunResult {
  if (config.budgeted) validateFunnelBudget(input.budget, input.k);
  const state: RunState = { spent: 0, reusable: new Set<string>() };
  const steps: FunnelStepSummary[] = [];
  let stopReason: FunnelStop =
    config.depths.length > 1 ? "deepest-layer" : "single-step";
  let last: StepOutcome | undefined;
  let pairsRequested = 0;
  for (const [index, depth] of config.depths.entries()) {
    const isLast = index === config.depths.length - 1;
    const allowance = config.budgeted
      ? stepAllowance(input.budget, state.spent, isLast)
      : Number.POSITIVE_INFINITY;
    if (allowance <= 0) {
      stopReason = "budget";
      break;
    }
    const outcome = runStep(input, config, depth, allowance, state);
    state.spent += outcome.plan.spent;
    for (const recordId of outcome.plan.scored) state.reusable.add(recordId);
    pairsRequested +=
      outcome.plan.scored.length +
      outcome.plan.cached.length +
      outcome.plan.unscored.length;
    steps.push({
      depth,
      allowance,
      spent: outcome.plan.spent,
      scored: outcome.plan.scored,
      cached: outcome.plan.cached,
      truncated: outcome.plan.truncated,
      droppedFinalists: outcome.plan.droppedFinalists,
      admitted: outcome.admitted,
      finalists: outcome.finalists
    });
    last = outcome;
    const stopped = stopAfter(config.stopOn, outcome.admitted);
    if (stopped !== undefined) {
      stopReason = stopped;
      break;
    }
  }
  return {
    admitted: last?.admitted ?? [],
    layersSearched: last ? [...MEMORY_DEPTH_LAYERS[last.depth]] : [],
    pairsRequested,
    pairsUnique: state.spent,
    stopReason,
    steps
  };
}

/**
 * The stop rule of a step, over the whole admitted list: any high-band result stops the search, and
 * under `high-or-medium` any medium-band result stops it too. The first result alone does not decide.
 */
export function stopAfter(
  rule: FunnelStopRule,
  admitted: readonly FunnelAdmitted[]
): FunnelStop | undefined {
  if (rule === "none") return undefined;
  if (admitted.some((item) => item.band === "high")) return "high-band";
  if (
    rule === "high-or-medium" &&
    admitted.some((item) => item.band === "medium")
  )
    return "medium-band";
  return undefined;
}

function runStep(
  input: FunnelCaseInput,
  config: FunnelConfig,
  depth: MemorySearchDepth,
  allowance: number,
  state: RunState
): StepOutcome {
  const channels = input.channelsByDepth[depth];
  if (channels === undefined)
    throw new Error(`The case has no channels for depth ${depth}.`);
  const groups: DepthGroup[] = groupsOf(channels, input.vectors);
  const byId = new Map(groups.map((group) => [group.groupId, group]));
  const finalistIds =
    config.finalists === "all"
      ? groups.map((group) => group.groupId)
      : selectFinalists(groups, input.k);
  const planned = finalistIds.map((groupId) => ({
    groupId,
    recordIds: PASSAGE_SELECTORS[config.passages](
      input,
      byId.get(groupId),
      allowance,
      catalogRowsAt(input.catalog, groupId, depth)
    )
  }));
  const plan = planStepPairs({
    finalists: planned,
    cached: state.reusable,
    allowance: config.budgeted ? allowance : Number.POSITIVE_INFINITY
  });
  const usable = new Set([...plan.scored, ...plan.cached]);
  const usableByGroup = planned
    .filter((finalist) => plan.keptFinalists.includes(finalist.groupId))
    .map((finalist) => ({
      groupId: finalist.groupId,
      recordIds: finalist.recordIds.filter((recordId) => usable.has(recordId))
    }));
  const admitted = admittedOf(
    usableByGroup,
    byId,
    input.scores,
    lexicalRanksByThread(channels),
    input.cuts
  );
  return { depth, plan, admitted, finalists: usableByGroup };
}

type PassageSelector = (
  input: FunnelCaseInput,
  group: DepthGroup | undefined,
  allowance: number,
  catalogRows: readonly CatalogRow[]
) => string[];

/**
 * Passages of a finalist, by the rule of the config. Dispatch table over `FunnelConfig.passages`. The
 * budget and all rules read the catalog up to the depth; the consolidated rule reads the channels, as M0.
 */
const PASSAGE_SELECTORS: Readonly<
  Record<FunnelConfig["passages"], PassageSelector>
> = {
  budget: (input, _group, allowance, catalogRows) =>
    selectRerankPassages(
      input.queryVector,
      catalogRows,
      stepPassages(allowance, input.k),
      input.mode,
      input.ftsRecordIds
    ),
  all: (input, _group, _allowance, catalogRows) =>
    selectRerankPassages(
      input.queryVector,
      catalogRows,
      Number.POSITIVE_INFINITY,
      input.mode,
      input.ftsRecordIds
    ),
  consolidated: (_input, group) => consolidatedPassages(group)
};

/**
 * The records that M0 sends to the reranker for a group: the consolidation of its channel evidence, and
 * the identity alone when the group has no channel passage (rerankingEvidence, as in semantic-ranking.ts).
 */
function consolidatedPassages(group: DepthGroup | undefined): string[] {
  if (group === undefined) return [];
  const evidence: RankedEvidence[] =
    group.identity === undefined
      ? group.passages
      : [group.identity, ...group.passages];
  return consolidateThreads(evidence).flatMap((candidate) =>
    rerankingEvidence(candidate).map((item) => item.record.recordId)
  );
}
