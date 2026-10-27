import fs from "node:fs/promises";
import path from "node:path";
import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import {
  asSearchRecord,
  type CaptureFile,
  type CapturedCase,
  type CapturedRecord
} from "./capture-types.js";
import { corpusContentDigest, type CorpusSource } from "./corpus.js";
import {
  validateDataset,
  type CorpusIndex,
  type EvalCase,
  type EvalDataset,
  type JudgedLayer,
  type LayerJudgments,
  type RelevanceGrade,
  type ValidationIssue,
  isNonThreadGroup
} from "./dataset.js";
import { judgedDepthOfCase, resultsForCase } from "./evaluation.js";
import { LIST_DEPTH, VARIANT_PLANS, reachEntries } from "./metrics.js";
import { presentLayersOf, requiredLayersOf, saturatedOf } from "./required-cells.js";
import type { ReplayResult } from "./replay.js";
import { rerankPairKey } from "./recording-providers.js";
import { selectRerankPassages, type FunnelRow } from "../../src/core/memory/funnel-selection.js";
import { quadraticKappa } from "./statistics.js";
import type { VariantResult } from "./variants.js";
import type { MemorySearchDepth } from "../../src/core/memory/types.js";

/**
 * One judged cell: a group in a layer. Layer 0 cells are the case's `judgments`; layers 1 and 2
 * are its `layerJudgments`. The group id is the thread id for a thread.
 */
export type Cell = { groupId: string; layer: JudgedLayer | 0 };

const LAYERED_KEY = /^layer([12]):(.*)$/;

/** Key of a cell in a rater file: the group id for layer 0, `layer<L>:<groupId>` otherwise. */
export function cellKeyOf(cell: Cell): string {
  if (cell.layer === 0) return cell.groupId;
  return `layer${cell.layer}:${cell.groupId}`;
}

/** Reads a rater key back into its cell. A thread id never starts with `layer1:` or `layer2:`. */
export function cellOf(key: string): Cell {
  const match = LAYERED_KEY.exec(key);
  if (match === null) return { groupId: key, layer: 0 };
  return { groupId: match[2] ?? "", layer: Number(match[1]) as JudgedLayer };
}

/** The grade that a case holds for a cell, when the cell is judged. */
export function gradeOfCell(evalCase: EvalCase, cell: Cell): RelevanceGrade | undefined {
  const judgments = cell.layer === 0 ? evalCase.judgments : (evalCase.layerJudgments?.[cell.layer] ?? {});
  return judgments[cell.groupId];
}

/** Agreement below this value is flagged in the merge report. */
export const KAPPA_THRESHOLD = 0.6;
/** Identity hits and reranker threads that enter the worksheet pool. */
export const IDENTITY_TOP = 5;
export const RERANKER_TOP = 5;

export type PoolSources = {
  m0Admitted: string[];
  d0Top: string[];
  identity: string[];
  reranker: string[];
  judged: string[];
  variantReach: string[];
  /** Groups that an exhaustive run requested, at any step. */
  exhaustive?: string[];
  /** Externals sampled by the audit: they enter the pool only as the reference depth, never in U. */
  audited?: string[];
};

/** One pending cell of the worksheet: its group (`threadId`), its layer, and the best evidence there. */
export type WorksheetThread = {
  threadId: string;
  layer: JudgedLayer | 0;
  title: string;
  section: string;
  sectionText: string;
  snippetSection: string;
  snippet: string;
  /** How the passage was chosen: by its reranker score, by cosine when the capture has none, or no passage. */
  choice: WorksheetChoice;
};

export type WorksheetCase = { caseId: string; query: string; threads: WorksheetThread[] };

/** Pending pairs of the worksheet, by layer. */
export type PendingByLayer = { 0: number; 1: number; 2: number };

/** How a row's passage was chosen. The worksheet shows nothing of it; the internal metadata keeps it. */
export type WorksheetChoice = "score" | "cosine" | "none";

/** The internal record of one row: never written into worksheet.md nor into the template. */
export type WorksheetMeta = {
  caseId: string;
  threadId: string;
  layer: JudgedLayer | 0;
  choice: WorksheetChoice;
};

export type Worksheet = {
  cases: WorksheetCase[];
  meta: WorksheetMeta[];
  template: Record<string, Record<string, null>>;
  pending: number;
  pendingByLayer: PendingByLayer;
  /** Rows whose passage has no reranker score in this capture. */
  unscored: number;
  /** The audit sample: sampled pairs, and the pending cells that come only from them. */
  audit: { pairs: number; cells: number };
  /** Layer cells that the summary saturation dispensed, and that were not graded. */
  saturationRemoved: number;
  markdown: string;
};

/** A replay and the funnel variants that it ran, for one point of the worksheet grid. */
export type WorksheetRun = { replay: ReplayResult; variants: string[] };

/** The passage that stands for a group in a layer, and whether the capture scored it. */
export type BestPassage = { record: CapturedRecord; scored: boolean };

/** What a passage choice reads for one case. */
type CaseContext = {
  records: ReadonlyMap<string, CapturedRecord>;
  captured: CapturedCase;
  scores: ReadonlyMap<string, number>;
  vectors: ReadonlyMap<string, readonly number[]>;
};

/** Grades of one rater, by case and cell key (see cellKeyOf). */
export type Rater = Record<string, Record<string, RelevanceGrade>>;

export type Divergence = { caseId: string; threadId: string; layer: JudgedLayer | 0; a: number; b: number };
export type Conflict = {
  caseId: string;
  threadId: string;
  layer: JudgedLayer | 0;
  existing: number;
  proposed: number;
};

export type MergeReport = {
  pairs: number;
  kappa: number | null;
  concordant: number;
  divergences: Divergence[];
  unresolved: Divergence[];
  written: Array<{ caseId: string; threadId: string; layer: JudgedLayer | 0; grade: number }>;
  alreadyPresent: number;
  conflicts: Conflict[];
  issues: ValidationIssue[];
  flags: string[];
};

export type MergeOutcome = { report: MergeReport; merged: EvalDataset };

/** Threads of one variant that must be judged, through the same reach rule used by the metrics. */
export function variantReachThreads(results: VariantResult[], variant: string): string[] {
  const plan = VARIANT_PLANS[variant];
  if (plan === undefined) throw new Error(`Unknown ranking variant: ${variant}`);
  return reachEntries({ results }, plan.requireAdmitted).map((entry) => entry.threadId);
}

/** Union of the worksheet sources, in alphabetical order of thread id. The source of each thread is not kept. */
export function poolOf(sources: PoolSources): string[] {
  const union = [
    ...sources.m0Admitted,
    ...sources.d0Top,
    ...sources.identity,
    ...sources.reranker,
    ...sources.judged,
    ...sources.variantReach,
    ...(sources.exhaustive ?? []),
    ...(sources.audited ?? [])
  ];
  return [...new Set(union)].sort(compareStrings);
}

export function poolSourcesFor(input: {
  capture: CaptureFile;
  captured: CapturedCase;
  /** The base replay: M0 and D0 are read from it. */
  replay: ReplayResult;
  /** Every run of the worksheet, the base one included, with the variants whose reach it adds. */
  runs: readonly WorksheetRun[];
  judgments: Record<string, RelevanceGrade>;
  exhaustive: ReadonlyMap<string, MemorySearchDepth>;
  scores: ReadonlyMap<string, number>;
}): PoolSources {
  const records = recordsById(input.capture);
  const caseId = input.captured.id;
  const resultsOf = (variant: string): VariantResult[] => completeResultsOf(input.replay, caseId, variant);
  return {
    m0Admitted: resultsOf("M0").filter((item) => item.admitted).map((item) => item.threadId),
    d0Top: resultsOf("D0").slice(0, LIST_DEPTH).map((item) => item.threadId),
    identity: identityTop(input.captured, records),
    reranker: rerankerTop(input.scores, records),
    judged: Object.keys(input.judgments),
    variantReach: input.runs.flatMap((run) =>
      run.variants.flatMap((variant) =>
        variantReachThreads(completeResultsOf(run.replay, caseId, variant), variant)
      )
    ),
    exhaustive: [...input.exhaustive.keys()]
  };
}

/**
 * The universe U of a case: the worksheet pool before the audit. The audit draws its external
 * candidates from the full lists of the depth variants, outside U.
 */
export function universeOf(input: {
  capture: CaptureFile;
  evalCase: EvalCase;
  replay: ReplayResult;
  runs: readonly WorksheetRun[];
  exhaustive: ReadonlyMap<string, MemorySearchDepth>;
}): string[] {
  const captured = capturedCaseOf(input.capture, input.evalCase.id);
  return poolOf(
    poolSourcesFor({
      capture: input.capture,
      captured,
      replay: input.replay,
      runs: input.runs,
      judgments: judgedGroupsOf(input.evalCase),
      exhaustive: input.exhaustive,
      scores: scoredRecordsOf(captured, recordsById(input.capture), complementedKeysOf(input.capture, captured.id))
    })
  );
}

/**
 * Builds the worksheet of the pending pairs. Refuses when the corpus content
 * no longer matches the capture, because the sections and snippets would not
 * describe the judged threads. The base replay holds M0, D0 and the variants
 * without funnel parameters; the grid runs hold the funnel variants, and the
 * reach of a case is the union over all of them.
 */
export async function buildWorksheet(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  replay: ReplayResult;
  source: CorpusSource;
  variants: string[];
  grid?: WorksheetRun[];
  /** Exhaustive reach of the adaptive variants, by case id (see exhaustiveReachOf). */
  reaches?: ReadonlyMap<string, ReadonlyMap<string, MemorySearchDepth>>;
  /** Vector of every record of the capture. Only the cosine fallback of a passage without score reads it. */
  vectors?: ReadonlyMap<string, readonly number[]>;
  /** The audit sample: the externals drawn for each case, by case id. They are judged at the reference depth. */
  audited?: ReadonlyMap<string, readonly string[]>;
}): Promise<Worksheet> {
  const digest = await corpusContentDigest(input.source);
  if (digest !== input.capture.corpusDigest)
    throw new Error("The corpus changed since the capture. Capture again before writing the worksheet.");
  const records = recordsById(input.capture);
  const runs: WorksheetRun[] = [{ replay: input.replay, variants: input.variants }, ...(input.grid ?? [])];
  const reaches = input.reaches ?? new Map<string, ReadonlyMap<string, MemorySearchDepth>>();
  const vectors = input.vectors ?? new Map<string, readonly number[]>();
  const audited = input.audited ?? new Map<string, readonly string[]>();
  let saturationRemoved = 0;
  let auditPairs = 0;
  let auditCells = 0;
  const cases: WorksheetCase[] = [];
  for (const evalCase of input.dataset.cases) {
    const captured = capturedCaseOf(input.capture, evalCase.id);
    const scores = scoredRecordsOf(captured, records);
    const universeScores = scoredRecordsOf(captured, records, complementedKeysOf(input.capture, captured.id));
    const exhaustive: ReadonlyMap<string, MemorySearchDepth> = reaches.get(evalCase.id) ?? new Map();
    const sources = poolSourcesFor({
      capture: input.capture,
      captured,
      replay: input.replay,
      runs,
      judgments: judgedGroupsOf(evalCase),
      exhaustive,
      scores: universeScores
    });
    const sampled = [...(audited.get(evalCase.id) ?? [])];
    const pool = poolOf({ ...sources, audited: sampled });
    const pending = pendingCellsOf({
      evalCase,
      pool,
      runs,
      exhaustive,
      audited: sampled,
      captureRecords: input.capture.records
    });
    const cells = pending.cells;
    saturationRemoved += pending.saturationRemoved;
    auditPairs += sampled.length;
    auditCells += cells.filter((cell) => sampled.includes(cell.groupId)).length;
    const context: CaseContext = { records, captured, scores, vectors };
    const threads: WorksheetThread[] = [];
    for (const cell of cells) {
      threads.push(await worksheetRow(input.source.threadsRoot, cell, context));
    }
    cases.push({ caseId: evalCase.id, query: evalCase.query, threads });
  }
  return {
    cases,
    template: templateOf(cases),
    pending: cases.reduce((total, item) => total + item.threads.length, 0),
    pendingByLayer: pendingByLayerOf(cases),
    unscored: cases.reduce((total, item) => total + item.threads.filter((thread) => thread.choice === "cosine").length, 0),
    meta: cases.flatMap((item) =>
      item.threads.map((thread) => ({ caseId: item.caseId, threadId: thread.threadId, layer: thread.layer, choice: thread.choice }))
    ),
    audit: { pairs: auditPairs, cells: auditCells },
    saturationRemoved,
    markdown: renderWorksheet(cases)
  };
}

/** Parses and checks a rater file: known cases, pinned threads and integer grades from 0 to 3. */
export function parseRater(value: unknown, name: string, dataset: EvalDataset, corpus: CorpusIndex): Rater {
  if (!isRecord(value)) throw new Error(`${name} must be an object keyed by case id.`);
  const rater: Rater = {};
  for (const [caseId, threads] of Object.entries(value)) {
    const known = dataset.cases.some((item) => item.id === caseId);
    if (!known) throw new Error(`${name}: unknown case ${caseId}.`);
    if (!isRecord(threads)) throw new Error(`${name}: case ${caseId} must be an object keyed by thread id.`);
    rater[caseId] = {};
    for (const [key, grade] of Object.entries(threads)) {
      const cell = cellOf(key);
      // Layer 1 and 2 groups are checked against the pinned corpus by the dataset validation.
      if (cell.layer === 0 && !corpus.has(cell.groupId))
        throw new Error(`${name}: thread ${cell.groupId} is not in the pinned corpus.`);
      if (!isGrade(grade))
        throw new Error(`${name}: invalid grade ${JSON.stringify(grade)} for ${caseId}/${key}; use an integer from 0 to 3.`);
      rater[caseId][key] = grade;
    }
  }
  return rater;
}

/**
 * Merges two raters. Concordant pairs are written; divergences are listed and
 * only written when the consensus resolves them. An existing grade is never
 * overwritten: a different grade is reported as a conflict. The merged dataset
 * is validated before anything can be written.
 */
export function mergeJudgments(input: {
  dataset: EvalDataset;
  corpus: CorpusIndex;
  /** Pinned corpus files by path, for the evidence quotes of the merged cases. */
  sources: ReadonlyMap<string, string>;
  raterA: unknown;
  raterB: unknown;
  consensus?: unknown;
}): MergeOutcome {
  const { dataset, corpus } = input;
  const first = parseRater(input.raterA, "rater A", dataset, corpus);
  const second = parseRater(input.raterB, "rater B", dataset, corpus);
  const consensus =
    input.consensus === undefined ? {} : parseRater(input.consensus, "consensus", dataset, corpus);

  const pairs = pairsOf(first, second);
  const divergences = pairs.filter((pair) => pair.a !== pair.b);
  const concordant = pairs.filter((pair) => pair.a === pair.b);
  for (const entry of entriesOf(consensus)) {
    const divergent = divergences.some((item) => sameCell(item, entry));
    if (!divergent)
      throw new Error(`consensus touches ${entry.caseId}/${entry.threadId}, which is not a divergent pair.`);
  }
  const consensusGradeOf = (item: Divergence): number | undefined =>
    consensus[item.caseId]?.[cellKeyOf({ groupId: item.threadId, layer: item.layer })];
  const unresolved = divergences.filter((item) => consensusGradeOf(item) === undefined);
  const finalGrades: Array<{ caseId: string; threadId: string; layer: JudgedLayer | 0; grade: number }> = [
    ...concordant.map((pair) => ({ caseId: pair.caseId, threadId: pair.threadId, layer: pair.layer, grade: pair.a })),
    ...divergences.flatMap((item) => {
      const grade = consensusGradeOf(item);
      return grade === undefined ? [] : [{ caseId: item.caseId, threadId: item.threadId, layer: item.layer, grade }];
    })
  ];

  const written: MergeReport["written"] = [];
  const conflicts: Conflict[] = [];
  let alreadyPresent = 0;
  const additions = new Map<string, Array<{ cell: Cell; grade: RelevanceGrade }>>();
  for (const item of finalGrades) {
    const cell: Cell = { groupId: item.threadId, layer: item.layer };
    const evalCase = dataset.cases.find((candidate) => candidate.id === item.caseId);
    const existing = evalCase === undefined ? undefined : gradeOfCell(evalCase, cell);
    if (existing === undefined) {
      written.push(item);
      additions.set(item.caseId, [
        ...(additions.get(item.caseId) ?? []),
        { cell, grade: item.grade as RelevanceGrade }
      ]);
      continue;
    }
    if (existing === item.grade) {
      alreadyPresent += 1;
      continue;
    }
    conflicts.push({
      caseId: item.caseId,
      threadId: item.threadId,
      layer: item.layer,
      existing,
      proposed: item.grade
    });
  }

  const merged: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) => withCellGrades(evalCase, additions.get(evalCase.id) ?? []))
  };
  const issues = validateDataset(merged, corpus, input.sources).issues;
  const kappa = quadraticKappa(pairs.map((pair) => [pair.a, pair.b]));
  const flags: string[] = [];
  if (kappa !== null && kappa < KAPPA_THRESHOLD) flags.push("kappa_below_threshold");
  return {
    report: {
      pairs: pairs.length,
      kappa,
      concordant: concordant.length,
      divergences,
      unresolved,
      written,
      alreadyPresent,
      conflicts,
      issues,
      flags
    },
    merged
  };
}

/**
 * Canonical text of a dataset file: two-space JSON, judgments with sorted keys
 * and one trailing newline. Every write of a dataset goes through it, so that
 * later merges produce minimal diffs.
 */
export function serializeDataset(dataset: EvalDataset): string {
  const canonical: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) => ({
      ...evalCase,
      judgments: sortedJudgments(evalCase.judgments),
      layerJudgments: withLayerGrades(evalCase.layerJudgments, [])
    }))
  };
  return `${JSON.stringify(canonical, null, 2)}\n`;
}

/** Writes the merged dataset only when validation passes and at least one pair is new. */
export async function commitMerge(input: { datasetPath: string; outcome: MergeOutcome }): Promise<boolean> {
  const { report, merged } = input.outcome;
  if (report.issues.length > 0 || report.written.length === 0) return false;
  await fs.writeFile(input.datasetPath, serializeDataset(merged));
  return true;
}

export async function writeMergeReport(directory: string, report: MergeReport, now: Date): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(directory, `merge-${stamp}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`);
  return filePath;
}

function identityTop(captured: CapturedCase, records: ReadonlyMap<string, CapturedRecord>): string[] {
  const channels = channelsOf(captured);
  const best = new Map<string, number>();
  for (const hit of channels.identities) {
    const threadId = threadOf(records, hit.recordId);
    best.set(threadId, Math.max(best.get(threadId) ?? Number.NEGATIVE_INFINITY, hit.score));
  }
  return rankThreads(best).slice(0, IDENTITY_TOP);
}

function rerankerTop(scores: ReadonlyMap<string, number>, records: ReadonlyMap<string, CapturedRecord>): string[] {
  const best = new Map<string, number>();
  for (const [recordId, score] of scores) {
    const threadId = threadOf(records, recordId);
    best.set(threadId, Math.max(best.get(threadId) ?? Number.NEGATIVE_INFINITY, score));
  }
  return rankThreads(best).slice(0, RERANKER_TOP);
}

/**
 * Reranker score of each identity and passage record that the capture scored for the effective query.
 * A record outside the closed scope of the case has no score: it is left out, never read as zero.
 */
export function scoredRecordsOf(
  captured: CapturedCase,
  records: ReadonlyMap<string, CapturedRecord>,
  excluded: ReadonlySet<string> = new Set()
): Map<string, number> {
  const query = captured.interpretation.effectiveQuery;
  const scores = new Map<string, number>();
  for (const record of records.values()) {
    if (record.kind !== "identity" && record.kind !== "passage") continue;
    const key = rerankPairKey(query, semanticRerankingDocument(asSearchRecord(record)));
    if (excluded.has(key)) continue;
    const score = captured.rerankScores[key];
    if (score === undefined) continue;
    scores.set(record.recordId, score);
  }
  return scores;
}

/**
 * The pair keys that the complement rounds scored for a case, after the capture. The universe of the
 * worksheet is read without them, so that a complement never moves the pool nor the audit manifest.
 */
export function complementedKeysOf(capture: CaptureFile, caseId: string): Set<string> {
  return new Set(
    (capture.complementRounds ?? [])
      .filter((round) => round.caseId === caseId)
      .flatMap((round) => round.addedKeys ?? [])
  );
}

/** Every group that a case judges, in any layer: the keys that the pool may take. */
function judgedGroupsOf(evalCase: EvalCase): Record<string, RelevanceGrade> {
  return {
    ...evalCase.judgments,
    ...evalCase.layerJudgments?.[1],
    ...evalCase.layerJudgments?.[2]
  };
}

/**
 * The results of a variant on a case, from a replay that must have completed the variant. An incomplete
 * variant has no results, so its groups would leave the worksheet without a trace; the worksheet refuses.
 */
function completeResultsOf(replay: ReplayResult, caseId: string, variant: string): VariantResult[] {
  const output = replay.cases.find((item) => item.caseId === caseId)?.variants.find((item) => item.variant === variant);
  if (output === undefined) throw new Error(`The replay holds no ${variant} for case ${caseId}.`);
  if (output.incomplete !== undefined)
    throw new Error(
      `Variant ${variant} is incomplete for case ${caseId} (${output.incomplete.reason}). The worksheet needs the capture vectors and the funnel parameters.`
    );
  return resultsForCase(replay, caseId, variant);
}

/** The deepest layer whose judgments grade each group: the largest depth of a variant that reaches it. */
/** The depth at which the audit judges its sampled pairs: the reference depth of the audit. */
const AUDIT_DEPTH = 2 as MemorySearchDepth;

function reachDepthsOf(input: {
  evalCase: EvalCase;
  runs: readonly WorksheetRun[];
  exhaustive: ReadonlyMap<string, MemorySearchDepth>;
  audited: readonly string[];
}): Map<string, MemorySearchDepth> {
  const depths = new Map<string, MemorySearchDepth>();
  for (const run of input.runs) {
    for (const variant of run.variants) {
      const results = completeResultsOf(run.replay, input.evalCase.id, variant);
      const depth = judgedDepthOfCase(run.replay, input.evalCase.id, variant);
      for (const groupId of variantReachThreads(results, variant)) {
        depths.set(groupId, Math.max(depths.get(groupId) ?? 0, depth) as MemorySearchDepth);
      }
    }
  }
  for (const [groupId, depth] of input.exhaustive) {
    depths.set(groupId, Math.max(depths.get(groupId) ?? 0, depth) as MemorySearchDepth);
  }
  for (const groupId of input.audited) {
    depths.set(groupId, Math.max(depths.get(groupId) ?? 0, AUDIT_DEPTH) as MemorySearchDepth);
  }
  return depths;
}

/**
 * The cells that a case still needs. Layer 0 of every pool group is asked, as before. Layer 1 or 2
 * is asked when a variant reaches the group at that depth or deeper, and the capture holds passages
 * of the group in that layer. A cell is pending while it has no grade.
 */
export function pendingCellsOf(input: {
  evalCase: EvalCase;
  pool: string[];
  runs: readonly WorksheetRun[];
  exhaustive: ReadonlyMap<string, MemorySearchDepth>;
  audited: readonly string[];
  captureRecords: readonly CapturedRecord[];
}): { cells: Cell[]; saturationRemoved: number } {
  const depths = reachDepthsOf(input);
  const present = presentLayersOf(input.captureRecords);
  const cells: Cell[] = [];
  let saturationRemoved = 0;
  for (const groupId of input.pool) {
    const reached = depths.get(groupId) ?? 0;
    const layersPresent = new Set(present[groupId] ?? [0]);
    const saturated = saturatedOf(input.evalCase.judgments, groupId);
    const plain = requiredLayersOf(groupId, reached, layersPresent);
    const required = requiredLayersOf(groupId, reached, layersPresent, saturated);
    for (const layer of plain) {
      const dispensed = !required.includes(layer);
      if (dispensed && gradeOfCell(input.evalCase, { groupId, layer }) === undefined) saturationRemoved += 1;
    }
    for (const layer of required) {
      const cell: Cell = { groupId, layer };
      if (gradeOfCell(input.evalCase, cell) === undefined) cells.push(cell);
    }
  }
  return { cells, saturationRemoved };
}

/** The worksheet row of one cell: a summary section for layer 0, the best passage of the layer otherwise. */
/** The worksheet row of one cell: a summary section for layer 0, the best passage of the layer otherwise. */
async function worksheetRow(threadsRoot: string, cell: Cell, context: CaseContext): Promise<WorksheetThread> {
  if (cell.layer === 0) return worksheetThread(threadsRoot, cell.groupId, context);
  const best = bestPassage(context, cell.groupId, cell.layer);
  return {
    threadId: cell.groupId,
    layer: cell.layer,
    title: titleOf(context.records, cell.groupId),
    section: best?.record.sectionTitle ?? "",
    sectionText: "",
    snippetSection: best?.record.sourcePath ?? "",
    snippet: best?.record.text ?? "",
    choice: choiceOf(best)
  };
}

/**
 * The passage that stands for the group in the layer. Layer 0 falls back to the identity record when
 * the group has no passage; the other layers have passages only. See bestPassageOf for the choice.
 */
function bestPassage(context: CaseContext, threadId: string, layer: JudgedLayer | 0): BestPassage | undefined {
  return bestPassageOf({
    candidates: candidatesOf(context.records, threadId, layer),
    scores: context.scores,
    queryVector: context.captured.queryVectors[context.captured.interpretation.effectiveQuery],
    vectors: context.vectors
  });
}

/**
 * The passage that stands for a group in a layer. The best scored candidate wins: the highest score,
 * and then the lower record id on a tie. When no candidate has a score, the funnel's own cosine
 * selection picks the candidate closest to the query, and the choice is marked unscored. A candidate
 * is never given a zero score.
 */
export function bestPassageOf(input: {
  candidates: readonly CapturedRecord[];
  scores: ReadonlyMap<string, number>;
  queryVector: readonly number[] | undefined;
  vectors: ReadonlyMap<string, readonly number[]>;
}): BestPassage | undefined {
  if (input.candidates.length === 0) return undefined;
  const scored = input.candidates.filter((record) => input.scores.has(record.recordId));
  if (scored.length > 0) return { record: bestScoredOf(scored, input.scores), scored: true };
  return { record: cosineChoiceOf(input), scored: false };
}

/** How a row's passage was chosen: by score, by cosine, or no passage at all. */
function choiceOf(best: BestPassage | undefined): WorksheetChoice {
  if (best === undefined) return "none";
  return best.scored ? "score" : "cosine";
}

/** The highest score first; on a tie, the lower record id. Expects at least one record. */
function bestScoredOf(records: readonly CapturedRecord[], scores: ReadonlyMap<string, number>): CapturedRecord {
  const ranked = [...records].sort(
    (left, right) =>
      (scores.get(right.recordId) ?? 0) - (scores.get(left.recordId) ?? 0) ||
      compareStrings(left.recordId, right.recordId)
  );
  const [best] = ranked;
  if (best === undefined) throw new Error("A scored choice needs at least one scored candidate.");
  return best;
}

/** The candidate with the highest cosine to the query, through the funnel's own selection. */
function cosineChoiceOf(input: {
  candidates: readonly CapturedRecord[];
  queryVector: readonly number[] | undefined;
  vectors: ReadonlyMap<string, readonly number[]>;
}): CapturedRecord {
  if (input.queryVector === undefined) throw new Error("The capture has no query vector for its effective query.");
  const rows: FunnelRow[] = input.candidates.map((record): FunnelRow => ({
    recordId: record.recordId,
    kind: record.kind === "passage" ? "passage" : "identity",
    vector: vectorOf(input.vectors, record.recordId)
  }));
  const [chosen] = selectRerankPassages(input.queryVector, rows, 1, "cosine");
  const best = input.candidates.find((record) => record.recordId === chosen);
  if (best === undefined) throw new Error("The cosine selection chose no candidate.");
  return best;
}

/** The records of a group in a layer: its passages, or for layer 0 without passages, its identity. */
function candidatesOf(
  records: ReadonlyMap<string, CapturedRecord>,
  threadId: string,
  layer: JudgedLayer | 0
): CapturedRecord[] {
  const inLayer = [...records.values()].filter(
    (record) => record.threadId === threadId && (record.layer ?? 0) === layer
  );
  const passages = inLayer.filter((record) => record.kind === "passage");
  if (passages.length > 0 || layer !== 0) return passages;
  return inLayer.filter((record) => record.kind === "identity");
}

function vectorOf(vectors: ReadonlyMap<string, readonly number[]>, recordId: string): readonly number[] {
  const vector = vectors.get(recordId);
  if (vector === undefined) throw new Error(`Capture has no vector for ${recordId}.`);
  return vector;
}

async function worksheetThread(threadsRoot: string, threadId: string, context: CaseContext): Promise<WorksheetThread> {
  const summary = await fs.readFile(path.join(threadsRoot, threadId, "SUMMARY.md"), "utf8");
  const section = firstSection(summary);
  const best = bestPassage(context, threadId, 0);
  if (best === undefined) throw new Error(`Thread ${threadId} has no records in the capture.`);
  return {
    threadId,
    layer: 0,
    title: titleOf(context.records, threadId),
    section: section.title,
    sectionText: section.text,
    snippetSection: best.record.sectionTitle ?? "Resumo",
    snippet: best.record.text,
    choice: choiceOf(best)
  };
}

function pendingByLayerOf(cases: WorksheetCase[]): PendingByLayer {
  const counts: PendingByLayer = { 0: 0, 1: 0, 2: 0 };
  for (const thread of cases.flatMap((item) => item.threads)) counts[thread.layer] += 1;
  return counts;
}


/** First `##` section of a summary: its title and the first three non-empty lines of its body. */
export function firstSection(markdown: string): { title: string; text: string } {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("## "));
  if (start < 0) return { title: "", text: "" };
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (line.trim().length > 0) body.push(line.trim());
  }
  return { title: (lines[start] ?? "").slice(3).trim(), text: body.slice(0, 3).join(" ") };
}

function renderWorksheet(cases: WorksheetCase[]): string {
  const lines = [
    "# Planilha de julgamento",
    "",
    "Escala: 0 não relevante; 1 menção incidental; 2 relevante, mas não é a fonte principal; 3 responde à pergunta.",
    "",
    "Preencha worksheet-template.json com um grau inteiro de 0 a 3 para cada par.",
    ""
  ];
  const withThreads = cases.filter((item) => item.threads.length > 0);
  if (withThreads.length === 0) lines.push("Nenhum par pendente.", "");
  for (const item of withThreads) {
    lines.push(`## ${item.caseId}`, "", `Consulta: ${item.query}`, "");
    for (const thread of item.threads) {
      lines.push(
        `### ${headingOf(thread)}`,
        "",
        `Título: ${thread.title}`,
        `Seção: ${thread.section}. ${thread.sectionText}`,
        `Trecho (${thread.snippetSection}): ${thread.snippet}`,
        ""
      );
    }
  }
  return lines.join("\n");
}

/** Heading of a worksheet row: the group id, and the layer when the row is not layer 0. */
function headingOf(thread: WorksheetThread): string {
  if (thread.layer === 0) return thread.threadId;
  return `${thread.threadId} (camada ${thread.layer})`;
}

function templateOf(cases: WorksheetCase[]): Record<string, Record<string, null>> {
  const template: Record<string, Record<string, null>> = {};
  for (const item of cases) {
    if (item.threads.length === 0) continue;
    template[item.caseId] = Object.fromEntries(
      item.threads.map((thread) => [cellKeyOf({ groupId: thread.threadId, layer: thread.layer }), null])
    );
  }
  return template;
}

type RaterEntry = { caseId: string; threadId: string; layer: JudgedLayer | 0; grade: number };

function pairsOf(first: Rater, second: Rater): Array<RaterEntry & { a: number; b: number }> {
  return entriesOf(first).flatMap((entry) => {
    const other = second[entry.caseId]?.[cellKeyOf({ groupId: entry.threadId, layer: entry.layer })];
    if (other === undefined) return [];
    return [{ ...entry, a: entry.grade, b: other }];
  });
}

function entriesOf(rater: Rater): RaterEntry[] {
  return Object.entries(rater).flatMap(([caseId, cells]) =>
    Object.entries(cells).map(([key, grade]) => {
      const cell = cellOf(key);
      return { caseId, threadId: cell.groupId, layer: cell.layer, grade };
    })
  );
}

function sameCell(
  left: { caseId: string; threadId: string; layer: JudgedLayer | 0 },
  right: { caseId: string; threadId: string; layer: JudgedLayer | 0 }
): boolean {
  return left.caseId === right.caseId && left.threadId === right.threadId && left.layer === right.layer;
}

function sortedJudgments(judgments: Record<string, RelevanceGrade>): Record<string, RelevanceGrade> {
  return Object.fromEntries(Object.entries(judgments).sort(([left], [right]) => compareStrings(left, right)));
}

/**
 * Layers 1 and 2 with their groups sorted and the additions applied. Undefined when neither the case
 * nor the additions have a layer judgment, so that datasets in the old format keep their shape.
 */
function withLayerGrades(
  layers: LayerJudgments | undefined,
  additions: ReadonlyArray<{ cell: Cell; grade: RelevanceGrade }>
): LayerJudgments | undefined {
  const merged: LayerJudgments = {};
  for (const layer of [1, 2] as const) {
    const grades = { ...(layers?.[layer] ?? {}), ...gradesOfLayer(additions, layer) };
    if (Object.keys(grades).length > 0) merged[layer] = sortedJudgments(grades);
  }
  return Object.keys(merged).length === 0 ? undefined : merged;
}

function gradesOfLayer(
  additions: ReadonlyArray<{ cell: Cell; grade: RelevanceGrade }>,
  layer: JudgedLayer | 0
): Record<string, RelevanceGrade> {
  const entries = additions
    .filter((item) => item.cell.layer === layer)
    .map((item) => [item.cell.groupId, item.grade] as const);
  return Object.fromEntries(entries);
}

/** The case with the added cells: layer 0 in `judgments`, layers 1 and 2 in `layerJudgments`. */
function withCellGrades(
  evalCase: EvalCase,
  additions: ReadonlyArray<{ cell: Cell; grade: RelevanceGrade }>
): EvalCase {
  const judgments = sortedJudgments({ ...evalCase.judgments, ...gradesOfLayer(additions, 0) });
  const layerJudgments = withLayerGrades(evalCase.layerJudgments, additions);
  return layerJudgments === undefined
    ? { ...evalCase, judgments }
    : { ...evalCase, judgments, layerJudgments };
}

function capturedCaseOf(capture: CaptureFile, caseId: string): CapturedCase {
  const captured = capture.cases.find((item) => item.id === caseId);
  if (captured === undefined) throw new Error(`The capture has no case ${caseId}.`);
  return captured;
}

function channelsOf(captured: CapturedCase) {
  const channels = captured.channels[captured.interpretation.effectiveQuery];
  if (channels === undefined) throw new Error(`Capture case ${captured.id} has no channels for its effective query.`);
  return channels;
}

function recordsById(capture: CaptureFile): Map<string, CapturedRecord> {
  return new Map(capture.records.map((record) => [record.recordId, record]));
}

function threadOf(records: ReadonlyMap<string, CapturedRecord>, recordId: string): string {
  const record = records.get(recordId);
  if (record === undefined) throw new Error(`Capture has no record ${recordId}.`);
  return record.threadId;
}

function titleOf(records: ReadonlyMap<string, CapturedRecord>, threadId: string): string {
  return [...records.values()].find((record) => record.threadId === threadId)?.title ?? threadId;
}

function rankThreads(scores: Map<string, number>): string[] {
  return [...scores]
    .sort(([leftId, leftScore], [rightId, rightScore]) => rightScore - leftScore || compareStrings(leftId, rightId))
    .map(([threadId]) => threadId);
}

function isGrade(value: unknown): value is RelevanceGrade {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareStrings(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}
