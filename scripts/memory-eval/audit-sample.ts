import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { CaptureFile } from "./capture-types.js";
import type { EvalCase, EvalDataset } from "./dataset.js";
import { resultsForCase } from "./evaluation.js";
import { universeOf, type WorksheetRun } from "./judgments.js";
import type { ReplayResult } from "./replay.js";
import type { MemorySearchDepth } from "../../src/core/memory/types.js";

/** One judgment cell that a merge wrote into the dataset. The merge report lists them in `written`. */
export type MergeWritten = { caseId: string; threadId: string; layer: 0 | 1 | 2; grade: number };

/** The fields of a merge report that the audit needs: the cells it wrote, and whether the merge was clean. */
export type MergeReportFile = {
  written: MergeWritten[];
  alreadyPresent: number;
  conflicts: unknown[];
};

/** Reads a merge report. Refuses a file that is not a merge report with its three fields. */
export function mergeReportOf(value: unknown): MergeReportFile {
  if (typeof value !== "object" || value === null) throw new Error("The merge report must be a JSON object.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.written)) throw new Error("The merge report has no written cells.");
  if (typeof record.alreadyPresent !== "number") throw new Error("The merge report has no alreadyPresent count.");
  if (!Array.isArray(record.conflicts)) throw new Error("The merge report has no conflicts list.");
  return {
    written: record.written as MergeWritten[],
    alreadyPresent: record.alreadyPresent,
    conflicts: record.conflicts
  };
}

/**
 * The judgments of a dataset from before the merge: the current ones minus the cells that the merge wrote.
 * It is exact only for a clean merge, with no cell already present and no conflict; any other report is refused.
 */
export function preMergeDatasetOf(dataset: EvalDataset, report: MergeReportFile): EvalDataset {
  if (report.alreadyPresent !== 0 || report.conflicts.length !== 0)
    throw new Error("The merge report is not a clean append: the judgments from before the merge cannot be rebuilt exactly.");
  return {
    ...dataset,
    cases: dataset.cases.map((evalCase) =>
      withoutWritten(
        evalCase,
        report.written.filter((item) => item.caseId === evalCase.id)
      )
    )
  };
}

function withoutWritten(evalCase: EvalCase, written: readonly MergeWritten[]): EvalCase {
  const summaryWritten = new Set(written.filter((item) => item.layer === 0).map((item) => item.threadId));
  const judgments = Object.fromEntries(
    Object.entries(evalCase.judgments).filter(([threadId]) => !summaryWritten.has(threadId))
  );
  if (evalCase.layerJudgments === undefined) return { ...evalCase, judgments };
  const layerJudgments = { ...evalCase.layerJudgments };
  for (const layer of [1, 2] as const) {
    const grades = evalCase.layerJudgments[layer];
    if (grades === undefined) continue;
    const layerWritten = new Set(written.filter((item) => item.layer === layer).map((item) => item.threadId));
    layerJudgments[layer] = Object.fromEntries(
      Object.entries(grades).filter(([threadId]) => !layerWritten.has(threadId))
    );
  }
  return { ...evalCase, judgments, layerJudgments };
}

/**
 * The audit cases of a capture, with the universe of each case computed from the judgments of before the
 * merge. The sample was drawn before the grades, so this is the universe the manifest froze.
 */
export function auditCasesOf(input: {
  capture: CaptureFile;
  dataset: EvalDataset;
  report: MergeReportFile;
  replay: ReplayResult;
  runs: readonly WorksheetRun[];
  reaches: ReadonlyMap<string, ReadonlyMap<string, MemorySearchDepth>>;
}): AuditCase[] {
  const before = preMergeDatasetOf(input.dataset, input.report);
  return before.cases.map((evalCase) => {
    const universe = universeOf({
      capture: input.capture,
      evalCase,
      replay: input.replay,
      runs: input.runs,
      exhaustive: input.reaches.get(evalCase.id) ?? new Map()
    });
    return { caseId: evalCase.id, universe, externals: externalsOf(input.replay, evalCase.id, universe) };
  });
}

/** Seed of the audit sample. Fixed, so that the sample can be reproduced from its manifest. */
export const AUDIT_SEED = 20261024;
/** Pairs drawn per case from its external candidates; all of them when there are fewer. */
export const AUDIT_PER_CASE = 2;
/** The variants whose full result lists supply the external candidates. */
export const AUDIT_DEPTH_VARIANTS = ["DEPTH0", "DEPTH1", "DEPTH2"] as const;

/** A case of the audit: its universe U, which is the worksheet pool, and its external candidates. */
export type AuditCase = {
  caseId: string;
  universe: readonly string[];
  externals: readonly string[];
};

export type AuditCaseRecord = {
  caseId: string;
  universeSize: number;
  universeSha256: string;
  externalCount: number;
  externals: string[];
  sampled: string[];
};

/** The frozen audit of one capture, written before the worksheet. */
export type AuditManifest = {
  schema: 1;
  seed: number;
  corpus: string;
  captureId: string;
  cases: AuditCaseRecord[];
};

/** Mulberry32: a small seeded generator in [0, 1). The same seed gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Up to `count` candidates drawn without replacement. The candidates are sorted by id before the
 * draw, so the same set always gives the same sample for the same generator state.
 */
export function sampleWithoutReplacement(
  candidates: readonly string[],
  count: number,
  next: () => number
): string[] {
  const pool = [...new Set(candidates)].sort(compareStrings);
  const take = Math.min(count, pool.length);
  for (let index = 0; index < take; index += 1) {
    const offset = index + Math.floor(next() * (pool.length - index));
    const picked = pool[offset];
    const current = pool[index];
    if (picked === undefined || current === undefined) throw new Error("The audit draw left the pool.");
    pool[index] = picked;
    pool[offset] = current;
  }
  return pool.slice(0, take);
}

/** The sha256 of a case universe: its distinct group ids, sorted, as JSON. */
export function universeSha256Of(universe: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([...new Set(universe)].sort(compareStrings)))
    .digest("hex");
}

/** The external candidates of a case: every group of the full lists of the depth variants, outside U. */
export function externalsOf(replay: ReplayResult, caseId: string, universe: readonly string[]): string[] {
  const inside = new Set(universe);
  const listed = AUDIT_DEPTH_VARIANTS.flatMap((variant) =>
    resultsForCase(replay, caseId, variant).map((item) => item.threadId)
  );
  return [...new Set(listed)].filter((groupId) => !inside.has(groupId)).sort(compareStrings);
}

/**
 * Draws the audit sample. The cases are visited in id order, with one generator seeded by AUDIT_SEED,
 * so the sample depends only on the seed and on the universes and externals of the cases.
 */
export function auditSampleOf(input: {
  seed: number;
  corpus: string;
  captureId: string;
  cases: readonly AuditCase[];
}): AuditManifest {
  const next = mulberry32(input.seed);
  const ordered = [...input.cases].sort((left, right) => compareStrings(left.caseId, right.caseId));
  const cases = ordered.map((item): AuditCaseRecord => ({
    caseId: item.caseId,
    universeSize: new Set(item.universe).size,
    universeSha256: universeSha256Of(item.universe),
    externalCount: item.externals.length,
    externals: [...item.externals],
    sampled: sampleWithoutReplacement(item.externals, AUDIT_PER_CASE, next)
  }));
  return { schema: 1, seed: input.seed, corpus: input.corpus, captureId: input.captureId, cases };
}

/**
 * Checks a stored manifest against the current universes and externals. Any change refuses it: the
 * sample was drawn over a universe that the worksheet no longer has.
 */
export function verifyAuditManifest(manifest: AuditManifest, cases: readonly AuditCase[]): void {
  if (manifest.cases.length !== cases.length)
    throw new Error(`The audit manifest has ${manifest.cases.length} cases; the capture has ${cases.length}. Delete it to sample again.`);
  const recorded = new Map(manifest.cases.map((item) => [item.caseId, item] as const));
  for (const item of cases) {
    const record = recorded.get(item.caseId);
    if (record === undefined)
      throw new Error(`The audit manifest has no case ${item.caseId}. Delete it to sample again.`);
    if (record.universeSha256 !== universeSha256Of(item.universe))
      throw new Error(`The universe of case ${item.caseId} changed since the audit manifest. Delete it to sample again.`);
    if (!sameList(record.externals, item.externals))
      throw new Error(`The external candidates of case ${item.caseId} changed since the audit manifest.`);
  }
}

/**
 * The audit manifest of a capture: read and verified when it exists, drawn and written when it does
 * not. A stored manifest is never drawn again.
 */
export async function readOrCreateAuditManifest(input: {
  file: string;
  seed: number;
  corpus: string;
  captureId: string;
  cases: readonly AuditCase[];
}): Promise<AuditManifest> {
  const stored = await readOptional(input.file);
  if (stored === undefined) {
    const manifest = auditSampleOf(input);
    await fs.writeFile(input.file, `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  }
  const manifest = JSON.parse(stored) as AuditManifest;
  if (manifest.seed !== input.seed || manifest.corpus !== input.corpus || manifest.captureId !== input.captureId)
    throw new Error(`${input.file} belongs to another seed, corpus or capture.`);
  verifyAuditManifest(manifest, input.cases);
  return manifest;
}

/**
 * The groups that the complement scores: for each case, the groups of its cosine rows in the worksheet.
 * The sampled groups of the audit are listed beside them, for traceability; they are not complemented twice.
 */
export type ComplementGroupsFile = {
  schema: 1;
  corpus: string;
  captureId: string;
  source: { worksheetMeta: string; auditSample: string; auditSampleSha256: string };
  cases: Record<string, string[]>;
  sampled: Record<string, string[]>;
};

export function complementGroupsOf(input: {
  corpus: string;
  captureId: string;
  caseIds: readonly string[];
  rows: ReadonlyArray<{ caseId: string; threadId: string; choice: string }>;
  manifest: AuditManifest;
  auditSampleSha256: string;
}): ComplementGroupsFile {
  const sampled = sampledByCaseOf(input.manifest);
  const cases: Record<string, string[]> = {};
  const sampledOut: Record<string, string[]> = {};
  for (const caseId of [...input.caseIds].sort(compareStrings)) {
    const groups = input.rows
      .filter((row) => row.caseId === caseId && row.choice === "cosine")
      .map((row) => row.threadId);
    cases[caseId] = [...new Set(groups)].sort(compareStrings);
    sampledOut[caseId] = [...(sampled.get(caseId) ?? [])].sort(compareStrings);
  }
  return {
    schema: 1,
    corpus: input.corpus,
    captureId: input.captureId,
    source: {
      worksheetMeta: "worksheet-meta.json",
      auditSample: "audit-sample.json",
      auditSampleSha256: input.auditSampleSha256
    },
    cases,
    sampled: sampledOut
  };
}

/** The sampled pairs of a manifest, by case id. */
export function sampledByCaseOf(manifest: AuditManifest): Map<string, string[]> {
  return new Map(manifest.cases.map((item) => [item.caseId, item.sampled] as const));
}

/** The median of a list of numbers, or null for an empty list. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

async function readOptional(file: string): Promise<string | undefined> {
  return fs.readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function compareStrings(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}
