import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import { LATENCY_LIMIT, REFERENCE_P95_MS, TIMED_PER_CASE } from "./deep-latency-math.js";
import type { LatencyReport, MeasurementRun } from "./deep-latency.js";

const MEMORY_EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MEMORY_EVAL_DIR, "..", "..");
const OUTPUT_DIR = path.join(REPOSITORY_ROOT, ".marc", "cache", "memory-eval", "marc-deep");

/** The protocol as the report states it: what each path runs, in which order, and the gate factor. */
export const PROTOCOL: Record<string, string | number> = {
  limit: LATENCY_LIMIT,
  timedPerCase: TIMED_PER_CASE,
  warmupPerPath: 1,
  interleaving:
    "per case: warm-up of m0, scoped (scoped cases only), unscoped; then three rounds in the order m0, scoped, unscoped, rotated by one path per round",
  m0: "reference copy of the pinned marc-deep threads with layer 0 only, input order (E3 preparation, openReferenceContext)",
  scopedPath: "the 10 scoped cases only, production index, thread and source types of the case",
  unscopedPath: "all 14 cases, production index, query and queryMode only",
  factor: 1.2,
  referenceP95Ms: REFERENCE_P95_MS
};

/** Writes the report to .marc/cache/memory-eval/marc-deep, with a timestamp in the name. */
export async function writeLatencyReport(report: LatencyReport): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(OUTPUT_DIR, `deep-latency-${stamp}.json`);
  await writeFileAtomically(target, `${JSON.stringify(report, null, 2)}\n`);
  return target;
}

function ms(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(0);
}

function runLines(label: string, run: MeasurementRun): string[] {
  const scoped = run.gates.scoped;
  const unscoped = run.gates.unscoped;
  return [
    `${label}: budget ${run.budget ?? "232 (core)"}, started ${run.startedAt}, finished ${run.finishedAt}`,
    `  m0 median ${ms(run.summary.m0.medianMs)} ms, p95 ${ms(run.summary.m0.p95Ms)} ms, samples ${run.summary.m0.samples}`,
    `  scoped median ${ms(run.summary.scoped.medianMs)} ms, p95 ${ms(run.summary.scoped.p95Ms)} ms, limit ${ms(scoped.limitMs)} ms (M0 scoped ${ms(run.m0ScopedMedianMs)} ms), verdict ${run.verdicts.scoped}`,
    `  unscoped median ${ms(run.summary.unscoped.medianMs)} ms, p95 ${ms(run.summary.unscoped.p95Ms)} ms, limit ${ms(unscoped.limitMs)} ms (M0 all ${ms(run.m0AllMedianMs)} ms), verdict ${run.verdicts.unscoped}`,
    `  informative p95 under ${REFERENCE_P95_MS} ms: scoped ${run.p95WithinReference.scoped}, unscoped ${run.p95WithinReference.unscoped}`,
    `  overhead ${ms(run.overheadMs)} ms, reranker rate ${run.pairsPerSecond === null ? "n/a" : run.pairsPerSecond.toFixed(2)} pairs/s`,
    `  pairs mismatch: ${run.pairsMismatch.length === 0 ? "none" : run.pairsMismatch.join(", ")}; protocolIncomplete ${run.protocolIncomplete}`,
    `  m0 pairs unstable within a case: ${run.m0UnstableCases.length === 0 ? "none" : run.m0UnstableCases.join(", ")}`
  ];
}

/** The console summary of a latency report: the first measurement, the recuo decision, and the recuo run if it ran. */
export function describeLatencyReport(report: LatencyReport): string[] {
  const recuo = report.recuo.run === null ? [`recuo: ${report.recuo.reason}; B' computed ${report.recuo.budget ?? "n/a"}`] : runLines("recuo run", report.recuo.run);
  return [...runLines("first run", report.first), ...recuo];
}
