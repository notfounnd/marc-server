import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { isNonThreadGroup, type EvalDataset } from "./dataset.js";
import type { MemoryLayer } from "../../src/core/memory/sources/contract.js";
import { INDEXED_LAYERS } from "../../src/core/memory/sources/index.js";
import type { WorkspaceInfo } from "../../src/core/types.js";
import {
  prepareMemoryInWorkspace,
  readMemoryStatusInWorkspace,
  rebuildMemoryInWorkspace
} from "../../src/core/memory/operations.js";
import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import { LanceDbMemoryVectorStore } from "../../src/core/memory/store.js";
import {
  MEMORY_SCHEMA_VERSION,
  type MemoryManifest,
  type MemoryOperationOptions,
  type MemoryVectorRecord,
  type MemoryVectorRow
} from "../../src/core/memory/types.js";
import {
  corpusContentDigest,
  corpusSourceTexts,
  withTemporaryWorkspace,
  type CorpusSource
} from "./corpus.js";
import {
  computeCaptureFingerprint,
  type CaptureFingerprint
} from "./capture-fingerprint.js";
import {
  E3_CAPTURE_CHANNELS,
  E3_INDEXED_LAYERS,
  E3_RERANK_ORDER
} from "./capture-layers.js";
import { planCases, type CasePlan } from "./capture-plan.js";
import { scoreCase } from "./capture-score.js";
import {
  captureSyntheticQueries,
  E2_SYNTHETIC_REQUESTED,
  E2_SYNTHETIC_RULE
} from "./capture-synthetic.js";
import { writeVectors } from "./capture-vectors.js";
import { COUNT_LIMIT_HOURS, type ComplementRound } from "./matrix-plan.js";
import {
  gateOf,
  productionRecallPairsOf,
  type CaseGateCount
} from "./capture-gate.js";
import { threadReferenceEdges } from "./references.js";
import {
  SCHEMA_VERSION,
  prepareCaptureDirectory,
  readCapturedCase,
  CAPTURE_FILE,
  readCheckpoint,
  writeCaptureFile,
  writeCapturedCase,
  writeCheckpoint
} from "./capture-storage.js";
import type {
  CaptureContext,
  CaptureFile,
  CaptureProviders,
  CapturedCase,
  ProductionCheckMode,
  ProductionCheckRecord
} from "./capture-types.js";

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
  /** Production manifest checked against the temporary rebuild. Read-only. */
  productionManifestPath?: string;
  resume: boolean;
  log: (line: string) => void;
  /**
   * Legacy E2 step: the synthetic Inverse Cloze queries that the H2 calibration reads. E3 captures
   * leave it off; the E2 fixtures of the calibration tests turn it on.
   */
  syntheticQueries?: boolean;
  /** Hours above which the count refuses the capture. The command uses the 12 h limit; tests lower it. */
  countLimitHours?: number;
  /** K_max of the closed scope. Absent means the E3 default of 30; the E4 corpus passes 0. */
  kMax?: number;
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
    await corpusContentDigest(options.source),
    E3_INDEXED_LAYERS,
    E3_CAPTURE_CHANNELS,
    E3_RERANK_ORDER,
    options.kMax
  );
  const captureDir = path.join(
    options.outputRoot,
    options.dataset.corpus,
    fingerprint.captureId
  );
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
  const index = await openCaptureContext({
    info,
    providers,
    productionManifestPath: options.productionManifestPath,
    threadIds: options.source.threadIds,
    layers: E3_INDEXED_LAYERS
  });
  const context: CaptureContext = {
    ...index,
    sourceTexts: await corpusSourceTexts(options.source),
    kMax: options.kMax
  };
  const cases = options.dataset.cases;
  const planned = await planCases(context, cases);
  refuseAboveLimit(await gateCountsOf(context, planned), options.countLimitHours ?? COUNT_LIMIT_HOURS);
  // The capture directory is created only once the count is accepted, so a refused capture leaves nothing.
  await prepareCaptureDirectory(captureDir, options.resume);

  const digest = fingerprint.corpusDigest;
  const completed = await readCheckpoint(
    captureDir,
    fingerprint.captureId,
    digest
  );
  const captured: CapturedCase[] = [];
  let executedCases = 0;
  let skippedCases = 0;
  for (const [position, plan] of planned.entries()) {
    const label = `[${position + 1}/${cases.length}]`;
    const evalCase = plan.evalCase;
    if (completed.includes(evalCase.id)) {
      captured.push(
        withoutLegacyLatency(await readCapturedCase(captureDir, evalCase.id))
      );
      skippedCases += 1;
      options.log(`${label} ${evalCase.id} resumed`);
      continue;
    }
    const started = performance.now();
    const result = await scoreCase(context, plan);
    await writeCapturedCase(captureDir, result);
    completed.push(evalCase.id);
    await writeCheckpoint(captureDir, fingerprint.captureId, digest, completed);
    captured.push(result);
    executedCases += 1;
    options.log(
      `${label} ${evalCase.id} ${plan.scopeRecordIds.length} pairs ${(performance.now() - started).toFixed(0)} ms`
    );
  }

  const vectors = await writeVectors(captureDir, context.rows);
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
    productionCheck: context.productionCheck,
    records: context.rows.map(recordWithoutVector),
    cases: captured,
    identityVectors: identityVectorsOf(context),
    threadReferences: await threadReferenceEdges(
      options.source.threadsRoot,
      options.source.threadIds
    ),
    vectors,
    complementRounds: await complementRoundsOf(captureDir),
    ...(await legacySyntheticOf(options, context, captureDir))
  });
  return { cases: cases.length, executedCases, skippedCases };
}

/** The pairs of every case that the gate counts: its matrix and its production recall. */
async function gateCountsOf(context: CaptureContext, planned: readonly CasePlan[]): Promise<CaseGateCount[]> {
  const counts: CaseGateCount[] = [];
  for (const plan of planned) {
    counts.push({
      pairs: plan.scopeRecordIds.length,
      productionRecallPairs: await productionRecallPairsOf(context, plan.effectiveQuery)
    });
  }
  return counts;
}

/** The complement rounds already in the capture file. A resume keeps them, so the log stays append-only. */
async function complementRoundsOf(captureDir: string): Promise<ComplementRound[] | undefined> {
  const content = await fs.readFile(path.join(captureDir, CAPTURE_FILE), "utf8").catch(() => undefined);
  if (content === undefined) return undefined;
  return (JSON.parse(content) as CaptureFile).complementRounds;
}

/**
 * Refuses the capture before any pair is scored when its count of pairs needs more than the limit
 * of hours. The approvers are consulted before a capture of that size runs.
 */
function refuseAboveLimit(counts: readonly CaseGateCount[], limitHours: number): void {
  const count = gateOf(counts, limitHours);
  if (!count.refused) return;
  throw new Error(
    `The capture counts ${count.totalPairs} pairs with production recall, ${count.hours.toFixed(2)} h, above the ${limitHours} h limit. Nothing was scored.`
  );
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
  /** Layers of the temporary rebuild. Defaults to the production layers; E3 captures pass [0, 1, 2]. */
  layers?: readonly MemoryLayer[];
}): Promise<CaptureContext> {
  const { info, providers } = input;
  const store = new LanceDbMemoryVectorStore();
  const operationOptions: MemoryOperationOptions = {
    provider: providers.embedding,
    reranker: providers.reranker,
    interpreter: providers.interpreter,
    store,
    indexedLayers: input.layers ?? INDEXED_LAYERS
  };
  await prepareMemoryInWorkspace(info, operationOptions);
  const attempt = await rebuildMemoryInWorkspace(info, operationOptions);
  if (!attempt.acquired)
    throw new Error("Another memory operation is already running.");
  const manifest = attempt.manifest;
  const rows = await store.readRows(info, manifest.generation);
  // Only the layers that production indexes are compared with the production manifest.
  const comparableRecordIds = new Set(
    rows.filter((row) => INDEXED_LAYERS.includes(row.layer)).map((row) => row.recordId)
  );
  const productionCheck = await assertProductionCheck(
    manifest,
    input.productionManifestPath,
    input.threadIds,
    comparableRecordIds
  );
  const status = await readMemoryStatusInWorkspace(info, operationOptions);
  if (!status.searchReady)
    throw new Error(`Temporary memory index is not search-ready: ${status.message}`);

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
    ),
    productionCheck
  };
}

/** Production check modes, in order. The first predicate that matches the production schema version wins. */
const PRODUCTION_CHECK_MODES: ReadonlyArray<{
  mode: ProductionCheckMode;
  matches: (productionSchemaVersion: number) => boolean;
}> = [
  {
    mode: "record-ids",
    matches: (version) => version === MEMORY_SCHEMA_VERSION
  },
  { mode: "thread-ids", matches: () => true }
];

/**
 * Mismatches of a temporary manifest against production. `comparableRecordIds` holds the records of
 * the temporary rebuild whose layer the production index holds, so that the layers that production
 * does not index (layers 1 and 2 in the default setting) are not compared.
 */
type ProductionComparison = (
  manifest: MemoryManifest,
  production: MemoryManifest,
  pinned: ReadonlySet<string>,
  comparableRecordIds: ReadonlySet<string>
) => string[];

/** One comparison per mode. Each returns mismatch descriptions; an empty list means a match. */
const PRODUCTION_COMPARISONS: Record<ProductionCheckMode, ProductionComparison> = {
  "record-ids": compareRecordIds,
  "thread-ids": compareThreadIds
};

/**
 * Compares the temporary rebuild with the production manifest, read-only. The
 * mode follows the production schema version: record ids when it matches the
 * code, pinned thread ids otherwise. Returns the check recorded in capture.json.
 */
async function assertProductionCheck(
  manifest: MemoryManifest,
  productionManifestPath: string | undefined,
  threadIds: readonly string[],
  comparableRecordIds: ReadonlySet<string>
): Promise<ProductionCheckRecord | undefined> {
  if (productionManifestPath === undefined) return undefined;
  const production = JSON.parse(
    await fs.readFile(productionManifestPath, "utf8")
  ) as MemoryManifest;
  const mode = productionCheckMode(production.schemaVersion);
  const problems = PRODUCTION_COMPARISONS[mode](
    manifest,
    production,
    new Set(threadIds),
    comparableRecordIds
  );
  if (problems.length > 0)
    throw new Error(
      `Temporary memory manifest diverges from production (${mode}): ${problems.join("; ")}.`
    );
  return {
    mode,
    productionSchemaVersion: production.schemaVersion,
    codeSchemaVersion: MEMORY_SCHEMA_VERSION
  };
}

function productionCheckMode(productionSchemaVersion: number): ProductionCheckMode {
  const entry = PRODUCTION_CHECK_MODES.find((candidate) =>
    candidate.matches(productionSchemaVersion)
  );
  return entry?.mode ?? "thread-ids";
}

export function compareRecordIds(
  manifest: MemoryManifest,
  production: MemoryManifest,
  pinned: ReadonlySet<string>,
  comparableRecordIds: ReadonlySet<string>
): string[] {
  const expected = recordIdSet(production, pinned);
  const actual = new Set(
    [...recordIdSet(manifest, pinned)].filter((recordId) => comparableRecordIds.has(recordId))
  );
  return differences([
    [
      "record ids missing from the temporary manifest",
      [...expected].filter((id) => !actual.has(id))
    ],
    [
      "unexpected record ids in the temporary manifest",
      [...actual].filter((id) => !expected.has(id))
    ]
  ]);
}

export function compareThreadIds(
  manifest: MemoryManifest,
  production: MemoryManifest,
  pinned: ReadonlySet<string>
): string[] {
  const productionThreads = threadIdSet(production);
  const temporaryThreads = new Set(
    [...threadIdSet(manifest)].filter((groupId) => !isNonThreadGroup(groupId))
  );
  // @rules and @document groups are accepted in the temporary manifest: production indexes layer 0 only.
  return differences([
    [
      "pinned threads missing from production",
      [...pinned].filter((id) => !productionThreads.has(id))
    ],
    [
      "pinned threads missing from the temporary manifest",
      [...pinned].filter((id) => !temporaryThreads.has(id))
    ],
    [
      "threads unexpected in the temporary manifest",
      [...temporaryThreads].filter((id) => !pinned.has(id))
    ]
  ]);
}

function differences(categories: Array<[string, string[]]>): string[] {
  return categories
    .filter(([, ids]) => ids.length > 0)
    .map(([label, ids]) => `${ids.length} ${label} (e.g. ${ids.slice(0, 3).join(", ")})`);
}

function recordIdSet(manifest: MemoryManifest, threadIds: ReadonlySet<string>): Set<string> {
  const records = manifest.records.filter((record) =>
    threadIds.has(record.threadId)
  );
  return new Set(records.flatMap((record) => record.recordIds));
}

function threadIdSet(manifest: MemoryManifest): Set<string> {
  return new Set(manifest.records.map((record) => record.threadId));
}

export async function disposeProviders(providers: CaptureProviders): Promise<void> {
  await Promise.all([
    providers.embedding.dispose(),
    providers.reranker.dispose(),
    providers.interpreter.dispose()
  ]);
}

/** The E2 synthetic fields, only when the legacy step is on. E3 captures carry none of them. */
async function legacySyntheticOf(
  options: CaptureOptions,
  context: CaptureContext,
  captureDir: string
): Promise<Partial<Pick<CaptureFile, "syntheticRule" | "syntheticRequested" | "syntheticQueries">>> {
  if (options.syntheticQueries !== true) return {};
  return {
    syntheticRule: E2_SYNTHETIC_RULE,
    syntheticRequested: E2_SYNTHETIC_REQUESTED,
    syntheticQueries: await captureSyntheticQueries(context, captureDir, options.resume)
  };
}

/** Identity vector of each pinned thread, for the identity-identity cosine of N1. */
function identityVectorsOf(context: CaptureContext): Record<string, number[]> {
  return Object.fromEntries(
    context.rows
      .filter((row) => row.kind === "identity")
      .map((row) => [row.threadId, [...row.vector]])
  );
}

/** Captures written before latency left capture.json may still carry latencyMs. It is dropped here. */
function withoutLegacyLatency(captured: CapturedCase): CapturedCase {
  const current: CapturedCase & { latencyMs?: unknown } = { ...captured };
  delete current.latencyMs;
  return current;
}

function recordWithoutVector(row: MemoryVectorRow): MemoryVectorRecord {
  const record: MemoryVectorRecord & { vector?: unknown } = { ...row };
  delete record.vector;
  return record;
}
