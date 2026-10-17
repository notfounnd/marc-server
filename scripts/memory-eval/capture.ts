import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { WorkspaceInfo } from "../../src/core/types.js";
import type { MemoryQueryCandidateSet } from "../../src/core/memory/query-candidates.js";
import {
  buildMemoryQueryCandidates,
  interpretMemoryQuery
} from "../../src/core/memory/query-interpretation.js";
import {
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace
} from "../../src/core/memory/operations.js";
import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import { LanceDbMemoryVectorStore } from "../../src/core/memory/store.js";
import type {
  MemoryManifest,
  MemoryOperationOptions,
  MemoryVectorRecord,
  MemoryVectorRow
} from "../../src/core/memory/types.js";
import {
  corpusContentDigest,
  withTemporaryWorkspace,
  type CorpusSource
} from "./corpus.js";
import type { EvalCase, EvalDataset } from "./dataset.js";
import {
  computeCaptureFingerprint,
  type CaptureFingerprint
} from "./capture-fingerprint.js";
import {
  captureChannels,
  captureProductionRecall
} from "./capture-channels.js";
import {
  CAPTURE_FILE,
  SCHEMA_VERSION,
  prepareCaptureDirectory,
  readCapturedCase,
  readCheckpoint,
  writeCaptureFile,
  writeCapturedCase,
  writeCheckpoint
} from "./capture-storage.js";
import type {
  CaptureContext,
  CaptureProviders,
  CapturedCase,
  CapturedChannels
} from "./capture-types.js";
import {
  RecordingEmbeddingProvider,
  RecordingQueryInterpreter,
  RecordingRerankingProvider
} from "./recording-providers.js";

export {
  computeCaptureFingerprint,
  queryFingerprintCases
} from "./capture-fingerprint.js";
export { lexicalFieldsForQueryReplica } from "./capture-channels.js";
export type { CaptureProviders, CapturedCase } from "./capture-types.js";
export type { CaptureFingerprint } from "./capture-fingerprint.js";

export type CaptureOptions = {
  dataset: EvalDataset;
  source: CorpusSource;
  /** Directory that receives `<corpus>/<captureId>/`, e.g. `.marc/cache/memory-eval`. */
  outputRoot: string;
  /** Repository root, used to read package.json and src/core/memory. */
  repositoryRoot: string;
  /** Builds the providers used in one capture. Real runs pass the Local* providers. */
  createProviders: () => CaptureProviders;
  /** Production manifest whose record ids must match the temporary rebuild. Read-only. */
  productionManifestPath?: string;
  resume: boolean;
  log: (line: string) => void;
};

export type CaptureResult = {
  captureId: string;
  captureDir: string;
  cases: number;
  executedCases: number;
  skippedCases: number;
  durationMs: number;
};

type CaptureCounts = Pick<CaptureResult, "cases" | "executedCases" | "skippedCases">;

/**
 * Runs one capture over the dataset and writes capture.json under the capture
 * directory. Cases already listed in checkpoint.json are read back when
 * `resume` is set, and are not recomputed.
 */
export async function captureMemoryEval(
  options: CaptureOptions
): Promise<CaptureResult> {
  const started = performance.now();
  const fingerprint = await computeCaptureFingerprint(
    options.dataset,
    options.repositoryRoot,
    await corpusContentDigest(options.source)
  );
  const captureDir = path.join(
    options.outputRoot,
    options.dataset.corpus,
    fingerprint.captureId
  );
  await prepareCaptureDirectory(captureDir, options.resume);
  const counts = await withTemporaryWorkspace(options.source, (info) =>
    runCaptureInWorkspace(options, fingerprint, captureDir, info)
  );
  return {
    captureId: fingerprint.captureId,
    captureDir,
    ...counts,
    durationMs: performance.now() - started
  };
}

async function runCaptureInWorkspace(
  options: CaptureOptions,
  fingerprint: CaptureFingerprint,
  captureDir: string,
  info: WorkspaceInfo
): Promise<CaptureCounts> {
  const providers = options.createProviders();
  try {
    return await captureWithProviders(
      options,
      fingerprint,
      captureDir,
      info,
      providers
    );
  } finally {
    await disposeProviders(providers);
  }
}

async function captureWithProviders(
  options: CaptureOptions,
  fingerprint: CaptureFingerprint,
  captureDir: string,
  info: WorkspaceInfo,
  providers: CaptureProviders
): Promise<CaptureCounts> {
  const context = await openCaptureContext({
    info,
    providers,
    productionManifestPath: options.productionManifestPath,
    threadIds: options.source.threadIds
  });

  const digest = fingerprint.corpusDigest;
  const completed = await readCheckpoint(
    captureDir,
    fingerprint.captureId,
    digest
  );
  const captured: CapturedCase[] = [];
  let executedCases = 0;
  let skippedCases = 0;
  const cases = options.dataset.cases;
  for (const [index, evalCase] of cases.entries()) {
    const position = `[${index + 1}/${cases.length}]`;
    if (completed.includes(evalCase.id)) {
      captured.push(
        withoutLegacyLatency(await readCapturedCase(captureDir, evalCase.id))
      );
      skippedCases += 1;
      options.log(`${position} ${evalCase.id} resumed`);
      continue;
    }
    const started = performance.now();
    const result = await captureCase(context, evalCase);
    await writeCapturedCase(captureDir, result);
    completed.push(evalCase.id);
    await writeCheckpoint(captureDir, fingerprint.captureId, digest, completed);
    captured.push(result);
    executedCases += 1;
    options.log(
      `${position} ${evalCase.id} ${(performance.now() - started).toFixed(0)} ms`
    );
  }

  await writeCaptureFile(captureDir, {
    schemaVersion: SCHEMA_VERSION,
    captureId: fingerprint.captureId,
    corpus: options.dataset.corpus,
    fingerprint,
    generation: context.generation,
    corpusDigest: digest,
    providers: {
      embedding: providers.embedding.describe(),
      reranker: providers.reranker.describe(),
      interpreter: providers.interpreter.describe()
    },
    matrixRecordCount: context.matrixRecords.length,
    records: context.rows.map(recordWithoutVector),
    cases: captured
  });
  return { cases: cases.length, executedCases, skippedCases };
}

/**
 * Rebuilds the memory index of the temporary workspace with the given
 * providers, checks it against production and returns the context of the
 * channels. Shared by capture and by the latency command.
 */
export async function openCaptureContext(input: {
  info: WorkspaceInfo;
  providers: CaptureProviders;
  productionManifestPath?: string;
  threadIds: readonly string[];
}): Promise<CaptureContext> {
  const { info, providers } = input;
  const store = new LanceDbMemoryVectorStore();
  const operationOptions: MemoryOperationOptions = {
    provider: providers.embedding,
    reranker: providers.reranker,
    interpreter: providers.interpreter,
    store
  };
  await prepareMemoryInWorkspace(info, operationOptions);
  const attempt = await rebuildMemoryInWorkspace(info, operationOptions);
  if (!attempt.acquired)
    throw new Error("Another memory operation is already running.");
  const manifest = attempt.manifest;
  await assertProductionRecordIds(
    manifest,
    input.productionManifestPath,
    input.threadIds
  );
  const status = await readMemoryStatusInWorkspace(info, operationOptions);
  if (!status.searchReady)
    throw new Error(`Temporary memory index is not search-ready: ${status.message}`);

  const rows = await store.readRows(info, manifest.generation);
  const matrixRecords = rows
    .map(recordWithoutVector)
    .filter((record) => record.kind === "identity" || record.kind === "passage");
  return {
    info,
    providers,
    store,
    generation: manifest.generation,
    rows,
    matrixRecords,
    matrixDocuments: matrixRecords.map((record) =>
      semanticRerankingDocument(record)
    )
  };
}

/** Captures one case: interpretation trace, channels per text and production recall. Latency is measured apart. */
async function captureCase(
  context: CaptureContext,
  evalCase: EvalCase
): Promise<CapturedCase> {
  const embedding = new RecordingEmbeddingProvider(context.providers.embedding);
  const reranker = new RecordingRerankingProvider(context.providers.reranker);
  const interpreter = new RecordingQueryInterpreter(
    context.providers.interpreter
  );
  const candidates: MemoryQueryCandidateSet = buildMemoryQueryCandidates(
    evalCase.query,
    context.rows
  );
  const interpretation = await interpretMemoryQuery({
    mode: evalCase.queryMode,
    originalQuery: evalCase.query,
    provider: interpreter,
    ...candidates
  });
  const channels: Record<string, CapturedChannels> = {};
  for (const text of distinctTexts(
    evalCase.query,
    interpretation.effectiveQuery,
    interpretation.suggestedQuery
  )) {
    channels[text] = await captureChannels(context, embedding, reranker, text);
  }
  return {
    id: evalCase.id,
    queryMode: evalCase.queryMode,
    originalQuery: evalCase.query,
    interpretation,
    candidates,
    interpretationTrace: interpreter.trace,
    queryVectors: Object.fromEntries(embedding.queryVectors),
    channels,
    rerankScores: Object.fromEntries(reranker.scores),
    productionRecall: await captureProductionRecall(
      context,
      interpretation.effectiveQuery
    )
  };
}

/**
 * Fails when the record ids of the pinned threads in the temporary rebuild are
 * not exactly those of the production manifest. Read-only.
 */
async function assertProductionRecordIds(
  manifest: MemoryManifest,
  productionManifestPath: string | undefined,
  threadIds: readonly string[]
): Promise<void> {
  if (productionManifestPath === undefined) return;
  const production = JSON.parse(
    await fs.readFile(productionManifestPath, "utf8")
  ) as MemoryManifest;
  const pinned = new Set(threadIds);
  const expected = recordIdSet(production, pinned);
  const actual = recordIdSet(manifest, pinned);
  const missing = [...expected].filter((id) => !actual.has(id));
  const unexpected = [...actual].filter((id) => !expected.has(id));
  if (missing.length === 0 && unexpected.length === 0) return;
  throw new Error(
    `Temporary memory manifest diverges from production: ${missing.length} record ids missing (e.g. ${missing.slice(0, 3).join(", ")}); ${unexpected.length} unexpected (e.g. ${unexpected.slice(0, 3).join(", ")}).`
  );
}

function recordIdSet(manifest: MemoryManifest, threadIds: Set<string>): Set<string> {
  const records = manifest.records.filter((record) =>
    threadIds.has(record.threadId)
  );
  return new Set(records.flatMap((record) => record.recordIds));
}

export async function disposeProviders(providers: CaptureProviders): Promise<void> {
  await Promise.all([
    providers.embedding.dispose(),
    providers.reranker.dispose(),
    providers.interpreter.dispose()
  ]);
}

function distinctTexts(...texts: Array<string | undefined>): string[] {
  const present = texts.filter((text): text is string => text !== undefined);
  return [...new Set(present)];
}

/** Captures written before latency left capture.json may still carry latencyMs. It is dropped here. */
function withoutLegacyLatency(captured: CapturedCase): CapturedCase {
  const { latencyMs: _legacy, ...current } = captured as CapturedCase & {
    latencyMs?: unknown;
  };
  return current;
}

function recordWithoutVector(row: MemoryVectorRow): MemoryVectorRecord {
  const { vector: _vector, ...record } = row;
  return record;
}
