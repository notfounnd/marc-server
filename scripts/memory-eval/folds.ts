import { createHash } from "node:crypto";
import { STATISTICS_SEED } from "./statistics.js";

export const FOLD_COUNT = 5;

/**
 * Assigns each family to one of FOLD_COUNT folds. Families are ordered by
 * sha256("20261015:" + family) and distributed round-robin, so the assignment
 * is deterministic and the fold sizes differ by at most one.
 */
export function assignFolds(families: readonly string[]): Map<string, number> {
  const keyed = [...new Set(families)]
    .map((family) => ({
      family,
      key: createHash("sha256")
        .update(`${STATISTICS_SEED}:${family}`)
        .digest("hex")
    }))
    .sort((left, right) => (left.key < right.key ? -1 : Number(left.key > right.key)));
  return new Map(keyed.map((item, index) => [item.family, index % FOLD_COUNT]));
}

/**
 * The outer fold of each case: the fold of its family, as assignFolds gives it
 * for the families of the whole dataset. The fit and the replay both use it.
 */
export function caseFolds(
  cases: readonly { id: string; family: string }[]
): Map<string, number> {
  const folds = assignFolds(cases.map((item) => item.family));
  return new Map(
    cases.map((item) => [item.id, foldOf(folds, item.family)] as const)
  );
}

function foldOf(folds: ReadonlyMap<string, number>, family: string): number {
  const fold = folds.get(family);
  if (fold === undefined) throw new Error(`No fold for family ${family}.`);
  return fold;
}
