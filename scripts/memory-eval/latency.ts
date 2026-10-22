import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkspaceInfo } from "../../src/core/types.js";
import { writeFileAtomically } from "../../src/core/write-coordination.js";
import { measureLatency } from "./capture-channels.js";
import {
  E2_CAPTURE_CHANNELS,
  computeCaptureFingerprint,
  type CaptureFingerprint
} from "./capture-fingerprint.js";
import { CAPTURE_FILE } from "./capture-storage.js";
import { disposeProviders, openCaptureContext } from "./capture.js";
import type { CaptureFile, CaptureProviders } from "./capture-types.js";
import {
  corpusContentDigest,
  withTemporaryWorkspace,
  type CorpusSource
} from "./corpus.js";
import type { EvalDataset } from "./dataset.js";

export const LATENCY_FILE = "latency.json";
export const LATENCY_SCHEMA_VERSION = 1;

export type LatencyCase = {
  id: string;
  /** One warm-up recall, in milliseconds. */
  warmup: number;
  /** Three timed recalls, in milliseconds. */
  samples: number[];
  /** os.freemem() in bytes, right after the case was measured. */
  freeMemAfterBytes: number;
};

/** Content of latency.json: latency lives here, apart from the capture. */
export type LatencyFile = {
  schemaVersion: typeof LATENCY_SCHEMA_VERSION;
  captureId: string;
  corpusDigest: string;
  measuredAt: string;
  totalMemBytes: number;
  /** os.freemem() in bytes, when the measurement started. */
  freeMemStartBytes: number;
  cases: LatencyCase[];
};

export type LatencyOptions = {
  dataset: EvalDataset;
  source: CorpusSource;
  /** Directory that holds `<corpus>/<captureId>/`, e.g. `.marc/cache/memory-eval`. */
  outputRoot: string;
  /** Repository root, used to read package.json and src/core/memory. */
  repositoryRoot: string;
  createProviders: () => CaptureProviders;
  /** Production manifest whose record ids must match the temporary rebuild. Read-only. */
  productionManifestPath?: string;
  log: (line: string) => void;
};

export type LatencyResult = {
  captureId: string;
  latencyPath: string;
  cases: number;
};

type StartMarks = { measuredAt: string; freeMemStartBytes: number };

/**
 * Measures latency for every case of a complete capture, in a temporary
 * workspace rebuilt the same way as the capture. Writes latency.json next to
 * capture.json. Rerunning overwrites the file; there is no resume.
 */
export async function measureCaptureLatency(
  options: LatencyOptions
): Promise<LatencyResult> {
  const marks: StartMarks = {
    measuredAt: new Date().toISOString(),
    freeMemStartBytes: os.freemem()
  };
  const fingerprint = await computeCaptureFingerprint(
    options.dataset,
    options.repositoryRoot,
    await corpusContentDigest(options.source),
    undefined,
    E2_CAPTURE_CHANNELS
  );
  const captureDir = path.join(
    options.outputRoot,
    options.dataset.corpus,
    fingerprint.captureId
  );
  await readCompleteCapture(
    captureDir,
    fingerprint.captureId,
    options.dataset.cases.length
  );
  const latency = await withTemporaryWorkspace(options.source, (info) =>
    measureInWorkspace(options, fingerprint, info, marks)
  );
  const latencyPath = path.join(captureDir, LATENCY_FILE);
  await writeFileAtomically(
    latencyPath,
    `${JSON.stringify(latency, null, 2)}\n`
  );
  return {
    captureId: fingerprint.captureId,
    latencyPath,
    cases: latency.cases.length
  };
}

/** Reads latency.json and refuses a file that belongs to another captureId. */
export async function readLatencyFile(
  captureDir: string,
  captureId: string
): Promise<LatencyFile> {
  const content = await fs
    .readFile(path.join(captureDir, LATENCY_FILE), "utf8")
    .catch(() => undefined);
  if (content === undefined)
    throw new Error(
      `No ${LATENCY_FILE} in ${captureDir}. Run memory:eval latency for captureId ${captureId} first.`
    );
  const latency = JSON.parse(content) as LatencyFile;
  if (latency.captureId !== captureId)
    throw new Error(
      `${LATENCY_FILE} in ${captureDir} belongs to captureId ${latency.captureId}, not ${captureId}. Run memory:eval latency again.`
    );
  return latency;
}

async function readCompleteCapture(
  captureDir: string,
  captureId: string,
  caseCount: number
): Promise<CaptureFile> {
  const content = await fs
    .readFile(path.join(captureDir, CAPTURE_FILE), "utf8")
    .catch(() => undefined);
  if (content === undefined)
    throw new Error(
      `No complete capture for captureId ${captureId}: ${CAPTURE_FILE} is missing in ${captureDir}. Run memory:eval capture first.`
    );
  const capture = JSON.parse(content) as CaptureFile;
  if (capture.captureId !== captureId)
    throw new Error(
      `${CAPTURE_FILE} in ${captureDir} belongs to captureId ${capture.captureId}, not ${captureId}.`
    );
  if (capture.cases.length !== caseCount)
    throw new Error(
      `Capture ${captureId} is incomplete: ${capture.cases.length} of ${caseCount} cases. Run memory:eval capture first.`
    );
  return capture;
}

async function measureInWorkspace(
  options: LatencyOptions,
  fingerprint: CaptureFingerprint,
  info: WorkspaceInfo,
  marks: StartMarks
): Promise<LatencyFile> {
  const providers = options.createProviders();
  try {
    const context = await openCaptureContext({
      info,
      providers,
      productionManifestPath: options.productionManifestPath,
      threadIds: options.source.threadIds
    });
    const cases: LatencyCase[] = [];
    for (const [index, evalCase] of options.dataset.cases.entries()) {
      const measured = await measureLatency(context, evalCase);
      cases.push({
        id: evalCase.id,
        warmup: measured.warmup,
        samples: measured.samples,
        freeMemAfterBytes: os.freemem()
      });
      options.log(
        `[${index + 1}/${options.dataset.cases.length}] ${evalCase.id} warmup ${measured.warmup.toFixed(0)} ms`
      );
    }
    return {
      schemaVersion: LATENCY_SCHEMA_VERSION,
      captureId: fingerprint.captureId,
      corpusDigest: fingerprint.corpusDigest,
      measuredAt: marks.measuredAt,
      totalMemBytes: os.totalmem(),
      freeMemStartBytes: marks.freeMemStartBytes,
      cases
    };
  } finally {
    await disposeProviders(providers);
  }
}
