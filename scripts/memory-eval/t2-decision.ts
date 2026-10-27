import { bandCutsOf, type ScoredLabel } from "./fit-model.js";
import { pairedBootstrap, ratio, type FamilySums, type Interval } from "./statistics.js";

/** The grid of K of the E3, with B = 232 and 3K ≤ ⌊B / 2⌋ for every value. */
export const T2_K_GRID: readonly number[] = [8, 10, 12, 15, 20, 25, 30];
/** The depths whose recall the choice of K must meet. */
export const T2_DEPTHS: readonly number[] = [0, 1, 2];
/** The loss of recall of relevant groups that the choice of K tolerates, against all candidates. */
export const T2_RECALL_LOSS = 0.02;

/**
 * One depth of one case: the relevant candidate groups (grade ≥ 2 at that depth) and the groups that
 * each K keeps as finalists. The candidates are the groups of the all-candidates reference.
 */
export type DepthTrials = {
  relevant: readonly string[];
  keptByK: ReadonlyMap<number, readonly string[]>;
};

/** The trials of every case, by depth. */
export type CaseTrials = ReadonlyMap<number, DepthTrials>;

export type KChoice = {
  k: number;
  /** False when no K of the grid met the tolerance on the training folds: the largest K is then reported. */
  met: boolean;
  /** The recall of relevant groups per depth at the chosen K, or null without relevant groups. */
  recallByDepth: Record<number, number | null>;
};

/**
 * The recall of relevant groups among the finalists of a K, summed over the cases of the given set.
 * Null when no case of the set has a relevant group at that depth.
 */
export function recallOf(
  caseIds: readonly string[],
  trials: ReadonlyMap<string, CaseTrials>,
  depth: number,
  k: number
): number | null {
  const totals = caseIds.reduce(
    (sums, caseId) => {
      const depthTrials = trials.get(caseId)?.get(depth);
      if (depthTrials === undefined) return sums;
      const kept = new Set(depthTrials.keptByK.get(k) ?? []);
      const found = depthTrials.relevant.filter((groupId) => kept.has(groupId)).length;
      return { found: sums.found + found, relevant: sums.relevant + depthTrials.relevant.length };
    },
    { found: 0, relevant: 0 }
  );
  return ratio(totals.found, totals.relevant);
}

/**
 * The smallest K of the grid whose recall loss is at most T2_RECALL_LOSS at every depth, measured only on
 * the training folds: the cases whose fold is not `fold`. Without `fold`, every case is training (production).
 */
export function chooseK(input: {
  trials: ReadonlyMap<string, CaseTrials>;
  folds: ReadonlyMap<string, number>;
  fold?: number;
  grid?: readonly number[];
}): KChoice {
  const grid = input.grid ?? T2_K_GRID;
  const training = [...input.trials.keys()].filter((caseId) => input.fold === undefined || input.folds.get(caseId) !== input.fold);
  const meets = (k: number): boolean =>
    T2_DEPTHS.every((depth) => {
      const recall = recallOf(training, input.trials, depth, k);
      return recall === null || recall >= 1 - T2_RECALL_LOSS;
    });
  const chosen = grid.find((k) => meets(k));
  const k = chosen ?? grid[grid.length - 1];
  if (k === undefined) throw new Error("The K grid is empty.");
  const recallByDepth = Object.fromEntries(
    T2_DEPTHS.map((depth) => [depth, recallOf(training, input.trials, depth, k)])
  ) as Record<number, number | null>;
  return { k, met: chosen !== undefined, recallByDepth };
}

/** One labelled candidate pair of the training set: its M0 eligibility and its relevance label. */
export type CutPair = { caseId: string; score: number; label: 0 | 1 };

/**
 * The fallback band cuts of a fold: the cuts that bandCutsOf (fit.ts) gives over the labelled pairs of the
 * training folds only. Without `fold`, every pair is training (production).
 */
export function cutsOf(input: {
  pairs: readonly CutPair[];
  folds: ReadonlyMap<string, number>;
  fold?: number;
}): ReturnType<typeof bandCutsOf> {
  const training: ScoredLabel[] = input.pairs
    .filter((pair) => input.fold === undefined || input.folds.get(pair.caseId) !== input.fold)
    .map((pair) => ({ score: pair.score, label: pair.label }));
  return bandCutsOf(training);
}

/**
 * Evidence survival of a case: whether some selected passage holds the citation of the evidence. The
 * passages are compared by passageId, which is the path and hash of the passage in the capture.
 */
export function survivedOf(selectedPassageIds: readonly string[], evidencePassageIds: readonly string[]): boolean {
  return selectedPassageIds.some((passageId) => evidencePassageIds.includes(passageId));
}

/** One case of a ratio that is bootstrapped by family: its family and its numerator and denominator. */
export type RatioRow = { family: string; num: number; den: number };

/**
 * The interval of a ratio of sums, by paired bootstrap over families. The baseline is zero, so the
 * difference is the ratio itself. Undefined when there are no applicable rows.
 */
export function ratioIntervalOf(rows: readonly RatioRow[]): Interval | undefined {
  const families: FamilySums[] = rows.map((row) => ({
    family: row.family,
    candidateNum: row.num,
    candidateDen: row.den,
    baselineNum: 0,
    baselineDen: row.den
  }));
  return pairedBootstrap(families.filter((family) => family.candidateDen > 0));
}
