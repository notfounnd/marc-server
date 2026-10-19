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
  type EvalDataset,
  type RelevanceGrade,
  type ValidationIssue
} from "./dataset.js";
import { resultsForCase } from "./evaluation.js";
import { LIST_DEPTH, VARIANT_PLANS, reachEntries } from "./metrics.js";
import type { ReplayResult } from "./replay.js";
import { rerankPairKey } from "./recording-providers.js";
import { quadraticKappa } from "./statistics.js";
import type { VariantResult } from "./variants.js";

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
};

export type WorksheetThread = {
  threadId: string;
  title: string;
  section: string;
  sectionText: string;
  snippetSection: string;
  snippet: string;
};

export type WorksheetCase = { caseId: string; query: string; threads: WorksheetThread[] };

export type Worksheet = {
  cases: WorksheetCase[];
  template: Record<string, Record<string, null>>;
  pending: number;
  markdown: string;
};

export type Rater = Record<string, Record<string, RelevanceGrade>>;

export type Divergence = { caseId: string; threadId: string; a: number; b: number };
export type Conflict = { caseId: string; threadId: string; existing: number; proposed: number };

export type MergeReport = {
  pairs: number;
  kappa: number | null;
  concordant: number;
  divergences: Divergence[];
  unresolved: Divergence[];
  written: Array<{ caseId: string; threadId: string; grade: number }>;
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
    ...sources.variantReach
  ];
  return [...new Set(union)].sort(compareStrings);
}

export function poolSourcesFor(input: {
  capture: CaptureFile;
  captured: CapturedCase;
  replay: ReplayResult;
  judgments: Record<string, RelevanceGrade>;
  variants: string[];
}): PoolSources {
  const records = recordsById(input.capture);
  const resultsOf = (variant: string): VariantResult[] =>
    resultsForCase(input.replay, input.captured.id, variant);
  return {
    m0Admitted: resultsOf("M0").filter((item) => item.admitted).map((item) => item.threadId),
    d0Top: resultsOf("D0").slice(0, LIST_DEPTH).map((item) => item.threadId),
    identity: identityTop(input.captured, records),
    reranker: rerankerTop(input.captured, records),
    judged: Object.keys(input.judgments),
    variantReach: input.variants.flatMap((variant) => variantReachThreads(resultsOf(variant), variant))
  };
}

/**
 * Builds the worksheet of the pending pairs. Refuses when the corpus content
 * no longer matches the capture, because the sections and snippets would not
 * describe the judged threads.
 */
export async function buildWorksheet(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  replay: ReplayResult;
  source: CorpusSource;
  variants: string[];
}): Promise<Worksheet> {
  const digest = await corpusContentDigest(input.source);
  if (digest !== input.capture.corpusDigest)
    throw new Error("The corpus changed since the capture. Capture again before writing the worksheet.");
  const records = recordsById(input.capture);
  const cases: WorksheetCase[] = [];
  for (const evalCase of input.dataset.cases) {
    const captured = capturedCaseOf(input.capture, evalCase.id);
    const pool = poolOf(
      poolSourcesFor({
        capture: input.capture,
        captured,
        replay: input.replay,
        judgments: evalCase.judgments,
        variants: input.variants
      })
    );
    const pending = pool.filter((threadId) => !Object.hasOwn(evalCase.judgments, threadId));
    const threads: WorksheetThread[] = [];
    for (const threadId of pending) {
      threads.push(await worksheetThread(input.source.threadsRoot, threadId, records, captured));
    }
    cases.push({ caseId: evalCase.id, query: evalCase.query, threads });
  }
  return {
    cases,
    template: templateOf(cases),
    pending: cases.reduce((total, item) => total + item.threads.length, 0),
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
    for (const [threadId, grade] of Object.entries(threads)) {
      if (!corpus.has(threadId)) throw new Error(`${name}: thread ${threadId} is not in the pinned corpus.`);
      if (!isGrade(grade))
        throw new Error(`${name}: invalid grade ${JSON.stringify(grade)} for ${caseId}/${threadId}; use an integer from 0 to 3.`);
      rater[caseId][threadId] = grade;
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
  const consensusGradeOf = (item: Divergence): number | undefined => consensus[item.caseId]?.[item.threadId];
  const unresolved = divergences.filter((item) => consensusGradeOf(item) === undefined);
  const finalGrades = [
    ...concordant.map((pair) => ({ caseId: pair.caseId, threadId: pair.threadId, grade: pair.a })),
    ...divergences.flatMap((item) => {
      const grade = consensusGradeOf(item);
      return grade === undefined ? [] : [{ caseId: item.caseId, threadId: item.threadId, grade }];
    })
  ];

  const written: MergeReport["written"] = [];
  const conflicts: Conflict[] = [];
  let alreadyPresent = 0;
  const additions = new Map<string, Record<string, RelevanceGrade>>();
  for (const item of finalGrades) {
    const existing = dataset.cases.find((evalCase) => evalCase.id === item.caseId)?.judgments ?? {};
    if (!Object.hasOwn(existing, item.threadId)) {
      written.push(item);
      additions.set(item.caseId, { ...additions.get(item.caseId), [item.threadId]: item.grade as RelevanceGrade });
      continue;
    }
    if (existing[item.threadId] === item.grade) {
      alreadyPresent += 1;
      continue;
    }
    conflicts.push({
      caseId: item.caseId,
      threadId: item.threadId,
      existing: existing[item.threadId] ?? 0,
      proposed: item.grade
    });
  }

  const merged: EvalDataset = {
    ...dataset,
    cases: dataset.cases.map((evalCase) => ({
      ...evalCase,
      judgments: sortedJudgments({ ...evalCase.judgments, ...additions.get(evalCase.id) })
    }))
  };
  const issues = validateDataset(merged, corpus).issues;
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
      judgments: sortedJudgments(evalCase.judgments)
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

function rerankerTop(captured: CapturedCase, records: ReadonlyMap<string, CapturedRecord>): string[] {
  const best = new Map<string, number>();
  for (const [recordId, score] of matrixScores(captured, records)) {
    const threadId = threadOf(records, recordId);
    best.set(threadId, Math.max(best.get(threadId) ?? Number.NEGATIVE_INFINITY, score));
  }
  return rankThreads(best).slice(0, RERANKER_TOP);
}

/** Matrix score of every identity and passage record for the effective query of the case. */
function matrixScores(captured: CapturedCase, records: ReadonlyMap<string, CapturedRecord>): Map<string, number> {
  const query = captured.interpretation.effectiveQuery;
  const scores = new Map<string, number>();
  for (const record of records.values()) {
    if (record.kind !== "identity" && record.kind !== "passage") continue;
    const score = captured.rerankScores[rerankPairKey(query, semanticRerankingDocument(asSearchRecord(record)))];
    if (score === undefined)
      throw new Error(`Capture case ${captured.id} has no matrix score for ${record.recordId}.`);
    scores.set(record.recordId, score);
  }
  return scores;
}

/** The passage with the best reranker score for the thread; the identity record when the thread has no passage. */
function bestPassage(
  captured: CapturedCase,
  records: ReadonlyMap<string, CapturedRecord>,
  threadId: string
): CapturedRecord {
  const scores = matrixScores(captured, records);
  const passages = [...records.values()].filter((record) => record.threadId === threadId && record.kind === "passage");
  const candidates = passages.length > 0
    ? passages
    : [...records.values()].filter((record) => record.threadId === threadId && record.kind === "identity");
  let best = candidates[0];
  for (const record of candidates) {
    const score = scores.get(record.recordId) ?? Number.NEGATIVE_INFINITY;
    if (best === undefined || score > (scores.get(best.recordId) ?? Number.NEGATIVE_INFINITY)) best = record;
  }
  if (best === undefined) throw new Error(`Thread ${threadId} has no records in the capture.`);
  return best;
}

async function worksheetThread(
  threadsRoot: string,
  threadId: string,
  records: ReadonlyMap<string, CapturedRecord>,
  captured: CapturedCase
): Promise<WorksheetThread> {
  const summary = await fs.readFile(path.join(threadsRoot, threadId, "SUMMARY.md"), "utf8");
  const section = firstSection(summary);
  const passage = bestPassage(captured, records, threadId);
  return {
    threadId,
    title: titleOf(records, threadId),
    section: section.title,
    sectionText: section.text,
    snippetSection: passage.sectionTitle ?? "Resumo",
    snippet: passage.text
  };
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
        `### ${thread.threadId}`,
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

function templateOf(cases: WorksheetCase[]): Record<string, Record<string, null>> {
  const template: Record<string, Record<string, null>> = {};
  for (const item of cases) {
    if (item.threads.length === 0) continue;
    template[item.caseId] = Object.fromEntries(item.threads.map((thread) => [thread.threadId, null]));
  }
  return template;
}

function pairsOf(first: Rater, second: Rater): Array<{ caseId: string; threadId: string; a: number; b: number }> {
  return entriesOf(first).flatMap((entry) => {
    const other = second[entry.caseId]?.[entry.threadId];
    if (other === undefined) return [];
    return [{ caseId: entry.caseId, threadId: entry.threadId, a: entry.grade, b: other }];
  });
}

function entriesOf(rater: Rater): Array<{ caseId: string; threadId: string; grade: number }> {
  return Object.entries(rater).flatMap(([caseId, threads]) =>
    Object.entries(threads).map(([threadId, grade]) => ({ caseId, threadId, grade }))
  );
}

function sameCell(left: { caseId: string; threadId: string }, right: { caseId: string; threadId: string }): boolean {
  return left.caseId === right.caseId && left.threadId === right.threadId;
}

function sortedJudgments(judgments: Record<string, RelevanceGrade>): Record<string, RelevanceGrade> {
  return Object.fromEntries(Object.entries(judgments).sort(([left], [right]) => compareStrings(left, right)));
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
