import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  prepareMemoryInWorkspace,
  rebuildMemoryInWorkspace
} from "../../src/core/memory/operations.js";
import { LanceDbMemoryVectorStore } from "../../src/core/memory/store.js";
import type {
  MemoryLayer,
  MemoryOperationOptions
} from "../../src/core/memory/types.js";
import {
  corpusContentDigest,
  withTemporaryWorkspace,
  type CorpusSource
} from "./corpus.js";
import type { EvalDataset } from "./dataset.js";
import {
  computeCaptureFingerprint,
  type CaptureFingerprint
} from "./capture-fingerprint.js";
import type { CaptureProviders } from "./capture-types.js";
import { disposeProviders } from "./capture.js";

export const LAYERS_SCHEMA_VERSION = 1;
export const DEFAULT_RUN_LAYERS: readonly MemoryLayer[] = [0];
export const ALL_RUN_LAYERS: readonly MemoryLayer[] = [0, 1, 2];

// Runs are sequential, so the two rebuilds never compete for the machine.
const LAYER_RUNS: ReadonlyArray<readonly MemoryLayer[]> = [
  DEFAULT_RUN_LAYERS,
  ALL_RUN_LAYERS
];

export type LayerRun = {
  indexedLayers: MemoryLayer[];
  rebuildMs: number;
  records: number;
  byLayer: Record<string, number>;
  bySourceType: Record<string, number>;
};

export type LayersFile = {
  schemaVersion: typeof LAYERS_SCHEMA_VERSION;
  captureId: string;
  corpus: string;
  corpusDigest: string;
  fingerprint: CaptureFingerprint;
  runs: LayerRun[];
};

export type LayersOptions = {
  dataset: EvalDataset;
  source: CorpusSource;
  /** Directory that receives `<corpus>/layers-<captureId>.json`. */
  outputRoot: string;
  repositoryRoot: string;
  createProviders: () => CaptureProviders;
  log: (line: string) => void;
};

export type LayersResult = {
  captureId: string;
  layersPath: string;
  runs: LayerRun[];
};

/** File name of the layer measurement. Its id is the fingerprint with every layer indexed. */
export function layersFileName(captureId: string): string {
  return `layers-${captureId}.json`;
}

/**
 * Measures the rebuild with the default layers and with every layer, each in a
 * fresh temporary workspace. It captures no cases and uses no checkpoint.
 */
export async function measureAllLayers(
  options: LayersOptions
): Promise<LayersResult> {
  const corpusDigest = await corpusContentDigest(options.source);
  const fingerprint = await computeCaptureFingerprint(
    options.dataset,
    options.repositoryRoot,
    corpusDigest,
    ALL_RUN_LAYERS
  );
  const runs: LayerRun[] = [];
  for (const layers of LAYER_RUNS) {
    options.log(`layers [${layers.join(", ")}]: rebuilding`);
    runs.push(await measureRebuild(options, layers));
  }
  const file: LayersFile = {
    schemaVersion: LAYERS_SCHEMA_VERSION,
    captureId: fingerprint.captureId,
    corpus: options.dataset.corpus,
    corpusDigest,
    fingerprint,
    runs
  };
  const directory = path.join(options.outputRoot, options.dataset.corpus);
  await fs.mkdir(directory, { recursive: true });
  const layersPath = path.join(directory, layersFileName(fingerprint.captureId));
  await fs.writeFile(layersPath, JSON.stringify(file, null, 2));
  return { captureId: fingerprint.captureId, layersPath, runs };
}

async function measureRebuild(
  options: LayersOptions,
  indexedLayers: readonly MemoryLayer[]
): Promise<LayerRun> {
  return withTemporaryWorkspace(options.source, async (info) => {
    const providers = options.createProviders();
    try {
      const store = new LanceDbMemoryVectorStore();
      const operationOptions: MemoryOperationOptions = {
        provider: providers.embedding,
        reranker: providers.reranker,
        interpreter: providers.interpreter,
        store,
        indexedLayers
      };
      await prepareMemoryInWorkspace(info, operationOptions);
      const started = performance.now();
      const attempt = await rebuildMemoryInWorkspace(info, operationOptions);
      const rebuildMs = performance.now() - started;
      if (!attempt.acquired)
        throw new Error("Another memory operation is already running.");
      const rows = await store.readRows(info, attempt.manifest.generation);
      return {
        indexedLayers: [...indexedLayers],
        rebuildMs,
        ...countRowsByLayer(rows)
      };
    } finally {
      await disposeProviders(providers);
    }
  });
}

/** Record counts overall, per layer, and per source type. Pure. */
export function countRowsByLayer(
  rows: ReadonlyArray<{ layer: MemoryLayer; sourceType: string }>
): Pick<LayerRun, "records" | "byLayer" | "bySourceType"> {
  return {
    records: rows.length,
    byLayer: countBy(rows, (row) => String(row.layer)),
    bySourceType: countBy(rows, (row) => row.sourceType)
  };
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
