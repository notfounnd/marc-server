import type { CaptureFile } from "./capture-types.js";
import type { EvalDataset } from "./dataset.js";
import {
  caseInputsFor,
  compareEvaluations,
  evaluateVariant,
  type MetricComparison,
  type VariantEvaluation
} from "./evaluation.js";
import { sharedMetrics, type PendingPair } from "./metrics.js";
import { replayCapture } from "./replay.js";
import type { ReplayInputs } from "./replay-inputs.js";

/** One side of a comparison: its capture, its variant, and the inputs that variant reads. */
export type CompareSide = { capture: CaptureFile; variant: string; inputs: ReplayInputs };

export type CompareSideSummary = {
  captureId: string;
  variant: string;
  status: "complete" | "incomplete";
  pendingPairs: number;
  pending: PendingPair[];
  /** Cases with a missing rerank score or no replay. A side with any is incomplete, never zero. */
  incompleteCaseIds: string[];
};

export type CompareResult = {
  corpus: string;
  queryFingerprint: string;
  corpusDigest: string;
  verdict: "compared" | "incomplete";
  baseline: CompareSideSummary;
  candidate: CompareSideSummary;
  rows: MetricComparison[];
};

/**
 * Refuses to pair captures that answer different queries or that were built
 * over different pinned corpus content.
 */
export function assertComparable(baseline: CaptureFile, candidate: CaptureFile): void {
  if (baseline.corpus !== candidate.corpus)
    throw new Error(
      `The captures belong to different corpora (${baseline.corpus} and ${candidate.corpus}).`
    );
  if (baseline.fingerprint.queryFingerprint !== candidate.fingerprint.queryFingerprint)
    throw new Error(
      "The captures have different queries (queryFingerprint). compare needs the same queries."
    );
  if (baseline.corpusDigest !== candidate.corpusDigest)
    throw new Error(
      "The captures have different corpusDigest: the pinned corpus content changed. compare refuses to pair them."
    );
}

/** Compares the candidate variant against the baseline variant, judged by the dataset's current judgments. */
export async function compareCaptures(input: {
  dataset: EvalDataset;
  baseline: CompareSide;
  candidate: CompareSide;
}): Promise<CompareResult> {
  assertComparable(input.baseline.capture, input.candidate.capture);
  const baseline = await evaluateSide(input.dataset, input.baseline);
  const candidate = await evaluateSide(input.dataset, input.candidate);
  const complete = baseline.status === "complete" && candidate.status === "complete";
  const rows = compareEvaluations(
    baseline,
    candidate,
    sharedMetrics(input.baseline.variant, input.candidate.variant)
  );
  return {
    corpus: input.baseline.capture.corpus,
    queryFingerprint: input.baseline.capture.fingerprint.queryFingerprint,
    corpusDigest: input.baseline.capture.corpusDigest,
    verdict: complete ? "compared" : "incomplete",
    baseline: summaryOf(input.baseline.capture, baseline),
    candidate: summaryOf(input.candidate.capture, candidate),
    rows
  };
}

async function evaluateSide(
  dataset: EvalDataset,
  side: CompareSide
): Promise<VariantEvaluation> {
  const replay = await replayCapture({
    capture: side.capture,
    dataset,
    variantIds: [side.variant],
    ...side.inputs
  });
  return evaluateVariant(side.variant, caseInputsFor(dataset, replay, side.variant));
}

function summaryOf(capture: CaptureFile, evaluation: VariantEvaluation): CompareSideSummary {
  return {
    captureId: capture.captureId,
    variant: evaluation.variant,
    status: evaluation.status,
    pendingPairs: evaluation.pending.length,
    pending: evaluation.pending,
    incompleteCaseIds: evaluation.incompleteCaseIds
  };
}
