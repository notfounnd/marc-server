import type {
  MemoryLexicalSearchHit,
  MemorySearchChannels,
  MemorySearchHit
} from "../../src/core/memory/types.js";
import type {
  CaptureFile,
  CapturedCase,
  CapturedChannels,
  CapturedIncomplete,
  CapturedProductionRecall,
  CapturedRecord
} from "./capture-types.js";
import { asSearchRecord } from "./capture-types.js";
import { CachedEmbeddingProvider, CachedRerankingProvider } from "./cached-providers.js";
import type { EvalDataset, RelevanceGrade } from "./dataset.js";
import type { FitResult } from "./fit-model.js";
import type { CalibrationSet } from "./calibration.js";
import { JUDGE_NAMES, type JudgeName } from "./judge-stage.js";
import type { JudgeTable } from "./fit.js";

import { caseFolds } from "./folds.js";
import { MissingRerankScore } from "../../src/core/memory/funnel-admission.js";
import type { CaseIncomplete } from "./metrics.js";
import {
  MissingFunnelInputs,
  MissingFunnelParams,
  isRankingVariantId,
  judgedDepthOfVariant,
  rankingVariants,
  runFunnelRanking,
  type FunnelParams,
  type FunnelVariantInput,
  type VariantInput,
  type VariantResult
} from "./variants.js";
import { FUNNEL_VARIANT_NAMES, type FunnelVariantName } from "./funnel-variants.js";
import type { MemorySearchDepth } from "../../src/core/memory/types.js";
import type { CatalogRow } from "../../src/core/memory/funnel-groups.js";
import { presentLayersOf } from "./required-cells.js";
import { E3_CAPTURE_CHANNELS } from "./capture-layers.js";

/**
 * The judge tables split by case: each judgeKeyOf key becomes (caseId, threadId).
 * Once a judge table is given, every capture case has an entry, possibly with no
 * thread, so a case without candidates is judged on nothing instead of failing.
 */
export function judgesByCase(
  tables: Partial<Record<JudgeName, JudgeTable>> | undefined,
  caseIds: readonly string[]
): Map<string, Partial<Record<JudgeName, Map<string, number>>>> {
  return new Map(
    caseIds.map((caseId) => [caseId, judgesOfOneCase(tables, caseId)] as const)
  );
}

function judgesOfOneCase(
  tables: Partial<Record<JudgeName, JudgeTable>> | undefined,
  caseId: string
): Partial<Record<JudgeName, Map<string, number>>> {
  return Object.fromEntries(
    JUDGE_NAMES.flatMap((name) => {
      const table = tables?.[name];
      if (table === undefined) return [];
      return [[name, scoresOfCase(table, caseId)] as const];
    })
  );
}

function scoresOfCase(table: JudgeTable, caseId: string): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [key, score] of table) {
    const [owner, threadId] = key.split("\0");
    if (owner === caseId) scores.set(threadId, score);
  }
  return scores;
}

/** The replay never loads a model: only the providers built from a capture. */
export type ReplayProviders = {
  embedding: CachedEmbeddingProvider;
  reranker: CachedRerankingProvider;
};

/**
 * `passed` is decided by the admitted threadId sequence only. `maxScoreDelta` is
 * reported per case and never gates: scores depend on the batch padded length of
 * the reranker call (see the CA1 findings), so a delta is evidence, not a failure.
 */
export type CaseEquivalence = {
  passed: boolean;
  productionThreadIds: string[];
  replayThreadIds: string[];
  maxScoreDelta: number;
};

/** Median, nearest-rank p95 and max of the per-case score deltas of one corpus. */
export type DeltaSummary = {
  cases: number;
  median: number | null;
  p95: number | null;
  max: number | null;
};

export type VariantOutput = {
  variant: string;
  results: VariantResult[];
  /** Deepest layer whose judgments grade this variant on this case (see judgedDepthOf). */
  judgedDepth: MemorySearchDepth;
  /** Set when the variant could not finish on this case. Its results are then empty. */
  incomplete?: CaseIncomplete;
};

type VariantRun = {
  results: VariantResult[];
  judgedDepth: MemorySearchDepth;
  incomplete?: CaseIncomplete;
};

export type CaseReplay = {
  caseId: string;
  effectiveQuery: string;
  variants: VariantOutput[];
  equivalence: CaseEquivalence;
};

export type ReplayResult = {
  captureId: string;
  corpus: string;
  variantIds: string[];
  equivalence: "passed" | "failed";
  failedCaseIds: string[];
  scoreDelta: DeltaSummary;
  cases: CaseReplay[];
  /** Layers that the capture holds for each group. Absent in replays written before the required cells. */
  presentLayers?: Record<string, number[]>;
};

export type ReplayInput = {
  capture: CaptureFile;
  dataset: EvalDataset;
  variantIds: string[];
  /** Required only by the H1 variants: the fit of this same capture. */
  fit?: FitResult;
  /** Required only by the H2 variants: the calibrations of this same capture. */
  calibrations?: CalibrationSet;
  /**
   * H2 on marc only: the calibrations of each external fold, indexed by fold. A case
   * takes the set of its own fold. Without them, every case takes `calibrations`.
   */
  foldCalibrations?: readonly CalibrationSet[];
  /** Judge scores of this capture, by judge (H7). Read as data: no model is loaded. */
  judgeTables?: Partial<Record<JudgeName, JudgeTable>>;
  /** E3 vectors of every record of the capture, read from its vector file. Only the funnel reads them. */
  vectors?: ReadonlyMap<string, number[]>;
  /** Budget, K, selection mode and band cuts of the funnel runs, given by the command. */
  funnelParams?: FunnelParams;
};

/**
 * The calibrations of one case: the set of its own external fold when the replay has
 * the per-fold sets, otherwise the set that every case takes.
 */
export function calibrationsOfCase(
  input: Pick<ReplayInput, "calibrations" | "foldCalibrations">,
  fold: number | undefined
): CalibrationSet | undefined {
  if (input.foldCalibrations === undefined || fold === undefined) return input.calibrations;
  const calibrations = input.foldCalibrations[fold];
  if (calibrations === undefined) throw new Error(`No calibrations for fold ${fold}.`);
  return calibrations;
}

/** Cached providers that serve exactly the vectors and scores recorded for one case. */
export function cachedReplayProviders(
  captured: CapturedCase,
  capture: CaptureFile
): ReplayProviders {
  return {
    embedding: new CachedEmbeddingProvider(
      capture.providers.embedding,
      new Map(Object.entries(captured.queryVectors))
    ),
    reranker: new CachedRerankingProvider(
      capture.providers.reranker,
      new Map(Object.entries(captured.rerankScores))
    )
  };
}

/** Replays every captured case with the requested variants, judged by the dataset's current judgments. */
/**
 * An E3 capture written before the catalog cannot replay: its funnel would select passages that the
 * capture does not hold. It fails with the reason; there is no silent fallback to the channels.
 */
export function assertCatalogOf(capture: CaptureFile): void {
  if (capture.vectors === undefined) return;
  if (capture.fingerprint.captureChannels === E3_CAPTURE_CHANNELS) return;
  throw new Error(
    `The capture ${capture.captureId} is E3 without the passage catalog (channels ${capture.fingerprint.captureChannels ?? "none"}): capture again with ${E3_CAPTURE_CHANNELS}.`
  );
}

export async function replayCapture(input: ReplayInput): Promise<ReplayResult> {
  assertCatalogOf(input.capture);
  assertKnownVariants(input.variantIds);
  const records = recordsById(input.capture.records);
  const folds = caseFolds(input.dataset.cases);
  const judgesOfCase = judgesByCase(
    input.judgeTables,
    input.capture.cases.map((item) => item.id)
  );
  const cases: CaseReplay[] = [];
  for (const captured of input.capture.cases) {
    cases.push(
      await replayCase({
        captured,
        judgments: judgmentsOf(input.dataset, captured.id),
        records,
        variantIds: input.variantIds,
        providers: cachedReplayProviders(captured, input.capture),
        fold: folds.get(captured.id),
        fit: input.fit,
        calibrations: calibrationsOfCase(input, folds.get(captured.id)),
        judge: judgesOfCase.get(captured.id),
        vectors: input.vectors,
        funnelParams: input.funnelParams
      })
    );
  }
  const summary = summarizeEquivalence(cases);
  return {
    captureId: input.capture.captureId,
    corpus: input.capture.corpus,
    variantIds: input.variantIds,
    equivalence: summary.equivalence,
    failedCaseIds: summary.failedCaseIds,
    scoreDelta: summary.scoreDelta,
    cases,
    presentLayers: presentLayersOf(input.capture.records)
  };
}

/** What one captured case gives to a ranking variant. */
export type VariantInputSource = {
  captured: CapturedCase;
  judgments: Record<string, RelevanceGrade>;
  records: ReadonlyMap<string, CapturedRecord>;
  providers: ReplayProviders;
  fold?: number;
  fit?: FitResult;
  calibrations?: CalibrationSet;
  judge?: Partial<Record<JudgeName, ReadonlyMap<string, number>>>;
  vectors?: ReadonlyMap<string, number[]>;
  funnelParams?: FunnelParams;
};

export type CaseReplayInput = VariantInputSource & { variantIds: string[] };

/**
 * The input of every ranking variant for one captured case. The judgments are
 * passed as data for the variants that read them; the H1 variants read only the
 * channels, the fit and the fold.
 */
export function variantInputOf(input: VariantInputSource): VariantInput {
  const effectiveQuery = input.captured.interpretation.effectiveQuery;
  return {
    query: effectiveQuery,
    channels: channelsOf(input.captured, effectiveQuery, input.records),
    reranker: input.providers.reranker,
    judgments: input.judgments,
    production: input.captured.productionRecall,
    fold: input.fold,
    fit: input.fit,
    calibrations: input.calibrations,
    judge: input.judge,
    funnel: funnelInputOf(input),
    funnelParams: input.funnelParams
  };
}

export async function replayCase(input: CaseReplayInput): Promise<CaseReplay> {
  const { captured, variantIds, providers } = input;
  assertKnownVariants(variantIds);
  const effectiveQuery = captured.interpretation.effectiveQuery;
  // The captured query vector must exist. The replay never embeds a query.
  await providers.embedding.embedQuery(effectiveQuery);
  const variantInput = variantInputOf(input);
  const runs = await runVariants(
    [...new Set([...variantIds, "M0"])],
    variantInput
  );
  return {
    caseId: captured.id,
    effectiveQuery,
    variants: variantIds.map((variant) =>
      outputOf(variant, runs.get(variant), captured.incomplete)
    ),
    equivalence: equivalenceOf(
      captured.productionRecall,
      runs.get("M0")?.results ?? []
    )
  };
}

/**
 * A case that the capture marks incomplete (its evidence is not indexed as a whole) cannot approve
 * any variant: each requested variant reports the reason and has no results.
 */
function outputOf(
  variant: string,
  run: VariantRun | undefined,
  caseIncomplete: CapturedIncomplete | undefined
): VariantOutput {
  if (caseIncomplete !== undefined) {
    return { variant, results: [], judgedDepth: 0, incomplete: caseIncomplete };
  }
  return {
    variant,
    results: run?.results ?? [],
    judgedDepth: run?.judgedDepth ?? 0,
    incomplete: run?.incomplete
  };
}

async function runVariants(
  ids: string[],
  input: VariantInput
): Promise<Map<string, VariantRun>> {
  const runs = new Map<string, VariantRun>();
  for (const id of ids) runs.set(id, await runOne(id, input));
  return runs;
}

/**
 * One ranking variant on one case. A funnel variant runs once and reports the judged depth of that
 * run. A missing score or missing inputs makes the variant incomplete, never zero: its results are
 * empty. Any other error is a real failure and is not hidden.
 */
async function runOne(id: string, input: VariantInput): Promise<VariantRun> {
  try {
    return await rankOf(id, input);
  } catch (error) {
    return incompleteOfError(error);
  }
}

async function rankOf(id: string, input: VariantInput): Promise<VariantRun> {
  if (isFunnelName(id)) return runFunnelRanking(id, input);
  const variant = rankingVariants[id];
  if (variant === undefined) throw new Error(`Unknown ranking variant: ${id}`);
  return { results: await variant(input), judgedDepth: judgedDepthOfVariant(id) };
}

function isFunnelName(id: string): id is FunnelVariantName {
  return (FUNNEL_VARIANT_NAMES as readonly string[]).includes(id);
}

function incompleteOfError(error: unknown): VariantRun {
  if (error instanceof MissingRerankScore) {
    return incompleteRun({ reason: "missing-score", recordId: error.recordId });
  }
  if (error instanceof MissingFunnelInputs) {
    return incompleteRun({ reason: "missing-funnel-inputs" });
  }
  if (error instanceof MissingFunnelParams) {
    return incompleteRun({ reason: "missing-funnel-params" });
  }
  throw error;
}

function incompleteRun(incomplete: CaseIncomplete): VariantRun {
  return { results: [], judgedDepth: 0, incomplete };
}

function assertKnownVariants(ids: readonly string[]): void {
  for (const id of ids) {
    if (isRankingVariantId(id)) continue;
    throw new Error(`Unknown ranking variant: ${id}`);
  }
}

/**
 * Equivalence with production, on the sequence only: the admitted threadId
 * sequence of M0, cut to the production limit, must equal the production recall
 * order. The largest score delta is recorded and never gates the case.
 */
export function equivalenceOf(
  production: CapturedProductionRecall,
  m0: VariantResult[]
): CaseEquivalence {
  const replayAdmitted = m0
    .filter((item) => item.admitted)
    .slice(0, production.limit);
  const productionThreadIds = production.results.map((hit) => hit.threadId);
  const replayThreadIds = replayAdmitted.map((item) => item.threadId);
  const maxScoreDelta = maxDifference(
    production.results.map((hit) => hit.score),
    replayAdmitted.map((item) => item.score)
  );
  const sameSequence =
    productionThreadIds.length === replayThreadIds.length &&
    productionThreadIds.every((id, index) => id === replayThreadIds[index]);
  return {
    passed: sameSequence,
    productionThreadIds,
    replayThreadIds,
    maxScoreDelta
  };
}

function maxDifference(left: number[], right: number[]): number {
  const pairs = Math.min(left.length, right.length);
  const differences = Array.from({ length: pairs }, (_, index) =>
    Math.abs((left[index] ?? 0) - (right[index] ?? 0))
  );
  return Math.max(0, ...differences);
}

/** Median, nearest-rank p95 and max of the case score deltas of one corpus. */
export function deltaSummary(values: readonly number[]): DeltaSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  if (count === 0) return { cases: 0, median: null, p95: null, max: null };
  const middle = Math.floor(count / 2);
  const median =
    count % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  const p95 = sorted[Math.min(count - 1, Math.ceil(0.95 * count) - 1)] ?? 0;
  return { cases: count, median, p95, max: sorted[count - 1] ?? 0 };
}

/** Corpus verdict (CA1b): the admitted sequence of every case; score deltas are reported only. */
export function summarizeEquivalence(cases: readonly CaseReplay[]): {
  equivalence: "passed" | "failed";
  failedCaseIds: string[];
  scoreDelta: DeltaSummary;
} {
  const failedCaseIds = cases
    .filter((item) => !item.equivalence.passed)
    .map((item) => item.caseId);
  return {
    equivalence: failedCaseIds.length === 0 ? "passed" : "failed",
    failedCaseIds,
    scoreDelta: deltaSummary(cases.map((item) => item.equivalence.maxScoreDelta))
  };
}

function channelsOf(
  captured: CapturedCase,
  query: string,
  records: ReadonlyMap<string, CapturedRecord>
): MemorySearchChannels {
  const channels: CapturedChannels | undefined = captured.channels[query];
  if (channels === undefined)
    throw new Error(`Capture case ${captured.id} has no channels for its effective query.`);
  return channelsOfCaptured(channels, records);
}

const REPLAY_DEPTHS: readonly MemorySearchDepth[] = [0, 1, 2];

/**
 * The funnel input of a case: the channels of every depth, the vectors, the captured scores of the
 * effective query and its query vector. A capture without them (E0 and E2) has no funnel input.
 */
export function funnelInputOf(
  input: Pick<VariantInputSource, "captured" | "records" | "vectors">
): FunnelVariantInput | undefined {
  const { captured, records, vectors } = input;
  const effectiveQuery = captured.interpretation.effectiveQuery;
  const queryVector = captured.queryVectors[effectiveQuery];
  const byDepth = captured.channelsByDepth;
  const scores = captured.recordScores;
  const complete = REPLAY_DEPTHS.every((depth) => byDepth?.[depth] !== undefined);
  if (byDepth === undefined || scores === undefined || !complete) return undefined;
  if (vectors === undefined || queryVector === undefined) return undefined;
  return {
    channelsByDepth: liveChannelsByDepth(byDepth, records),
    vectors,
    catalog: catalogOf(records, vectors),
    queryVector,
    scores: new Map(Object.entries(scores)),
    ftsRecordIds: new Set(lexicalRecordIdsOf(byDepth))
  };
}

/**
 * The catalog of a capture: every identity and passage record, with its group, its layer and its vector.
 * The vector file holds a vector for each of them; a missing one is a broken capture, not a zero.
 */
export function catalogOf(
  records: ReadonlyMap<string, CapturedRecord>,
  vectors: ReadonlyMap<string, readonly number[]>
): Map<string, CatalogRow[]> {
  const byGroup = new Map<string, CatalogRow[]>();
  for (const record of records.values()) {
    if (record.kind !== "identity" && record.kind !== "passage") continue;
    const vector = vectors.get(record.recordId);
    if (vector === undefined)
      throw new Error(`The vector file has no vector for record ${record.recordId}: capture again.`);
    const row: CatalogRow = { recordId: record.recordId, kind: record.kind, layer: record.layer ?? 0, vector };
    byGroup.set(record.threadId, [...(byGroup.get(record.threadId) ?? []), row]);
  }
  return byGroup;
}

function liveChannelsByDepth(
  byDepth: Partial<Record<MemorySearchDepth, CapturedChannels>>,
  records: ReadonlyMap<string, CapturedRecord>
): Partial<Record<MemorySearchDepth, MemorySearchChannels>> {
  return Object.fromEntries(
    REPLAY_DEPTHS.map((depth) => [depth, channelsOfCaptured(capturedAt(byDepth, depth), records)])
  ) as Partial<Record<MemorySearchDepth, MemorySearchChannels>>;
}

function lexicalRecordIdsOf(byDepth: Partial<Record<MemorySearchDepth, CapturedChannels>>): string[] {
  return REPLAY_DEPTHS.flatMap((depth) =>
    capturedAt(byDepth, depth).lexical.map((hit) => hit.recordId)
  );
}

function capturedAt(
  byDepth: Partial<Record<MemorySearchDepth, CapturedChannels>>,
  depth: MemorySearchDepth
): CapturedChannels {
  const channels = byDepth[depth];
  if (channels === undefined) throw new MissingFunnelInputs();
  return channels;
}

/** The channels of one captured text, as the ranking variants read them. Shared by the cases and the synthetic queries. */
export function channelsOfCaptured(
  channels: CapturedChannels,
  records: ReadonlyMap<string, CapturedRecord>
): MemorySearchChannels {
  return {
    identities: channels.identities.map((hit) =>
      memoryHit(hit.recordId, hit.score, records)
    ),
    passages: channels.passages.map((hit) =>
      memoryHit(hit.recordId, hit.score, records)
    ),
    lexical: channels.lexical.map(
      (hit): MemoryLexicalSearchHit => ({
        field: hit.field,
        record: asSearchRecord(recordOf(records, hit.recordId)),
        score: hit.score,
        vectorScore: hit.vectorScore
      })
    )
  };
}

function memoryHit(
  recordId: string,
  score: number,
  records: ReadonlyMap<string, CapturedRecord>
): MemorySearchHit {
  return { record: asSearchRecord(recordOf(records, recordId)), score };
}

function recordOf(
  records: ReadonlyMap<string, CapturedRecord>,
  recordId: string
): CapturedRecord {
  const record = records.get(recordId);
  if (record === undefined) throw new Error(`Capture has no record ${recordId}.`);
  return record;
}

export function recordsById(
  records: readonly CapturedRecord[]
): Map<string, CapturedRecord> {
  return new Map(records.map((record) => [record.recordId, record]));
}

function judgmentsOf(
  dataset: EvalDataset,
  caseId: string
): Record<string, RelevanceGrade> {
  const evalCase = dataset.cases.find((item) => item.id === caseId);
  if (evalCase === undefined) throw new Error(`Dataset has no case ${caseId}.`);
  return evalCase.judgments;
}
