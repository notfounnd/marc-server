import type { EvalCaseStyle, EvalDataset } from "./dataset.js";
import type { ReplayResult } from "./replay.js";
import {
  METRIC_MARGIN,
  VARIANT_PLANS,
  caseContribution,
  metricValue,
  pendingPairs,
  sumContributions,
  type CaseContribution,
  type CaseInput,
  type Contribution,
  type MetricId,
  type PendingPair
} from "./metrics.js";
import {
  decisionTerm,
  mcnemarExact,
  pairedBootstrap,
  type DecisionTerm,
  type FamilySums
} from "./statistics.js";
import type { VariantResult } from "./variants.js";

export const ALL_SCOPE = "total";

export type ScopeValues = Partial<Record<MetricId, number | null>>;

export type EvaluatedCase = {
  caseId: string;
  family: string;
  style: EvalCaseStyle;
  contribution: CaseContribution;
};

export type VariantEvaluation = {
  variant: string;
  status: "complete" | "incomplete";
  pending: PendingPair[];
  cases: EvaluatedCase[];
  /** Metric values per scope ("total" and each style). Null everywhere when incomplete. */
  scopes: Record<string, ScopeValues>;
};

export type MetricComparison = {
  scope: string;
  metric: MetricId;
  baseline: number | null;
  candidate: number | null;
  difference: number | null;
  lower: number | null;
  upper: number | null;
  margin: number;
  term: DecisionTerm | null;
  nonInferior: boolean | null;
  mcnemar?: { b: number; c: number; p: number };
};

/** Case inputs of one variant, taken from the replay and the dataset's current judgments. */
export function caseInputsFor(
  dataset: EvalDataset,
  replay: ReplayResult,
  variant: string
): CaseInput[] {
  return dataset.cases.map((evalCase) => ({
    caseId: evalCase.id,
    family: evalCase.family,
    style: evalCase.style,
    judgments: evalCase.judgments,
    results: resultsForCase(replay, evalCase.id, variant)
  }));
}

export function evaluateVariant(variant: string, cases: readonly CaseInput[]): VariantEvaluation {
  const plan = VARIANT_PLANS[variant];
  if (plan === undefined) throw new Error(`No evaluation plan for variant ${variant}.`);
  const pending = pendingPairs(cases, plan.requireAdmitted);
  const status = pending.length === 0 ? "complete" : "incomplete";
  const evaluated = cases.map((item) => ({
    caseId: item.caseId,
    family: item.family,
    style: item.style,
    contribution: caseContribution(item)
  }));
  return {
    variant,
    status,
    pending,
    cases: evaluated,
    scopes: scopeValues(evaluated, plan.metricIds, status)
  };
}

export function scopeNames(cases: readonly EvaluatedCase[]): string[] {
  const styles = [...new Set(cases.map((item) => item.style))].sort();
  return [ALL_SCOPE, ...styles];
}

/**
 * Paired comparison of candidate against baseline, metric by metric and scope
 * by scope. Empty when either side is incomplete: no verdict without coverage.
 */
export function compareEvaluations(
  baseline: VariantEvaluation,
  candidate: VariantEvaluation,
  metricIds: readonly MetricId[]
): MetricComparison[] {
  if (baseline.status !== "complete" || candidate.status !== "complete") return [];
  const candidateById = new Map(candidate.cases.map((item) => [item.caseId, item]));
  const pairs = baseline.cases.map((item) => {
    const other = candidateById.get(item.caseId);
    if (other === undefined) throw new Error(`Candidate has no case ${item.caseId}.`);
    return { base: item, other };
  });
  return scopeNames(baseline.cases).flatMap((scope) => {
    const inScope = pairs.filter(
      (pair) => scope === ALL_SCOPE || pair.base.style === scope
    );
    return metricIds.map((metric) => compareMetric(scope, metric, inScope));
  });
}

function compareMetric(
  scope: string,
  metric: MetricId,
  pairs: ReadonlyArray<{ base: EvaluatedCase; other: EvaluatedCase }>
): MetricComparison {
  const baselineSum = sumContributions(pairs.map((pair) => pair.base.contribution))[metric];
  const candidateSum = sumContributions(pairs.map((pair) => pair.other.contribution))[metric];
  const baseline = metricValue(baselineSum);
  const candidate = metricValue(candidateSum);
  const margin = METRIC_MARGIN[metric];
  const interval = pairedBootstrap(familySums(pairs, metric));
  const difference = baseline === null || candidate === null ? null : candidate - baseline;
  const verdict = interval === undefined ? undefined : decisionTerm(interval, margin);
  const comparison: MetricComparison = {
    scope,
    metric,
    baseline,
    candidate,
    difference,
    lower: interval?.lower ?? null,
    upper: interval?.upper ?? null,
    margin,
    term: verdict?.term ?? null,
    nonInferior: verdict?.nonInferior ?? null
  };
  if (metric === "top1Target" && scope === ALL_SCOPE) {
    return { ...comparison, mcnemar: mcnemarTop1(pairs) };
  }
  return comparison;
}

/** McNemar on the discordant top-1 outcomes of applicable cases. b: baseline right only; c: candidate right only. */
function mcnemarTop1(
  pairs: ReadonlyArray<{ base: EvaluatedCase; other: EvaluatedCase }>
): { b: number; c: number; p: number } {
  const applicable = pairs.filter((pair) => pair.base.contribution.top1Target.den === 1);
  const b = applicable.filter(
    (pair) => pair.base.contribution.top1Target.num === 1 && pair.other.contribution.top1Target.num === 0
  ).length;
  const c = applicable.filter(
    (pair) => pair.base.contribution.top1Target.num === 0 && pair.other.contribution.top1Target.num === 1
  ).length;
  return { b, c, p: mcnemarExact(b, c) };
}

function familySums(
  pairs: ReadonlyArray<{ base: EvaluatedCase; other: EvaluatedCase }>,
  metric: MetricId
): FamilySums[] {
  const byFamily = new Map<string, FamilySums>();
  for (const pair of pairs) {
    const current = byFamily.get(pair.base.family) ?? {
      family: pair.base.family,
      candidateNum: 0,
      candidateDen: 0,
      baselineNum: 0,
      baselineDen: 0
    };
    const base: Contribution = pair.base.contribution[metric];
    const other: Contribution = pair.other.contribution[metric];
    byFamily.set(pair.base.family, {
      family: current.family,
      candidateNum: current.candidateNum + other.num,
      candidateDen: current.candidateDen + other.den,
      baselineNum: current.baselineNum + base.num,
      baselineDen: current.baselineDen + base.den
    });
  }
  return [...byFamily.values()];
}

function scopeValues(
  cases: readonly EvaluatedCase[],
  metricIds: readonly MetricId[],
  status: "complete" | "incomplete"
): Record<string, ScopeValues> {
  const scopes: Record<string, ScopeValues> = {};
  for (const scope of scopeNames(cases)) {
    const inScope = cases.filter((item) => scope === ALL_SCOPE || item.style === scope);
    const sums = sumContributions(inScope.map((item) => item.contribution));
    const values: ScopeValues = {};
    for (const metric of metricIds) {
      values[metric] = status === "complete" ? metricValue(sums[metric]) : null;
    }
    scopes[scope] = values;
  }
  return scopes;
}

export type VariantDifference = {
  metric: MetricId;
  baseline: number | null;
  other: number | null;
  /** other − baseline on the total scope. Null while either side is incomplete. */
  difference: number | null;
  /** Cases whose contribution to this metric differs between the two variants. */
  caseIds: string[];
};

/**
 * Metric-by-metric difference of two variants on the same cases. Reports the
 * total-scope values and every case whose contribution differs. It never decides.
 */
export function variantDifferences(
  baseline: VariantEvaluation,
  other: VariantEvaluation,
  metricIds: readonly MetricId[]
): VariantDifference[] {
  const otherById = new Map(other.cases.map((item) => [item.caseId, item]));
  return metricIds.map((metric) => {
    const baselineValue = baseline.scopes[ALL_SCOPE]?.[metric] ?? null;
    const otherValue = other.scopes[ALL_SCOPE]?.[metric] ?? null;
    const caseIds = baseline.cases
      .filter((item) => {
        const counterpart = otherById.get(item.caseId);
        return counterpart !== undefined && !sameContribution(item.contribution[metric], counterpart.contribution[metric]);
      })
      .map((item) => item.caseId);
    return {
      metric,
      baseline: baselineValue,
      other: otherValue,
      difference: baselineValue === null || otherValue === null ? null : otherValue - baselineValue,
      caseIds
    };
  });
}

function sameContribution(left: Contribution, right: Contribution): boolean {
  return left.num === right.num && left.den === right.den;
}

/** Full result list of one variant for one case, in the order of the variant. */
export function resultsForCase(replay: ReplayResult, caseId: string, variant: string): VariantResult[] {
  const replayed = replay.cases.find((item) => item.caseId === caseId);
  return replayed?.variants.find((item) => item.variant === variant)?.results ?? [];
}
