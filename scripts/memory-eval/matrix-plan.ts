/**
 * Pure planning of the E3 reranker matrix: the count of pairs before any scoring, the hours that
 * the count implies, and the append-only complement rounds. No model runs and no file is written.
 */

/** Pairs per second of the T0 study, with the ordering adopted by size. Turns pairs into hours. */
export const ADOPTED_PAIRS_PER_SECOND = 11.74;
/** A capture whose count exceeds this many hours is refused before any pair is scored. */
export const COUNT_LIMIT_HOURS = 12;

const SECONDS_PER_HOUR = 3600;

export type CountPlan = {
  /** Pairs of the matrix over every case of the capture. */
  totalPairs: number;
  /** Hours that the total takes at the adopted throughput. */
  hours: number;
  /** True when the hours are above the limit: the approvers must be consulted before scoring. */
  refused: boolean;
};

/** Sums the pairs of every case and converts them to hours; refuses above the limit (inclusive limit). */
export function countPlanOf(
  pairsPerCase: readonly number[],
  pairsPerSecond: number = ADOPTED_PAIRS_PER_SECOND,
  limitHours: number = COUNT_LIMIT_HOURS
): CountPlan {
  const totalPairs = pairsPerCase.reduce((sum, pairs) => sum + pairs, 0);
  const hours = totalPairs / pairsPerSecond / SECONDS_PER_HOUR;
  return { totalPairs, hours, refused: hours > limitHours };
}

export type ComplementRound = {
  /** Round number, from 1, in the order the rounds were run. */
  round: number;
  caseId: string;
  /** Record ids that the round adds to the matrix of the case. Never a record already held. */
  addedRecordIds: string[];
  /**
   * Pair keys that the round scored with the reranker: the new keys of the added records. The universe
   * of the worksheet is read without them, so that a complement never moves it.
   */
  addedKeys?: string[];
};

/**
 * The cells that a complement round adds: the records of the new scope that the case does not
 * hold yet. The held records keep their place; nothing is removed and nothing is scored twice.
 */
export function complementRoundOf(input: {
  round: number;
  caseId: string;
  held: ReadonlySet<string>;
  scope: ReadonlySet<string>;
}): ComplementRound {
  const addedRecordIds = [...input.scope].filter((recordId) => !input.held.has(recordId)).sort();
  return { round: input.round, caseId: input.caseId, addedRecordIds };
}

/**
 * Checks that the rounds written so far are kept as a prefix of the new log: an append-only log
 * never drops or rewrites a round. Returns the problems, empty when the log only grew.
 */
export function appendOnlyProblems(previous: readonly ComplementRound[], next: readonly ComplementRound[]): string[] {
  const kept = previous.every((round, index) => sameRound(round, next[index]));
  if (kept && next.length >= previous.length) return [];
  return [`the complement log was rewritten: ${previous.length} rounds before, ${next.length} after`];
}

function sameRound(left: ComplementRound, right: ComplementRound | undefined): boolean {
  if (right === undefined) return false;
  return (
    left.round === right.round &&
    left.caseId === right.caseId &&
    left.addedRecordIds.length === right.addedRecordIds.length &&
    left.addedRecordIds.every((recordId, index) => recordId === right.addedRecordIds[index])
  );
}

/** One evidence quote of a case, located among the passages of its source. */
export type EvidenceMatch = {
  sourcePath: string;
  quote: string;
  /** Passages that hold the whole quote. Empty unless the status is `indexed`. */
  passageIds: string[];
  /**
   * `indexed`: a single passage holds the quote. `evidence_unindexable`: the source holds the quote
   * but it is split between passages, so no passage holds it whole. `missing`: the source lacks it.
   */
  status: "indexed" | "evidence_unindexable" | "missing";
};

export type EvidencePassage = { passageId: string; sourcePath: string; text: string };
