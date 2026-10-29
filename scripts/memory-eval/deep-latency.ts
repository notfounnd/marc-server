import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getWorkspaceInfo } from "../../src/core/workspace.js";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { configuredDocumentsOf, withTemporaryWorkspace, type CorpusSource } from "./corpus.js";
import { disposeProviders } from "./capture.js";
import type { CaptureProviders } from "./capture-types.js";
import type { EvalCase } from "./dataset.js";
import { loadDeepInputs, runDeepCases, type DeepInputs } from "./deep-run.js";
import { PROTOCOL } from "./deep-latency-report.js";
import { runnersOf } from "./deep-latency-paths.js";
import {
  budgetOf,
  gateOfPath,
  isUsableBudget,
  overheadMsOf,
  pairsMatch,
  pairsPerSecondOf,
  pairsStable,
  REFERENCE_P95_MS,
  rotatedOrder,
  TIMED_PER_CASE,
  type TimedSample
} from "./deep-latency-math.js";
import { latencySummary, type LatencySummary } from "./metrics.js";
import {
  instrumentedProviders,
  openReferenceContext,
  providersOf,
  type ProbeHolder,
  type RecallSample
} from "./t0-funnel-prestudy.js";

const MEMORY_EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MEMORY_EVAL_DIR, "..", "..");
const THREADS_ROOT = path.join(REPOSITORY_ROOT, ".marc", "threads");
const RULES_PATH = path.join(REPOSITORY_ROOT, ".marc", "RULES.md");
const PINNED_PATH = path.join(MEMORY_EVAL_DIR, "datasets", "marc-deep.corpus.json");
const DATASET_PATH = path.join(MEMORY_EVAL_DIR, "datasets", "marc-deep.json");

export type PathName = "m0" | "scoped" | "unscoped";
const PATH_ORDER: readonly PathName[] = ["m0", "scoped", "unscoped"];

/** The pairs that a path must send, replayed from the capture: the scoped run and the unscoped run of the case. */
export type Expected = { scoped: number | null; unscoped: number | null };

/** The samples of one case: the warm-up calls and the timed ones, per path. */
export type CaseTiming = {
  id: string;
  scoped: boolean;
  expectedPairs: Expected;
  allPairs: Record<PathName, RecallSample[]>;
  timed: Record<PathName, RecallSample[]>;
};

type Gate = { limitMs: number | null; passed: boolean | null };

/** One measurement: the cases interleaved, the summaries, the gates and the verdict of each mode. */
export type MeasurementRun = {
  budget: number | null;
  startedAt: string;
  finishedAt: string;
  cases: CaseTiming[];
  summary: Record<PathName, LatencySummary>;
  m0ScopedMedianMs: number | null;
  m0AllMedianMs: number | null;
  gates: { scoped: Gate; unscoped: Gate };
  p95WithinReference: { scoped: boolean | null; unscoped: boolean | null };
  overheadMs: number | null;
  pairsPerSecond: number | null;
  pairsMismatch: string[];
  m0UnstableCases: string[];
  protocolIncomplete: boolean;
  verdicts: { scoped: boolean | null; unscoped: boolean | null };
  memory: { totalMemBytes: number; freeMemStartBytes: number; freeMemEndBytes: number };
};

/** The report written to .marc/cache/memory-eval/marc-deep: the first measurement, and the recuo one when it ran. */
export type LatencyReport = {
  schemaVersion: 1;
  corpus: "marc-deep";
  captureId: string;
  protocol: Record<string, string | number>;
  first: MeasurementRun;
  recuo: { budget: number | null; reason: string; run: MeasurementRun | null };
};

type Setup = { cases: EvalCase[]; threadIds: string[]; info: WorkspaceInfo; base: CaptureProviders };

/** The source of the M0 reference copy: the pinned threads of marc-deep, with the rules and the configured documents. */
async function sourceOf(threadIds: string[]): Promise<CorpusSource> {
  return {
    threadsRoot: THREADS_ROOT,
    threadIds,
    rulesPath: RULES_PATH,
    documents: await configuredDocumentsOf({ repositoryRoot: REPOSITORY_ROOT })
  };
}

/** One case: a warm-up of each path that applies, then three rounds with the order rotated by round. */
async function timeCase(input: {
  evalCase: EvalCase;
  runners: ReturnType<typeof runnersOf>;
  expected: Expected;
}): Promise<CaseTiming> {
  const scoped = input.evalCase.scope?.threadId !== undefined;
  const names = scoped ? PATH_ORDER : PATH_ORDER.filter((name) => name !== "scoped");
  const allPairs: Record<PathName, RecallSample[]> = { m0: [], scoped: [], unscoped: [] };
  const timed: Record<PathName, RecallSample[]> = { m0: [], scoped: [], unscoped: [] };
  for (const name of names) allPairs[name].push(await input.runners[name]());
  for (let round = 0; round < TIMED_PER_CASE; round += 1) {
    for (const name of rotatedOrder(names, round)) {
      const sample = await input.runners[name]();
      timed[name].push(sample);
      allPairs[name].push(sample);
    }
  }
  return { id: input.evalCase.id, scoped, expectedPairs: input.expected, allPairs, timed };
}

function timedOf(cases: CaseTiming[], name: PathName, scopedOnly: boolean): TimedSample[] {
  return cases
    .filter((item) => !scopedOnly || item.scoped)
    .flatMap((item) => item.timed[name])
    .map((sample) => ({ e2eMs: sample.e2eMs, rerankMs: sample.rerankMs, pairs: sample.pairs }));
}

/** One full measurement over the cases, in one execution: the reference copy, the production calls, the summaries. */
async function measureOnce(setup: Setup, expectedOf: (id: string) => Expected, budget?: number): Promise<MeasurementRun> {
  const holder: ProbeHolder = {};
  const m0Providers = instrumentedProviders(setup.base, holder, "input");
  const deepProviders = instrumentedProviders(setup.base, holder);
  const startedAt = new Date().toISOString();
  const freeMemStartBytes = os.freemem();
  const cases = await withTemporaryWorkspace(await sourceOf(setup.threadIds), async (referenceInfo) => {
    const reference = await openReferenceContext(referenceInfo, setup.base, setup.threadIds);
    const timings: CaseTiming[] = [];
    for (const evalCase of setup.cases) {
      const runners = runnersOf({ evalCase, reference, m0Providers, deepProviders, holder, info: setup.info, budget });
      timings.push(await timeCase({ evalCase, runners, expected: expectedOf(evalCase.id) }));
      console.error(`[${timings.length}/${setup.cases.length}] ${evalCase.id} timed at ${new Date().toISOString()}`);
    }
    return timings;
  });
  const summary = {
    m0: latencySummary(timedOf(cases, "m0", false).map((item) => item.e2eMs)),
    scoped: latencySummary(timedOf(cases, "scoped", true).map((item) => item.e2eMs)),
    unscoped: latencySummary(timedOf(cases, "unscoped", false).map((item) => item.e2eMs))
  };
  const m0Scoped = latencySummary(timedOf(cases, "m0", true).map((item) => item.e2eMs));
  const gates = {
    scoped: gateOfPath({ medianMs: summary.scoped.medianMs, referenceMedianMs: m0Scoped.medianMs }),
    unscoped: gateOfPath({ medianMs: summary.unscoped.medianMs, referenceMedianMs: summary.m0.medianMs })
  };
  const mismatch = cases.flatMap((item) => [
    ...(item.scoped && !pairsMatch(item.allPairs.scoped, item.expectedPairs.scoped ?? -1) ? [`${item.id}/scoped`] : []),
    ...(!pairsMatch(item.allPairs.unscoped, item.expectedPairs.unscoped ?? -1) ? [`${item.id}/unscoped`] : [])
  ]);
  const protocolIncomplete = mismatch.length > 0;
  const scopedTimed = timedOf(cases, "scoped", true);
  return {
    budget: budget ?? null,
    startedAt,
    finishedAt: new Date().toISOString(),
    cases,
    summary,
    m0ScopedMedianMs: m0Scoped.medianMs,
    m0AllMedianMs: summary.m0.medianMs,
    gates,
    p95WithinReference: {
      scoped: summary.scoped.p95Ms === null ? null : summary.scoped.p95Ms <= REFERENCE_P95_MS,
      unscoped: summary.unscoped.p95Ms === null ? null : summary.unscoped.p95Ms <= REFERENCE_P95_MS
    },
    overheadMs: overheadMsOf(scopedTimed),
    pairsPerSecond: pairsPerSecondOf(scopedTimed),
    pairsMismatch: mismatch,
    m0UnstableCases: cases.filter((item) => !pairsStable(item.allPairs.m0)).map((item) => item.id),
    protocolIncomplete,
    verdicts: {
      scoped: protocolIncomplete ? null : gates.scoped.passed,
      unscoped: protocolIncomplete ? null : gates.unscoped.passed
    },
    memory: { totalMemBytes: os.totalmem(), freeMemStartBytes, freeMemEndBytes: os.freemem() }
  };
}

/** The replayed pairs of each case, for one budget: the DEEP pairs of the scoped run, and of the unscoped run. */
async function replayPairs(inputs: DeepInputs, budget?: number): Promise<Map<string, Expected>> {
  const scoped = await runDeepCases(inputs, budget);
  const unscopedInputs: DeepInputs = {
    ...inputs,
    dataset: { ...inputs.dataset, cases: inputs.dataset.cases.map((item) => ({ ...item, scope: undefined })) }
  };
  const unscoped = await runDeepCases(unscopedInputs);
  const unscopedById = new Map(
    unscoped.map((item) => {
      const run = item.caseRuns.runs.DEEP;
      return [item.evalCase.id, run?.status === "ok" ? run.pairs : null] as const;
    })
  );
  return new Map(
    scoped.map((item) => {
      const run = budget === undefined ? item.caseRuns.runs.DEEP : item.caseRuns.runs.DEEP_BUDGET;
      const scopedPairs = run?.status === "ok" ? run.pairs : null;
      return [item.evalCase.id, { scoped: scopedPairs, unscoped: unscopedById.get(item.evalCase.id) ?? null }] as const;
    })
  );
}

/** The recuo decision, taken from the first measurement only: B' from its M0, overhead and rate, and the scoped verdict. */
type RecuoDecision = { budget: number | null; run: boolean; reason: string };

function recuoOf(first: MeasurementRun): RecuoDecision {
  const budget = budgetOf({
    referenceMedianMs: first.m0ScopedMedianMs,
    overheadMs: first.overheadMs,
    pairsPerSecond: first.pairsPerSecond
  });
  if (first.protocolIncomplete)
    return { budget, run: false, reason: "not run: the pairs of the first measurement diverge from the replay" };
  if (first.verdicts.scoped !== false)
    return { budget, run: false, reason: "not run: the scoped path passed the gate" };
  if (!isUsableBudget(budget))
    return { budget, run: false, reason: "not run: B' is outside 1 to 231; the failure is reported to the human" };
  return { budget, run: true, reason: "run: the scoped path failed the gate, so one new measurement runs with B'" };
}

/** The recuo measurement runs only when the decision asks for it, with its usable B' as the budget. */
async function runRecuo(input: { inputs: DeepInputs; setup: Setup; decision: RecuoDecision }): Promise<MeasurementRun | null> {
  const { decision } = input;
  if (!decision.run || decision.budget === null) return null;
  const expected = await replayPairs(input.inputs, decision.budget);
  return measureOnce(input.setup, (id) => expected.get(id) ?? { scoped: null, unscoped: null }, decision.budget);
}

/** The whole E4 latency study over the marc-deep capture: the first measurement, and the recuo one when it applies. */
export async function runDeepLatency(captureDir: string): Promise<LatencyReport> {
  const inputs = await loadDeepInputs({ datasetPath: DATASET_PATH, captureDir });
  const pinned = JSON.parse(await fs.readFile(PINNED_PATH, "utf8")) as { threadIds: string[] };
  const info = await getWorkspaceInfo(REPOSITORY_ROOT);
  const base = providersOf(info);
  const cases = inputs.dataset.cases.filter((item) => item.style === "deep");
  const setup: Setup = { cases, threadIds: pinned.threadIds, info, base };
  try {
    const firstExpected = await replayPairs(inputs);
    const first = await measureOnce(setup, (id) => firstExpected.get(id) ?? { scoped: null, unscoped: null });
    const decision = recuoOf(first);
    const recuoRun = await runRecuo({ inputs, setup, decision });
    return {
      schemaVersion: 1,
      corpus: "marc-deep",
      captureId: inputs.capture.captureId,
      protocol: PROTOCOL,
      first,
      recuo: { budget: decision.budget, reason: decision.reason, run: recuoRun }
    };
  } finally {
    await disposeProviders(base);
  }
}
