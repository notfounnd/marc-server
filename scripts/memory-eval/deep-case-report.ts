import { SCOPE_RERANK_BUDGET } from "../../src/core/memory/deep-scope.js";
import type { EvalCase } from "./dataset.js";
import { classifyFailure, type FailureDecision } from "./deep-classes.js";
import { metricsOf, type IncompleteReason, type VariantMetrics } from "./deep-metrics.js";
import { assertDeepBudget, gateOf, protocolOf } from "./deep-protocol.js";
import { DEEP_VARIANTS, type DeepCaseRuns, type DeepVariantId } from "./deep-variants.js";
import type { EvidenceMatch } from "./matrix-plan.js";
import type { AdoptedVariant, CaseReport, CaseRuns, DeepReport, DeepSummary } from "./deep-run.js";

/** The configuration under test: DEEP when no budget is given, and the recuo DEEP_BUDGET when one is. */
export function adoptedVariantOf(deepBudget: number | undefined): AdoptedVariant {
  return deepBudget === undefined ? "DEEP" : "DEEP_BUDGET";
}

/**
 * The deep report from the runs of the cases. Pure: it reads no file and runs no variant, so the gate can be
 * tested on the same path as the real report. The gate, the classes and the summary read the adopted variant;
 * DEEP stays in the report as the baseline for comparison.
 */
export function deepReportOf(
  runs: readonly CaseRuns[],
  evidence: ReadonlyMap<string, EvidenceMatch[]>,
  deepBudget: number | undefined,
  captureId: string
): DeepReport {
  assertDeepBudget(deepBudget);
  const adopted = adoptedVariantOf(deepBudget);
  const cases = runs.map((item) => caseReportOf(item, evidence.get(item.evalCase.id) ?? [], adopted));
  const protocol = protocolOf(
    cases.map((item) => ({ scoped: item.scoped, scopePassages: item.scopePassages })),
    SCOPE_RERANK_BUDGET
  );
  const gate = gateOf(
    protocol,
    cases.map((item) => ({
      successAdopted: item.successAdopted,
      incomplete: item.incomplete,
      scopeConformAdopted: item.scopeConformAdopted
    }))
  );
  return {
    corpus: "marc-deep",
    captureId,
    deepBudget: deepBudget ?? null,
    adoptedVariant: adopted,
    protocol,
    gate,
    summary: summaryOf(cases),
    cases
  };
}

/** The report of one deep case. Exported so that the incomplete reasons and the classes can be tested on a case. */
export function caseReportOf(item: CaseRuns, evidence: EvidenceMatch[], adopted: AdoptedVariant): CaseReport {
  const { evalCase, caseRuns } = item;
  const variants = metricsByVariant(caseRuns, evalCase);
  const adoptedMetrics = variants[adopted];
  const adoptedRun = caseRuns.runs[adopted];
  const scope = evalCase.scope;
  const incompleteReasons = incompleteReasonsOf(variants, evidence);
  const incomplete = incompleteReasons.length > 0;
  const scoped = scope?.threadId !== undefined;
  return {
    id: evalCase.id,
    scoped,
    threadId: scope?.threadId ?? null,
    sourceTypes: scope?.sourceTypes ?? null,
    scopePassages: adoptedRun?.status === "ok" ? adoptedRun.scopePassages : null,
    truncated: adoptedRun?.status === "ok" ? adoptedRun.truncated : false,
    incomplete,
    incompleteReasons,
    variants,
    successAdopted: adoptedMetrics?.status === "ok" ? adoptedMetrics.success : null,
    scopeConformAdopted: adoptedMetrics?.scopeConform ?? false,
    saturatedAdopted: adoptedMetrics?.status === "ok" ? adoptedMetrics.saturated : null,
    failure: failureOf({ item, variants, evidence, scoped, incomplete, adopted }),
    deepSameAsDeepAll: sameTop5(variants.DEEP, variants.DEEP_ALL)
  };
}

/**
 * The reasons that keep a case out of the classes: an incomplete variant, in any variant, and a quote with status
 * missing. An unindexable quote is not a reason here: it is the segmentation class.
 */
export function incompleteReasonsOf(
  variants: Partial<Record<DeepVariantId, VariantMetrics>>,
  evidence: EvidenceMatch[]
): IncompleteReason[] {
  const fromVariants = DEEP_VARIANTS.flatMap((id) => {
    const metrics = variants[id];
    if (metrics?.status !== "incomplete" || metrics.reason === undefined) return [];
    return [metrics.reason];
  });
  const missing: IncompleteReason[] = evidence.some((item) => item.status === "missing") ? ["missing-evidence"] : [];
  return [...new Set<IncompleteReason>([...fromVariants, ...missing])];
}

function metricsByVariant(caseRuns: DeepCaseRuns, evalCase: EvalCase): Partial<Record<DeepVariantId, VariantMetrics>> {
  const metrics: Partial<Record<DeepVariantId, VariantMetrics>> = {};
  for (const id of DEEP_VARIANTS) {
    const run = caseRuns.runs[id];
    if (run !== undefined) metrics[id] = metricsOf(run, evalCase, caseRuns.admittedGroups);
  }
  return metrics;
}

function failureOf(input: {
  item: CaseRuns;
  variants: Partial<Record<DeepVariantId, VariantMetrics>>;
  evidence: EvidenceMatch[];
  scoped: boolean;
  incomplete: boolean;
  adopted: AdoptedVariant;
}): FailureDecision | null {
  const { item, variants, evidence, scoped, incomplete, adopted } = input;
  const deep = variants[adopted];
  const deepAll = variants.DEEP_ALL;
  if (incomplete || deep === undefined || deepAll === undefined || deep.success) return null;
  return classifyFailure({
    scoped,
    evidence,
    deep,
    deepAll,
    deepRankedIds: rankedIdsOf(item.caseRuns, adopted),
    pool: item.caseRuns.pool,
    admittedGroups: item.caseRuns.admittedGroups
  });
}

function rankedIdsOf(caseRuns: DeepCaseRuns, adopted: AdoptedVariant): string[] {
  const run = caseRuns.runs[adopted];
  if (run === undefined || run.status !== "ok") return [];
  return run.ranked.map((passage) => passage.passageId);
}

function sameTop5(left: VariantMetrics | undefined, right: VariantMetrics | undefined): boolean {
  if (left === undefined || right === undefined) return false;
  return left.top5.join("|") === right.top5.join("|");
}

function summaryOf(cases: CaseReport[]): DeepSummary {
  const success: DeepSummary["success"] = {};
  const incomplete: DeepSummary["incomplete"] = {};
  for (const id of DEEP_VARIANTS) {
    const complete = cases.map((item) => item.variants[id]).filter((item) => item?.status === "ok");
    success[id] = complete.filter((item) => item?.success === true).length;
    incomplete[id] = incompleteByReason(cases.map((item) => item.variants[id]));
  }
  const failures: DeepSummary["failures"] = {};
  for (const item of cases) {
    if (item.failure !== null) failures[item.failure.class] = (failures[item.failure.class] ?? 0) + 1;
  }
  return {
    success,
    successAdopted: cases.filter((item) => item.successAdopted === true).length,
    incomplete,
    incompleteCases: incompleteCasesByReason(cases),
    failures,
    alsoTruncated: cases.filter((item) => item.failure?.alsoTruncated === true).length,
    deepDiffersFromDeepAll: cases.filter((item) => !item.deepSameAsDeepAll).length,
    scopeConformAdopted: cases.every((item) => item.scopeConformAdopted)
  };
}

function incompleteCasesByReason(cases: CaseReport[]): Partial<Record<IncompleteReason, number>> {
  const counts: Partial<Record<IncompleteReason, number>> = {};
  for (const item of cases) {
    for (const reason of item.incompleteReasons) counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

function incompleteByReason(
  metrics: Array<VariantMetrics | undefined>
): Partial<Record<IncompleteReason, number>> {
  const counts: Partial<Record<IncompleteReason, number>> = {};
  for (const item of metrics) {
    if (item?.status !== "incomplete" || item.reason === undefined) continue;
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
  }
  return counts;
}
