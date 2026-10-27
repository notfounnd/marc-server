import type { EvalCaseStyle, RelevanceGrade } from "./dataset.js";
import { requiredLayersOf, saturatedOf } from "./required-cells.js";
import type { VariantResult } from "./variants.js";
import { PROPORTION_MARGIN, RANKING_MARGIN } from "./statistics.js";

export const TARGET_GRADE = 3;
export const RELEVANT_GRADE = 2;
/** Depth of the full-list diagnostics, and of the nDCG cut (plan section 6). */
export const LIST_DEPTH = 10;

const ADMITTED_METRICS = [
  "top1Target",
  "top1Relevant",
  "top3Target",
  "mrr",
  "ndcg10",
  "admissionPrecision",
  "admissionRecall",
  "incidentalExposure",
  "abstentionCorrect"
] as const;
const FULL_LIST_METRICS = ["fullRecall10", "fullMrr10"] as const;
const DIAGNOSTIC_METRICS = ["condensedTop1Target"] as const;

export const METRIC_IDS = [
  ...ADMITTED_METRICS,
  ...FULL_LIST_METRICS,
  ...DIAGNOSTIC_METRICS
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export type MetricReach = "admittedList" | "fullTop10" | "diagnosticOnly";

/** Positions that must be judged for each metric (plan section 6, revision 3). */
export const METRIC_REACH: Readonly<Record<MetricId, MetricReach>> = {
  top1Target: "admittedList",
  top1Relevant: "admittedList",
  top3Target: "admittedList",
  mrr: "admittedList",
  ndcg10: "admittedList",
  admissionPrecision: "admittedList",
  admissionRecall: "admittedList",
  incidentalExposure: "admittedList",
  abstentionCorrect: "admittedList",
  fullRecall10: "fullTop10",
  fullMrr10: "fullTop10",
  condensedTop1Target: "diagnosticOnly"
};

/** Margin δ of the decision vocabulary per metric. */
export const METRIC_MARGIN: Readonly<Record<MetricId, number>> = {
  top1Target: PROPORTION_MARGIN,
  top1Relevant: PROPORTION_MARGIN,
  top3Target: PROPORTION_MARGIN,
  mrr: RANKING_MARGIN,
  ndcg10: RANKING_MARGIN,
  admissionPrecision: PROPORTION_MARGIN,
  admissionRecall: PROPORTION_MARGIN,
  incidentalExposure: PROPORTION_MARGIN,
  abstentionCorrect: PROPORTION_MARGIN,
  fullRecall10: PROPORTION_MARGIN,
  fullMrr10: RANKING_MARGIN,
  condensedTop1Target: PROPORTION_MARGIN
};

/** Metrics that each variant is evaluated on, and whether it needs the whole admitted list judged. */
export type VariantPlan = {
  metricIds: readonly MetricId[];
  requireAdmitted: boolean;
};

export const VARIANT_PLANS: Readonly<Record<string, VariantPlan>> = {
  M0: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS, ...DIAGNOSTIC_METRICS],
    requireAdmitted: true
  },
  D0: { metricIds: FULL_LIST_METRICS, requireAdmitted: false },
  /** The M0 algorithm at each depth: the same decision plan as M0. */
  DEPTH0: { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true },
  DEPTH1: { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true },
  DEPTH2: { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true },
  /** Adaptive funnel variants (E3): the admitted groups must be judged, as for M0. */
  ADAPTIVE: { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true },
  ADAPTIVE_HM: { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true },
  /** One funnel variant per depth: FUNNEL and ALL_PASSAGES admit groups, as for M0. */
  ...Object.fromEntries(
    [0, 1, 2].flatMap((depth) => [
      [`FUNNEL_D${depth}`, { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true }],
      [`ALL_PASSAGES_D${depth}`, { metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS], requireAdmitted: true }],
      /** Reference ceiling: every candidate is admitted, so its list is judged like D0. */
      [`ALL_CANDIDATES_D${depth}`, { metricIds: FULL_LIST_METRICS, requireAdmitted: false }]
    ])
  ),
  ORACLE_ADMISSION: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: false
  },
  /** Decision variants of H1: the admitted list must be fully judged, as for M0. */
  H1_CALIBRATED: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  H1_FALLBACK: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  /** H2 variants: the admission of H1_CALIBRATED, with the band taken from p'. */
  H2_N1: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  H2_N2: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  /** H7 variants: the judge chain on the H1 fit, and the fallback chain on M0. */
  H7_JUDGE_QWEN: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  H7_JUDGE_KEV: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  H7_JUDGE_QWEN_FALLBACK: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  H7_JUDGE_KEV_FALLBACK: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS],
    requireAdmitted: true
  },
  /** Pseudo-variant: the production order of M0's pool. Not a decision variant; reported beside M0. */
  PRODUCTION_RECALL: {
    metricIds: [...ADMITTED_METRICS, ...FULL_LIST_METRICS, ...DIAGNOSTIC_METRICS],
    requireAdmitted: true
  }
};

/** Metrics that both variants are evaluated on. */
export function sharedMetrics(baseline: string, candidate: string): MetricId[] {
  const baselinePlan = VARIANT_PLANS[baseline];
  const candidatePlan = VARIANT_PLANS[candidate];
  if (baselinePlan === undefined || candidatePlan === undefined)
    throw new Error(`Unknown ranking variant: ${baseline} or ${candidate}.`);
  return baselinePlan.metricIds.filter((metric) => candidatePlan.metricIds.includes(metric));
}

/** Numerator and denominator of one case. A zero denominator leaves the case out of the mean. */
export type Contribution = { num: number; den: number };
export type CaseContribution = Record<MetricId, Contribution>;

/**
 * Why a variant has no complete result for a case. Every reason makes the variant not
 * approvable; none is ever scored as zero.
 */
export type CaseIncomplete =
  | { reason: "missing-score"; recordId: string }
  | { reason: "missing-funnel-inputs" }
  | { reason: "missing-funnel-params" }
  | { reason: "evidence_unindexable" }
  | { reason: "evidence_missing" }
  | { reason: "unreplayed" };

export type CaseInput = {
  caseId: string;
  family: string;
  style: EvalCaseStyle;
  judgments: Record<string, RelevanceGrade>;
  results: VariantResult[];
  /**
   * Why the variant has no complete result for this case. `missing-score`: a pair the variant
   * needs is not in the matrix. `missing-funnel-inputs`: the capture lacks the channels of some
   * depth. `unreplayed`: the variant was not replayed for this case. Every reason makes the
   * variant not approvable; the case is never read as a zero.
   */
  incomplete?: CaseIncomplete;
  /** Judgments of each layer, as the dataset holds them. With `judgedDepth`, they decide the required cells. */
  gradesByLayer?: Partial<Record<0 | 1 | 2, Record<string, RelevanceGrade>>>;
  /** Layers that the capture holds for each group. A group missing from the map holds layer 0 only. */
  presentLayers?: ReadonlyMap<string, ReadonlySet<number>>;
  /** Deepest layer that grades the variant on this case. Without it, only the effective judgments count. */
  judgedDepth?: number;
  /**
   * Common reference of a comparison (plan revision 8): the judgments that fix the relevant set of the case,
   * at the largest depth of the compared variants. The numerators keep the variant's own judgments.
   */
  referenceJudgments?: Record<string, RelevanceGrade>;
  /**
   * Depth of the common reference (the largest depth of the compared variants). It fixes the relevant set from
   * the judged layers up to it; it does not require cells, so an unjudged layer is not a pending cell.
   */
  referenceDepth?: number;
};

export type PendingPair = {
  caseId: string;
  threadId: string;
  reach: "admittedList" | "fullTop10";
  /** The layer of the cell that has no judgment; absent for the effective judgments of old inputs. */
  layer?: number;
};

export const INTERPRETATION_IDS = [
  "correctionCorrect",
  "correctionUndue",
  "suggestionCorrect",
  "suggestionUndue",
  "suggestionMissing"
] as const;
export type InterpretationId = (typeof INTERPRETATION_IDS)[number];

export function gradeOf(judgments: Record<string, RelevanceGrade>, threadId: string): number {
  return Object.hasOwn(judgments, threadId) ? (judgments[threadId] ?? 0) : 0;
}

/** Per-case contributions of every metric. Callers keep only the metrics of the variant plan. */
export function caseContribution(input: CaseInput): CaseContribution {
  const positive = input.style !== "negative";
  const admitted = input.results.filter((item) => item.admitted);
  const admittedGrades = admitted.map((item) => gradeOf(input.judgments, item.threadId));
  const topResults = input.results.slice(0, LIST_DEPTH);
  const topGrades = topResults.map((item) => gradeOf(input.judgments, item.threadId));
  const reference = input.referenceJudgments ?? input.judgments;
  const judgedRelevant = Object.values(reference).filter(
    (grade) => grade >= RELEVANT_GRADE
  ).length;
  const admittedRelevant = admittedGrades.filter((grade) => grade >= RELEVANT_GRADE).length;
  const reciprocalRank = reciprocalRankOf(admittedGrades);
  const fullRank = reciprocalRankOf(topGrades);
  const condensed = admitted.filter((item) => Object.hasOwn(input.judgments, item.threadId));
  const condensedGrades = condensed.map((item) => gradeOf(input.judgments, item.threadId));
  return {
    top1Target: flag(positive, admittedGrades[0] === TARGET_GRADE),
    top1Relevant: flag(positive, (admittedGrades[0] ?? 0) >= RELEVANT_GRADE),
    top3Target: flag(positive, admittedGrades.slice(0, 3).includes(TARGET_GRADE)),
    mrr: pairedFlagValue(positive, reciprocalRank),
    ndcg10: ndcgContribution(admittedGrades, input.judgments, positive),
    admissionPrecision: { num: admittedRelevant, den: admitted.length },
    admissionRecall: { num: admittedRelevant, den: judgedRelevant },
    incidentalExposure: flag(positive, admittedGrades.some((grade) => grade <= 1)),
    abstentionCorrect: flag(!positive, admitted.length === 0),
    fullRecall10: {
      num: topGrades.filter((grade) => grade >= RELEVANT_GRADE).length,
      den: judgedRelevant
    },
    fullMrr10: pairedFlagValue(positive, fullRank),
    condensedTop1Target: flag(positive, condensedGrades[0] === TARGET_GRADE)
  };
}

/** Sums the contributions of a set of cases, metric by metric. */
export function sumContributions(items: readonly CaseContribution[]): CaseContribution {
  const zero: CaseContribution = Object.fromEntries(
    METRIC_IDS.map((id) => [id, { num: 0, den: 0 }])
  ) as CaseContribution;
  return items.reduce((total, item) => {
    const next = { ...total };
    for (const id of METRIC_IDS) {
      next[id] = { num: total[id].num + item[id].num, den: total[id].den + item[id].den };
    }
    return next;
  }, zero);
}

/** Ratio of sums, or null when no case is applicable. */
export function metricValue(contribution: Contribution): number | null {
  if (contribution.den === 0) return null;
  return contribution.num / contribution.den;
}

/**
 * Coverage of a variant (plan section 6). Every position inside the reach of
 * its metrics must be judged. Unjudged positions are listed as pending pairs.
 */
export type ReachEntry = { threadId: string; reach: PendingPair["reach"] };

/**
 * The positions that a variant needs judged in one case: the whole admitted
 * list when the variant requires it, and the first ten of the full list. Each
 * thread appears once, with the admitted reach when both apply.
 */
export function reachEntries(item: Pick<CaseInput, "results">, requireAdmitted: boolean): ReachEntry[] {
  const admittedEntries: ReachEntry[] = requireAdmitted
    ? item.results
        .filter((result) => result.admitted)
        .map((result) => ({ threadId: result.threadId, reach: "admittedList" as const }))
    : [];
  const topEntries: ReachEntry[] = item.results
    .slice(0, LIST_DEPTH)
    .map((result) => ({ threadId: result.threadId, reach: "fullTop10" as const }));
  const seen = new Set<string>();
  return [...admittedEntries, ...topEntries].filter((entry) => {
    if (seen.has(entry.threadId)) return false;
    seen.add(entry.threadId);
    return true;
  });
}

/** Unjudged positions inside the reach of a variant: every required cell without a judgment of its layer. */
export function pendingPairs(cases: readonly CaseInput[], requireAdmitted: boolean): PendingPair[] {
  return cases.flatMap((item) =>
    reachEntries(item, requireAdmitted).flatMap((entry) => unjudgedOf(item, entry))
  );
}

/** The pending cells of one reached group. Without the layer grades, the effective judgments decide. */
function unjudgedOf(item: CaseInput, entry: ReachEntry): PendingPair[] {
  const pending = (layer?: number): PendingPair => ({
    caseId: item.caseId,
    threadId: entry.threadId,
    reach: entry.reach,
    ...(layer === undefined ? {} : { layer })
  });
  // Completeness follows the variant's own depth. The common reference (referenceDepth) fixes only the
  // relevant set, from the judged layers; a layer cell that nobody judged neither blocks nor counts as zero.
  const depth = item.judgedDepth;
  if (depth === undefined || item.gradesByLayer === undefined)
    return Object.hasOwn(item.judgments, entry.threadId) ? [] : [pending()];
  const present = new Set(item.presentLayers?.get(entry.threadId) ?? [0]);
  const saturated = saturatedOf(item.gradesByLayer?.[0] ?? {}, entry.threadId);
  return requiredLayersOf(entry.threadId, depth, present, saturated)
    .filter((layer) => !Object.hasOwn(item.gradesByLayer?.[layer] ?? {}, entry.threadId))
    .map((layer) => pending(layer));
}

/** Contributions of the interpretation metrics of one case with an expected interpretation. */
export function interpretationContribution(
  captured: InterpretationSource,
  expected: { effectiveQuery: string; suggestedQuery?: string }
): Record<InterpretationId, Contribution> {
  const original = captured.originalQuery;
  const effective = captured.interpretation.effectiveQuery;
  const suggested = captured.interpretation.suggestedQuery;
  const expectedEffective = expected.effectiveQuery;
  const expectedSuggested = expected.suggestedQuery;
  const corrected = effective !== original;
  return {
    correctionCorrect: {
      num: Number(corrected && effective === expectedEffective),
      den: Number(expectedEffective !== original)
    },
    correctionUndue: {
      num: Number(corrected && expectedEffective === original),
      den: Number(expectedEffective === original)
    },
    suggestionCorrect: {
      num: Number(suggested !== undefined && suggested === expectedSuggested),
      den: Number(expectedSuggested !== undefined)
    },
    suggestionUndue: {
      num: Number(suggested !== undefined && expectedSuggested === undefined),
      den: Number(expectedSuggested === undefined)
    },
    suggestionMissing: {
      num: Number(expectedSuggested !== undefined && suggested === undefined),
      den: Number(expectedSuggested !== undefined)
    }
  };
}

export type InterpretationSource = {
  originalQuery: string;
  interpretation: { effectiveQuery: string; suggestedQuery?: string };
};

export type LatencySummary = { samples: number; medianMs: number | null; p95Ms: number | null };

/** Median and nearest-rank p95 of the measured latencies, in milliseconds. */
export function latencySummary(values: readonly number[]): LatencySummary {
  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  if (count === 0) return { samples: 0, medianMs: null, p95Ms: null };
  const middle = Math.floor(count / 2);
  const median =
    count % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  const p95 = sorted[Math.min(count - 1, Math.ceil(0.95 * count) - 1)] ?? 0;
  return { samples: count, medianMs: median, p95Ms: p95 };
}

export function discountedGain(grades: readonly number[]): number {
  return grades.reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
}

function ndcgContribution(
  admittedGrades: readonly number[],
  judgments: Record<string, RelevanceGrade>,
  positive: boolean
): Contribution {
  const ideal = Object.values(judgments)
    .filter((grade) => grade > 0)
    .sort((left, right) => right - left)
    .slice(0, LIST_DEPTH);
  const idealGain = discountedGain(ideal);
  if (!positive || idealGain === 0) return { num: 0, den: 0 };
  return {
    num: discountedGain(admittedGrades.slice(0, LIST_DEPTH)) / idealGain,
    den: 1
  };
}

function reciprocalRankOf(grades: readonly number[]): number {
  const position = grades.findIndex((grade) => grade >= RELEVANT_GRADE);
  if (position < 0) return 0;
  return 1 / (position + 1);
}

function flag(applicable: boolean, value: boolean): Contribution {
  return { num: Number(applicable && value), den: Number(applicable) };
}

function pairedFlagValue(applicable: boolean, value: number): Contribution {
  return { num: applicable ? value : 0, den: Number(applicable) };
}
