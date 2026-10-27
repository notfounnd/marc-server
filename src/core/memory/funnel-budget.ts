/**
 * Budget rules of the E3 funnel: the reranker pairs one query may score, split by step, and
 * the pairs that each step plans. Pure: no model runs and no file is read. A pair is the
 * tuple (effective query, recordId); a pair already scored by an earlier step is free.
 */

/** Passages per finalist in a step: a step never plans fewer than three. */
export const FUNNEL_MIN_PASSAGES = 3;

/**
 * Refuses a budget that cannot give every finalist its three passages in the first step:
 * 3K <= floor(B / 2). The first step of an adaptive search is never truncated.
 */
export function validateFunnelBudget(budget: number, k: number): void {
  if (3 * k <= Math.floor(budget / 2)) return;
  throw new Error(
    `The funnel budget ${budget} cannot give ${k} finalists three passages in the first step.`
  );
}

/**
 * The pairs that a step may score. When another step follows, the step takes half of the
 * balance; the last step takes all of it. A step with no balance does not run.
 *
 * With 3K <= floor(B/2) the first step scores at most floor(B/2), so the balance left for the
 * next step is at least ceil(B/2) >= 1, and every later step gets at least one pair. The stop
 * reason `budget` therefore only appears with B = 0: it is a safety stop, not a planned path.
 */
export function stepAllowance(
  budget: number,
  spent: number,
  isLastStep: boolean
): number {
  const balance = Math.max(0, budget - spent);
  if (isLastStep) return balance;
  return Math.floor(balance / 2);
}

/** Passages per finalist in a step: as many as the allowance shares, and at least three. */
export function stepPassages(allowance: number, k: number): number {
  return Math.max(FUNNEL_MIN_PASSAGES, Math.floor(allowance / k));
}

export type PlannedFinalist = {
  groupId: string;
  /** Records of the finalist in the order that they are requested. */
  recordIds: readonly string[];
};

export type StepPlan = {
  /** Pairs scored by this step, in request order. */
  scored: string[];
  /** Pairs reused at no cost: scored by an earlier step, or repeated within this step. */
  cached: string[];
  /** Pairs requested after the allowance ran out. They are not scored. */
  unscored: string[];
  /** Finalists with at least one usable pair (cached or scored), in order. */
  keptFinalists: string[];
  /** Finalists with no usable pair. They are never admitted. */
  droppedFinalists: string[];
  /** Pairs scored by this step, which is never more than its allowance. */
  spent: number;
  /** True when some requested pair was left unscored for lack of allowance. */
  truncated: boolean;
};

/**
 * Plans the pairs of one step in the order of the finalists and, inside each finalist, the
 * order of its passages. A pair is scored only while the allowance lasts.
 */
export function planStepPairs(input: {
  finalists: readonly PlannedFinalist[];
  cached: ReadonlySet<string>;
  allowance: number;
}): StepPlan {
  const plan: StepPlan = {
    scored: [],
    cached: [],
    unscored: [],
    keptFinalists: [],
    droppedFinalists: [],
    spent: 0,
    truncated: false
  };
  const handled = new Set<string>();
  for (const finalist of input.finalists) {
    const usable = planFinalistPairs(finalist, input, plan, handled);
    const target = usable > 0 ? plan.keptFinalists : plan.droppedFinalists;
    target.push(finalist.groupId);
  }
  return plan;
}

/** Adds one finalist's pairs to the plan and returns how many of them are usable. */
function planFinalistPairs(
  finalist: PlannedFinalist,
  input: { cached: ReadonlySet<string>; allowance: number },
  plan: StepPlan,
  handled: Set<string>
): number {
  let usable = 0;
  for (const recordId of finalist.recordIds) {
    if (input.cached.has(recordId) || handled.has(recordId)) {
      plan.cached.push(recordId);
      handled.add(recordId);
      usable += 1;
      continue;
    }
    if (plan.spent < input.allowance) {
      plan.scored.push(recordId);
      handled.add(recordId);
      plan.spent += 1;
      usable += 1;
      continue;
    }
    plan.unscored.push(recordId);
    plan.truncated = true;
  }
  return usable;
}
