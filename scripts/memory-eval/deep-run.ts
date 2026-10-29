import fs from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import { readVectors } from "./capture-vectors.js";
import type { CaptureFile, CapturedCase, CapturedRecord } from "./capture-types.js";
import type { EvalCase, EvalDataset } from "./dataset.js";
import type { FailureClass, FailureDecision } from "./deep-classes.js";
import type { IncompleteReason, VariantMetrics } from "./deep-metrics.js";
import { assertDeepBudget, type GateReport, type ProtocolReport } from "./deep-protocol.js";
import { renderDeepMarkdown } from "./deep-report.js";
import { runDeepVariants, type DeepCaseRuns, type DeepVariantId } from "./deep-variants.js";
import type { EvidenceMatch } from "./matrix-plan.js";
import { recordsById } from "./replay.js";
import { deepReportOf } from "./deep-case-report.js";

export { adoptedVariantOf, caseReportOf, deepReportOf, incompleteReasonsOf } from "./deep-case-report.js";

/** What a deep run reads from disk: the dataset, the capture with its vectors, and the evidence of each case. */
export type DeepInputs = {
  dataset: EvalDataset;
  capture: CaptureFile;
  vectors: Map<string, number[]>;
  evidence: Map<string, EvidenceMatch[]>;
};

/** The configuration under test: DEEP when no budget is given, and the recuo DEEP_BUDGET when one is. */
export type AdoptedVariant = "DEEP" | "DEEP_BUDGET";

export type CaseReport = {
  id: string;
  scoped: boolean;
  threadId: string | null;
  sourceTypes: string[] | null;
  /** Passages of the scope, from the adopted variant. Null for an unscoped case. */
  scopePassages: number | null;
  /** The adopted variant was truncated by its budget. */
  truncated: boolean;
  /** True when the case has any incomplete reason, in any variant. An incomplete case has no failure class. */
  incomplete: boolean;
  /** The reasons that make the case incomplete, without duplicates: variant reasons and missing-evidence. */
  incompleteReasons: IncompleteReason[];
  /** Every variant of the case, DEEP included as the baseline. */
  variants: Partial<Record<DeepVariantId, VariantMetrics>>;
  /** Success@5 of the adopted variant. Null when it is incomplete in the case. */
  successAdopted: boolean | null;
  /** Every result of the adopted variant respects the scope. */
  scopeConformAdopted: boolean;
  /** Saturated results of the adopted variant among its first five. Null when it is incomplete. */
  saturatedAdopted: number | null;
  failure: FailureDecision | null;
  /** DEEP and DEEP_ALL return the same first five passages. */
  deepSameAsDeepAll: boolean;
};

export type DeepSummary = {
  /** Success@5 of each variant over its complete cases. DEEP is the baseline. */
  success: Partial<Record<DeepVariantId, number>>;
  /** Success@5 of the adopted variant over its complete cases. */
  successAdopted: number;
  /** Incomplete cases of each variant, by reason. */
  incomplete: Partial<Record<DeepVariantId, Partial<Record<IncompleteReason, number>>>>;
  /** Cases counted under each reason that makes them incomplete. A case with two reasons counts twice. */
  incompleteCases: Partial<Record<IncompleteReason, number>>;
  failures: Partial<Record<FailureClass, number>>;
  alsoTruncated: number;
  deepDiffersFromDeepAll: number;
  scopeConformAdopted: boolean;
};

export type DeepReport = {
  corpus: "marc-deep";
  captureId: string;
  deepBudget: number | null;
  /** The configuration that the gate and the classes read. DEEP_BUDGET when a budget is given. */
  adoptedVariant: AdoptedVariant;
  protocol: ProtocolReport;
  gate: GateReport;
  summary: DeepSummary;
  cases: CaseReport[];
};

export type CaseRuns = { evalCase: EvalCase; captured: CapturedCase; caseRuns: DeepCaseRuns };

/** Reads the dataset, the capture and the vectors. The vectors are read only when the capture holds them. */
export async function loadDeepInputs(input: { datasetPath: string; captureDir: string }): Promise<DeepInputs> {
  const dataset = JSON.parse(await fs.readFile(input.datasetPath, "utf8")) as EvalDataset;
  const capture = JSON.parse(await fs.readFile(path.join(input.captureDir, "capture.json"), "utf8")) as CaptureFile;
  if (capture.vectors === undefined) throw new Error("A deep run needs the vectors of an E3 capture.");
  const vectors = await readVectors(input.captureDir, capture.vectors);
  const evidence = await readEvidenceOf(input.captureDir);
  return { dataset, capture, vectors, evidence };
}

async function readEvidenceOf(directory: string): Promise<Map<string, EvidenceMatch[]>> {
  const names = (await fs.readdir(path.join(directory, "cases"))).filter((name) => name.endsWith(".json"));
  const entries = await Promise.all(
    names.map(async (name) => {
      const file = JSON.parse(await fs.readFile(path.join(directory, "cases", name), "utf8")) as {
        id: string;
        evidence?: EvidenceMatch[];
      };
      return [file.id, file.evidence ?? []] as const;
    })
  );
  return new Map(entries);
}

/** Runs every variant of every deep case, in dataset order. The budget is refused outside its domain first. */
export async function runDeepCases(inputs: DeepInputs, deepBudget?: number): Promise<CaseRuns[]> {
  assertDeepBudget(deepBudget);
  const records = recordsById(inputs.capture.records);
  const rerankerMetadata = inputs.capture.providers.reranker;
  const deepCases = inputs.dataset.cases.filter((evalCase) => evalCase.style === "deep");
  const runs: CaseRuns[] = [];
  for (const evalCase of deepCases) {
    const captured = capturedCaseOf(inputs.capture, evalCase.id);
    const caseRuns = await runDeepVariants({
      evalCase,
      captured,
      records,
      vectors: inputs.vectors,
      rerankerMetadata,
      deepBudget
    });
    runs.push({ evalCase, captured, caseRuns });
  }
  return runs;
}

function capturedCaseOf(capture: CaptureFile, caseId: string): CapturedCase {
  const captured = capture.cases.find((item) => item.id === caseId);
  if (captured === undefined) throw new Error(`The capture has no case ${caseId}.`);
  return captured;
}

/** The full deep report of a capture. It runs the cases and then builds the report with `deepReportOf`. */
export async function runDeepReport(inputs: DeepInputs, deepBudget?: number): Promise<DeepReport> {
  const runs = await runDeepCases(inputs, deepBudget);
  return deepReportOf(runs, inputs.evidence, deepBudget, inputs.capture.captureId);
}

/** Writes the JSON and the Markdown report beside the capture. */
export async function writeDeepReport(captureDir: string, report: DeepReport): Promise<string[]> {
  const jsonPath = path.join(captureDir, "deep-report.json");
  const markdownPath = path.join(captureDir, "deep-report.md");
  await writeFileAtomically(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFileAtomically(markdownPath, renderDeepMarkdown(report));
  return [jsonPath, markdownPath];
}

/** The captured record of each passage id, for the worksheet. Passages only. */
export function passageRecordsOf(capture: CaptureFile): Map<string, CapturedRecord> {
  return new Map(
    capture.records
      .filter((record) => record.kind === "passage" && record.passageId !== undefined)
      .map((record) => [record.passageId ?? "", record])
  );
}
