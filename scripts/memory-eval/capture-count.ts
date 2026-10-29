import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { openCaptureContext, disposeProviders, type CaptureOptions } from "./capture.js";
import { computeCaptureFingerprint } from "./capture-fingerprint.js";
import { E3_CAPTURE_CHANNELS, E3_INDEXED_LAYERS, E3_RERANK_ORDER } from "./capture-layers.js";
import { gateOf, productionRecallPairsOf } from "./capture-gate.js";
import { planCases } from "./capture-plan.js";
import { corpusContentDigest, corpusSourceTexts, withTemporaryWorkspace } from "./corpus.js";
import {
  ADOPTED_PAIRS_PER_SECOND,
  COUNT_LIMIT_HOURS,
  countPlanOf
} from "./matrix-plan.js";
import type { WorkspaceInfo } from "../../src/core/types.js";
import type { CaptureContext } from "./capture-types.js";

/**
 * The file of the count of a capture. It sits beside the capture directory, not inside it, so that the
 * capture itself still starts from an empty directory.
 */
export function countFileName(captureId: string): string {
  return `${captureId}.count.json`;
}

export type CountedCase = {
  caseId: string;
  /** Pairs of the matrix of the case: the pairs the capture scores. */
  pairs: number;
  /** Documents that the production recall of the case sends to the reranker (M0 at depth 0). */
  productionRecallPairs: number;
};

export type CountFile = {
  captureId: string;
  corpus: string;
  pairsPerSecond: number;
  limitHours: number;
  perCase: CountedCase[];
  totalPairs: number;
  hours: number;
  refused: boolean;
  /** Production recall of every case, which every capture runs in addition to its matrix. */
  totalProductionRecallPairs: number;
  hoursWithProductionRecall: number;
  /** Time to build the temporary index of the capture, in milliseconds. */
  indexBuildMs: number;
};

/**
 * Counts the pairs that the matrix of each case would score, and the production recall pairs of the
 * same case. The interpretation and the search run; the reranker scores nothing. The count is written
 * beside the capture directory as `<captureId>.count.json`.
 */
export async function countCapture(options: CaptureOptions): Promise<CountFile> {
  const fingerprint = await computeCaptureFingerprint(
    options.dataset,
    options.repositoryRoot,
    await corpusContentDigest(options.source),
    E3_INDEXED_LAYERS,
    E3_CAPTURE_CHANNELS,
    E3_RERANK_ORDER,
    options.kMax
  );
  const counted = await withTemporaryWorkspace(options.source, (info) =>
    countInWorkspace(options, info)
  );
  const limitHours = options.countLimitHours ?? COUNT_LIMIT_HOURS;
  const matrixPlan = countPlanOf(counted.perCase.map((item) => item.pairs), ADOPTED_PAIRS_PER_SECOND, limitHours);
  const gate = gateOf(counted.perCase, limitHours);
  const totalProductionRecallPairs = counted.perCase.reduce(
    (total, item) => total + item.productionRecallPairs,
    0
  );
  const file: CountFile = {
    captureId: fingerprint.captureId,
    corpus: options.dataset.corpus,
    pairsPerSecond: ADOPTED_PAIRS_PER_SECOND,
    limitHours,
    perCase: counted.perCase,
    totalPairs: matrixPlan.totalPairs,
    hours: matrixPlan.hours,
    refused: gate.refused,
    totalProductionRecallPairs,
    hoursWithProductionRecall: gate.hours,
    indexBuildMs: counted.indexBuildMs
  };
  const corpusDir = path.join(options.outputRoot, options.dataset.corpus);
  await fs.mkdir(corpusDir, { recursive: true });
  await fs.writeFile(
    path.join(corpusDir, countFileName(fingerprint.captureId)),
    `${JSON.stringify(file, null, 2)}\n`
  );
  return file;
}

async function countInWorkspace(
  options: CaptureOptions,
  info: WorkspaceInfo
): Promise<{ perCase: CountedCase[]; indexBuildMs: number }> {
  const providers = options.createProviders();
  try {
    const started = performance.now();
    const index = await openCaptureContext({
      info,
      providers,
      productionManifestPath: options.productionManifestPath,
      threadIds: options.source.threadIds,
      layers: E3_INDEXED_LAYERS
    });
    const indexBuildMs = performance.now() - started;
    const context: CaptureContext = {
      ...index,
      sourceTexts: await corpusSourceTexts(options.source),
      kMax: options.kMax
    };
    const plans = await planCases(context, options.dataset.cases);
    const perCase: CountedCase[] = [];
    for (const plan of plans) {
      perCase.push({
        caseId: plan.evalCase.id,
        pairs: plan.scopeRecordIds.length,
        productionRecallPairs: await productionRecallPairsOf(context, plan.effectiveQuery)
      });
    }
    return { perCase, indexBuildMs };
  } finally {
    await disposeProviders(providers);
  }
}

