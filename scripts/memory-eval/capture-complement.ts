import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RERANK_BATCH_SIZE } from "../../src/core/memory/model-config.js";
import { semanticRerankingDocument } from "../../src/core/memory/semantic-ranking.js";
import type { RerankingProvider } from "../../src/core/memory/types.js";
import { E3_RERANK_ORDER } from "./capture-layers.js";
import { knownGroupIdsOf } from "./capture-scope.js";
import { CAPTURE_FILE, writeCaptureFile, writeCapturedCase } from "./capture-storage.js";
import {
  asSearchRecord,
  type CaptureFile,
  type CapturedCase,
  type CapturedRecord
} from "./capture-types.js";
import type { EvalDataset } from "./dataset.js";
import {
  COUNT_LIMIT_HOURS,
  appendOnlyProblems,
  complementRoundOf,
  countPlanOf,
  type ComplementRound
} from "./matrix-plan.js";
import { rerankPairKey } from "./recording-providers.js";

/**
 * Pairs per second that the reranker scored at in the T-captura of the marc corpus. The complement
 * counts its hours at this observed rate, which is the conservative one.
 */
export const COMPLEMENT_PAIRS_PER_SECOND = 8.06;

/** The groups to complement, by case id. Their identity and passage records join the matrix of the case. */
export type ComplementTargets = ReadonlyMap<string, ReadonlySet<string>>;

export type ComplementSummary = {
  round: number;
  perCase: Array<{ caseId: string; pairs: number }>;
  addedPairs: number;
};

/** The count of a complement, before any scoring. Nothing is written. */
export type ComplementCount = {
  round: number;
  /** Records that the round would add to the matrix. */
  addedRecords: number;
  /** Pairs that the reranker would score: the distinct new pair texts of each case. */
  scoredPairs: number;
  hours: number;
  refused: boolean;
  perCase: Array<{ caseId: string; addedRecords: number; scoredPairs: number }>;
};

/** The complement input: the targets, or the judged dataset whose groups of degree two or more are the targets. */
export type ComplementInput = {
  captureDir: string;
  targets?: ComplementTargets;
  judged?: EvalDataset;
};

function targetsOf(input: ComplementInput): ComplementTargets {
  if (input.targets !== undefined) return input.targets;
  if (input.judged !== undefined) return targetsOfJudged(input.judged);
  throw new Error("The complement needs its targets or the judged dataset.");
}

/** The targets of the judged dataset: the groups that reach degree two or more in it. */
export function targetsOfJudged(judged: EvalDataset): ComplementTargets {
  return new Map(judged.cases.map((evalCase) => [evalCase.id, knownGroupIdsOf(evalCase)] as const));
}

/**
 * Adds the pairs of the records of the target groups that the capture does not hold yet. It never
 * overwrites a score: a key that exists keeps its value, whether it is a recordId or a pair text, and a
 * new pair whose text is already scored reuses that score without a new reranker call. The changed cases
 * are written back to capture.json and to their case files, so that a resume reads the complemented cells.
 * The round is appended to the log of the capture, with the pair keys it scored.
 */
export async function complementCapture(input: ComplementInput & { reranker: RerankingProvider }): Promise<ComplementSummary> {
  const targets = targetsOf(input);
  const capture = await readCaptureFile(input.captureDir);
  const round = lastRoundOf(capture.complementRounds ?? []) + 1;
  const planned = capture.cases.map((captured) => plannedCase(capture, captured, targets, round));
  const count = countPlanOf(
    planned.map((item) => item.round.addedRecordIds.length),
    COMPLEMENT_PAIRS_PER_SECOND
  );
  if (count.refused) {
    throw new Error(
      `The complement counts ${count.totalPairs} pairs, ${count.hours.toFixed(2)} h, above the ${COUNT_LIMIT_HOURS} h limit. Nothing was scored.`
    );
  }
  for (const item of planned) {
    await scoreAdded(capture, item.captured, item.round, input.reranker);
  }
  for (const item of planned) {
    await writeCapturedCase(input.captureDir, item.captured);
  }
  const previous = capture.complementRounds ?? [];
  const rounds = planned.map((item) => item.round);
  const next = [...previous, ...rounds];
  const problems = appendOnlyProblems(previous, next);
  if (problems.length > 0) throw new Error(problems.join("; "));
  await writeCaptureFile(input.captureDir, { ...capture, complementRounds: next });
  return {
    round,
    perCase: rounds.map((item) => ({ caseId: item.caseId, pairs: item.addedRecordIds.length })),
    addedPairs: count.totalPairs
  };
}

/** The count of a complement round, before any scoring: the records it adds and the pairs it would score. */
export async function complementCountOf(input: ComplementInput): Promise<ComplementCount> {
  const targets = targetsOf(input);
  const capture = await readCaptureFile(input.captureDir);
  const round = lastRoundOf(capture.complementRounds ?? []) + 1;
  const planned = capture.cases.map((captured) => plannedCase(capture, captured, targets, round));
  const perCase = planned.map((item) => ({
    caseId: item.captured.id,
    addedRecords: item.round.addedRecordIds.length,
    scoredPairs: newKeysOf(capture, item.captured, item.round).length
  }));
  const count = countPlanOf(
    perCase.map((item) => item.scoredPairs),
    COMPLEMENT_PAIRS_PER_SECOND
  );
  return {
    round,
    addedRecords: perCase.reduce((total, item) => total + item.addedRecords, 0),
    scoredPairs: count.totalPairs,
    hours: count.hours,
    refused: count.refused,
    perCase
  };
}

async function readCaptureFile(captureDir: string): Promise<CaptureFile> {
  return JSON.parse(await fs.readFile(path.join(captureDir, CAPTURE_FILE), "utf8")) as CaptureFile;
}

function lastRoundOf(rounds: readonly ComplementRound[]): number {
  return rounds.reduce((last, item) => Math.max(last, item.round), 0);
}

function plannedCase(
  capture: CaptureFile,
  captured: CapturedCase,
  targets: ComplementTargets,
  round: number
): { captured: CapturedCase; round: ComplementRound } {
  const groups = targets.get(captured.id);
  if (groups === undefined) throw new Error(`The complement targets have no case ${captured.id}.`);
  if (captured.recordScores === undefined)
    throw new Error(`Case ${captured.id} has no E3 scores: only an E3 capture can be complemented.`);
  const scope = scopeOfGroups(capture.records, groups);
  return {
    captured,
    round: complementRoundOf({
      round,
      caseId: captured.id,
      held: new Set(Object.keys(captured.recordScores)),
      scope
    })
  };
}

/** The identity and passage records of the given groups, as record ids. */
function scopeOfGroups(records: readonly CapturedRecord[], groupIds: ReadonlySet<string>): Set<string> {
  return new Set(
    records
      .filter((record) => groupIds.has(record.threadId) && (record.kind === "identity" || record.kind === "passage"))
      .map((record) => record.recordId)
  );
}

/** The distinct pair keys of a round that the case does not score yet: the pairs the reranker would score. */
function newKeysOf(capture: CaptureFile, captured: CapturedCase, round: ComplementRound): string[] {
  const query = captured.interpretation.effectiveQuery;
  const added = recordsOf(capture, round.addedRecordIds);
  const documents = added.map((record) => semanticRerankingDocument(asSearchRecord(record)));
  const keys = documents.map((document) => rerankPairKey(query, document));
  return pendingOf(keys, documents, captured.rerankScores).map((item) => item.key);
}

async function scoreAdded(
  capture: CaptureFile,
  captured: CapturedCase,
  round: ComplementRound,
  reranker: RerankingProvider
): Promise<void> {
  round.addedKeys = [];
  if (round.addedRecordIds.length === 0) return;
  const query = captured.interpretation.effectiveQuery;
  const added = recordsOf(capture, round.addedRecordIds);
  const documents = added.map((record) => semanticRerankingDocument(asSearchRecord(record)));
  const keys = documents.map((document) => rerankPairKey(query, document));
  const pending = pendingOf(keys, documents, captured.rerankScores);
  round.addedKeys = pending.map((item) => item.key);
  const scores = await scoreDocuments(reranker, query, pending.map((item) => item.document));
  const fresh = Object.fromEntries(pending.map((item, index) => [item.key, scores[index]]));
  captured.rerankScores = { ...fresh, ...captured.rerankScores };
  const recordEntries = added
    .map((record, index) => [record.recordId, captured.rerankScores[keys[index]]] as const)
    .filter(([recordId]) => captured.recordScores?.[recordId] === undefined);
  captured.recordScores = { ...captured.recordScores, ...Object.fromEntries(recordEntries) };
}

/** The distinct pairs whose text has no score yet. A text that repeats is scored once. */
export function pendingOf(
  keys: readonly string[],
  documents: readonly string[],
  known: Readonly<Record<string, number>>
): Array<{ key: string; document: string }> {
  const seen = new Set<string>();
  return keys.flatMap((key, index) => {
    if (Object.hasOwn(known, key) || seen.has(key)) return [];
    seen.add(key);
    return [{ key, document: documents[index] }];
  });
}

async function scoreDocuments(reranker: RerankingProvider, query: string, documents: string[]): Promise<number[]> {
  if (documents.length === 0) return [];
  const scores = await reranker.rerank(query, documents, DEFAULT_RERANK_BATCH_SIZE, E3_RERANK_ORDER);
  if (scores.length !== documents.length)
    throw new Error("The reranker returned an unexpected score count for the complement.");
  return scores;
}

function recordsOf(capture: CaptureFile, recordIds: readonly string[]): CapturedRecord[] {
  const byId = new Map(capture.records.map((record) => [record.recordId, record]));
  return recordIds.map((recordId) => {
    const record = byId.get(recordId);
    if (record === undefined) throw new Error(`Capture has no record ${recordId}.`);
    return record;
  });
}
