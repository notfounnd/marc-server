import fs from "node:fs/promises";
import { candidateLimitForMemorySearchDepth } from "../../src/core/memory/search-depth.js";
import type { CaptureFile, CapturedCase } from "./capture-types.js";
import { assignFolds } from "./folds.js";
import type { EvalDataset } from "./dataset.js";
import {
  caseInputsFor,
  compareEvaluations,
  evaluateVariant,
  resultsForCase,
  variantDifferences,
  type MetricComparison,
  type ScopeValues,
  type VariantDifference,
  type VariantEvaluation
} from "./evaluation.js";
import { attributeCase, ATTRIBUTION_CATEGORIES, type AttributionCategory, type AttributionRow } from "./attribution.js";
import {
  INTERPRETATION_IDS,
  METRIC_IDS,
  METRIC_REACH,
  interpretationContribution,
  latencySummary,
  metricValue,
  sharedMetrics,
  type InterpretationId,
  type LatencySummary,
  type PendingPair
} from "./metrics.js";
import type { Contribution } from "./metrics.js";
import { quadraticKappa } from "./statistics.js";
import type { DeltaSummary, ReplayResult } from "./replay.js";
import type { LatencyFile } from "./latency.js";
import { PRODUCTION_RECALL_ID } from "./variants.js";

export const REPORT_VARIANTS = ["M0", "D0", "ORACLE_ADMISSION"] as const;

/** Decision metrics: every metric except the diagnostic ones. */
export const DECISION_METRICS = METRIC_IDS.filter((metric) => METRIC_REACH[metric] !== "diagnosticOnly");

export type ProductionRecallComparison = {
  m0Status: "complete" | "incomplete";
  productionStatus: "complete" | "incomplete";
  /** PRODUCTION_RECALL − M0 per decision metric. Reported, never gating. */
  rows: VariantDifference[];
};

export type RaterPairs = { sources: [string, string]; pairs: Array<[number, number]>; divergences: number };

export type ReportInput = {
  capture: CaptureFile;
  dataset: EvalDataset;
  replay: ReplayResult;
  /** latency.json of the same captureId. Latency is not part of the capture. Absent with --without-latency. */
  latency?: LatencyFile;
  raters?: RaterPairs;
};

export type ReportLatency = LatencySummary & {
  measuredAt: string;
  /** Lowest os.freemem() observed, in bytes: at the start and after each case. */
  minFreeMemoryBytes: number;
};

function latencyOf(file: LatencyFile): ReportLatency {
  const samples = file.cases.flatMap((item) => item.samples);
  const freeMemory = [
    file.freeMemStartBytes,
    ...file.cases.map((item) => item.freeMemAfterBytes)
  ];
  return {
    ...latencySummary(samples),
    measuredAt: file.measuredAt,
    minFreeMemoryBytes: Math.min(...freeMemory)
  };
}

function latencySection(file: LatencyFile | undefined): ReportLatency | null {
  if (file === undefined) return null;
  return latencyOf(file);
}

/** Output names. Without latency the report never overwrites the approved report.json and report.md. */
export const REPORT_FILE_NAMES = {
  withLatency: { json: "report.json", markdown: "report.md" },
  withoutLatency: {
    json: "report-no-latency.json",
    markdown: "report-no-latency.md"
  }
} as const;

export function reportFileNames(withoutLatency: boolean): {
  json: string;
  markdown: string;
} {
  if (withoutLatency) return REPORT_FILE_NAMES.withoutLatency;
  return REPORT_FILE_NAMES.withLatency;
}

export type Report = {
  schemaVersion: 1;
  captureId: string;
  corpus: string;
  generation: string;
  corpusDigest: string;
  queryFingerprint: string;
  fingerprint: string;
  providers: CaptureFile["providers"];
  casesByStyle: Record<string, number>;
  corpusSize: {
    threads: number;
    identityRecords: number;
    passageRecords: number;
    channelLimit: number;
    identitiesFitChannel: boolean;
  };
  equivalence: {
    status: "passed" | "failed";
    failedCaseIds: string[];
    /** Score deltas of the admitted sequence, reported and never gating. */
    scoreDelta: DeltaSummary;
  };
  variants: Record<string, VariantSummary>;
  comparisons: Array<{ candidate: string; rows: MetricComparison[] }>;
  attribution: {
    counts: Record<AttributionCategory, number>;
    suspects: number;
    rows: AttributionRow[];
    m0Top1Total: number | null;
    oracleTop1Total: number | null;
  };
  interpretation: Array<{ id: InterpretationId; num: number; den: number; value: number | null }>;
  latency: ReportLatency | null;
  productionRecall: ProductionRecallComparison;
  kappa: { sources: [string, string] | null; pairs: number; divergences: number; value: number | null };
  folds: Array<{ fold: number; families: string[]; cases: number }>;
};

export type VariantSummary = {
  status: "complete" | "incomplete";
  pendingPairs: number;
  pending: PendingPair[];
  scopes: Record<string, ScopeValues>;
};

/** Builds report.json from a replay of the three report variants, plus the optional rater pairs. */
export async function buildReport(input: ReportInput): Promise<Report> {
  const { capture, dataset, replay } = input;
  const evaluations = Object.fromEntries(
    REPORT_VARIANTS.map((variant) => [
      variant,
      evaluateVariant(variant, caseInputsFor(dataset, replay, variant))
    ])
  ) as Record<string, VariantEvaluation>;
  const m0 = evaluations.M0;
  const production = evaluateVariant(
    PRODUCTION_RECALL_ID,
    caseInputsFor(dataset, replay, PRODUCTION_RECALL_ID)
  );
  const comparisons = ["D0", "ORACLE_ADMISSION"].map((candidate) => ({
    candidate,
    rows: compareEvaluations(
      requireEvaluation(m0),
      requireEvaluation(evaluations[candidate]),
      sharedMetrics("M0", candidate)
    )
  }));
  return {
    schemaVersion: 1,
    captureId: capture.captureId,
    corpus: capture.corpus,
    generation: capture.generation,
    corpusDigest: capture.corpusDigest,
    queryFingerprint: capture.fingerprint.queryFingerprint,
    fingerprint: capture.fingerprint.fingerprint,
    providers: capture.providers,
    casesByStyle: countBy(dataset.cases.map((item) => item.style)),
    corpusSize: corpusSize(capture),
    equivalence: {
      status: replay.equivalence,
      failedCaseIds: replay.failedCaseIds,
      scoreDelta: replay.scoreDelta
    },
    variants: Object.fromEntries(
      Object.entries(evaluations).map(([variant, evaluation]) => [
        variant,
        {
          status: evaluation.status,
          pendingPairs: evaluation.pending.length,
          pending: evaluation.pending,
          scopes: evaluation.scopes
        }
      ])
    ),
    comparisons,
    attribution: attributionOf(input, evaluations),
    interpretation: interpretationOf(capture, dataset),
    latency: latencySection(input.latency),
    productionRecall: {
      m0Status: requireEvaluation(m0).status,
      productionStatus: production.status,
      rows: variantDifferences(requireEvaluation(m0), production, DECISION_METRICS)
    },
    kappa: kappaOf(input.raters),
    folds: foldsOf(dataset)
  };
}

/** Reads two rater files of `{ caseId: { threadId: grade } }` and pairs the grades they share. */
export async function readRaterPairs(pathA: string, pathB: string): Promise<RaterPairs> {
  const first = JSON.parse(await fs.readFile(pathA, "utf8")) as Record<string, Record<string, number>>;
  const second = JSON.parse(await fs.readFile(pathB, "utf8")) as Record<string, Record<string, number>>;
  const pairs: Array<[number, number]> = [];
  for (const [caseId, threads] of Object.entries(first)) {
    for (const [threadId, grade] of Object.entries(threads)) {
      const other = second[caseId]?.[threadId];
      if (other !== undefined) pairs.push([grade, other]);
    }
  }
  const divergences = pairs.filter(([left, right]) => left !== right).length;
  return { sources: [pathA, pathB], pairs, divergences };
}

function latencyLines(latency: ReportLatency | null): string[] {
  if (latency === null) return ["Latency: not measured", ""];
  return [
    table(["Samples", "Median", "p95", "Min free memory (MB)"], [[String(latency.samples), fmt(latency.medianMs), fmt(latency.p95Ms), fmt(latency.minFreeMemoryBytes / 1024 ** 2)]]),
    "",
    `Measured at ${latency.measuredAt}, from latency.json.`,
    ""
  ];
}

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Memory evaluation report: ${report.captureId} (${report.corpus})`, "");
  lines.push(
    table(["Field", "Value"], [
      ["captureId", report.captureId],
      ["generation", report.generation],
      ["queryFingerprint", report.queryFingerprint],
      ["corpusDigest", report.corpusDigest],
      ["cases by style", Object.entries(report.casesByStyle).map(([style, count]) => `${style}: ${count}`).join(", ")],
      ["embedding", providerLine(report.providers.embedding)],
      ["reranker", providerLine(report.providers.reranker)],
      ["interpreter", providerLine(report.providers.interpreter)],
      ["equivalence (M0 vs production, admitted sequence)", `${report.equivalence.status}${report.equivalence.failedCaseIds.length > 0 ? ` (${report.equivalence.failedCaseIds.join(", ")})` : ""}`],
      ["score delta per case (median, p95, max)", `${sci(report.equivalence.scoreDelta.median)}, ${sci(report.equivalence.scoreDelta.p95)}, ${sci(report.equivalence.scoreDelta.max)}`]
    ]),
    ""
  );
  lines.push("## Variants and coverage", "");
  for (const [variant, summary] of Object.entries(report.variants)) {
    lines.push(`### ${variant}: ${summary.status}, pending pairs ${summary.pendingPairs}`, "");
    lines.push(scopeTable(summary.scopes), "");
  }
  lines.push("## Comparisons against M0", "");
  for (const comparison of report.comparisons) {
    lines.push(`### ${comparison.candidate} − M0`, "");
    lines.push(comparisonTable(comparison.rows), "");
  }
  lines.push("## M0 vs PRODUCTION_RECALL", "");
  lines.push(
    `M0 ${report.productionRecall.m0Status}; PRODUCTION_RECALL ${report.productionRecall.productionStatus}. Reported beside M0, not a decision comparison: the gate is the approvers' call.`,
    ""
  );
  lines.push(
    table(
      ["Metric", "M0", "PRODUCTION_RECALL", "PRODUCTION_RECALL − M0", "Cases with a difference"],
      report.productionRecall.rows.map((row) => [
        row.metric,
        fmt(row.baseline),
        fmt(row.other),
        sci(row.difference),
        row.caseIds.length === 0 ? "none" : row.caseIds.join(", ")
      ])
    ),
    ""
  );
  lines.push("## Attribution (M0, depth 0)", "");
  lines.push(
    table(["Category", "Threads of grade 3"], ATTRIBUTION_CATEGORIES.map((category) => [category, String(report.attribution.counts[category])])),
    "",
    `Passage-selection suspects: ${report.attribution.suspects}. M0 Top1 (total): ${fmt(report.attribution.m0Top1Total)}. ORACLE_ADMISSION Top1 (total): ${fmt(report.attribution.oracleTop1Total)}.`,
    ""
  );
  lines.push("## Interpretation", "");
  lines.push(table(["Metric", "Count", "Denominator", "Value"], report.interpretation.map((row) => [row.id, String(row.num), String(row.den), fmt(row.value)])), "");
  lines.push("## Latency (milliseconds)", "", ...latencyLines(report.latency));
  lines.push("## Judgment agreement", "");
  lines.push(
    report.kappa.sources === null
      ? "No rater files were given (--raters a.json,b.json)."
      : `Quadratic kappa ${fmt(report.kappa.value)} over ${report.kappa.pairs} pairs, ${report.kappa.divergences} divergences.`,
    ""
  );
  lines.push("## Folds", "");
  lines.push(table(["Fold", "Cases", "Families"], report.folds.map((fold) => [String(fold.fold), String(fold.cases), fold.families.join(", ")])), "");
  lines.push("## Corpus size", "");
  lines.push(
    `Threads ${report.corpusSize.threads}; identity records ${report.corpusSize.identityRecords}; passage records ${report.corpusSize.passageRecords}; channel limit ${report.corpusSize.channelLimit}; identities fit the channel limit: ${report.corpusSize.identitiesFitChannel ? "yes" : "no"}.`,
    ""
  );
  return lines.join("\n");
}

function attributionOf(
  input: ReportInput,
  evaluations: Record<string, VariantEvaluation>
): Report["attribution"] {
  const records = new Map(input.capture.records.map((record) => [record.recordId, record]));
  const judgmentsByCase = new Map(input.dataset.cases.map((item) => [item.id, item]));
  const rows = input.capture.cases.flatMap((captured) => {
    const evalCase = judgmentsByCase.get(captured.id);
    if (evalCase === undefined) return [];
    return attributeCase({
      caseId: captured.id,
      positive: evalCase.style !== "negative",
      query: captured.interpretation.effectiveQuery,
      channels: channelsOf(captured),
      rerankScores: captured.rerankScores,
      records,
      judgments: evalCase.judgments,
      results: resultsForCase(input.replay, captured.id, "M0")
    });
  });
  const counts = Object.fromEntries(
    ATTRIBUTION_CATEGORIES.map((category) => [category, rows.filter((row) => row.category === category).length])
  ) as Record<AttributionCategory, number>;
  return {
    counts,
    suspects: rows.filter((row) => row.passageSelectionSuspect).length,
    rows,
    m0Top1Total: totalValue(evaluations.M0, "top1Target"),
    oracleTop1Total: totalValue(evaluations.ORACLE_ADMISSION, "top1Target")
  };
}

function channelsOf(captured: CapturedCase) {
  const channels = captured.channels[captured.interpretation.effectiveQuery];
  if (channels === undefined) throw new Error(`Capture case ${captured.id} has no channels for its effective query.`);
  return channels;
}

function interpretationOf(capture: CaptureFile, dataset: EvalDataset): Report["interpretation"] {
  const sums = new Map<InterpretationId, Contribution>(
    INTERPRETATION_IDS.map((id) => [id, { num: 0, den: 0 }])
  );
  for (const evalCase of dataset.cases) {
    if (evalCase.expectedInterpretation === undefined) continue;
    const captured = capture.cases.find((item) => item.id === evalCase.id);
    if (captured === undefined) continue;
    const contributions = interpretationContribution(captured, evalCase.expectedInterpretation);
    for (const id of INTERPRETATION_IDS) {
      const current = sums.get(id) ?? { num: 0, den: 0 };
      const next = contributions[id];
      sums.set(id, { num: current.num + next.num, den: current.den + next.den });
    }
  }
  return INTERPRETATION_IDS.map((id) => {
    const sum = sums.get(id) ?? { num: 0, den: 0 };
    return { id, num: sum.num, den: sum.den, value: metricValue(sum) };
  });
}

function kappaOf(raters: RaterPairs | undefined): Report["kappa"] {
  if (raters === undefined) return { sources: null, pairs: 0, divergences: 0, value: null };
  return {
    sources: raters.sources,
    pairs: raters.pairs.length,
    divergences: raters.divergences,
    value: quadraticKappa(raters.pairs)
  };
}

function foldsOf(dataset: EvalDataset): Report["folds"] {
  const assignment = assignFolds(dataset.cases.map((item) => item.family));
  const byFold = new Map<number, { families: Set<string>; cases: number }>();
  for (const evalCase of dataset.cases) {
    const fold = assignment.get(evalCase.family) ?? 0;
    const current = byFold.get(fold) ?? { families: new Set<string>(), cases: 0 };
    current.families.add(evalCase.family);
    current.cases += 1;
    byFold.set(fold, current);
  }
  return [...byFold.entries()]
    .sort(([left], [right]) => left - right)
    .map(([fold, value]) => ({ fold, families: [...value.families].sort(), cases: value.cases }));
}

function corpusSize(capture: CaptureFile): Report["corpusSize"] {
  const identityRecords = capture.records.filter((record) => record.kind === "identity").length;
  const passageRecords = capture.records.filter((record) => record.kind === "passage").length;
  const channelLimit = candidateLimitForMemorySearchDepth(0);
  return {
    threads: new Set(capture.records.map((record) => record.threadId)).size,
    identityRecords,
    passageRecords,
    channelLimit,
    identitiesFitChannel: identityRecords <= channelLimit
  };
}

function totalValue(evaluation: VariantEvaluation | undefined, metric: "top1Target"): number | null {
  return evaluation?.scopes.total?.[metric] ?? null;
}

function requireEvaluation(evaluation: VariantEvaluation | undefined): VariantEvaluation {
  if (evaluation === undefined) throw new Error("A report variant was not evaluated.");
  return evaluation;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});
}

function scopeTable(scopes: Record<string, ScopeValues>): string {
  const metricIds = Object.keys(METRIC_REACH) as Array<keyof typeof METRIC_REACH>;
  const scopeNames = Object.keys(scopes);
  return table(
    ["Metric", "Reach", ...scopeNames],
    metricIds.map((metric) => [metric, METRIC_REACH[metric], ...scopeNames.map((scope) => fmt(scopes[scope]?.[metric] ?? null))])
  );
}

function comparisonTable(rows: MetricComparison[]): string {
  if (rows.length === 0) return "No verdict: at least one side is incomplete.";
  return table(
    ["Scope", "Metric", "Difference", "Interval 95%", "Margin", "Term", "Non-inferior", "McNemar (b/c, p)"],
    rows.map((row) => [
      row.scope,
      row.metric,
      fmt(row.difference),
      row.lower === null || row.upper === null ? "—" : `[${fmt(row.lower)}, ${fmt(row.upper)}]`,
      fmt(row.margin),
      row.term ?? "—",
      row.nonInferior === null ? "—" : String(row.nonInferior),
      mcnemarCell(row)
    ])
  );
}

/** McNemar on the discordant top-1 outcomes. Only the all-scope top1Target row carries it. */
function mcnemarCell(row: MetricComparison): string {
  if (row.mcnemar === undefined) return "—";
  return `${row.mcnemar.b}/${row.mcnemar.c}, ${row.mcnemar.p.toExponential(2)}`;
}

/** One identification line for a provider: the model and the version recorded in the capture. */
function providerLine(provider: { model: string; version: string }): string {
  return `${provider.model} (version ${provider.version})`;
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  return [head, rule, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(4);
}

/** Small score deltas need scientific notation: 4 decimals would print them as zero. */
function sci(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toExponential(2);
}
