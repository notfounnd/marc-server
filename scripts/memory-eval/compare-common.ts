import type { CaptureFile, CapturedCase, CapturedChannels } from "./capture-types.js";
import type { EvalDataset } from "./dataset.js";
import {
  caseInputsFor,
  compareEvaluations,
  evaluateVariant,
  type MetricComparison,
  type VariantEvaluation
} from "./evaluation.js";
import type { MetricId } from "./metrics.js";
import { replayCapture, type ReplayInput, type ReplayResult } from "./replay.js";

/**
 * The metrics of the acceptance of DEPTH0 against the frozen M0 (plan revision 6): Top1-alvo, the recall of the
 * implicit cases, and the correct abstention. The margin, the paired bootstrap by family and the E0 verdict are
 * those of compareEvaluations (δ 0,05; inconclusive fails).
 */
export const COMMON_ACCEPTANCE_METRICS: readonly MetricId[] = [
  "top1Target",
  "admissionRecall",
  "abstentionCorrect"
];

/** One side of a common-case comparison: its capture, its variant and the replay inputs the variant needs. */
export type CommonSide = {
  capture: CaptureFile;
  variant: string;
  inputs: Omit<ReplayInput, "capture" | "dataset" | "variantIds">;
};

/** The dataset cases that both captures hold with the same query, and why every other case is left out. */
export type CommonCaseSet = {
  common: string[];
  excluded: {
    notInBaseline: string[];
    notInCandidate: string[];
    queryDiffers: string[];
    incompleteBaseline: string[];
    incompleteCandidate: string[];
  };
};

export type CaseDivergence = {
  caseId: string;
  baselineAdmitted: string[];
  candidateAdmitted: string[];
  admittedDiffers: boolean;
  lexicalDiffers: boolean;
  vectorDiffers: boolean;
  /** The channels that differ for this case: lexical, vector, both, or none (the difference is in the rerank). */
  channel: "lexical" | "vector" | "both" | "none";
};

export type CompareCommonSide = {
  captureId: string;
  variant: string;
  status: VariantEvaluation["status"];
  incompleteCaseIds: string[];
  pendingPairs: number;
  pending: VariantEvaluation["pending"];
};

export type CompareCommonResult = {
  corpus: string;
  baseline: CompareCommonSide;
  candidate: CompareCommonSide;
  cases: CommonCaseSet;
  verdict: "compared" | "incomplete";
  rows: MetricComparison[];
  divergences: CaseDivergence[];
};

/**
 * The cases of the dataset that both captures hold, in dataset order. A case stays in the common set only when the
 * two captures hold the same query for it (original and effective) and neither side marks it incomplete.
 */
export function commonCasesOf(input: {
  dataset: EvalDataset;
  baseline: CaptureFile;
  candidate: CaptureFile;
}): CommonCaseSet {
  const baselineById = new Map(input.baseline.cases.map((item) => [item.id, item] as const));
  const candidateById = new Map(input.candidate.cases.map((item) => [item.id, item] as const));
  const set: CommonCaseSet = {
    common: [],
    excluded: {
      notInBaseline: [],
      notInCandidate: [],
      queryDiffers: [],
      incompleteBaseline: [],
      incompleteCandidate: []
    }
  };
  for (const evalCase of input.dataset.cases) {
    const base = baselineById.get(evalCase.id);
    const cand = candidateById.get(evalCase.id);
    if (base === undefined) {
      set.excluded.notInBaseline.push(evalCase.id);
      continue;
    }
    if (cand === undefined) {
      set.excluded.notInCandidate.push(evalCase.id);
      continue;
    }
    if (!sameQuery(base, cand)) {
      set.excluded.queryDiffers.push(evalCase.id);
      continue;
    }
    if (base.incomplete !== undefined) {
      set.excluded.incompleteBaseline.push(evalCase.id);
      continue;
    }
    if (cand.incomplete !== undefined) {
      set.excluded.incompleteCandidate.push(evalCase.id);
      continue;
    }
    set.common.push(evalCase.id);
  }
  return set;
}

function sameQuery(base: CapturedCase, cand: CapturedCase): boolean {
  return (
    base.originalQuery === cand.originalQuery &&
    base.queryMode === cand.queryMode &&
    base.interpretation.effectiveQuery === cand.interpretation.effectiveQuery
  );
}

/** The lexical and vector channels of a captured case under its effective query, as comparable lists. */
export function channelListsOf(captured: CapturedCase): { lexical: string[]; vector: string[] } {
  const channels: CapturedChannels | undefined = captured.channels[captured.interpretation.effectiveQuery];
  if (channels === undefined) return { lexical: [], vector: [] };
  return {
    lexical: channels.lexical.map((hit) => `${hit.field}:${hit.recordId}:${hit.score.toFixed(6)}`),
    vector: [...channels.identities, ...channels.passages].map(
      (hit) => `${hit.recordId}:${hit.score.toFixed(6)}`
    )
  };
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function admittedOf(replay: ReplayResult, caseId: string, variant: string): string[] {
  const output = replay.cases
    .find((item) => item.caseId === caseId)
    ?.variants.find((item) => item.variant === variant);
  return (output?.results ?? []).filter((item) => item.admitted).map((item) => item.threadId);
}

/** The divergence of one common case: whether the admitted sequences differ, and which captured channels differ. */
export function divergenceOf(input: {
  caseId: string;
  baseline: CapturedCase;
  candidate: CapturedCase;
  baselineAdmitted: string[];
  candidateAdmitted: string[];
}): CaseDivergence {
  const left = channelListsOf(input.baseline);
  const right = channelListsOf(input.candidate);
  const lexicalDiffers = !sameList(left.lexical, right.lexical);
  const vectorDiffers = !sameList(left.vector, right.vector);
  const admittedDiffers = !sameList(input.baselineAdmitted, input.candidateAdmitted);
  return {
    caseId: input.caseId,
    baselineAdmitted: input.baselineAdmitted,
    candidateAdmitted: input.candidateAdmitted,
    admittedDiffers,
    lexicalDiffers,
    vectorDiffers,
    channel: channelLabel(lexicalDiffers, vectorDiffers)
  };
}

function channelLabel(
  lexicalDiffers: boolean,
  vectorDiffers: boolean
): CaseDivergence["channel"] {
  if (lexicalDiffers && vectorDiffers) return "both";
  if (lexicalDiffers) return "lexical";
  if (vectorDiffers) return "vector";
  return "none";
}

/**
 * Compares a candidate variant against a baseline variant on the common cases only, with the current judgments of
 * the dataset for both sides. Each side is replayed from its own capture; the cases outside the common set are
 * reported, never scored.
 */
export async function compareCommonCases(input: {
  dataset: EvalDataset;
  baseline: CommonSide;
  candidate: CommonSide;
  metricIds?: readonly MetricId[];
}): Promise<CompareCommonResult> {
  const cases = commonCasesOf({
    dataset: input.dataset,
    baseline: input.baseline.capture,
    candidate: input.candidate.capture
  });
  const commonIds = new Set(cases.common);
  const dataset: EvalDataset = {
    ...input.dataset,
    cases: input.dataset.cases.filter((item) => commonIds.has(item.id))
  };
  const baselineCapture: CaptureFile = {
    ...input.baseline.capture,
    cases: input.baseline.capture.cases.filter((item) => commonIds.has(item.id))
  };
  const candidateCapture: CaptureFile = {
    ...input.candidate.capture,
    cases: input.candidate.capture.cases.filter((item) => commonIds.has(item.id))
  };
  const baselineReplay = await replayCapture({
    ...input.baseline.inputs,
    capture: baselineCapture,
    dataset,
    variantIds: [input.baseline.variant]
  });
  const candidateReplay = await replayCapture({
    ...input.candidate.inputs,
    capture: candidateCapture,
    dataset,
    variantIds: [input.candidate.variant]
  });
  const baselineEval = evaluateVariant(
    input.baseline.variant,
    caseInputsFor(dataset, baselineReplay, input.baseline.variant)
  );
  const candidateEval = evaluateVariant(
    input.candidate.variant,
    caseInputsFor(dataset, candidateReplay, input.candidate.variant)
  );
  const rows = compareEvaluations(
    baselineEval,
    candidateEval,
    input.metricIds ?? COMMON_ACCEPTANCE_METRICS
  );
  const divergences = cases.common.map((caseId) => {
    const base = baselineCapture.cases.find((item) => item.id === caseId);
    const cand = candidateCapture.cases.find((item) => item.id === caseId);
    if (base === undefined || cand === undefined) throw new Error(`Common case ${caseId} is missing.`);
    return divergenceOf({
      caseId,
      baseline: base,
      candidate: cand,
      baselineAdmitted: admittedOf(baselineReplay, caseId, input.baseline.variant),
      candidateAdmitted: admittedOf(candidateReplay, caseId, input.candidate.variant)
    });
  });
  const complete = baselineEval.status === "complete" && candidateEval.status === "complete";
  return {
    corpus: input.baseline.capture.corpus,
    baseline: sideOf(input.baseline.capture.captureId, baselineEval),
    candidate: sideOf(input.candidate.capture.captureId, candidateEval),
    cases,
    verdict: complete ? "compared" : "incomplete",
    rows: complete ? rows : [],
    divergences
  };
}

function sideOf(captureId: string, evaluation: VariantEvaluation): CompareCommonSide {
  return {
    captureId,
    variant: evaluation.variant,
    status: evaluation.status,
    incompleteCaseIds: evaluation.incompleteCaseIds,
    pendingPairs: evaluation.pending.length,
    pending: evaluation.pending.slice(0, 50)
  };
}

/** The Markdown of a common-case comparison: counts, the metric table, and every case whose admitted sequence differs. */
export function renderCompareCommonMarkdown(result: CompareCommonResult): string {
  const excludedTotal = Object.values(result.cases.excluded).reduce((sum, list) => sum + list.length, 0);
  const admittedDiffers = result.divergences.filter((item) => item.admittedDiffers);
  const lines: string[] = [
    `# Comparação em casos comuns: ${result.candidate.variant} (${result.candidate.captureId}) contra ${result.baseline.variant} (${result.baseline.captureId}), corpus ${result.corpus}`,
    "",
    `Veredito: ${result.verdict}. Casos comuns: ${result.cases.common.length}. Fora do conjunto: ${excludedTotal}.`,
    "",
    "| Fora do conjunto | Casos |",
    "|---|---|",
    ...Object.entries(result.cases.excluded).map(([reason, ids]) => `| ${reason} | ${ids.length} |`),
    "",
    "## Métricas (δ 0,05, bootstrap por família, inconclusivo reprova)",
    "",
    "| Métrica | Escopo | Base | Candidato | Diferença | IC inferior | IC superior | Termo | Não inferior |",
    "|---|---|---|---|---|---|---|---|---|",
    ...result.rows.map(
      (row) =>
        `| ${row.metric} | ${row.scope} | ${fmt(row.baseline)} | ${fmt(row.candidate)} | ${fmt(row.difference)} | ${fmt(row.lower)} | ${fmt(row.upper)} | ${row.term ?? "—"} | ${row.nonInferior ?? "—"} |`
    ),
    "",
    `## Casos com lista admitida divergente (${admittedDiffers.length})`,
    "",
    "| Caso | Canal divergente | Base (admitidos) | Candidato (admitidos) |",
    "|---|---|---|---|",
    ...admittedDiffers.map(
      (item) =>
        `| ${item.caseId} | ${item.channel} | ${item.baselineAdmitted.join(", ") || "—"} | ${item.candidateAdmitted.join(", ") || "—"} |`
    ),
    "",
    `Casos com canal léxico divergente: ${result.divergences.filter((item) => item.lexicalDiffers).length}. Canal vetorial divergente: ${result.divergences.filter((item) => item.vectorDiffers).length}.`,
    ""
  ];
  return `${lines.join("\n")}\n`;
}

function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(4);
}
