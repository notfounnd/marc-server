import os from "node:os";
import { performance } from "node:perf_hooks";
import type { WorkspaceInfo } from "../../src/core/types.js";
import {
  semanticOnlyVectorOf
} from "./features.js";
import { judgeDocumentOf } from "./judge-document.js";
import type { MemoryVectorRecord } from "../../src/core/memory/types.js";
import type { CaptureFile, CapturedRecord } from "./capture-types.js";
import { medianOf } from "./calibration.js";
import {
  admits,
  probabilityOf,
  type ModelParams
} from "./fit-model.js";
import {
  choiceCasesOf,
  judgeTargetsOf,
  type JudgeTarget
} from "./judge.js";
import type {
  ChoiceRunner,
  JudgeRunner,
  ModelIdentity
} from "./judge-runner.js";
import type { JudgeName } from "./judge-stage.js";
import type { LatencyFile } from "./latency.js";
import { createRssSampler, workerRssBytes, type RssSampler } from "./memory-sampling.js";

/**
 * Latency of the judge (H7) and of the typed choice (H8), with the memory of the
 * harness process and of the inference workers (E2, A4). The judge times the threads
 * that production would judge: the ones H1 pre-admits, under the production
 * parameters. The choice times one forward per case with a distinct correction.
 * Every case has one warm-up pass and MODEL_LATENCY_SAMPLES timed passes.
 */

export const MODEL_LATENCY_SCHEMA_VERSION = 1;
/** Label of every total built from the M0 latency and a model component. */
export const MODEL_LATENCY_LABEL = "estimated";
/** Timed passes after the warm-up pass, as the M0 latency has three samples per case. */
export const MODEL_LATENCY_SAMPLES = 3;
/** Period of the harness RSS sampler, in milliseconds. */
export const RSS_SAMPLE_INTERVAL_MS = 200;

/** What the memory fields mean, written into every file next to the numbers. */
export const MEMORY_NOTE =
  "harness* is the RSS of the whole harness process (the Node runtime, the capture and the model). " +
  "harnessDeltaBytes is peak minus base: the incremental cost of the model during the passes. " +
  "workers* are the RSS of the inference workers of the M0 models, by role: before the model, after it, " +
  "and the peak of each role seen during the passes. totalSampledBytes is the harness peak plus the sum of the worker peaks.";

export type ModelLatencyCase = {
  id: string;
  /** Judged threads (judge) or forwards (choice) of the case. */
  units: number;
  /** The warm-up pass, in milliseconds. */
  warmup: number;
  /** The timed passes, in milliseconds. */
  samples: number[];
};

export type LatencyMemory = {
  totalMemBytes: number;
  freeMemStartBytes: number;
  freeMemEndBytes: number;
  harnessBaseBytes: number;
  harnessLoadedBytes: number;
  harnessPeakBytes: number;
  harnessDeltaBytes: number;
  workersBeforeBytes: Record<string, number>;
  /** The largest RSS of each worker role seen at the base and after each case. */
  workersPeakBytes: Record<string, number>;
  workersAfterBytes: Record<string, number>;
  /** Harness peak plus the sum of the worker peaks, by role. */
  totalSampledBytes: number;
  note: string;
};

export type EstimatedLatency = {
  label: typeof MODEL_LATENCY_LABEL;
  /** Median over the cases with a M0 latency of their M0 median recall, or null. */
  m0MedianMs: number | null;
  /** Median over the cases of the component's median per case. */
  componentMedianMs: number;
  /** Median over the cases of the M0 median plus the component median, or null. */
  totalMedianMs: number | null;
  casesWithM0: number;
  cases: number;
};

export type ModelLatencyFile = {
  schemaVersion: typeof MODEL_LATENCY_SCHEMA_VERSION;
  kind: "judge" | "choice";
  model: ModelIdentity;
  captureId: string;
  corpus: string;
  measuredAt: string;
  /** The capture whose production H1 parameters chose the judged threads, or null for the choice. */
  productionFit: string | null;
  cases: ModelLatencyCase[];
  memory: LatencyMemory;
  estimated: EstimatedLatency;
};

/** Threads that H1 pre-admits: semanticOnly reaches the production low cut (D6). */
export function preAdmittedTargetsOf(
  targets: readonly JudgeTarget[],
  production: ModelParams
): JudgeTarget[] {
  return targets.filter((target) =>
    admits(probabilityOf(production, semanticOnlyVectorOf(target.features)), production.cuts.low)
  );
}

/** The median recall of each case in latency.json, in milliseconds. */
export function m0MedianByCase(latency: LatencyFile | undefined): Map<string, number> {
  return new Map(
    (latency?.cases ?? []).map((item) => [item.id, medianOf(item.samples)] as const)
  );
}

function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return medianOf(values);
}

/**
 * The total labelled "estimated": per case, the M0 median recall plus the component's
 * median, and the median over the cases. A case without M0 contributes only to the
 * component median.
 */
export function estimatedOf(input: {
  m0: ReadonlyMap<string, number>;
  components: ReadonlyArray<{ id: string; componentMs: number }>;
}): EstimatedLatency {
  const withM0 = input.components.flatMap((item) => {
    const m0 = input.m0.get(item.id);
    return m0 === undefined ? [] : [{ m0, componentMs: item.componentMs }];
  });
  return {
    label: MODEL_LATENCY_LABEL,
    m0MedianMs: medianOrNull(withM0.map((item) => item.m0)),
    componentMedianMs: medianOrNull(input.components.map((item) => item.componentMs)) ?? 0,
    totalMedianMs: medianOrNull(withM0.map((item) => item.m0 + item.componentMs)),
    casesWithM0: withM0.length,
    cases: input.components.length
  };
}

export type MemoryReadings = {
  totalMemBytes: number;
  freeMemStartBytes: number;
  freeMemEndBytes: number;
  harnessBaseBytes: number;
  harnessLoadedBytes: number;
  harnessPeakBytes: number;
  workersBeforeBytes: Record<string, number>;
  workersPeakBytes: Record<string, number>;
  workersAfterBytes: Record<string, number>;
};

/** The memory block of a file: the delta is peak minus base, the total is the peak plus the worker peaks. */
export function memoryOf(readings: MemoryReadings): LatencyMemory {
  const workersPeak = Object.values(readings.workersPeakBytes).reduce(
    (total, bytes) => total + bytes,
    0
  );
  return {
    ...readings,
    harnessDeltaBytes: readings.harnessPeakBytes - readings.harnessBaseBytes,
    totalSampledBytes: readings.harnessPeakBytes + workersPeak,
    note: MEMORY_NOTE
  };
}

export type TimedWork = { id: string; units: number; work: () => Promise<void> };

/**
 * One warm-up pass over every case, then MODEL_LATENCY_SAMPLES timed passes. The
 * sampler reads the RSS after every case, so its peak covers the whole pass. The
 * optional hook runs after each case, outside the timed section (it reads the workers).
 */
export async function timedPasses(
  cases: readonly TimedWork[],
  sampler: RssSampler,
  log: (line: string) => void,
  afterCase?: () => Promise<void>
): Promise<ModelLatencyCase[]> {
  const measured: ModelLatencyCase[] = cases.map((item) => ({
    id: item.id,
    units: item.units,
    warmup: 0,
    samples: []
  }));
  for (let pass = 0; pass <= MODEL_LATENCY_SAMPLES; pass += 1) {
    for (const [index, item] of cases.entries()) {
      const started = performance.now();
      await item.work();
      const elapsed = performance.now() - started;
      sampler.sample();
      await afterCase?.();
      if (pass === 0) {
        measured[index].warmup = elapsed;
        continue;
      }
      measured[index].samples.push(elapsed);
    }
    log(`pass ${pass} of ${MODEL_LATENCY_SAMPLES} done (${pass === 0 ? "warm-up" : "timed"})`);
  }
  return measured;
}

/** The file name of a model latency: latency-judge-<model>.json or latency-choice-<model>.json. */
export function modelLatencyFileName(kind: "judge" | "choice", model: string): string {
  return `latency-${kind}-${model}.json`;
}

type PlannedWork<R> = { id: string; units: number; work: (runner: R) => Promise<void> };

async function measureModelLatency<R extends { identity: ModelIdentity }>(input: {
  kind: "judge" | "choice";
  capture: CaptureFile;
  workerInfo: WorkspaceInfo;
  latency: LatencyFile | undefined;
  productionFit: string | null;
  planned: ReadonlyArray<PlannedWork<R>>;
  loadRunner: () => Promise<R>;
  log: (line: string) => void;
}): Promise<ModelLatencyFile> {
  const measuredAt = new Date().toISOString();
  const freeMemStartBytes = os.freemem();
  // Base: the M0 models are loaded in the workers, and the new model is not loaded yet.
  const harnessBaseBytes = process.memoryUsage().rss;
  const workersBeforeBytes = await workerRssBytes(input.workerInfo);
  const runner = await input.loadRunner();
  const harnessLoadedBytes = process.memoryUsage().rss;
  const sampler = createRssSampler(undefined, RSS_SAMPLE_INTERVAL_MS);
  const cases = input.planned.map((item) => ({
    id: item.id,
    units: item.units,
    work: () => item.work(runner)
  }));
  // The workers are read after each case, so a worker that unloads later still leaves its peak.
  const workersPeakBytes: Record<string, number> = { ...workersBeforeBytes };
  const observeWorkers = async () => {
    const current = await workerRssBytes(input.workerInfo);
    for (const [role, bytes] of Object.entries(current)) {
      workersPeakBytes[role] = Math.max(workersPeakBytes[role] ?? 0, bytes);
    }
  };
  const measured = await timedPasses(cases, sampler, input.log, observeWorkers);
  const harnessPeakBytes = sampler.stop();
  const workersAfterBytes = await workerRssBytes(input.workerInfo);
  await observeWorkers();
  return {
    schemaVersion: MODEL_LATENCY_SCHEMA_VERSION,
    kind: input.kind,
    model: runner.identity,
    captureId: input.capture.captureId,
    corpus: input.capture.corpus,
    measuredAt,
    productionFit: input.productionFit,
    cases: measured,
    memory: memoryOf({
      totalMemBytes: os.totalmem(),
      freeMemStartBytes,
      freeMemEndBytes: os.freemem(),
      harnessBaseBytes,
      harnessLoadedBytes,
      harnessPeakBytes,
      workersBeforeBytes,
      workersPeakBytes,
      workersAfterBytes
    }),
    estimated: estimatedOf({
      m0: m0MedianByCase(input.latency),
      components: measured.map((item) => ({ id: item.id, componentMs: medianOf(item.samples) }))
    })
  };
}

/**
 * The judge latency. The targets are read before the base is taken, so the planning
 * does not count in the memory of the model. Each timed unit builds the judge document
 * and scores it, as the judge pass does.
 */
export async function measureJudgeLatency(input: {
  capture: CaptureFile;
  records: ReadonlyMap<string, CapturedRecord>;
  identities: ReadonlyMap<string, MemoryVectorRecord>;
  judge: JudgeName;
  production: ModelParams;
  productionFit: string;
  latency: LatencyFile | undefined;
  workerInfo: WorkspaceInfo;
  loadRunner: () => Promise<JudgeRunner>;
  log: (line: string) => void;
}): Promise<ModelLatencyFile> {
  const planned: Array<PlannedWork<JudgeRunner>> = [];
  for (const captured of input.capture.cases) {
    const inputs = await judgeTargetsOf({
      captured,
      capture: input.capture,
      records: input.records,
      identities: input.identities
    });
    const judged = preAdmittedTargetsOf(inputs.targets, input.production);
    planned.push({
      id: captured.id,
      units: judged.length,
      work: async (runner) => {
        for (const target of judged) {
          const document = judgeDocumentOf({
            identity: target.identity,
            passages: target.passages,
            rerankScores: inputs.rerankScores,
            truncate: runner.truncate
          });
          await runner.scoreDocument(inputs.query, document);
        }
      }
    });
  }
  return measureModelLatency({
    kind: "judge",
    capture: input.capture,
    workerInfo: input.workerInfo,
    latency: input.latency,
    productionFit: input.productionFit,
    planned,
    loadRunner: input.loadRunner,
    log: input.log
  });
}

/** The choice latency: one forward per case with a distinct correction. */
export async function measureChoiceLatency(input: {
  capture: CaptureFile;
  latency: LatencyFile | undefined;
  workerInfo: WorkspaceInfo;
  loadRunner: () => Promise<ChoiceRunner>;
  log: (line: string) => void;
}): Promise<ModelLatencyFile> {
  const planned: Array<PlannedWork<ChoiceRunner>> = choiceCasesOf(input.capture).map((item) => ({
    id: item.caseId,
    units: 1,
    work: async (runner) => {
      await runner.choose(item.original, item.correction);
    }
  }));
  return measureModelLatency({
    kind: "choice",
    capture: input.capture,
    workerInfo: input.workerInfo,
    latency: input.latency,
    productionFit: null,
    planned,
    loadRunner: input.loadRunner,
    log: input.log
  });
}
