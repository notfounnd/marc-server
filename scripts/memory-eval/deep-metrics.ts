import type { EvalCase } from "./dataset.js";
import type { DeepVariantId, RankedPassage, VariantRun } from "./deep-variants.js";

/** The depth of the judgment: the first five passages of each variant. */
export const TOP_K = 5;
/** A passage that answers the query has grade 2 or 3. */
export const RELEVANT_GRADE = 2;
/** A score at or above this value is saturated for the diagnostic count. */
export const SATURATION_SCORE = 0.999;

/** Why a case is incomplete: a variant lacks a reranker pair or a grade, or a quote is missing from the capture. */
export type IncompleteReason = "missing-pair" | "missing-grade" | "missing-evidence";

export type VariantMetrics = {
  variant: DeepVariantId;
  status: "ok" | "incomplete";
  reason?: IncompleteReason;
  /** Passage ids of the first five results. Empty when the variant is incomplete. */
  top5: string[];
  success: boolean;
  mrr: number;
  precision5: number;
  /** Results of the first five with a score at or above the saturation value. Null for the cosine variant. */
  saturated: number | null;
  /** Every result respects the scope: the thread and the source types, or the admitted groups when unscoped. */
  scopeConform: boolean;
  pairs: number;
  truncated: boolean;
  scopePassages: number | null;
};

/** The metrics of one variant of one case. A missing pair or grade makes the variant incomplete. */
export function metricsOf(
  run: VariantRun,
  evalCase: EvalCase,
  admittedGroups?: ReadonlySet<string>
): VariantMetrics {
  if (run.status === "incomplete") return incompleteMetrics(run.variant, "missing-pair");
  const top = run.ranked.slice(0, TOP_K);
  const grades = top.map((passage) => evalCase.passageJudgments?.[passage.passageId]);
  const scopeConform = run.ranked.every((passage) => conformsScope(passage, evalCase, admittedGroups));
  const base = {
    variant: run.variant,
    pairs: run.pairs,
    truncated: run.truncated,
    scopePassages: run.scopePassages,
    scopeConform
  };
  if (grades.some((grade) => grade === undefined))
    return { ...base, status: "incomplete", reason: "missing-grade", top5: [], success: false, mrr: 0, precision5: 0, saturated: null };
  const relevant = grades.map((grade) => grade !== undefined && grade >= RELEVANT_GRADE);
  return {
    ...base,
    status: "ok",
    top5: top.map((passage) => passage.passageId),
    success: relevant.some((item) => item),
    mrr: reciprocalRankOf(relevant),
    precision5: relevant.filter((item) => item).length / TOP_K,
    saturated: saturatedOf(top)
  };
}

function incompleteMetrics(variant: DeepVariantId, reason: IncompleteReason): VariantMetrics {
  return {
    variant,
    status: "incomplete",
    reason,
    top5: [],
    success: false,
    mrr: 0,
    precision5: 0,
    saturated: null,
    scopeConform: true,
    pairs: 0,
    truncated: false,
    scopePassages: null
  };
}

function reciprocalRankOf(relevant: boolean[]): number {
  const index = relevant.findIndex((item) => item);
  if (index < 0) return 0;
  return 1 / (index + 1);
}

function saturatedOf(top: RankedPassage[]): number | null {
  const scores = top.map((passage) => passage.score);
  if (scores.some((score) => score === undefined)) return null;
  return scores.filter((score) => score !== undefined && score >= SATURATION_SCORE).length;
}

/** The scope rule of one result: a thread scope keeps its thread, and the source types filter any scope. */
export function conformsScope(
  passage: RankedPassage,
  evalCase: EvalCase,
  admittedGroups?: ReadonlySet<string>
): boolean {
  const scope = evalCase.scope;
  const typeAllowed = scope?.sourceTypes === undefined || scope.sourceTypes.includes(passage.sourceType);
  if (scope?.threadId !== undefined) return passage.threadId === scope.threadId && typeAllowed;
  return (admittedGroups?.has(passage.threadId) ?? false) && typeAllowed;
}
