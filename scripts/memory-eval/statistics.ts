/** Seed of the bootstrap and of the family folds (plan section 7). */
export const STATISTICS_SEED = 20261015;
export const BOOTSTRAP_RESAMPLES = 10_000;
export const PROPORTION_MARGIN = 0.05;
export const RANKING_MARGIN = 0.03;

export type DecisionTerm = "melhora" | "piora" | "não inferior" | "inconclusivo";

export type FamilySums = {
  family: string;
  candidateNum: number;
  candidateDen: number;
  baselineNum: number;
  baselineDen: number;
};

export type Interval = { lower: number; upper: number };

/** mulberry32: small seeded generator, deterministic across runs. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ratio of sums, or null when the denominator is zero. */
export function ratio(num: number, den: number): number | null {
  if (den === 0) return null;
  return num / den;
}

/**
 * Paired bootstrap by family: draws families with replacement and computes
 * the difference candidate − baseline of the ratios of sums. Interval is the
 * percentile 2.5 / 97.5 (nearest rank) over the finite differences.
 */
export function pairedBootstrap(families: readonly FamilySums[]): Interval | undefined {
  if (families.length === 0) return undefined;
  const random = mulberry32(STATISTICS_SEED);
  const differences: number[] = [];
  for (let resample = 0; resample < BOOTSTRAP_RESAMPLES; resample += 1) {
    const drawn = Array.from(
      { length: families.length },
      () => families[Math.floor(random() * families.length)]
    );
    const sums = drawn.reduce(
      (total, family) => ({
        candidateNum: total.candidateNum + (family?.candidateNum ?? 0),
        candidateDen: total.candidateDen + (family?.candidateDen ?? 0),
        baselineNum: total.baselineNum + (family?.baselineNum ?? 0),
        baselineDen: total.baselineDen + (family?.baselineDen ?? 0)
      }),
      { candidateNum: 0, candidateDen: 0, baselineNum: 0, baselineDen: 0 }
    );
    const candidate = ratio(sums.candidateNum, sums.candidateDen);
    const baseline = ratio(sums.baselineNum, sums.baselineDen);
    if (candidate === null || baseline === null) continue;
    differences.push(candidate - baseline);
  }
  if (differences.length === 0) return undefined;
  differences.sort((left, right) => left - right);
  return {
    lower: nearestRank(differences, 0.025),
    upper: nearestRank(differences, 0.975)
  };
}

/** Nearest-rank percentile of a sorted, non-empty array. */
export function nearestRank(sorted: readonly number[], probability: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(probability * sorted.length) - 1));
  return sorted[index] ?? 0;
}

/**
 * Exact McNemar test (two-sided binomial). b and c are the discordant pairs.
 * p = min(1, 2 · P(X <= min(b, c))), with X ~ Binomial(b + c, 0.5).
 */
export function mcnemarExact(b: number, c: number): number {
  const trials = b + c;
  if (trials === 0) return 1;
  const smaller = Math.min(b, c);
  let cumulative = 0;
  let coefficient = 1;
  for (let successes = 0; successes <= smaller; successes += 1) {
    cumulative += coefficient / 2 ** trials;
    coefficient = (coefficient * (trials - successes)) / (successes + 1);
  }
  return Math.min(1, 2 * cumulative);
}

/**
 * Cohen's weighted kappa with quadratic weights over `categories` ordinal
 * levels (0..categories-1). Pairs are [gradeA, gradeB]. Returns null when
 * there are no pairs or the expected disagreement is zero.
 */
export function quadraticKappa(
  pairs: ReadonlyArray<readonly [number, number]>,
  categories = 4
): number | null {
  const total = pairs.length;
  if (total === 0) return null;
  const observed = Array.from({ length: categories }, () =>
    Array.from({ length: categories }, () => 0)
  );
  for (const [left, right] of pairs) {
    const row = observed[left];
    if (row !== undefined) row[right] = (row[right] ?? 0) + 1;
  }
  const rows = observed.map((row) => row.reduce((sum, value) => sum + value, 0));
  const columns = Array.from({ length: categories }, (_, column) =>
    observed.reduce((sum, row) => sum + (row[column] ?? 0), 0)
  );
  const weight = (left: number, right: number): number =>
    ((left - right) / (categories - 1)) ** 2;
  let weightedObserved = 0;
  let weightedExpected = 0;
  for (let left = 0; left < categories; left += 1) {
    for (let right = 0; right < categories; right += 1) {
      const expected = ((rows[left] ?? 0) * (columns[right] ?? 0)) / total;
      weightedObserved += weight(left, right) * (observed[left]?.[right] ?? 0);
      weightedExpected += weight(left, right) * expected;
    }
  }
  if (weightedExpected === 0) return null;
  return 1 - weightedObserved / weightedExpected;
}

/**
 * Decision vocabulary (plan section 7). Improvement, worsening, non-inferiority
 * and inconclusive are exclusive terms. "Inconclusivo" is never non-inferior.
 */
export function decisionTerm(
  interval: Interval,
  margin: number
): { term: DecisionTerm; nonInferior: boolean } {
  return { term: termOf(interval, margin), nonInferior: interval.lower > -margin };
}

function termOf(interval: Interval, margin: number): DecisionTerm {
  if (interval.lower > 0) return "melhora";
  if (interval.upper < 0) return "piora";
  if (interval.lower > -margin) return "não inferior";
  return "inconclusivo";
}
